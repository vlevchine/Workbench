//Here we collect all common + app-specific properties - provided by all.js
//and run several initialization tasks: passport
//properties exposed
'use strict';

var _ = require('lodash'),
    path = require('path'),
    glob = require('glob'),
    all = require('./all');

var _appPath = ''; //TBD

module.exports = all;

/** Module init function.  */
module.exports.init = function() {
    /** Look for a valid NODE_ENV variable and if one cannot be found load the development NODE_ENV	 */
    var  environmentFiles = glob('./config/env/' + process.env.NODE_ENV + '.js');
    if (!environmentFiles.length) {
        if (process.env.NODE_ENV) {
            console.error('\x1b[31m', 'No configuration file found for "' + process.env.NODE_ENV + '" environment using development instead');
        } else {
            console.error('\x1b[31m', 'NODE_ENV is not defined! Using default development environment');
        }

        process.env.NODE_ENV = 'development';
    } else {
        console.log('\x1b[7m', 'Application loaded using the "' + process.env.NODE_ENV + '" environment configuration');
    }
    console.log('\x1b[0m', 'Environment set');

    // Add our server node extensions
    require.extensions['.server.controller.js'] = require.extensions['.js'];
    require.extensions['.server.model.js'] = require.extensions['.js'];
    require.extensions['.server.routes.js'] = require.extensions['.js'];

};

//Get files by glob patterns
module.exports.getGlobbedFiles = function(globPatterns, removeRoot) {
    // For context switching
    var _this = this;

    // URL paths regex
    var urlRegex = new RegExp('^(?:[a-z]+:)?\/\/', 'i');

    // The output array
    var output = [];

    // If glob pattern is array so we use each pattern in a recursive way, otherwise we use glob
    if (_.isArray(globPatterns)) {
        globPatterns.forEach(function(globPattern) {
            output = _.union(output, _this.getGlobbedFiles(globPattern, removeRoot));
        });
    } else if (_.isString(globPatterns)) {
        if (urlRegex.test(globPatterns)) {
            output.push(globPatterns);
        } else {
            var files = glob.sync(globPatterns);

            if (removeRoot) {
                files = files.map(function(file) {
                    return file.replace(removeRoot, '');
                });
            }

            output = _.union(output, files);
        }
    }

    return output;
};

module.exports.get = function(patterns, root) {
    return glob.sync(patterns, {cwd: root});
};

// Get the modules JavaScript files
module.exports.getJavaScriptAssets = function(includeTests) {
    var output = this.getGlobbedFiles(this.assets.lib.js.concat(this.assets.js), _appPath);

    // To include tests
    if (includeTests) {
        output = _.union(output, this.getGlobbedFiles(this.assets.tests));
    }

    return output;
};

// Get the modules CSS files
module.exports.getCSSAssets = function() {
    var output = this.getGlobbedFiles(this.assets.lib.css.concat(this.assets.css), _appPath);
    return output;
};

module.exports.getClients = function(user) {
    var apps = user ? user.apps.toObject() : [],
        userApps = [],
        app;
    _.values(this.clients)
        .forEach(function(e) {
            app = e.anonimousAccess ? e : _.assign(_.pick(e, ['title', 'version', 'url', 'description']),
                apps.find(function(app) { return app.appId === e.id; }));
            delete app._id;
            userApps.push(app);
        });

    return userApps;
};