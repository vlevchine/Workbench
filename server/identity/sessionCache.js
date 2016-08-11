'use strict';

var _ = require('lodash'),
    jsonwebtoken = require('jsonwebtoken'),
    utils = require('./utils'),
    security = libRequire('security'),
    errors = libRequire('errors'),
    logger = libRequire('logger').getLogger(),
    redisClient = libRequire('lib/redisClient'),
    config = rootRequire('./server/config/all');

var appConnector, client,
    TOKEN_EXPIRATION = 60 * 1, //dateUtils.toMinutes(config.sessionValid),
    TOKEN_KEEP_ALIVE = 4 * TOKEN_EXPIRATION,
    ISSURER = 'is_workbench',
    CODE_PRX = 'code',
    SESSION_PRX = 'session';

function init(connector) {
    client = redisClient.createClient(config.redis, 'SessionCache');
    appConnector = connector;
}

function sessionRecordConsistent(data) {
    return security.createDigest(data.access_token, data.salt) === data.at_hash; //
    //return jsonwebtoken.decode(data.access_token)._id === data._id;
}

function toSessionId(id, prefix){
    return (prefix || SESSION_PRX) + ':' + id.replace('@', ':');
}

//Folloowing are service methods, not middleware
//Find the authorization headers from the headers in the request
function fetchTokenFromHeaders(headers) {
    if (headers && headers.authorization) {
        var authorization = headers.authorization;
        var part = authorization.split(' ');
        return part.length === 2 ? part[1]: null;
    } else { return null; }
}

// Expires the token, so the user can no longer gain access to the system, without logging in again or requesting new token
function expire(headers) {
    var token = fetchTokenFromHeaders(headers);
    logger.debug("Expiring token: %s", token);
    if (!!token) {
        client.expire(token, 0);
    }
    return !!token;
}

function appRegistered(data) {
    var key = toSessionId(data.client, 'app');
    return client.hmsetAsync(key, data)
        .then(function (result) {
            if (!result) { throw new errors.InternalError('Failed to write registered app data into redis'); }
        })
        .catch(function(err) {
            throw new errors.InternalError('Failed to write registered app data into redis');
        });
}

// Creates a new token for the user that has been logged in
function createSession(id, user, apps) {
    if (_.isEmpty(user)) {
        return Promise.reject('Insufficient data.');
    }

    var userProps = { sub: id, aud: apps.join(' '), iss: ISSURER },
        data = Object.assign({},  userProps, {salt: security.createSalt(10)}),
        access_token = jsonwebtoken.sign(userProps, config.sessionSecret, { expiresIn: TOKEN_EXPIRATION }),
        id_token = jsonwebtoken.sign(userProps, config.sessionSecret, { expiresIn: TOKEN_KEEP_ALIVE }),
        refresh_token = jsonwebtoken.sign(security.createDigest(JSON.stringify(userProps), data.salt), config.sessionSecret, { expiresIn: TOKEN_KEEP_ALIVE }),
        atDecoded = jsonwebtoken.decode(access_token),
        idtDecoded = jsonwebtoken.decode(id_token),
        sessionId = toSessionId(id);
    Object.assign(data, {//expiration times set in seconds
        at_exp: atDecoded.exp,
        idt_exp: idtDecoded.exp,
        token_iat: atDecoded.iat,
        access_token: access_token,
        at_hash: security.createDigest(access_token, data.salt),
        refresh_token: refresh_token,
        email: user.email,
        fullName: user.fullName,
        company: user.company.title
    });

    return client.hmsetAsync(sessionId, data)
        .then(function (result) {
            if (!result) { throw new errors.InternalError('Failed to write token into redis'); }
            return client.expireAsync(sessionId, TOKEN_KEEP_ALIVE);
        })
        .then(function(reply) {
            if (!reply) { throw new errors.InternalError('Failed to set token expiration in redis'); }
            return data;
        });
}

