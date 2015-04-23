/**
 * @file lib/pair.js
 * @project peddler
 * @license GPLv3.
 * @copyright 2015 Online Health Database.
 */

"use strict";

var crypto = require('crypto')
  , format = require('util').format.bind(null, '%s:%s')
  , rndstr = require('randomstring')

module.exports = function (user, pass) {
  var pair = {}, hash

  /**
   *  generate the key hash using both the username
   * and password, and use a randomstring to complicate
   * bruteforcing and allowing the rusty mechanism to fetch
   * fresh keys upon rusty requests
   */
  hash = crypto.createHash('RSA-SHA224')
  hash.update(format(user, pass) + rndstr.generate())
  pair.key = hash.digest('hex')

  /**
   * generate the secret from the created key so that it is
   * unique to the key, and add some randomness because why the
   * hell not
   */
  hash = crypto.createHash('sha512WithRSAEncryption')
  hash.update(format(pair.key, rndstr.generate()))
  pair.secret = hash.digest('hex')

  return pair
}
