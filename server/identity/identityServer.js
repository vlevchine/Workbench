/**
 * Implements Identity server middleware (see readme.md)
 * This is the ONLY object exposed to outside - must run init to activate identityManager and
 * provides 3 route handles to application router
 */
var Connector = libRequire('appConnector'),
    config = rootRequire('./server/config/authServer'),
    authErrors = require('./authErrors'),
    guard = require('./requestGuard'),
    appCache = require('./appCache');
    identityManager = require('./identityManager');

var postTask = {
        authorization_code: { func: identityManager.tokenRequest, props: ['grant_type', 'code', 'redirect_uri', 'client_id']},
        refresh_token: { func: identityManager.refreshToken, props: ['grant_type', 'refresh_token', 'scope']},
        revoke: { func: identityManager.clearSession, props: ['grant_type', 'client_id', 'state', 'subject']},
        key: { func: identityManager.exchangeKey, props: ['grant_type', 'refresh_token']},
    },
    redirectTask = {
        code: {func: identityManager.codeRequest, separator: '?'},//1st step of code flow
        token: {func: identityManager.authorizeClient, separator: '#'} //implicit flow
    },
    connector = new Connector(config.redis, config.clientId);

function init() {
    var payload = {baseURL: config.baseURL, endpoints: config.endpoints};
    connector.subscribeTo(config.channels.app_start, (err, data) => {
        connector.sendOneWay(data.replyTo, payload);
    });
    connector.sendOneWay(config.channels.auth_start, payload);
}

function routes() {
    var router = require('express').Router(),
        conf = config.endpoints;

    router.post(conf.register, register);
    router.get(conf.authorize, authorize);
    router.post(conf.login, authenticate);
    router.post(conf.token, token);
    router.post(conf.clearSession, token);
    router.post(conf.refreshToken, token);

    router.get('/apps', getActiveClients);

    return router;
}

//handles HTTP POST sent by any webapp to register with AS
function register(req, res, next) {
    guard.validateRegisterRequest(req.body)
    .then(() => identityManager.register(req.body))
    .then(data => res.status(200).json(data))
    .catch(err => res.status(501).json('Internal server error. Please contact your system administrator'));
}

//handles both ACG flow code and auth Implicit flow requests
function authorize(req, res, next) {
    guard.preValidateRequestToRedirect(req.query)
        .then(() => redirectTask[req.query.response_type].func.call(null, req, res))
        .then(url => res.redirect(url));
}

//Handles request to auth_code grant flow
function authenticate(req, res, next) {//req.body expected in format {subject=user@comp.com:psw, client_id}
    identityManager.authenticate(req, res)
        .then(url => res.redirect(url));
}

//Handles POST for both ACG flow token and refresh requests for token depending on provided grant_type
function token(req, res, next) { //       toks = (req.headers.authorization || '').split(' '),
    guard.preValidatePostRequest(req.body, postTask[req.body.grant_type].props)
        .then(() => postTask[req.body.grant_type].func.call(null, req, res))
        .then(data => { res.status(200).json(data); })
        .catch(err => { res.status(err.status).json(err.code); }); //Bad request
}

function getActiveClients(req, res) {
    identityManager.getActiveClients(req)
        .then(data => res.status(200).json(data))
        .catch(err => res.status(501).json(err));
}

module.exports = {
    init: init,
    routes: routes
};