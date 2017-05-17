'use strict'
// Test cases when an encryption key has been defined.

const tap = require('tap')
const common = require('./common')

tap.test('when no cookie is present', (context) => {
  context.test('creates a session and sets cookie', (t) => {
    t.plan(5)
    let server
    common.createServer({expiresIn: 1000, key: 'test'})
      .then((s) => {
        server = s
        return common.injectWithValue(server)
      })
      .then((res) => {
        t.ok(res.request.session.test)
        t.is(res.request.session.test, '1')
        t.is(res.statusCode, 200)
        t.ok(res.headers['set-cookie'])
        t.match(res.headers['set-cookie'], common.cookieRegex)
        server.stop()
      })
      .catch(t.threw)
  })

  context.test('should reply with internal server error when creating id fails', (t) => {
    t.plan(1)
    let server
    common.createServer({algorithm: 'invalid', expiresIn: 1000, key: 'test'})
      .then((s) => {
        server = s
        return common.injectWithValue(server)
      })
      .then((res) => {
        t.is(res.statusCode, 500)
        server.stop()
      })
      .catch(t.threw)
  })

  context.test('should reply with internal server error when cache is unavailable', (t) => {
    t.plan(1)
    let server
    common.createServer({expiresIn: 1000, key: 'test'})
      .then((s) => {
        server = s
        server._caches._default.client.stop()
        return common.injectWithValue(server)
      })
      .then((res) => {
        t.is(res.statusCode, 500)
        server.stop()
      })
      .catch(t.threw)
  })

  context.end()
})

tap.test('when cookie is present', (context) => {
  context.test('cookie is valid', (validContext) => {
    validContext.test('should create empty session when cache is expired', (t) => {
      t.plan(2)
      let server
      common.createServer({
        cache: {expiresIn: 1},
        expiresIn: 1000,
        key: 'test'
      })
        .then((s) => {
          server = s
          return common.injectWithCookie(server)
        })
        .then((res) => {
          t.deepEqual(res.request.session, {})
          t.is(res.statusCode, 200)
          server.stop()
        })
        .catch(t.threw)
    })

    validContext.test('should reply with internal server error when cache is unavailable', (t) => {
      t.plan(1)
      let server
      common.createServer({expiresIn: 1000, key: 'test'})
        .then((s) => {
          server = s
          return common.injectWithValue(server)
            .then((res) => {
              server._caches._default.client.stop()
              return common.inject(server, {cookie: common.extractCookie(res)})
            })
        })
        .then((res) => {
          t.is(res.statusCode, 500)
          server.stop()
        })
        .catch(t.threw)
    })

    validContext.test('should load session and not set cookie', (t) => {
      t.plan(3)
      let server
      common.createServer({expiresIn: 1000, key: 'test'})
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

  context.test('cookie is invalid', (invalidContext) => {
    invalidContext.test('should create session and set cookie', (t) => {
      t.plan(4)
      let server
      common.createServer({expiresIn: 1000, key: 'test'})
        .then((s) => {
          server = s
          const options = {
            cookie: 'easySession=KRf_gZUqEMW66rRSIbZdIEJ07XGZxBAAfqnbNGAtyDDVmMSHbzKoFA7oAkCsvxgfC2xSVJPMvjI',
            value: '1'
          }
          return common.inject(server, options) // expired
        })
        .then((res) => {
          t.deepEqual(res.request.session, {test: '1'})
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
