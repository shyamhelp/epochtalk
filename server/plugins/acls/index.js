var _ = require('lodash');
var Boom = require('boom');
var path = require('path');
var roles = require(path.normalize(__dirname + '/roles'));
var config = require(path.normalize(__dirname + '/../../../config'));

exports.register = function (server, options, next) {
  // Check ACL roles on each route
  server.ext("onPostAuth", function (request, reply) {
    // ensure user has a role
    // TODO: handle multiple stacking roles
    var userACLs;
    var authenticated = request.auth.isAuthenticated;
    if (authenticated) { userACLs = roles[request.auth.role] || roles.user; }
    else if (config.loginRequired) { userACLs = roles.noRead; }
    else { userACLs = roles.anonymous; }

    // grab permission needed for route (array? string?)
    // TODO: handle stacking roles and stacking permissions
    var routeACL = request.route.settings.plugins.permissions;
    // route has no ACLs so allow access
    if (!routeACL) { return reply.continue(); }

    // check that routeACLs is allowed
    // return error if ACL Value is false
    // else allow access to path
    var ACLValue = _.get(userACLs, routeACL);
    if (ACLValue) { return reply.continue(); }
    else { return reply(Boom.forbidden()); }
  });

  next();
};

exports.register.attributes = {
  name: 'permissions',
  version: '1.0.0'
};