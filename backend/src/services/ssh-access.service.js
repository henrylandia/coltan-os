'use strict'
const fs = require('fs')
const { exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)

const SSHD_CONFIG = '/etc/ssh/sshd_config'
const SSHD_BACKUP = '/etc/ssh/sshd_config.coltan.bak'

// sshd usa la PRIMERA aparicion de una directiva; si no esta, el default de OpenSSH es prohibit-password
function readRootLogin() {
  let content = ''
  try { content = fs.readFileSync(SSHD_CONFIG, 'utf8') } catch (e) { return null }
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*PermitRootLogin\s+(\S+)/i)
    if (m) return m[1].toLowerCase()
  }
  return 'prohibit-password'
}

async function getStatus() {
  const raw = readRootLogin()
  let running = false
  try { await execAsync('service sshd onestatus'); running = true } catch (e) {}
  return { rootLogin: raw === 'yes', raw, running }
}

async function setRootLogin(enabled) {
  const wanted = enabled ? 'yes' : 'no'
  const original = fs.readFileSync(SSHD_CONFIG, 'utf8')
  const out = []
  let placed = false
  for (const line of original.split('\n')) {
    if (/^\s*#?\s*PermitRootLogin\s+/i.test(line)) {
      if (!placed) { out.push('PermitRootLogin ' + wanted); placed = true }
      continue
    }
    out.push(line)
  }
  // Al principio del archivo para que nunca quede dentro de un bloque Match
  if (!placed) out.unshift('PermitRootLogin ' + wanted)

  fs.writeFileSync(SSHD_BACKUP, original)
  fs.writeFileSync(SSHD_CONFIG, out.join('\n'))
  try {
    await execAsync('/usr/sbin/sshd -t')
  } catch (e) {
    fs.writeFileSync(SSHD_CONFIG, original)
    throw new Error('La configuracion de SSH no es valida, se restauro la anterior')
  }
  const st = await getStatus()
  if (st.running) await execAsync('service sshd reload')
  return getStatus()
}

module.exports = { getStatus, setRootLogin }
