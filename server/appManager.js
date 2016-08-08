/**
 * Created by valev on 2016-03-28.
 */

var _ = require('lodash'),
    request = require('request'),
    security = rootRequire('lib/security'),
    config = rootRequire('config/all'),
    logger = rootRequire('lib/logger').getLogger(),
    sessionCache = require('./identity/sessionCache');

var registedClients = [],
    apiEndpoint = config.baseURL + config.apiEndpoint,
    connector;

function getApiEndpoints() {
    return registedClients.reduce((acc,cur) => { return acc;}, [apiEndpoint]);
}

function createId(base) {
    return security.hmac(base, Date.now())
}

function handleRequest(req) {

}

function createClient(client) {
    var id = client + '-' + new Date().valueOf();
    return {
        client: client,
        clientId: id,
        clientSecret: security.createDigest(id)
    };
}

function register(err, payload, currentUrl) {
    if (config.clients.indexOf(payload.client) === -1) { return; }

    var client = Object.assign(payload, createClient(payload.client), {
        reqChannel: payload.client + '->' + config.clientId,
        workbenchUrl: currentUrl
    });

    if (payload.client !== config.clientId) {//don't register Workbench itself
        registedClients.push(client);
        connector.subscribeTo(client.reqChannel, function(err, req) {
            logger.debug(req);
            return req;
        });
    }
    connector.sendOneWay('registerAuth', client);//inform Identity server
    logger.info('Register client: ' + payload.client);

    return client;
}

function init(conn, data) {
    connector = conn;
    var seed = security.randomString(24);

    return new Promise(function(resolve, reject) {
        request.post({url: config.asBaseURL + config.endpoints.register, form: {seed: seed,
            client: config.clientId, pages: JSON.stringify(config.pages), baseURL: config.baseURL}},//
            function(error, response, body) {
                if (error) {//cache {sub:tokens}, broadcast {access_token,expires_in,expires_in_rt,rights:{webapi_id:rightsCode}
                    reject('Failed to connect to Authorization server');
                } else {
                    var dt = JSON.parse(body);
                    config.registeredClient = security.generateCredentials(config.clientId, dt.key, seed);
                    config.registeredClient.tokenizer = security.generateTokenSecret(dt.tokenizer, config.registeredClient.psw);
                    connector.sendToMaster({type: 'init', registerURL: config.baseURL + config.endpoints.appStart});
                }
            });
    });
}

function getIdentity(id) {
    var apps = registedClients //all registered apps except Workbench
        .filter(e => e.client !== config.clientId);
    return sessionCache.getSession(id, apps);
}

function getClients() {
    return registedClients.filter(e => !e.master).map(e => _.pick(e, ['title', 'redirect', 'client', 'clientId']));
}

function getClientsWithMaster(apps) {
    var registered = getClients();
    registered.push(_.pick(config.registeredAs, ['title', 'redirect', 'client', 'clientId']));
    return registered;
}

module.exports = {
    init: init,
    register: register,
    createClient: createClient,
    getIdentity: getIdentity,
    getClients: getClients,
    getClientsWithMaster
};