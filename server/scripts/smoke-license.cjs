/* 服务端 license API 冒烟：激活/复查/换机拒绝/无效 key */
;(async () => {
  const base = 'http://127.0.0.1:8420'
  const post = async (p, b) => {
    const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
    const d = await r.json().catch(() => ({}))
    return { status: r.status, ...d }
  }
  const KEY = '5361-F10B-FBBD-9355'
  const M1 = 'mach-A-1111-2222-3333'
  const M2 = 'mach-B-9999-8888-7777'

  let p = await post('/api/license/activate', { key: KEY, machine_id: M1 })
  console.log('激活(M1):', p.status === 200 && p.ok && p.active && p.edition === 'pro' ? 'PASS' : 'FAIL', JSON.stringify(p))

  p = await post('/api/license/activate', { key: KEY, machine_id: M1 })
  console.log('重复激活(M1) 幂等:', p.ok ? 'PASS' : 'FAIL')

  p = await post('/api/license/check', { key: KEY, machine_id: M1 })
  console.log('复查(M1):', p.ok && p.active ? 'PASS' : 'FAIL')

  p = await post('/api/license/check', { key: KEY, machine_id: M2 })
  console.log('换机复查(M2) 应拒绝:', p.status === 400 ? 'PASS' : 'FAIL', p.detail)

  p = await post('/api/license/activate', { key: 'AAAA-BBBB-CCCC-DDDD', machine_id: M1 })
  console.log('无效key 应拒绝:', p.status === 400 ? 'PASS' : 'FAIL', p.detail)
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
