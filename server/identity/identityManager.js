/**
 * Implements all Identity server functionality (see readme.md), requires SessionCache
 */
var _ = require('lodash'),
    uuid = require('node-uuid'),
    request = require('request');

var dateUtils = libRequire('date'),
    security = libRequire('security'),
    commonUtils = libRequire('utils'),
    logger = libRequire('logger').getLogger(),
    config = rootRequire('./server/config/authServer'),
    sessionCache = require('./session'),
    guard = require('./requestGuard'),
    stateManager = require('./requestStateManager'),
    appCache = require('./appCache'),
    tokenFactory = require('./tokenFactory'),
    userModel = require('./userModel'),
    utils = require('./utils');

var secret = config.secret,
    TOKEN_EXPIRATION = 60 * 10, //dateUtils.toMinutes(config.sessionValid),
    SESSION_ALIVE = 4 * TOKEN_EXPIRATION;

guard.init(config);

//Following 3 methods support Auth code grant flow - generate code
//Handle initial code request, i.e start first step of ACG flow
function codeRequest(req, res) {
    var data = req.query,
        subject = security.base64Decode(req.cookies.subject || ''),
        clientId = security.decrypt(data.client_id, secret);

    return appCache.get(clientId)
        .then(client => {
            var scopes =  _.intersection(Object.keys(client.requiredServices), data.scope.split(' '));
            return guard.validateOnCodeRequest(client.id, scopes)
                .then(() => sessionCache.retrieveSession(subject))
                .then(session => {
                    var state = security.hmac(data.state, client.seed),
                        cachedRequest = stateManager.getOrCreateRequestByState(state, {
                            client: clientId, client_id : data.client_id, code: uuid.v4(), state: data.state,
                            redirect_uri: data.redirect_uri, scopes: scopes, seed: client.seed, subject: subject });

                    if(!session) {//launch login page to authenticate user
                        cachedRequest.challenge = state;
                        res.clearCookie('subject');
                        return data.redirect_uri;//redirect to login page (app specific)
                    } else {//proceed with ACG flow
                        return data.redirect_uri + config.endpoints.exchange +
                            commonUtils.toQueryString({code: cachedRequest.code, state: state});
                    }
                });
        })
        .catch(err => data.redirect_uri + commonUtils.toQueryString({error: err.code}));
}

//Creating a session in response to login and send code back to client (finish first step of ACG flow)
function authenticate(req, res) {//data expected in format {subject=user@comp.com:psw, client_id}, clientToks: [id, psw]
    var data = req.body,
        id = utils.parseEmail(data.email),
        state = data.challenge,
        codeRequest = stateManager.getRequestByState(state) || { redirect_uri: config.baseURL + config.endpoints.error };

    return guard.validateLoginRequest(data, codeRequest)// .then(() => sessionCache.retrieveSession(id.sub))
            .then(() => sessionCache.retrieveSession(id.sub))
            .then((session) => {
                return session || userModel.findUser(data.email, data.password)
                                    .then(user => sessionCache.createSession(id.sub, user, SESSION_ALIVE));
            })
            .then(session => {
                codeRequest.subject = id.sub;
                res.cookie('subject', security.base64Encode(id.sub), {
                    httpOnly: true, maxAge: dateUtils.getTTL(session.exp).ms});
                logger.debug('Authorization server: user: %s authenticated, sending code to client: ', id.sub, codeRequest.client);
                return codeRequest.redirect_uri + config.endpoints.exchange +
                    commonUtils.toQueryString({code: codeRequest.code, state: state});
            })
            .catch(err => {
                res.clearCookie('subject');
                return codeRequest.redirect_uri + commonUtils.toQueryString({error: err.code});
        });
}

//reply with refresh and id tokens
function tokenRequest(req, res) {
    var clientId = security.decrypt(req.body.client_id, secret),
        credentials = commonUtils.getCredentialsFromHeaders(req.headers),
        flow = stateManager.getRequestByCode(req.body.code);

    stateManager.deleteRequestByCode(req.body.code);
    return guard.validateStoredRequest(req, flow)
            .then( () => Promise.all([appCache.get(clientId), sessionCache.retrieveSession(flow.subject)]) )
            .then(data => {
                var client = data[0], session = data[1],
                    expiresIn = dateUtils.getTTL(session.exp).sec;
                return Promise.all([guard.validateRequestCredentials(client, credentials), guard.validateSesion(session)])
                    .then(() => {
                        return { token_type: 'bearer', expires_in: expiresIn,
                            refresh_token: tokenFactory.refreshToken(
                                security.base64Encode(flow.subject), client, expiresIn),
                            id_token: session.id_token};
                    });
            })
            .catch(err => {
                throw {error: err};
            });
}

//Supports Implicit flow
function authorizeClient(req, res) {
    var subject = security.base64Decode(req.cookies.subject),//security.base64Decode(req.scope)),
        query = req.query || { redirect_uri: config.baseURL + config.endpoints.error },
        clientId = security.decrypt(query.client_id, secret);

    return guard.validateIGFlowRequest(query.scope, req.cookies.subject)
            .then(() => Promise.all([appCache.get(clientId), sessionCache.retrieveSession(subject)]) )
            .then((data) => {
                var client = data[0], session = data[1],
                    expiresIn = dateUtils.getTTL(session.exp).sec,
                    rights = userModel.getAppRights(session, client.id);
                session.apps[client.id] = query.state;
                return sessionCache.onAuthorize(subject, session.apps)
                    .then(() => {
                        return query.redirect_uri + commonUtils.toQueryString({token_type: 'bearer', expires_in: expiresIn,
                                access_token: tokenFactory.accessToken(subject, client, expiresIn).access_token,
                                id_token: session.id_token,
                                scope: rights, state: security.hmac(query.state, client.seed)}, '#');
                    });
            })
        .catch(err => query.redirect_uri + commonUtils.toQueryString({error: err.code}));
}

