'use strict';
/* jslint node: true */
/* global angular */

module.exports = ['$location', '$rootScope', '$http', '$window', 'User',
  function($location, $rootScope, $http, $window, User) {
    var loginState = 'Not Logged In';
    var getUser = function() {
      var username;
      if ($window.sessionStorage.username) {
        username = $window.sessionStorage.username;
      }
      else if ($window.localStorage.username) {
        username = $window.localStorage.username;
      }
      return username;
    };

    return {
      register: function(user, callback, error) {
        // get username
        var username = user.username;
        User.register(user, callback, error).$promise
        .then(function(resource) {
          var token = resource.token;
          loginState = 'Logged In as ' + username;
          $window.sessionStorage.token = token;
          $window.sessionStorage.username = username;
        })
        .catch(function(err) {
          loginState = 'Not Logged In';
          // delete storage keys
          delete $window.sessionStorage.token;
          delete $window.sessionStorage.username;
          delete $window.localStorage.token;
          delete $window.localStorage.username;
        });
      },

      login: function(user, callback, error) {
        // get username and rememberMe
        var username = user.username;
        var rememberMe = user.rememberMe;
        delete user.rememberMe;

        User.login(user, callback, error).$promise
        .then(function(resource) {
          var token = resource.token;
          loginState = 'Logged In as ' + username;
          if (rememberMe) {
            $window.localStorage.token = token;
            $window.localStorage.username = username;
          }
          else {
            $window.sessionStorage.token = token;
            $window.sessionStorage.username = username;
          }
        })
        .catch(function(err) {
          loginState = 'Not Logged In';
          // delete storage keys
          delete $window.sessionStorage.token;
          delete $window.sessionStorage.username;
          delete $window.localStorage.token;
          delete $window.localStorage.username;
        });
      },

      logout: function(callback, error) {
        User.logout(callback, error).$promise
        .then(function() {
          loginState = 'Not Logged In';
          // delete key from session storage
          delete $window.sessionStorage.token;
          delete $window.sessionStorage.username;
          delete $window.localStorage.token;
          delete $window.localStorage.username;
        })
        .catch(function(err) {
          if (err.data.message === 'Not Logged In') {
            delete $window.sessionStorage.token;
            delete $window.sessionStorage.username;
            delete $window.localStorage.token;
            delete $window.localStorage.username;
            loginState = 'Logged Out';
          }
          else {
            loginState = 'Could Not Log You Out';
          }
        });
      },

      isAuthenticated: function() {
        var authenticated = false;
        if ($window.sessionStorage.token ||
            $window.localStorage.token) {
          authenticated = true;
        }
        return authenticated;
      },

      loginState: function() {
        var username = getUser();
        if (username) { loginState = 'Logged In as ' + username; }
        return loginState;
      },

      currentUser: function() {
        // check if key exists in storage
        var username = getUser();
        $rootScope.currentUser = username;
        return username;
      },

      checkUsername: function(username, callback, error) {
        $http({ method: 'GET', url: '/api/register/username/' + username })
        .success(callback)
        .error(error);
      },

      checkEmail: function(email, callback, error) {
        $http({ method: 'GET', url: '/api/register/email/' + email })
        .success(callback)
        .error(error);
      }

      // changePassword: function(email, oldPassword, newPassword, callback) {
      //   var cb = callback || angular.noop;
      //   User.update({
      //     email: email,
      //     oldPassword: oldPassword,
      //     newPassword: newPassword
      //   }, function(user) {
      //       console.log('password changed');
      //       return cb();
      //   }, function(err) {
      //       return cb(err.data);
      //   });
      // }

      // removeUser: function(email, password, callback) {
      //   var cb = callback || angular.noop;
      //   User.delete({
      //     email: email,
      //     password: password
      //   }, function(user) {
      //       console.log(user + 'removed');
      //       return cb();
      //   }, function(err) {
      //       return cb(err.data);
      //   });
      // }
    };
  }
];
