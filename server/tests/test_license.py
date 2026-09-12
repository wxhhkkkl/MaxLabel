import unittest
import tempfile
from pathlib import Path
from threading import Barrier
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from server.app.database import Base, License
from server.app.routers.license import ActivateIn, _claim_machine, _not_expired, activate


class LicenseExpiryTests(unittest.TestCase):
    def test_missing_expiry_is_permanent(self):
        self.assertTrue(_not_expired(SimpleNamespace(expires_at=None)))

    def test_malformed_expiry_fails_closed(self):
        self.assertFalse(_not_expired(SimpleNamespace(expires_at="not-a-date")))

    def test_naive_iso_expiry_is_treated_as_utc(self):
        self.assertTrue(_not_expired(SimpleNamespace(expires_at="2999-01-01T00:00:00")))


class LicenseBindingTests(unittest.TestCase):
    def test_second_machine_cannot_take_first_binding_on_sqlite(self):
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(engine)
        session = sessionmaker(bind=engine, expire_on_commit=False)()
        try:
            session.add(License(key="ABCD1234", holder="test", edition="standard", status="active"))
            session.commit()
            request = SimpleNamespace(client=SimpleNamespace(host="license-test"))
            activate(request, ActivateIn(key="ABCD1234", machine_id="machine-001"), session)
            with self.assertRaises(HTTPException) as error:
                activate(request, ActivateIn(key="ABCD1234", machine_id="machine-002"), session)
            self.assertEqual(error.exception.status_code, 400)
            self.assertEqual(session.query(License).one().machine_id, "machine-001")
        finally:
            session.close()
            engine.dispose()

    def test_atomic_claim_allows_only_one_machine_on_concurrent_sqlite_sessions(self):
        with tempfile.TemporaryDirectory() as directory:
            db_path = Path(directory) / 'license.db'
            engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False, "timeout": 5})
            Base.metadata.create_all(engine)
            seed = sessionmaker(bind=engine, expire_on_commit=False)()
            seed.add(License(key="WXYZ5678", holder="test", edition="standard", status="active"))
            seed.commit()
            license_id = seed.query(License).one().id
            seed.close()
            ready = Barrier(2)

            def claim(machine_id):
                session = sessionmaker(bind=engine, expire_on_commit=False)()
                try:
                    ready.wait()
                    won = _claim_machine(session, license_id, machine_id, "2999-01-01T00:00:00+00:00")
                    session.commit()
                    return won
                finally:
                    session.close()

            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(claim, ["machine-101", "machine-202"]))
            check = sessionmaker(bind=engine, expire_on_commit=False)()
            try:
                self.assertEqual(sum(results), 1)
                self.assertIn(check.query(License).one().machine_id, {"machine-101", "machine-202"})
            finally:
                check.close()
                engine.dispose()


if __name__ == "__main__":
    unittest.main()
