'use strict'
// Test cases when an encryption key has not been defined.

const tap = require('tap')
const common = require('./common')

tap.test('expiresIn is set', (context) => {
  context.test('should throw an error', (t) => {
    t.plan(2)
    common.createServer({expiresIn: 100})
      .catch((err) => {
        t.type(err, Error)
        t.match(err.message, /requires the "key" option/)
      })
  })

  context.end()
})

tap.test('when cookie is present', (context) => {
  context.test('and cookie is valid', (validContext) => {
    validContext.test('should load session and not set cookie', (t) => {
      t.plan(3)
      let server
      common.createServer()
        .then((s) => {
          server = s
          return common.injectWithCookie(server)
        })
        .then((res) => {
          t.is(res.request.session.test, '1')
          t.is(res.statusCode, 200)
          t.notOk(res.headers['set-cookie'])
          server.stop()
        })
        .catch(t.threw)
    })

    validContext.test('should load session and not set cookie when session is modified', (t) => {
      t.plan(3)
      let server
      common.createServer()
        .then((s) => {
          server = s
          return common.injectWithCookieAndvalue(server)
        })
        .then((res) => {
          t.is(res.request.session.test, '2')
          t.is(res.statusCode, 200)
          t.notOk(res.headers['set-cookie'])
          server.stop()
        })
        .catch(t.threw)
    })

    validContext.end()
  })

  context.test('and cookie is invalid', (invalidContext) => {
    invalidContext.test('should create session and set new cookie', (t) => {
      t.plan(4)
      let server
      common.createServer()
        .then((s) => {
          server = s
          return common.inject(server, {cookie: 'easySession=abcd'})
        }) // too short
        .then((res) => {
          t.deepEqual(res.request.session, {})
          t.is(res.statusCode, 200)
          t.ok(res.headers['set-cookie'])
          t.match(res.headers['set-cookie'], common.cookieRegex)
          server.stop()
        })
        .catch(t.threw)
    })

    invalidContext.end()
  })

  context.end()
})
