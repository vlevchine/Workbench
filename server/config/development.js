var common = rootRequire('../config/development');

var config =  {
    port: 3080,
    host: 'localhost',
    userStorage: {
        secret: 'topgear',
        connString: 'mongodb://localhost/testDatabase1'
    },
    docStorage: {
        connString: "mongodb://localhost:27017/5-terre"
    }
};



module.exports = Object.assign({}, common, config);