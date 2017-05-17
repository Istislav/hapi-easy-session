'use strict'

const test = require('tap').test
const common = require('./common')

test('ignores specified regex paths', (t) => {
  t.plan(2)
  let server
  common.createServer({expiresIn: 1000, key: 'test', ignorePaths: [/\/foo/]})
    .then((s) => {
      server = s
      return server.inject({url: '/foo'})
    })
    .then((res) => {
      t.notOk(res.request.session)
      t.is(res.result, 'foo')
      server.stop()
    })
    .catch(t.threw)
})

test('ignores specified string paths', (t) => {
  t.plan(2)
  let server
  common.createServer({expiresIn: 1000, key: 'test', ignorePaths: ['/foo']})
    .then((s) => {
      server = s
      return server.inject({url: '/foo'})
    })
    .then((res) => {
      t.notOk(res.request.session)
      t.is(res.result, 'foo')
      server.stop()
    })
    .catch(t.threw)
})

test('ignores specified mixed paths', (t) => {
  t.plan(2)
  let server
  common.createServer({expiresIn: 1000, key: 'test', ignorePaths: [/\/bar/, '/foo']})
    .then((s) => {
      server = s
      return server.inject({url: '/foo'})
    })
    .then((res) => {
      t.notOk(res.request.session)
      t.is(res.result, 'foo')
      server.stop()
    })
    .catch(t.threw)
})
