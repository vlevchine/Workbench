/**
 * Created by valev on 2016-04-12.
 */

var common = rootRequire('../config/all'),
    config = {//setting for Identity server!!!
    port: 3080,
    host: 'localhost',
    title: "Workbench",//because we use workbench index page as a login page for AS
    clientId: 'authServer',
    authScopes: {
        workbench: { acgf: 1, api: 1},
        scrumBoard: { acgf: 1, api: 1}
    },
    tokenChannel: 'broadcastToken',
    secret: 'secret_qwerty',
    endpoints: {
        login: '/login',
        logout: '/logout',
        error: '/error',
        onLogout: '/onlogout',
        token: '/token',
        authorize: '/authorize',
        authenticate: '/authenticate',
        register: '/register',
        exchange: '/exchange',
        refreshToken: '/refresh_token',
        clearSession: '/clear_session'
    },
    redis: {
        host: '127.0.0.1',
        port: 6379,
        options: {
            //auth_pass: 'password' // enable as needed
        },
        db: 0 // selected Redis database
    }
};

config.baseURL = 'http://'+ config.host + ':' + config.port;

module.exports = Object.assign({}, common, config);