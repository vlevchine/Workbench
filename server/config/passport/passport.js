'use strict';

//var passport = require('passport'),
//    config = require('./../config');
//
//module.exports = function(app) {
//    // Serialize sessions
//    passport.serializeUser(function(user, done) {
//        if (user) { done(null, user._id); }
//    });
//
//    // Deserialize sessions
//    passport.deserializeUser(function(user, done) {//'-salt -password',
//        //return user ? done(null, user) : done(err, false);
//        User.findOne({ _id: id })
//            .exec(function(err, user) {
//                return user ? done(null, user) : done(err, false);
//        });
//    });
//
//    config.get('./*.js',config.root + '/config/passport')
//        .filter(function(e) { return e.indexOf('Strategy') > -1; })
//        .forEach(function(e) {
//            var strategy = require(e);
//            passport.use(strategy.name, strategy.stategyFn());
//     });
//
//    app.use(passport.initialize);
//}
