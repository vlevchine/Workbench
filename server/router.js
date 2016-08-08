var express = require('express'),
    request = require('request'),
    security = rootRequire('lib/security'),
    config = rootRequire('config/all'),
    authServer = rootRequire('lib/auth_client/authServer');

var defineParams = function(err, options) {
        return {project: config.project, title: config.title, client: config.registeredClient,
            params: Object.assign({ error: err}, options), loginURL: config.as.baseURL+config.as.endpoints.login
    }};

function setCors(req, res, next) {//allow cors
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, X-Requested-With, Content-Type, Accept');
    res.header('Content-Security-Policy', "default-src 'self'; style-src 'self' http://fonts.googleapis.com; script-src 'self'; font-src 'self' http://fonts.googleapis.com http://fonts.gstatic.com");

    next();
}

function processPageRequest(req, res, options) {
    var subject = security.base64Decode(req.cookies.subject || '');

    if (!config.registeredClient) {
        res.render('index', defineParams('Can not connect to Authorization server. Application started in a mode for anonymous user.', options));
    }
    Promise.all([authServer.sessionExists(subject), getApps(subject)])
        .then(data => {//subject exists and session for it defined
            options.apps = data[1];
            if (data[0]) {//session exists
                authServer.runIGFlow(req, res, options, defineParams);
            } else {
                authServer.runACGFlow(req, res, options, defineParams);
            }
        })
        .catch(err => {//subject is undefined
            res.render(options.page, defineParams('Internal server error', options));
        })
}

function getApps(subject) {
    return new Promise(function(resolve, reject) {
        request(config.asBaseURL + config.endpoints.apps+'?sub='+subject, function(error, response, body) {
            if (error) { reject(error); } //all except Workbench
            resolve(JSON.parse(body).filter(e => e.id !== config.clientId));
        })
    });
}

function getRouter() {
  var router = express.Router();
//Common methods - to be used by ALL apps: can use authManager, not appManager, identityServer  or SessionCache
// Upon web client opening up the app in browser - as with any app which allows an anonymous access
// if subject present, start or finish Implicit grant flow
// either start one of auth flows or finish the flow and render index

    router.get('/', (req, res, next) => processPageRequest(req, res,
        { pageURI:'/', page: 'index'}, defineParams ));
    router.get('/profile', (req, res) => processPageRequest(req, res,
        { pageURI:'/profile', page: 'profile'}, defineParams ));

    router.get('/exchange', authServer.authCodeGrantFlowExchange);
    router.get('/refresh', authServer.refreshFlow);
    router.post('/logout', (req, res) => authServer.logout(req, res, {redirect: '/'}));
    router.post('/onlogout', (req, res) => authServer.onLogout(req, res, {redirect: '/'}));

    router.get('/error', authServer.onError);

    router.get('*', function(req, res, next) {
        res.render('404', defineParams());
    });


  return router;
}

module.exports = {
  getRouter: getRouter,
    setCors: setCors
};
