/**
 * @file lib/pair.js
 * @project peddler
 * @license GPL-3.0.
 * @copyright 2015-2016 Karim Alibhai.
 */

"use strict";

var crypto = require('crypto')
  , format = require('util').format.bind(null, '%s:%s')

module.exports = function (user, pass) {
  var pair = {}, hash

  /**
   * generate the key hash using both the username
   * and password, and add some entropy to avoid dictionary attacks
   * as well as keep keys fresh
   */
  pair.key = crypto.createHash('sha256')
               .update(format(user, pass) + crypto.randomBytes(32).toString('hex'))
               .digest('hex')

  /**
   * generate a random secret unique to the key
   */
  pair.secret = crypto.createHash('sha512')
                  .update(format(pair.key, crypto.randomBytes(64).toString('hex')))
                  .digest('hex')

  return pair
}
