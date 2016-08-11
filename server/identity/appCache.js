/**
 * Created by valev on 2016-04-13.
 */
var logger = libRequire('logger').getLogger(),
    redisCache = libRequire('redisClient').redisCache,
    config = rootRequire('./server/config/authServer'),
    encryptor = libRequire('encryptor'),
    errors = require('./authErrors'),
    utils = require('./utils');

var cache = new redisCache(config.redis, 'AppCache'),
    APP_PRX = 'app',
    CLIENTS_SET = 'clients',
    clients = new Map();

function add(id, data) {
    return cache.setObjectById(utils.prefix(APP_PRX, id), data)
        .then(res => data)
        .catch(err => {
            logger.error("Error caching application data on registration, id: : " + id, err);
            throw errors.server_error;
        });
}

function get(clientId, clientSecret) {
    return cache.getObjectById(utils.prefix(APP_PRX, clientId))
        .then(client => {
            if (!client) {
                throw errors.invalid_client;
            } else if (clientSecret && (encryptor.decrypt(clientSecret, client.seed) === client.secret)) {
                throw errors.unauthorized_client;
            }
            client.requiredServices = JSON.parse(client.requiredServices);
            return client;
        })
        .catch(err => {
            logger.error("Error retrieving app data from cache, id: : " + clientId, err);
            throw errors.server_error;
        });
}

function remove(id) {
    return cache.deleteById(utils.prefix(APP_PRX, id))
        .then(client => {
            return 'OK';
        })
        .catch(err => {
            logger.error("Error retrieving app data from cache, id: : " + id, err);
            throw errors.server_error;
        });
}

function addClient(value) {
    return cache.addToSet(CLIENTS_SET, value);
}

function getClients() {
    return cache.getSetMembers(CLIENTS_SET);
}

function removeClients(value) {
    return cache.deleteFromSet(CLIENTS_SET, value);
}

function getActiveClients() {
    return Promise.all(Object.keys(config.authScopes).map( e => cache.getObjectById(utils.prefix(APP_PRX, e)) ))
        .then(data => data.filter(e => !!e));
}

module.exports = {
    add: add,
    get: get,
    remove: remove,
    addClient: addClient,
    getClients: getClients,
    removeClients: removeClients,
    getActiveClients: getActiveClients
};