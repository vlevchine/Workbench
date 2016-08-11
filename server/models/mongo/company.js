'use strict';

// Module dependencies.
var mongoose = require('mongoose'),
    security = libRequire('security'),
    config = rootRequire('./server/config/all'),
    Schema = mongoose.Schema;

// User Schema
var CompanySchema = new Schema({
        name: {
            type: String,
            trim: true,
            default: '',
            required: 'Company name is required'
        },
        title: {
            type: String,
            trim: true,
            default: ''
        },
        nick: {
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
            match: [/.+\@.+\..+/, 'Please fill a valid email address']
        },
        apps: [String],
        updated: {
            type: Date
        },
        created: {
            type: Date,
            default: Date.now
        }
    });

//
//UserSchema.methods.toJSON = function () {
//    var user = this.toObject();
//    delete user.password;
//    delete user.salt;
//    return user;
//};
//
//UserSchema.set('toJSON', {
//    getters: true,
//    virtuals: true
//});
//UserSchema.set('toObject', {
//    virtuals: true
//});

module.exports = CompanySchema;
