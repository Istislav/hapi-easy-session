'use strict';

const crypto = require('crypto');
const path = require('path');
const debug = require('debug')('hapi-easy-session');
const Boom = require('boom');

const defaultOptions = {
  algorithm: 'sha256',
  cache: {
    segment: 'easySession'
  },
  cookie: {
    isSecure: true,
    isHttpOnly: true
  },
  name: 'easySession',
  size: 16,
  ignorePaths: []
};

function SessionPlugin(server, options) {
  this.opts = Object.assign({}, defaultOptions, options);
  if (this.opts.expiresIn && !this.opts.key) {
    throw new Error('The "expiresIn" option requires the "key" option');
  }
  if (!this.opts.cache.expiresIn) {
    const maxExpiresIn = Math.pow(2, 31) - 1;
    this.opts.cache.expiresIn = Math.min(
      this.opts.expiresIn || maxExpiresIn, maxExpiresIn
    );
  }

  this.cache = server.cache(this.opts.cache);

  // register cookie configuration with Hapi
  server.state(this.opts.name, this.opts.cookie);
}

SessionPlugin.prototype.createSessionId = function createSessionId(randomBytes, expiresAt) {
  debug('creating session id');
  const sessionId = [randomBytes || crypto.randomBytes(this.opts.size)];
  if (this.opts.expiresIn) {
    const buffer = new Buffer(8);
    buffer.writeDoubleBE(expiresAt || Date.now() + this.opts.expiresIn);
    sessionId.push(buffer);
  }
  if (this.opts.key) {
    const hmac = crypto.createHmac(this.opts.algorithm, this.opts.key);
    sessionId.forEach((value) => {
      hmac.update(value);
    });
    sessionId.push(hmac.digest());
  }
  const id = encodeURIComponent(Buffer.concat(sessionId).toString('base64'));
  debug('session id: %s', id);
  return id;
};

SessionPlugin.prototype.isValidSessionId = function isValidSessionId(sessionId) {
  debug('verifying session id: %s', sessionId);
  const minSize = (this.opts.expiresIn) ? this.opts.size + 8 : this.opts.size;
  const decodedSessionId = new Buffer(decodeURIComponent(sessionId), 'base64');

  if (decodedSessionId.length < minSize) {
    debug('decoded session id length too short');
    return false;
  }

  const randomBytes = decodedSessionId.slice(0, this.opts.size);
  let expiresAt;
  if (this.opts.expiresIn) {
    expiresAt = decodedSessionId.readDoubleBE(this.opts.size);
    if (Date.now() >= expiresAt) {
      debug('decoded session id has expired');
      return false;
    }
  }

  const isValid = sessionId === this.createSessionId(randomBytes, expiresAt);
  debug('session id is valid: %s', isValid);
  return isValid;
};

SessionPlugin.prototype.shouldIgnore = function shouldIgnore(path) {
  for (let p of this.opts.ignorePaths) {
    if (p instanceof RegExp && p.test(path)) {
      return true;
    }
    if (p === path) {
      return true;
    }
  }
  return false;
};

SessionPlugin.prototype.onPreAuth = function onPreAuth(request, reply) {
  debug('==== onPreAuth ====');
  if (this.shouldIgnore(request.url.path)) {
    debug('ignoring path: %s', request.url.path);
    request.easySessionIgnore = true;
    return reply.continue();
  }
  const sessionId = request.state[this.opts.name];
  debug('sessionId: %s', sessionId);
  if (!sessionId) {
    debug('creating new session');
    request.session = {};
    return reply.continue();
  }

  if (!this.isValidSessionId(sessionId)) {
    debug('removing session');
    reply.unstate(this.opts.name);
    request.session = {};
    return reply.continue();
  }

  debug('setting internal easySessionId variable');
  request.easySessionId = sessionId;

  debug('getting session from cache: %s', request.easySessionId);
  this.cache.get(sessionId, (err, value, cached) => {
    debug('cache value: %j ~~ %j', value, cached);
    if (err) {
      debug('could not retrieve session from cache: %j', err);
      return reply(Boom.wrap(err, 503));
    }

    request.session = (value) ? value : {};
    debug('session from cache: %j', request.session);
    return reply.continue();
  });
};

SessionPlugin.prototype.onPreResponse = function onPreResponse(request, reply) {
  debug('==== onPreResponse ====');
  if (request.easySessionIgnore) {
    debug('ignoring path: %s', request.url.path);
    return reply.continue();
  }
  let sessionId = request.easySessionId;
  debug('sesion id: %s', sessionId);
  if (!sessionId) {
    try {
      sessionId = this.createSessionId();
    } catch (err) {
      debug('could not generate session id: %j', err);
      reply(Boom.wrap(err, 500));
      return;
    }
    debug('setting session id cookie: %s', sessionId);
    reply.state(this.opts.name, sessionId);
  }

  debug('saving session to cache: %j', request.session);
  this.cache.set(sessionId, request.session || {}, null, (err) => {
    debug('session saved to cache. err: %j', err);
    (err) ? reply(Boom.wrap(err, 503)) : reply.continue();
  });
};

function plugin(server, options, next) {
  debug('instantiating new easy-session plugin: %j', options);
  const sessionPlugin = new SessionPlugin(server, options);
  server.ext('onPreAuth', sessionPlugin.onPreAuth.bind(sessionPlugin));
  server.ext('onPreResponse', sessionPlugin.onPreResponse.bind(sessionPlugin));
  next();
}

plugin.attributes = {
  pkg: require('./package.json')
};

module.exports = plugin;
