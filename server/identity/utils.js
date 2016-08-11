'use strict';

var jwt = require('jsonwebtoken'),
    _ = require('lodash'),
    config = rootRequire('./server/config/all');

function generateToken(payload, subject, expire) {
    return jwt.sign(payload || {}, config.userStorage.secret,
        {audience: config.clientId, subject: subject || 'anonym',
            issuer: config.serverName, expiresIn: expire });
}

function decode(token) {
    return jwt.decode(token);
}

function verifyToken(token) {
    return jwt.verifyAsync(token, config.sessionSecret);
}

function getSessionKey(company, user) {
    return 'session:' + (company || 'NA') + ':' + (user || 'NA');
}

//Find the authorization headers from the headers in the request
function fetchTokenFromHeaders(headers) {
    if (headers && headers.authorization) {
        var authorization = headers.authorization;
        var part = authorization.split(' ');
        return part.length === 2 ? part[1]: null;
    } else { return null; }
}

function tokenToKey(token) {
    var decoded = decode(token);
    return getSessionKey(decoded.company, decode.sub);
}

function parseEmail(email) {
    if (!(/.+\@.+\..+/.test(email))) { return null; }
    var toks = email.split(/\@|\./);
    toks.pop();//remove 'com' element
    return {company: toks[1], username: toks[0], sub: toks.join('@')};
}

function idFromEmail(data) {
    return !data ? '' :  _.dropRight(data.split('.'), 1).join('.');
}

function prefix(pref, val) {
    return pref + ':' + val;
}

module.exports = {
    generateToken: generateToken,
    decode: decode,
    verifyToken: verifyToken,
    getSessionKey: getSessionKey,
    fetchTokenFromHeaders: fetchTokenFromHeaders,
    tokenToKey: tokenToKey,
    parseEmail: parseEmail,
    idFromEmail: idFromEmail,
    prefix: prefix
};
