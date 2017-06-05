require('babel-register')
require('babel-polyfill')

require('../')({
  loader: {
    loader: require('../../peddler-koa').default,
    options: {
      port: 8080
    }
  },
  directories: {
    middleware: __dirname + '/mw',
    routes: __dirname + '/app'
  },
  middleware: [
    ['koa-morgan', 'dev'],
    'koa-bodyparser'
  ]
}).catch(console.log)