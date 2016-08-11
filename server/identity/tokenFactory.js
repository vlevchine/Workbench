/**
 * Created by valev on 2016-04-13.
 */
var _ = require('lodash'),
    jwt = require('jsonwebtoken'),
    dateUtils = libRequire('date'),
    security = libRequire('security');

var sessionSecret = security.randomString(12),
    ISSURER = 'auth_workbench';

function getExpiration(token) {
    var decoded = jwt.decode(token);
    return dateUtils.getTTL(decoded.exp, true).sec;
}

function accessToken(subject, client, expiresIn) {//subject = security.base64Encode(id),
    var secret = security.hmac(client.tok_hint, client.seed)+subject,
        payload = { iss: ISSURER, sub: subject, aud: client.requiredServices },
        token = jwt.sign(payload, secret, { expiresIn: expiresIn}),//headers: {kid: id + ':' + client.client
        decoded = jwt.decode(token);

    return {
        access_token: token,
        expiresIn: decoded.exp
    };
}

//Refresh token is a signed digest of client credentials with salt
function refreshToken(subject, client, expiresIn) {
    var secret = security.hmac(client.tok_hint, client.seed),
        salt = security.createSalt(10),
        payload = { iss: ISSURER, sub: subject, aud: client.client_id };//client.secret
    return jwt.sign(payload, secret, { expiresIn: expiresIn, headers: {kid: salt} });
}

function idToken(payload, key, expiresIn) {//subject is base64-encoded uer@comp
    var secret = sessionSecret + key;
    return expiresIn ? jwt.sign(payload, secret, { expiresIn: expiresIn}) :
        jwt.sign(payload, secret);
}

function verifyToken(token, secret) {
    return new Promise(function(resolve, reject) {//always resolves
        jwt.verify(token, secret, function(err, res) {
            if (err || !res) { reject(err); }
            resolve(res);
        });
    });
}

function verifyRefreshToken(token, client) {
    var secret = security.hmac(client.tok_hint, client.seed);

    return verifyToken(token, secret)
    .then(decoded => {
        return { subject: decoded.sub, client: decoded.client_id} ;
    });
}

module.exports = {
    accessToken: accessToken,
    refreshToken: refreshToken,
    idToken: idToken,
    validate: verifyToken,
    getExpiration: getExpiration,
    verifyRefreshToken: verifyRefreshToken
};