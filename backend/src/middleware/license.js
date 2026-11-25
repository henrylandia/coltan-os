'use strict'

// Coltan OS es libre: todas las funciones estan habilitadas, sin licencia.
function getLicenseStatus() {
  return { active: true, licenseStatus: 'free_open' }
}

function isPremiumEndpoint() {
  return false
}

function licenseMiddleware(request, reply, done) {
  done()
}

module.exports = { licenseMiddleware, getLicenseStatus, isPremiumEndpoint }
