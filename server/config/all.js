//Here we collect all the properties defined in common location (both dev and prod) in a config folder above Gateway root
//plus app-specific properties defined here in files development.js and production.js

var common = rootRequire('../config/all');
    env = require('./' +(process.env.NODE_ENV || 'development') ) || {};

var appId = 'workbench',
    overall = Object.assign({}, common, env, {
        root: './bin',
        clientId: 'workbench',
        clientSecret: 'workbench_secret',
        serverName: 'identityServer',
        title: "Workbench",
        version: '1.0.0',
        anonimousAccess: true,
        clients: ['scrumBoard', 'dashboard'],
        claims: {
            wells: 1,
            well: 2,
            projects: 4,
            project: 8,
            notifications: 16
        },
        endpoints: {
            root: '/',
            login: '/login',
            logout: '/logout',
            clearSession: '/clear_session',
            error: '/error',
            as: '',//identity
            token: '/token',
            authorize: '/authorize',
            authenticate:  '/authenticate',
            register: '/register',
            appStart: 'onstart',
            exchange: '/exchange',
            refresh: '/refresh',
            refreshToken: 'refresh_token',
            userinfo: '/userinfo',
            apps: '/apps'
        },
        useServices: {workbench: 63, service1: 63, service2: 31}, //webservices used by this app - now it's just for testing
        pages: ['', 'profile'],
        apiEndpoint: '/api',
        auth: {
          base: '/auth'
        },
        templateEngine: 'ejs',
        crypto: {
            workFactor: 5000,
            keyLength: 32,
            randomSize: 256
        },
        loginEndpoint: '/login',
        tokenEndpoint: '',
        passwordSecret: 'secret',
        apiSecret: 'apisecret',
        sessionValid: {days: 0, hours: 0, mins: 5},
        refreshTokenLifeRatio: 3,
        sessionSecret: 'MeanSecret',
        sessionCollection: 'sessions',
    });

overall.port = env.port || '3000';

overall.baseURL = 'http://'+ overall.host + ':' + overall.port;
overall.asBaseURL = 'http://'+ overall.host + ':' + overall.port+overall.endpoints.as;

module.exports = overall;