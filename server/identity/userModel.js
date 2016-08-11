/**
 * Created by valev on 2016-04-13.
 */

var logger = libRequire('logger').getLogger(),
    models = rootRequire('./server/models/mongo'),
    errors = require('./authErrors');

function findUser(email, password) {
    return models.User.findOne({email: email})
        .populate('company', 'name title apps')
        .exec(function(err, user) {
            if (err) {
                logger.error(err);
                throw errors.server_error;
            } else if (!user) {
                logger.warning('Token request by nonexisting user: ' + email);
                throw errors.unauthorized_user;
            }
            return user.comparePasswords(password, function(err, res) {
                if (err || !res) {
                    logger.warning('Token request by user with unmatching password: ' + email);
                    throw errors.unauthorized_user;
                }
                return user;
            });
        });
}

function getAppRights(session, clientId) {
    var appRights = session.aud.find(e => e.appId === clientId);
    return appRights  ? appRights.rights : 0;
}

module.exports = {
    findUser: findUser,
    getAppRights: getAppRights
};