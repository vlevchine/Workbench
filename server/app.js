var express = require('express'),
    path = require('path'),
    logger = require('morgan'),
    cookieParser = require('cookie-parser'),
    helmet = require('helmet'),
    bodyParser = require('body-parser'),
    app = express();

global.rootRequire = function(name) {
  return require(__dirname + '/' + name);
};

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public/images', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(require('less-middleware')(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(helmet());
//app.use(helmet.csp({
//  defaultSrc: ["'self'"],
//  scriptSrc: ['*.google-analytics.com'],
//  styleSrc: ["'unsafe-inline'"],
//  imgSrc: ['*.google-analytics.com'],
//  connectSrc: ["'none'"],
//  fontSrc: ["http://fonts.googleapis.com", "http://fonts.gstatic.com"],
//  objectSrc: [],
//  mediaSrc: [],
//  frameSrc: []
//}));

var redisClient = rootRequire("./lib/redisClient"),
    config = require('./config/all'),
    Connector = rootRequire('./lib/appConnector'),
    connector = new Connector(config.redis, config.clientId),
    authServer = rootRequire('lib/auth_client/authServer'),
    identityServer = require('./identity/identityServer'),
    router = require('./router');

//Handshake between Workbench and Identity Server
app.use(router.setCors);
app.use('/', identityServer.routes());
app.use('/', router.getRouter());
//init in this order: to avoid double-registering
authServer.init(config, connector);
identityServer.init();

app.port = config.port;

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

//Promisify standard Node APIs
var blueBird = require("bluebird");
blueBird.promisifyAll(require('jsonwebtoken'));
blueBird.promisifyAll(require('redis'));
blueBird.promisifyAll(require('request'));

module.exports = app;
