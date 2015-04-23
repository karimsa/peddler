// simplest app setup
require('../')({
  schema: require('chimp')(process.env.DB_CONN, {
    User: {
      email: String,
      password: String,
      '_peddler': {
         key: String,
         secret: String,
         rusty: 'boolean'
       }
     }
   }).User,

  secure: false,
  routes: require('path').resolve(__dirname, './routes')
}).on('listening', function () {
  console.log('listening... somewhere')
}).listen(443, 1025)
