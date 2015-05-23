var path = require('path');
var posts = require(path.normalize(__dirname + '/config'));

// Export Routes/Pre
module.exports = [
  { method: 'POST', path: '/posts', config: posts.create },
  { method: 'GET', path: '/posts/{id}', config: posts.find },
  { method: 'GET', path: '/posts/user/{user_id}', config: posts.pageByUser },
  { method: 'GET', path: '/posts/user/{user_id}/count', config: posts.pageByUserCount },
  { method: 'GET', path: '/posts', config: posts.byThread },
  { method: 'POST', path: '/posts/{id}', config: posts.update },
  { method: 'DELETE', path: '/posts/{id}', config: posts.delete },
  { method: 'POST', path: '/posts/import', config: posts.import }
];
