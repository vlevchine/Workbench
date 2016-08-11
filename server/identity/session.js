/*
 * Session cache for Identity server - used by identityManager
 * all methods return: actual data (if successful) resolved/ 'NotFound' or 'Failed' (if data access error) are rejected
 */
'use strict';

var security = libRequire('security'),
    dateUtils = libRequire('date'),
    logger = libRequire('logger').getLogger(),
    redisCache = libRequire('redisClient').redisCache,
    config = rootRequire('./server/config/authServer'),
    errors = require('./authErrors'),
    tokenFactory = require('./tokenFactory'),
    utils = require('./utils');

var cache = new redisCache(config.redis, 'SessionCache'),
    SESSION_PRX = 'session',
    USERS_SET = 'users',
    USER_PRX = 'user';

//check is access_token has comforms to access_token stored in session and session not to expire for next 10 sec
function sessionRecordValid(data) { //return jwt.decode(data.access_token)._id === data._id;
    var digest = security.createDigest(data.access_token, data.salt),
        ttl = dateUtils.getTTL(data.session_exp, true).sec;
    return digest === data.at_hash && ttl > 10;//valid at least for 10 more seconds
}

// Creates a new token for the user that has been logged in
function createSession(id, user, expiresIn) {
    var data = {
        sub: security.base64Encode(id),
        email: user.email,
        title: user.title,
        fullName: user.fullName,
        company: user.company.title
    };
    Object.assign(data, {id_token: tokenFactory.idToken(data, data.sub),
        exp: Date.now() + expiresIn * 1000, aud: JSON.stringify(user.apps), apps: JSON.stringify({})});
    return cache.setObjectById(utils.prefix(SESSION_PRX, id), data, expiresIn)
        .then(res => data)
        .catch(err => {
            logger.error("Error creating session, id: : " + id, err);
            throw errors.server_error;
        });
}

function onAuthorize(id, apps) {
    return cache.setObjectById(utils.prefix(SESSION_PRX, id), {
                    apps: JSON.stringify(apps)});
}

//Fetch the token from redis for the given key
//returns either session object or an error string
function retrieveSession(id) {
    return cache.getObjectById(utils.prefix(SESSION_PRX, id || ''))
        .then(session => {
            if (session) {
                session.aud = JSON.parse(session.aud);
                session.apps = JSON.parse(session.apps) || {};
            }

            return session;
        })
        .catch(err => {
            logger.error("Error retrieving session, id: : " + id, err);
            throw errors.server_error;
        });
}

function clearSession(id) {
    return cache.deleteById(utils.prefix(SESSION_PRX, id), 0)
        .then(res => id)
        .catch(err => {
            logger.error("Error deleting session, id: : " + id, err);
            throw errors.server_error;
        });
}

function addUser(subject, client, state, ttl) {
    var id = utils.prefix(USER_PRX, subject);
    return cache.addToSet(USERS_SET, subject)
            .then(() => cache.addToSet(id, client+ ':' + state))
            .then(() => cache.expire(id, ttl));
}

function getUserData(subject) {
    return cache.getSetMembers(utils.prefix(USER_PRX, subject));
}

function getUsers() {
    return cache.getSetMembers(USERS_SET);
}

function removeUser(value) {
    var id = utils.prefix(USER_PRX, value),
        clients;
    return cache.deleteFromSet(USERS_SET, value)
            .then(() => cache.getSetMembers(id))
            .then(data => {
                return cache.expire(id, 0)
                        .then(() => data);
            });
}


function getTTL(id) {
    return cache.getTTL(utils.prefix(SESSION_PRX, id))
        .catch(err => {
            logger.error("Error checking ttl, key: : " + id, err);
            throw errors.server_error;
        });
}

module.exports = {
    createSession: createSession,
    retrieveSession: retrieveSession,
    clearSession: clearSession,
    onAuthorize: onAuthorize,
    addUser: addUser,
    getUserData: getUserData,
    getUsers: getUsers,
    removeUser: removeUser,
    getTTL: getTTL
};