function clearSession(id) {
    return client.expireAsync(toSessionId(id), 0);
}

//Fetch the token from redis for the given key
function retrieveSession(id) {
    if (!id) { return 'Invalid id'; }

    return client.hgetallAsync(toSessionId(id))
        .then(function(result) {
            if (!result) {
                return "Session doesn't exists, it may have been expired or revoked";
            } else if (!sessionRecordConsistent(result)) {
                return "Session invalid.";
            }

            return result;
        });
}

function storeCode(code, key) {
    return client.setAsync(code, toSessionId(key, CODE_PRX), 'EX', 60);
}

module.exports = {
    init: init,
    appRegistered: appRegistered,
    createSession: createSession,
    clearSession: clearSession,
    retrieveSession: retrieveSession,
    storeCode: storeCode

};

//function getAnonymous(apps) {
//    var anonymApps = apps.filter(e => e.anonym),
//        entry =  {
//            subject: 'anonym'
//        };
//
//    return {
//        'id_token': utils.generateToken(entry, null, TOKEN_KEEP_ALIVE_SEC),
//        scope: anonymApps.map(e => e.client).join(' '),
//        subject: security.createDigest(entry.subject)
//    }
//};
//




//
//
////Follwong are middleware methods
////Verifies that the token supplied in the request is valid, by checking the redis store to see if it's stored there.
//module.exports.verify = function (req, res, next) {
//    var token = exports.fetchToken(req.headers);
//    jsonwebtoken.verify(token, config.sessionSecret, function (err, decode) {
//        if (err) {
//            req.user = undefined;
//            return next(new errors.UnauthorizedAccessError("invalid_token"));
//        }
//        exports.retrieve(token, function (err, data) {
//            req.user = undefined;
//            if (err) {
//                return next(new errors.UnauthorizedAccessError("invalid_token", data));
//            }
//            if (data.token_exp > (new Date().valueOf() / 1000)) {
//                return next(new errors.UnauthorizedAccessError("expired_token", data));
//            }
//
//            req.user = data;
//            next();
//        });
//    });
//};
//
//module.exports.renew = function (req, res, next) {
//    var access_token = exports.fetchToken(req.headers),
//        id_token = req.headers ? req.headers['x-requested-with'] : '';
//    if (!id_token) { utils.sendJSON(res, 400, {message: 'Bad request: id_token missing when requesting to renew token'}); }
//
//    exports.retrieve(access_token, function (err, data) {
//        if (err) {
//            req.user = undefined;
//            utils.sendJSON(res, 404, {
//                message: 'No data found for provided token, login into the system so it can generate new token.'});
//        } else {//clean retrieved data and create a new session
//            delete data.token_exp;
//            delete data.token_iat;
//            client.del(access_token);
//            exports.createSession(data, true)
//            .then(function(dt) {
//                utils.sendJSON(res, 200, dt.access_token);
//            }, function(err) {
//                utils.sendJSON(res, 404, {
//                    message: "Access and ID tokens don't match, login into the system so it can generate new token." });
//            });
//        }
//    });
//};
//
//// Middleware for getting the token into the user
//module.exports.authorize = function (accessLevel) {
//    var func = function (req, res, next) {
//        var token = exports.fetchToken(req.headers);
//        exports.retrieve(token, function (err, data) {
//            req.user = undefined;
//            var current = new Date().valueOf() / 1000,
//                sufficient = true;//!accessLevel || (data.claims & accessLevel === accessLevel);
//            if (err) {
//                utils.sendJSON(res, 401, data);
//            } else if (data.token_exp < current) {
//                utils.sendJSON(res, 412, {message: "Request unauthorized (access token expired)"});
//            }  else if (!sufficient) {
//                utils.sendJSON(res, 403, {message: "Request unauthorized (insufficient claims)"});
//            } else {
//                req.user = _.merge(req.user || {}, data);
//                next();
//            }
//        });
//    };
//    func.unless = require("express-unless");
//    return func;
//};
