'use strict'

const Hapi = require('hapi')
const plugin = require('../session')
const cookieRegex = /[\w]+=[%0-9A-Za-z_-]+; Secure; HttpOnly/

function createServer (options) {
  const server = new Hapi.Server()
  server.connection({
    host: 'localhost',
    address: '127.0.0.1'
  })

  server.route({
    method: 'GET',
    path: '/',
    handler: function slash (request, reply) {
      if (request.query.test) {
        request.session.test = request.query.test
      }
      reply(request.session.test)
    }
  })

  server.route({
    method: 'GET',
    path: '/foo',
    handler: function fooRoute (request, reply) {
      reply('foo')
    }
  })

  const plugins = [{
    register: plugin,
    options: options
  }]

  return new Promise((resolve, reject) => {
    server.register(plugins, (err) => {
      if (err) {
        return reject(err)
      }
      server.start(() => {
        resolve(server)
      })
    })
  })
}

function extractCookie (res) {
  const cookie = res.headers['set-cookie'][0]
  return cookie.slice(0, cookie.indexOf(';'))
}

function inject (server, options) {
  options = options || {}
  const url = options.value ? '/?test=' + options.value : '/'
  const headers = options.cookie ? {cookie: options.cookie} : {}
  return server.inject({url: url, headers: headers})
}

function injectWithValue (server) {
  return inject(server, {value: '1'})
}

function injectWithCookie (server) {
  return injectWithValue(server)
    .then((res) => inject(server, {cookie: extractCookie(res)}))
}

function injectWithCookieAndvalue (server) {
  return injectWithValue(server)
    .then((res) => inject(server, {cookie: extractCookie(res), value: '2'}))
}

module.exports = {
  cookieRegex,
  createServer,
  extractCookie,
  inject,
  injectWithValue,
  injectWithCookie,
  injectWithCookieAndvalue
}
