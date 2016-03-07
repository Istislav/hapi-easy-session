'use strict';

const path = require('path');
const Hapi = require('hapi');
const expect = require('chai').expect;
const plugin = require(path.join(__dirname, '..', 'session'));

const cookieRegex = /[\w]+=[%0-9A-Za-z_-]+; Secure; HttpOnly/;

function createServer(options) {
  const server = new Hapi.Server();
  server.connection({
    host: 'localhost',
    address: '127.0.0.1'
  });

  server.route({
    method: 'GET',
    path: '/',
    handler: function slash(request, reply) {
      if (request.query.test) {
        request.session.test = request.query.test;
      }
      reply(request.session.test);
    }
  });

  const plugins = [{
    register: plugin,
    options: options
  }];

  return new Promise((resolve, reject) => {
    server.register(plugins, (err) => {
      if (err) {
        return reject(err);
      }
      server.start(() => {
        resolve(server);
      });
    });
  });
}

function extractCookie(res) {
  const cookie = res.headers['set-cookie'][0];
  return cookie.slice(0, cookie.indexOf(';'));
}

function inject(server, options) {
  options = options || {};
  const url = options.value ? '/?test=' + options.value : '/';
  const headers = options.cookie ? {cookie: options.cookie} : {};
  return server.inject({url: url, headers: headers});
}

function injectWithValue(server) {
  return inject(server, {value: '1'});
}

function injectWithCookie(server) {
  return injectWithValue(server)
    .then((res) => inject(server, {cookie: extractCookie(res)}));
}

function injectWithCookieAndvalue(server) {
  return injectWithValue(server)
    .then((res) => inject(server, {cookie: extractCookie(res), value: '2'}));
}

context('when encryption key is set', function keyTests() {
  context('and no cookie present', () => {

    it('should create session and set cookie', (done) => {
      createServer({expiresIn: 1000, key: 'test'})
        .then(injectWithValue)
        .then((res) => {
          expect(res.request.session.test).to.exist;
          expect(res.request.session.test).to.equal('1');
          expect(res.statusCode).to.equal(200);
          expect(res.headers['set-cookie']).to.exist;
          expect(res.headers['set-cookie'][0])
            .to.match(cookieRegex);
          done();
        });
    });

    context('and creating id fails', () => {
      it('should reply with internal server error', (done) => {
        createServer({algorithm: 'invalid', expiresIn: 1000, key: 'test'})
          .then(injectWithValue)
          .then((res) => {
            expect(res.statusCode).to.equal(500);
            done();
          });
      });
    });

    context('and cache is unavailable', () => {
      it('should reply with internal server error', (done) => {
        createServer({expiresIn: 1000, key: 'test'})
          .then((server) => {
            server._caches._default.client.stop();
            return server;
          })
          .then(injectWithValue)
          .then((res) => {
            expect(res.statusCode).to.equal(500);
            done();
          });
      });
    });

  });

  context('and cookie is present', () => {
    context('and cookie is valid', () => {

      context('and cache is expired', () => {
        it('should create empty session', (done) => {
          createServer({
            cache: {expiresIn: 1},
            expiresIn: 1000,
            key: 'test'
          })
            .then(injectWithCookie)
            .then((res) => {
              expect(res.request.session).to.deep.equal({});
              expect(res.statusCode).to.equal(200);
              done();
            });
        });
      });

      context('and cache is unavailable', () => {
        it('should reply with internal server error', (done) => {
          createServer({expiresIn: 1000, key: 'test'})
            .then((server) => {
              return injectWithValue(server)
                .then((res) => {
                  server._caches._default.client.stop();
                  return inject(server, {cookie: extractCookie(res)});
                });
            })
            .then((res) => {
              expect(res.statusCode).to.equal(500);
              done();
            });
        });
      });

      it('should load session and not set cookie', (done) => {
        createServer({expiresIn: 1000, key: 'test'})
          .then(injectWithCookieAndvalue)
          .then((res) => {
            expect(res.request.session.test).to.equal('2');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.not.exist;
            done();
          });
      });

    });

    context('and cookie is not valid', () => {
      it('should create session and set cookie', (done) => {
        createServer({expiresIn: 1000, key: 'test'})
          .then((server) => {
            const options = {
              cookie: 'easySession=KRf_gZUqEMW66rRSIbZdIEJ07XGZxBAAfqnbNGAtyDDVmMSHbzKoFA7oAkCsvxgfC2xSVJPMvjI',
              value: '1'
            };
            return inject(server, options); // expired
          })
          .then((res) => {
            expect(res.request.session).to.deep.equal({test: '1'});
            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.exist;
            expect(res.headers['set-cookie'][0]).to.match(cookieRegex);
            done();
          });
      });
    });
  });
});

context('when encryption key is not set', function noKeyTests() {
  context('and expiresIn is set', () => {
    it('should throw an error', (done) => {
      createServer({expiresIn: 100})
        .catch((err) => {
          expect(err).to.be.an.instanceof(Error);
          expect(err.message).to.contain('requires the "key" option');
          done();
        });
    });
  });

  context('and cookie is set', () => {

    context('and cookie is valid', () => {
      it('should load session and not set cookie', (done) => {
        createServer()
          .then(injectWithCookie)
          .then((res) => {
            expect(res.request.session.test).to.equal('1');
            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.not.exist;
            done();
          });
      });

      context('and session is modified', () => {
        it('should load session and not set cookie', (done) => {
          createServer()
            .then(injectWithCookieAndvalue)
            .then((res) => {
              expect(res.request.session.test).to.equal('2');
              expect(res.statusCode).to.equal(200);
              expect(res.headers['set-cookie']).to.not.exist;
              done();
            });
        });
      });
    });

    context('and cookie is not valid', () => {
      it('should create session and set new cookie', (done) => {
        createServer()
          .then((server) => {
            return inject(server, {cookie: 'easySession=abcd'});
          }) // too short
          .then((res) => {
            expect(res.request.session).to.deep.equal({});
            expect(res.statusCode).to.equal(200);
            expect(res.headers['set-cookie']).to.exist;
            expect(res.headers['set-cookie'][0]).to.match(cookieRegex);
            done();
          });
      });
    });

  });
});

