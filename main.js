#!/usr/bin/env node
"use strict";

global.rootRequire = function(name) {
    return require(name);//__dirname + '/' +
};

global.libRequire = function(name) {
    return require('../libs/server/' + name);//__dirname + '/' +
};

var debug = require('debug')('workbench:server'),
    http = require('http'),
    redis = require('redis'),
    blueBird = require("bluebird");

//Promisify standard Node APIs
blueBird.promisifyAll(require('jsonwebtoken'));
blueBird.promisifyAll(redis.RedisClient.prototype);
blueBird.promisifyAll(redis.Multi.prototype);
blueBird.promisifyAll(require('request'));

var app = require('./server/app'),
    config = require('./server/config/all'),
    port = normalizePort(process.env.PORT || config.port),
    server = http.createServer(app);

server.on('error', onError);
server.on('listening', function() {
    var addr = server.address(),
        bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
    console.log(`App listening on ${bind}`);
});
server.listen(port);


//Normalize a port into a number, string, or false.
function normalizePort(val) {
    var port = parseInt(val, 10);

    return isNaN(port) ? val : (port >= 0 ? port : false);
}

//Event listener for HTTP server "error" event.
function onError(error) {
    if (error.syscall !== 'listen') { throw error; }

    var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}

