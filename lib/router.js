/**
 * @file lib/router.js
 * @project peddler
 * @license GPLv3.
 * @copyright 2015 Online Health Database.
 **/

"use strict";

var parsers = {
      'string': String,
      'number': parseFloat,
      'object': JSON.parse,
      'array': JSON.parse
    }
  , pair = require('./pair')
  , path = require('path')
  , fs = require('fs')

module.exports = function (router, config) {
  var app = this
    , routes = config.routes || './routes'
    , bodies = {}
    , route = function (fn) {
        var handle = function (req, res) {
          if (fn.constructor.name === 'GeneratorFunction') {
            /**
             * create iterator
             **/
            var gen = fn.call(res, req)

            /** everything that is yielded is written out */
            do {
              var ret = gen.next()

              if (ret.done) {
                res.end(ret.value || undefined)
                break
              } else {
                res.write(ret.value)
              }
            } while (true)
          } else {
            /**
             * call the actual route, and save what
             * it returns
             */
            var ret = fn.call(res, req), sret

            /** force the object into a string */
            if (ret !== undefined) {
              sret = String(ret)
  
              /**
               * if the output string is inappropriate,
               * try using the JSON library
               */
              if (sret[0] === '[' && !(ret instanceof Array)) {
                sret = JSON.stringify(ret)
              }
  
              /**
               * we already have a response, so we can
               * end the connection with the result
               */
              res.end(sret)
            }
          }
        }

        return function (req, res) {
          /**
           * try cleansing the body if that is
           * what the client asked for
           */
          if (bodies.hasOwnProperty(req.path)) {
            var i, cast, body = {}

            /**
             * only keep inputs common between the expected
             * and given, and cast them using the typecast given
             * by the config
             */
            for (i in bodies[req.path]) {
              if (bodies[req.path].hasOwnProperty(i) && req.body.hasOwnProperty(i) && i !== 'rusty') {
                cast = typeof bodies[req.path][i] === 'string' ? parsers[bodies[req.path][i]] : bodies[req.path][i]
                body[i] = cast(req.body[i])
              }
            }

            /** handle rusty request first */
            if (req.user._peddler.rusty || req.body.rusty) {
              req.user._peddler = pair(req.user[config.username], req.user[config.password])
              req.user._peddler.rusty = false
              req.user.save(function (err) {
                /**
                 * if the save is successful, we can go ahead
                 * and ask the client to replace the key/secret pair
                 * it has saved
                 */
                if (!err) res.set('X-Rusty', req.user._peddler.key + ':' + req.user._peddler.secret)

                /** and we can continue with the newly parsed body */
                req.body = body
                handle(req, res)
              })
            } else {
              /** update the request body with the newly parsed inputs */
              req.body = body
              handle(req, res)
            }
          } else handle(req, res)
        }
      }
    , parseRoute = function (curr, from, pfrom) {
        fs.stat(path.resolve(pfrom, curr), function (sterr, stat) {
          if (sterr) app.emit('error', sterr)
          else if (stat.isDirectory()) {
            fs.readdir(path.resolve(pfrom, curr), function (lserr, list) {
              if (lserr) app.emit('error', lserr)
              else {
                var i

                for (i = 0; i < list.length; i += 1) {
                  parseRoute(list[i], from + '/' + list[i], path.resolve(pfrom, curr))
                }
              }
            })
          } else if (stat.isFile()) {
            from = from.replace('/' + curr, '')

            if (curr.substr(0, 9) === 'params.js') {
              bodies[from] = require(path.resolve(pfrom, curr))
            } else {
              curr = curr.substr(0, curr.length - 3)
              router.route(from)[curr](route(require(path.resolve(pfrom, curr + '.js'))))
            }
          }
        })
      }
    , dig = function (obj, here) {
        var type, i
        for (i in obj) {
          if (obj.hasOwnProperty(i)) {
            if (i === 'params') bodies[here] = obj[i]
            else {
              type = typeof obj[i]

              if (type === 'object') dig(obj[i], here + '/' + i)
              else if (type === 'function') router.route(here)[i](route(obj[i]))
            }
          }
        }
      }

  /** begin table parsing, from either folders or json */
  if (typeof routes === 'string') parseRoute(routes, '', '.')
  else dig(routes, '')
}