//supports Refresh token flow
function refreshToken(req, res) {//data expected in format: { refresh_token}, sub: user@comp
    var credentials = commonUtils.getCredentialsFromHeaders(req.headers),
        client;

    return appCache.get(credentials.id)
            .then(cl => {
                client = cl;
                return guard.validateRequestCredentials(cl, credentials);
            })
            .then(() => tokenFactory.verifyRefreshToken(req.refresh_token, client))
            .then((decoded) => sessionCache.retrieveSession(decoded.subject))
            .then(session => {//validate refresh_token and aud
                if (!session ) { throw 'invalid_client'; }
//TBD: might consider rolling token expiration method
                var expiresIn = dateUtils.getTTL(session.exp).sec;
                return { token_type: 'bearer', expires_in: expiresIn, scope: req.body.scope,
                    refresh_token: session.refresh_token,
                    access_token: tokenFactory.accessToken(subject, client, expiresIn)};
            });
}

//handles logout flow
function clearSession(req, res) {//data expected in format {refresh_token, client_id}, sub: user@comp
    var clientId = security.decrypt(req.body.client_id, secret),
        credentials = commonUtils.getCredentialsFromHeaders(req.headers),
        subject = security.base64Decode(req.body.subject);

    return Promise.all([appCache.get(clientId), sessionCache.retrieveSession(subject)])
        .then(data => {
            var client = data[0], session = data[1],
                state = session.apps[client.id];

            return Promise.all([guard.validateRequestCredentials(client, credentials),
                    guard.validateState(session.apps[client.id], req.body.state, client.seed)])
                .then(() => {
                    setTimeout(() => {
                        Promise.all(Object.keys(session.apps).map(e => appCache.get(e)))
                            .then (clients => {
                                var services = _.uniq(_.flatten(clients.filter(e =>
                                        config.authScopes[e.id].acgf).map(e => Object.keys(e.requiredServices)))),
                                    registeredServices = clients.filter(e => config.authScopes[e.id].api && services.indexOf(e.id) > -1);
                                registeredServices.forEach(e => {
                                    request.post({url: e.baseURL + config.endpoints.onLogout, form: {subject: req.body.subject}},
                                        function(error, response, body) {
                                        //logger.error();
                                    });
                                });
                            });
                    }, 0);
                    return {revoked: true };
                })
                .catch(err => {
                    throw {error: err};
                });
        });
}

//supports Refresh token flow
function exchangeKey(req, res) {//data expected in format: { refresh_token}, sub: user@comp
    var credentials = commonUtils.getCredentialsFromHeaders(req.headers),
        client;

    return appCache.get(credentials.id)
        .then(cl => {
            if (security.hmac(client.code_hint, client.seed) !== req.body.key) {
                throw 'invalid_client';
            }
            client = cl;
            return guard.validateRequestCredentials(cl, credentials);
        })
        .then((decoded) => {//validate refresh_token and aud
            return { token_type: 'bearer', token: client.tok_hint, aud: decoded.subject,
            client_id: client.client_id};
        });
}

function register(data) {
    var clientRoles = config.authScopes[data.client],
        cs_hint = security.randomString(48),//uuid.v4(),
        tid = security.randomString(64),
        seed =  security.randomString(32),
        salt = security.randomString(32),
        clientId = security.encrypt(data.client, secret),
        client = {id: data.client, client_id: clientId,
            title: data.title,
            seed: seed, //for secure communication: all that comes from client should be hashed with seed before sending it back
            salt: salt, //for checking secret
            secret: cs_hint,//used as security.hmac(secret, seed),
            requiredServices: data.services,
            pages: data.pages,
            baseURL: data.baseURL},
        response = {client_id: clientId, cs_hint: encodeURIComponent(security.hmac(cs_hint, salt)),
            sid: encodeURIComponent(seed),
            state: (security.hmac(data.state, seed)) };

    if (clientRoles.api) {
        client.tok_hint = tid; //used as security.hmac(code_hint, seed),
        client.code_hint = tid; //used as security.hmac(code_hint, seed)

        if (clientRoles.acgf) {//for webapp with api
            response.tid = encodeURIComponent(tid);
        } else {//for webapi
            response.cid = encodeURIComponent(tid);
        }
    }

    return appCache.add(client.id, client)
            .then(() => appCache.addClient(data.client))
            .then(dt => response);
}

//API methods
function getActiveClients(req, res) {
    var subject = security.base64Decode(req.query.sub);

    return Promise.all([appCache.getActiveClients(), sessionCache.retrieveSession(subject)])
        .then(data => {
            var availableApps =  _.partition(data[0].map(e => _.pick(e, ['id', 'baseURL', 'title', 'anonym'])), e => e.anonym),
                userApps = data[1] ? data[1].apps.map(e => e.appId) : [],
                authorizedApps = availableApps[1].filter(e => userApps.indexOf(e.id) > -1);
          //  return availableApps[0].concat(authorizedApps);
            return [{id: 'scrumboard', title: 'SCRUM board', url: config.baseURL}, {id: 'editor', title: 'Bootstrap Form Builder', url: config.baseURL}];
        })
        .catch(err => { throw err.code; });
}

module.exports = {
    authenticate: authenticate,
    codeRequest: codeRequest,
    tokenRequest: tokenRequest,
    authorizeClient: authorizeClient,
    refreshToken: refreshToken,
    clearSession: clearSession,
    exchangeKey: exchangeKey,
    register: register,
    getActiveClients: getActiveClients
};