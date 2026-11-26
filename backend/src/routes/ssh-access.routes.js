'use strict'
const ssh = require('../services/ssh-access.service')

module.exports = async function (fastify) {
  fastify.get('/api/settings/ssh', { onRequest: [fastify.authenticate] }, async () => ssh.getStatus())

  fastify.post('/api/settings/ssh', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    try {
      return await ssh.setRootLogin(!!(req.body && req.body.rootLogin))
    } catch (e) {
      return reply.code(500).send({ error: e.message })
    }
  })
}
