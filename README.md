# Peddler

a lightweight REST framework.

[![NPM](https://nodei.co/npm/peddler.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/peddler/)

## Usage

To use this framework, install it via npm (`npm install --save peddler`) and configure your router:

```javascript
// instantiate a new instance of peddler
// with some options
var app = require('peddler')(options)

// start the web server
app.listen()
```

## Options

 - **schema**: an instance of `mongoose.model` with your user info setup. The schema MUST contain the following sub-document:
```json
{
  "_peddler": {
    "key": String,
    "secret": String,
    "rusty": "boolean"
  }
}
```
 - **username**: the key from which to extract the username from `UserSchema` rows. (default: 'email')
 - **password**: the key from which to extract the password from `UserSchema` rows. (default: 'password')
 - **secure**: a boolean about whether or not to use https. (default: true)
 - **spdy**: a boolean about whether or not to use SPDY. (default: true)
 - **routes**: a JSON-based router setup or a string path to the routing folder. (default: './routes')
 - **log**: string specifying a format to use with [morgan](https://github.com/expressjs/morgan). (default: yellow+bold simplified apache-like log)
 - **ssl**: a JSON object to be passed as the first argument to https.Server. (load your key/cert into this, or (default) create a folder in '.' called ssl with 'server.key' and 'server.crt')
 - **latency**: maximum latency the event loop may experience before you begin dropping connections. (default: 10)
 - **badConnections**: maximum number of connections you drop from a client before banning them with iptables. (default: 5)

## Methods

*The peddler object is extended from the express app instance and will, therefore, support all the express application methods/properties. It is also extended from events.EventEmitter and therefore will support events. All the events are proxied from the https server.*

 - **listen()**: setup a web server on next available port.
 - **listen([port])**: try to start a web server on port `[port]`.
 - **listen([start], [end])**: setup a web server on next available port after `[start]` but before `[end]`.

## Routing

The route handling for peddler is a bit different from express in the sense that it focuses on a preference for exiting synchronously.
Therefore, all route handlers will be passed the request (http.IncomingMessage) as the only parameter, and the context will be set to
the response object provided by express. If the method returns `undefined`, it will be assumed that the method is now gone into asynchronous
mode and therefore the response object must be ended to return anything to the client. However, if anything else is returned, it will be stringified
(preferring String() then using JSON.stringify()) and the response will be ended with the string.

The routing table can only choose to filter and cast any incoming request bodies by providing the types of the fields they wish to receive (all other
fields will be ignored).

Simple hello world:

```javascript
var app = require('peddler')({
  routes: {
    '/hello': {
      'params': {
        'name': 'string'
      },

      'get': function (req) {
        return 'Hello, ' + req.body.name;
      }
    }
  }
})
```

Try doing `curl -d "name=world" https://localhost/hello` and it should result in "Hello, world".

*Like it should be, routing is not established after the server is started. The routing table is parsed into an express router when the peddler
instance is created. So there's no point of trying to change the routing table at runtime; it's a bad idea anyways. If you are thinking of something
like this, read what the [expressjs docs](http://expressjs.com/4x/api.html) have to say about params.*

## License

GPLv3.

```
peddler: a lightweight REST framework.
Copyright (C) 2015 Online Health Database

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
```
