/**
 * @file index.js
 * @project peddler
 * @license GPL-3.0.
 * @copyright 2015-2016 Karim Alibhai.
 */

"use strict";

var BasicStrategy = require('passport-http').BasicStrategy
  , buildRouter = require('./lib/router')
  , compression = require('compression')
  , bodyParser = require('body-parser')
  , proxyEvts = require('proxy-events')
  , nextport = require('next-port')
  , toobusy = require('toobusy-js')
  , passport = require('passport')
  , iptables = require('iptables')
  , express = require('express')
  , morgan = require('morgan')
  , chalk = require('chalk')
  , path = require('path')
  , fs = require('fs')
  , User

/**
 * passport handling will be the same regardless
 * of what is specified by the options, except the schema
 * must be adjusted before `passport.authenticate()` is called
 */
passport.serializeUser(function (user, done) {
  done(null, user._id)
})

passport.deserializeUser(function (id, done) {
  User.findOne({
    _id: id
  }, function (err, user) {
    if (err) done(null, false)
    else done(null, user)
  })
})

/**
 * basic authentication is used by default in peddler, so it is
 * recommended that you use https instead of http (basic happens
 * entirely in plain text)
 */
passport.use(new BasicStrategy(function (key, secret, done) {
  /**
   * we do the lookup only by the key, not by
   * the secret so that we can mark off a user as 'rusty'
   * if the API key is guessed at any point -> this will minimize
   * the window of time within which the hacker can steal the secret
   * whilst having the key
   */
  User.findOne({
    '_peddler.key': key
  }, function (err, user) {
    if (err || !user) {
      done(null, false)
    } else if (user._peddler.secret === secret) {
      /**
       * we move forth with authentication regardless
       * of whether or not the user is rusty, because we
       * do not yet have the response objec to return a fresh
       * key even if we generated one
       */
      done(null, user)
    } else {
      /**
       * if the key has matched, but the secret has not
       * we mark the key as rusty, but ignore errors on save
       * (we're assuming it is a hacker, so he/she does not need
       * to know that we failed to protect the system)
       */
      user._peddler.rusty = true
      user.save()

      /** and like always, we return unauthorized */
      done(null, false)
    }
  })
}))

/**
 * due to the messy constructor being exported,
 * you can run however many instances of peddler as you
 * would like at once
 */
