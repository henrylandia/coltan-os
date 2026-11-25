'use strict'
// Retencion automatica de las tablas de analytics. Corre 2 minutos despues de arrancar
// y despues una vez por dia, sin que nadie entre al panel.
const NOISE = ['malicious_ip', 'scan']
const BATCH = 5000
const DAYS = { noise: 14, other: 90, panel: 30, dns: 30, traffic: 90 }

async function del(db, table, col, cutoff, extra) {
  const stmt = db.prepare(`DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE ${col} < ? ${extra} LIMIT ${BATCH})`)
  let total = 0
  for (;;) {
    const r = stmt.run(cutoff)
    total += r.changes
    if (r.changes < BATCH) break
    await new Promise(res => setImmediate(res))
  }
  return total
}

async function prune() {
  const db = require('./db.service').getDB()
  const now = Math.floor(Date.now() / 1000)
  const cut = d => now - d * 86400
  const list = NOISE.map(k => `'${k}'`).join(',')
  const jobs = [
    ['noise', 'attack_log', 'detected_at', cut(DAYS.noise), `AND threat_key IN (${list})`],
    ['other', 'attack_log', 'detected_at', cut(DAYS.other), `AND (threat_key IS NULL OR threat_key NOT IN (${list}))`],
    ['panel', 'panel_access_log', 'accessed_at', cut(DAYS.panel), ''],
    ['dns', 'dns_queries', 'queried_at', cut(DAYS.dns), ''],
    ['traffic', 'traffic_samples', 'sampled_at', cut(DAYS.traffic), '']
  ]
  const out = {}
  for (const [k, table, col, cutoff, extra] of jobs) {
    try { out[k] = await del(db, table, col, cutoff, extra) } catch (e) { out[k] = 'error: ' + e.message }
  }
  try { db.pragma('wal_checkpoint(TRUNCATE)') } catch (e) {}
  return out
}

function start() {
  const run = () => prune()
    .then(r => console.log('[Retention]', JSON.stringify(r)))
    .catch(e => console.error('[Retention] Error:', e.message))
  setTimeout(run, 2 * 60 * 1000)
  setInterval(run, 24 * 60 * 60 * 1000)
}

module.exports = { prune, start }
