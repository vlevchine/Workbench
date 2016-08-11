/** Created by Vlad on 2014-09-30. */
'use strict';

// Module dependencies.
var mongoose = require('mongoose'),
    _ = require('lodash'),
    bcrypt = require('bcrypt-nodejs'),
    jwt = require('jsonwebtoken'),
    security = libRequire('security'),
    utils = libRequire('utils'),
    config = rootRequire('./server/config/all'),
    minPasswordLength = 5,
    Schema = mongoose.Schema;

// A Validation function for local strategy properties
var validateLocalStrategyProperty = function(property) {
    return ((this.provider !== 'local' && !this.updated) || property.length);
};

// A Validation function for local strategy password

var validateLocalStrategyPassword = function(password) {
    return (this.provider !== 'local' || (password && password.length >= minPasswordLength));
};

// User Schema
var NameValueSchema = new Schema({
        name: {type: String},
        value: { type: Number }
    }),
    AppRightsSchema = new Schema({
        appId: {type: String},
        rights: { type: Number },
        roles: {
            type: [{type: String}],
            default: ['guest']
        },
        groups: {
            type: [{type: String}],
            default: ['guests']
        }//, api: [NameValueSchema]
    }),
    UserSchema = new Schema({
        firstName: {
            type: String,
            trim: true,
            default: '',
            required: '{PATH} is required'
        },
        lastName: {
            type: String,
            trim: true,
            default: '',
            validate: [validateLocalStrategyProperty, 'Please fill in your last name']
        },
        company: {type: Schema.Types.ObjectId, ref: 'Company', required: 'Company is required'},
        nick: {
            type: String,
            trim: true
        },
        title: {
            type: String,
            trim: true
        },
        image: {
            type: String,
            trim: true
        },
        displayName: {
            type: String,
            trim: true
        },
        email: {
            type: String,
            trim: true,
            default: '',
            validate: [validateLocalStrategyProperty, 'Please fill in your email'],
            match: [/.+\@.+\..+/, 'Please fill a valid email address']
        },
        username: {
            type: String,
            unique: true,
            required: 'Username is required',
            trim: true
        },
        password: {
            type: String,
            default: '',
            validate: [validateLocalStrategyPassword, 'Password should be longer']
        },
        salt: {//use to hash your password
            type: String
        },
        provider: {//indicate the strategy used to register the user
            type: String,
            required: 'Provider is required'
        },
        providerId: String, //indicate the user identifier for the authentication strategy
        providerData: {}, //use to store the user object retrieved from OAuth providers
        additionalProvidersData: {},
        apps: [AppRightsSchema],
        updated: {
            type: Date
        },
        created: {
            type: Date,
            default: Date.now
        },
        /* For reset password */
        resetPasswordToken: {
            type: String
        },
        resetPasswordExpires: {
            type: Date
        }
    });

UserSchema.virtual('fullName').get(function() {
        return this.firstName + ' ' + this.lastName;
    }).set(function(fullName) {
        var splitName = fullName.split(' ');
        this.firstName = splitName[0] || '';
        this.lastName = splitName[1] || '';
    });

//pre save method to hash the password using bcrypt
UserSchema.pre('save', function(next) {
    var user = this;
    if (!user.isModified('password')) { return next(); }
    if (!user.password || this.password.length < minPasswordLength) {
        return next(new Error('Password is not sufficiently strong')); }

    bcrypt.genSalt(10, function(err, salt) {
        if (err) { return next(err); }

        bcrypt.hash(user.password, salt, null,  function(err, hash) {
            if (err) { return next(err); }
            user.salt = salt;
            user.password = hash;
            user.username = user.username.toLowerCase();//username to be stored in lower case - always!!!
            next();
        });
    });
});


//instance method for authenticating user
UserSchema.methods.authenticate = function(password) {
    return this.password === this.hashPassword(password);
};
UserSchema.methods.comparePasswords = function(password, callback) {
    bcrypt.compare(password, this.password, callback);
};

UserSchema.methods.hashPassword = function(password) {
    return security.hashPasswordStrong(this.salt, password);
};

UserSchema.methods.hasRole = function(role) {
    return this.roles.indexOf(role) > -1;
};

UserSchema.methods.generateJwt = function(payload) {
    var TOKEN_EXPIRATION =  utils.toMinutes(config.sessionValid);

    _.assign(payload, {
        sub: this._id,
        username: this.username,
        company: this.company,
        claims: this.claims,
        roles: this.roles,
        groups: this.groups,
        email: this.email,
        name: this.fullName,
        exp: new Date().valueOf() + TOKEN_EXPIRATION * 60000});

    return jwt.sign(payload, config.userStorage.secret, {expiresInMinutes: TOKEN_EXPIRATION});
};

// used to find an available unique username for new users
UserSchema.statics.findUniqueUsername = function(username, suffix, callback) {
    var _this = this;
    var possibleUsername = username + (suffix || '');

    _this.findOne({
        username: possibleUsername
    }, function(err, user) {
        if (!err) {
            if (!user) {
                callback(possibleUsername);
            } else {
                return _this.findUniqueUsername(username, (suffix || 0) + 1, callback);
            }
        } else {
            callback(null);
        }
    });
};

UserSchema.methods.toJSON = function () {
    var user = this.toObject();
    delete user.password;
    delete user.salt;
    return user;
};

UserSchema.set('toJSON', {
    getters: true,
    virtuals: true
});
UserSchema.set('toObject', {
    virtuals: true
});

module.exports = UserSchema;