module.exports = function (options) {
  /** convert to boolean, but prefer to stay secure */
  var secure = options.hasOwnProperty('secure') ? !! options.secure : true

      /**
       * at a base level, we want to stick to using express
       * because it already handles everything one needs to worry about
       */
    , app = express()

      /**
       * we use an express sub-router to handle all the routes
       * so that we can ensure that no route is handled or even considered
       * before authentication is complete
       */
    , router = express.Router()

      /** if specified, we'll assume it comes preloaded with the key/cert */
    , ssl = options.ssl || {}
    
      /** if explicitally false, then we will not use any authentication */
    , auth = options.auth !== false

      /**
       * load the appropriate module for now, but await
       * key/cert lookup before instantiating server
       */
    , server = options.http2 || options.spdy ? require('http2') : require('http' + (secure ? 's' : ''))

      /**
       * this is the default port, however, we will change
       * based on scan results and user preferences
       */
    , port = 443

      /**
       * by using a frequency table, we can set a max number of connections
       * before a user is considered to be a hacker/moron, and then stop worrying
       * after the user has been blacklisted under IP Tables (if your iptables is
       * disabled for whatever reason, this is going to just use up pointless memory)
       */
    , freqlist  = {}

  /** complain for http servers */
  if (!secure || !auth) console.warn(chalk.yellow.bold('WARN: peddler was made insecure by your choices.'))

  /** configure passport globals */
  if (auth) {
    User = options.schema
    options.username = options.username || 'email'
    options.password = options.password || 'password'
  }

  /**
   * configure maximum server latency and maximum number of
   * connections after an overload
   */
  if (options.hasOwnProperty('latency')) toobusy.maxLag(options.latency)
  if (!options.hasOwnProperty('badConnections')) options.badConnections = 5

  /** synchronously load up the key and certificate */
  if ((secure || options.spdy) && !ssl.key) {
    ssl.key = fs.readFileSync(path.resolve(options.dirname || '.', 'ssl', 'server.key'), 'utf8')
    ssl.cert = fs.readFileSync(path.resolve(options.dirname || '.', 'ssl', 'server.crt'), 'utf8')
  }

  /** create the appropriate web server */
  app.server = server = secure || options.spdy ? server.createServer(ssl, app) : server.createServer(app)

  /**
   * configure server latency handler (this happens before express to
   * try and kick the user asap)
   */
  server.on('connection', function (sock) {
    var who = sock.address().address

    if (toobusy()) {
      /**
       * our first preference should always be to stop this
       * connection from going any further, and so our firewall
       * handling doesn't actually take place until the user's next
       * connection attempt and no extra parsing occurs
       */
      sock.end()

      /**
       * if this user hasn't made our list yet, start
       * a frequency calculation for him/her
       */
      if (freqlist[who] === undefined) freqlist[who] = 0

      /**
       * we immediately block the client via iptables if they exceed
       * the threshold of maximum connections
       */
      if (freqlist[who] > options.badConnections) {
        iptables.drop({

            /**
             * using -I over -A causes this rule to populate to the top
             * of the default iptables chain; this means that you can choose
             * to add other rules in the chain to handle maximum concurrent connections
             * and other such rules
             */
            action: '-I'

            /**
             * the block occurs over the port being used only, so
             * if you run multiple peddlers, the second peddler will still
             * be able to accept connections from this user
             */
          , src: who
          , dport: port
          , protocol: 'tcp'

            /**
             * peddler should be sudo-ed or run as root anyways (for https)
             * otherwise we can assume that you do not have sudo access on the
             * current machine
             */
          , sudo: false

        })

        /**
         * we no longer need to be recording this user's frequency as we
         * should not be receiving any more connections from him/her
         */
        delete freqlist [ who ]
      }
    }
  })

  /** to help avoid header overflows */
  server.maxHeadersCount = 8

  /** build the router */
  buildRouter.call(app, router, options)

  /**
   * peddler will enable colourful logging, gzip compression, JSON-communication,
   * and authentication before visiting the router parsed from the input routes
   * these middleware are typically things you want to have in every request, and
   * having authentication run before the sub-router is invoked keeps every request
   * secure
   */
  app
    .disable('x-powered-by')
    .use(morgan(options.log || chalk.yellow.bold(':method :url :status :response-time ms ":user-agent" ":remote-addr"')))
    .use(compression())
  
  /** enable authentication */
  if (auth) app.use(passport.initialize())
  
  /** everything must be json */
  app.use(bodyParser.json())
  
  /** auth or nah */
  if (auth) app.use(function (req, res, next) {
      res.set('Content-Type', 'application/json')
      next()
    }, passport.authenticate('basic'), router)
  else app.use(function (req, res, next) {
      res.set('Content-Type', 'application/json')
      next()
    }, router)

  /** add the listening method */
  app.listen = function (start, end) {
    /**
     * if start is specified, but end is not, we only
     * try using start
     */
    if (start !== undefined && end === undefined) {
      port = start
      server.listen(start)
    }

    /**
     * if neither start nor end are specified, we do a full scan
     * in the available port range
     */
    else if (start === undefined) nextport(function (err, newPort) {
      port = newPort || port

      if (err) app.emit('error', err)
      else server.listen(port)
    })

    /**
     * if both start AND end are specified, we go ahead and
     * use them as a port range
     */
    else nextport({
        lower: start
      , higher: end
    }, function (err, newPort) {
      port = newPort || port

      if (err) app.emit('error', err)
      else server.listen(port)
    })
  }

  /** proxy the events from the server to the express app */
  proxyEvts(server, app)

  /** return the final object */
  return app
}
