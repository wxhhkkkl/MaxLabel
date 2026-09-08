(async () => {
  const base = 'http://127.0.0.1:8420'
  const post = async (p, b, h) => (await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(h || {}) }, body: JSON.stringify(b) })).json()
  let r = await post('/api/auth/register', { email: 'utf8@maxlabel.cn', password: 'abcdef' })
  if (!r.token) {
    r = await post('/api/auth/login', { email: 'utf8@maxlabel.cn', password: 'abcdef' })
  }
  const h = { Authorization: 'Bearer ' + r.token }
  const saved = await post('/api/cloud/templates', { name: '快递面单 100x150', data: '{"w":100}' }, h)
  console.log('saved:', saved.id ? 'PASS' : 'FAIL', JSON.stringify(saved))
  const list = await (await fetch(base + '/api/cloud/templates', { headers: h })).json()
  console.log('list:', Array.isArray(list) ? 'PASS (' + list.length + ')' : 'FAIL')
  const one = await (await fetch(base + '/api/cloud/templates/' + saved.id, { headers: h })).json()
  console.log('one:', one.name === '快递面单 100x150' ? 'PASS' : 'FAIL', JSON.stringify(one))
  const del = await (await fetch(base + '/api/cloud/templates/' + saved.id, { method: 'DELETE', headers: h })).json()
  console.log('del:', del.ok === true ? 'PASS' : 'FAIL', JSON.stringify(del))
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
