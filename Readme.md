# hapi-easy-session

A server-side session management plugin for Hapi. It is largely copied from
[hapi-server-session](https://github.com/btmorex/hapi-server-session). The main
difference is that *hapi-server-session* guards against gratuitous cache stores
while *hapi-easy-session* use a bit less memory. To illustrate, here's a
breakdown of how the plugins work:

+ *hapi-server-session*:
    1. Looks for a session id cookie and, if found, tries to load the session
       from Hapi's cache
    2. The cached session is set as the primary session and then cloned to a
       secondary session
    3. Before the request is served, the primary session and secondary session
       are compared for differences. If no difference is found, the primary
       session is sent and storing it to the cache is skipped. If a difference
       is found, then the primary session is saved to the cache
+ *hapi-easy-session*:
    1. Looks for a session id cookie and, if found, tries to load the session
       from Hapi's cache
    2. The cached session is set as the only session instance
    3. Before the request is seved, the session is stored to the cache

It's a pick your poison situation: either use *hapi-server-session* and incur
at least twice the memory usage per session object but skip some saves to the
cache, or use *hapi-easy-session* use a bit less memory and issue a cache
store operation on every request.

## Install

```bash
$ npm install --save hapi-easy-session
```

## Example:

```javascript
'use strict';

const Hapi = require('hapi');
const server = new Hapi.Server();

server.connection({
  host: 'localhost',
  address: '127.0.0.1',
  port: 8080
});

const sessionPluginOptions = {
  cache: { segment: 'unique-cache-sement' },
  cookie: { isSecure: false },
  key: 'super-secret-cookie-encryption-key'
};

server.register(
  { register: require('hapi-easy-session'), options: sessionPluginOptions },
  (err) => {
    if (err) {
      throw err;
    }
  }
);

server.route({
  method: 'GET',
  path: '/',
  handler: function (request, reply) {
    request.session.views = request.session.views + 1 || 1;
    reply('Views: ' + request.session.views);
  },
});

server.start();
```

## Options

```javascript
{
  // name for the session id cookie sent to the client
  name: 'easySession',

  // the algorithm to use when encrypting the session id cookie
  algorithm: 'sha256',

  // secret key for cookie encryption, default: `undefined`
  key: 'string',

  // number of random bytes to use for session id
  size: 16,

  // time when the cookie will expire, in milliseconds
  // e.g. `Date.now() + (86400 * 1000)`
  // must set the `key` option if this is set
  expiresIn: undefined,

  // http://hapijs.com/api#servercacheoptions
  cache: {
    segment: 'easySession',

    // how long entries will live in the cache (milliseconds),
    // default: 2147483647 (~24 days)
    expiresIn: 60000
  },

  // http://hapijs.com/api#serverstatename-options
  cookie: {
    isSecure: true,
    isHttpOnly: true
  },

  // An array of regular expressions or strings to match.
  // The matches will tested against `request.url.path`. If any of the
  // matches succeed, session processing will not be performed.
  ignorePaths: []
}
```

## License

[MIT License](http://jsumners.mit-license.org/)
