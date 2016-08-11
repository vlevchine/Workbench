/**
 * Created by valev on 2016-04-08.
 */

var errors = {//default code 500
    access_denied: { code: 'access_denied', status: 401 },
    invalid_grant: { code: 'invalid_grant', status: 400 },
    invalid_client: { code: 'invalid_client', status: 401 },
    invalid_request: { code: 'invalid_request', status: 400 },
    invalid_scope: { code: 'invalid_scope', status: 401 },
    invalid_token: { code: 'invalid_token', status: 401 },
    not_found: { code: 'not_found'},
    server_error: { code: 'server_error', status: 503 },
    temporarily_unavailable: { code: 'temporarily_unavailable', status: 500 },
    unauthorized_client: { code: 'unauthorized_client', status: 401 },
    unauthorized_user: { code: 'unauthorized_user', status: 401 },
    unsupported_grant_type: { code: 'unsupported_grant_type', status: 400 },
    unsupported_response_type: { code: 'unsupported_response_type', status: 401 },
    coerce: function(err) { return err.code !== 'not_found' ? err.code : 'invalid_scope'; },
    toURL: function(err, baseURL) { return baseURL + '?error='+ encodeURIComponent(this.coerce(err)); }, //not_found is not a standard OAuth error => coerce it to invalid_scope
    toPostResponse: function(err, res) { return res.status(400).json({error: this.coerce(err)}); }
};

module.exports = errors;