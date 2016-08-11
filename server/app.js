'use strict';

var Express = require('express'),
    path = require('path'),
    logger = require('morgan'),
    cookieParser = require('cookie-parser'),
    helmet = require('helmet'),
    bodyParser = require('body-parser'),
    app = new Express();

var config = require('./config/all'),
    redisClient = libRequire("redisClient"),
    Connector = libRequire('appConnector'),
    authServer = libRequire('auth_client/authServer'),
    identityServer = require('./identity/identityServer'),
    router = require('./router');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public/images', 'favicon.ico')));
// app.use(require('less-middleware')(path.join(__dirname, 'public')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// view engine setup
app.use(Express.static(path.join(path.resolve(), 'app')));
app.set('views', path.join(path.resolve(), 'app/views'));
app.set('view engine', 'ejs');

app.use(helmet());

//Handshake between Workbench and Identity Server
//init in this order: to avoid double-registering
authServer.init(config, new Connector(config.redis, config.clientId));
identityServer.init();
app.use('/', identityServer.routes());
router.setRoutes(app);
//allow CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, X-Requested-With, Content-Type, Accept');
    //res.header('Content-Security-Policy', "default-src 'self'; style-src 'self' http://fonts.googleapis.com; script-src 'self'; font-src 'self' http://fonts.googleapis.com http://fonts.gstatic.com");

    next();
});

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


module.exports = app;
