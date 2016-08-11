"use strict";
var Express = require('express'),
    request = require('request');
    //security = rootRequire('lib/security'),
    //config = rootRequire('config/all'),
    //authServer = rootRequire('lib/auth_client/authServer');

function setRoutes(app) {
    var router = Express.Router();
    router.get('/', (req,res)=>{
        res.render('index');
    });

    router.get('/messages', (req,res)=>{
        res.status(200).json(require('./messages.json'));
    });

    app.use('/', router);

    return router;
}

module.exports = {
    setRoutes: setRoutes
};
