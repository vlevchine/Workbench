/**
 * Created by valev on 2016-04-18.
 */
var security = libRequire('security'),
    errors = require('./authErrors');

var guard = {
    assert: function(assertion, args, error) {
        if (!assertion.apply(null, args)) { throw error; }
        return this;
    }
};

//Guardian assumes a set of tests {valid,error} na runs until first failure
function validate(tests) {
    return new Promise(function(resolve, reject) {
        var invalid = tests.find(t => !t.guard.apply(null, t.args));
        if (!invalid) {
            resolve('OK');
        } else {
            reject(invalid.error);
        }
    });
}

//test: object contains all the properties listed and all are truthy
function wellFormed(obj, props) {
    return Object.keys(obj)
            .filter(p => props.indexOf(p) > -1 && !!obj[p]).length === props.length;
}

function whiteListed(obj, prop, whitelist) {
    var pr = obj[prop];
    return !!pr && whitelist.indexOf(pr) > -1;
}


//AS specific guards
var config;
function init(conf) {
    config = conf;
}

var registerRequestProps = ['state', 'client', 'pages', 'services', 'baseURL'],
    authRequestProps = ['client_id', 'response_type', 'scope', 'redirect_uri', 'state'],
    grantTypes = ['authorization_code', 'refresh_token', 'revoke', 'key'],
    responseTypes = ['code', 'token', 'key'];

function validateRegisterRequest(data) {
    //return !!guard.assert(wellFormed, [data, registerRequestProps], errors.invalid_request);
    return validate([
        { guard: wellFormed, args: [data, registerRequestProps], error: errors.invalid_request }
    ]);
}

function preValidatePostRequest(data, props) {//ACGF: token, Refresh
    return validate([
        { guard: wellFormed, args: [data, props], error: errors.invalid_request },
        { guard: () => grantTypes.indexOf(data.grant_type) > -1, args: [], responseTypes: errors.unsupported_grant_type }
    ]);
}

function preValidateRequestToRedirect(data) {//ACGF:code, IGF
    return validate([
        { guard: wellFormed, args: [data, authRequestProps], error: errors.invalid_request },
        { guard: () => responseTypes.indexOf(data.response_type) > -1, args: [], error: errors.unsupported_response_type}
    ]);
}

function validateOnCodeRequest(clientId, scopes) {
    var whitelisted =  Object.keys(config.authScopes).filter(e => !!config.authScopes[e].acgf);
    return validate([
        { guard: () => whitelisted.indexOf(clientId) > -1, args: [clientId], error: errors.unauthorized_client },
        { guard: () => scopes.length > 0, args: [], error: errors.invalid_scope}
    ]);
}

function validateLoginRequest(data, cached) {
    return validate([
        { guard: () => !!cached, args: [], error: errors.invalid_request },
        { guard: () => data.challenge === cached.challenge, args: [], error: errors.invalid_request}
    ]);
}

function validateStoredRequest(req, flow) {
    return validate([
        { guard: () => !!flow, args: [], error: errors.invalid_client },
        { guard: () => req.body.code === flow.code, args: [], error: errors.invalid_grant}
    ]);
}

function validateSesion(session) {
    return validate([
        { guard: () => !!session && new Date(parseInt(session.exp)) > Date.now(), args: [], error: errors.access_denied }
    ]);
}

function validateRequestCredentials(client, credentials) {
    return validate([
        { guard: () => credentials.id === client.client_id, args: [], error: errors.invalid_client },
        { guard: () => credentials.secret === security.hmac(client.secret, client.salt), args: [], error: errors.unauthorized_client }
    ]);
}

function validateIGFlowRequest(fromQuery, fromCookie){
    return validate([
        { guard: () => fromQuery === fromCookie, args: [], error: errors.invalid_scope }
    ]);
}

function validateState(clean, hashed, seed) {
    return validate([
        { guard: () => security.hmac(clean, seed) === hashed, args: [], error: errors.invalid_request }
    ]);
}


module.exports = {
    validate: validate,
    wellFormed: wellFormed,

    init: init,
    validateRegisterRequest: validateRegisterRequest,
    preValidatePostRequest: preValidatePostRequest,
    validateOnCodeRequest: validateOnCodeRequest,
    validateStoredRequest: validateStoredRequest,
    validateSesion: validateSesion,
    preValidateRequestToRedirect: preValidateRequestToRedirect,
    validateLoginRequest: validateLoginRequest,
    validateRequestCredentials: validateRequestCredentials,
    validateIGFlowRequest: validateIGFlowRequest,
    validateState: validateState
};