/**
 * Created by valev on 2016-02-16.
 */
'use strict';

// Module dependencies.
var LocalStrategy = require('passport-local').Strategy,
    User = require('../../models/mongo').User;

module.exports = {
    name: 'login-local',
    stategyFn: function() {
        return new LocalStrategy({
                usernameField: 'email',
                passwordField: 'password',
                passReqToCallback: true
            }, function(req, username, password, done) {
                User.findOne({email: username})
                    .populate('company')
                    .exec(function(err, user) {
                        if (err) { return done(err) ; }
                        if (!user) {
                            return done(null, false, {message: 'Incorrect login'});
                        }
                        user.comparePasswords(password, function(err, isMatch) {
                            if (err) { return done(null, false, {message: 'login/password do not match'}); }
                            if (isMatch) {
                                return done(null, {
                                    username: user.username,
                                    fullName: user.fullName,
                                    company: user.company.title,
                                    coname: user.company.name.toLowerCase(),
                                    title: user.title,
                                    image: user.image,
                                    email: user.email,
                                    apps: user.apps
                                });
                            }
                        });
                    });
            }
        );
    }
};