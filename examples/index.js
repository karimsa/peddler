// simplest app setup
require('../')({
  schema: require('mongoose').connect(process.env.DB_CONN).model('User', {
    email: String,
    password: String,
    '_peddler': {
      key: String,
      secret: String,
      rusty: 'boolean'
    }
   }),

  spdy: true,
  dirname: __dirname,
  routes: require('path').resolve(__dirname, './routes')
}).on('listening', function () {
  console.log('listening... somewhere')
}).listen(443, 1025)
