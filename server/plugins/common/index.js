var uuid = require('node-uuid');
var cheerio = require('cheerio');
var Promise = require('bluebird');
var bbcodeParser = require('epochtalk-bbcode-parser');

// -- internal methods

function categoriesClean(sanitizer, payload) {
  payload.name = sanitizer.strip(payload.name);
}

function boardsClean(sanitizer, payload) {
  // name
  payload.name = sanitizer.strip(payload.name);

  // description
  if (payload.description) {
    payload.description = sanitizer.display(payload.description);
  }
}

function usersClean(sanitizer, payload) {
  var keys = ['username', 'email', 'name', 'website', 'btcAddress', 'gender', 'location', 'language', 'avatar', 'position'];
  keys.map(function(key) {
    if (payload[key]) { payload[key] = sanitizer.strip(payload[key]); }
  });

  var displayKeys = ['signature', 'raw_signature'];
  displayKeys.map(function(key) {
    if (payload[key]) { payload[key] = sanitizer.display(payload[key]); }
  });
}

function postsClean(sanitizer, payload) {
  payload.title = sanitizer.strip(payload.title);
  payload.raw_body = sanitizer.bbcode(payload.raw_body);
}

function messagesClean(sanitizer, payload) {
  payload.body = sanitizer.bbcode(payload.body);
}

function postsParse(parser, payload) {
  payload.body = parser.parse(payload.raw_body);

  // check if parsing was needed
  if (payload.body === payload.raw_body) { payload.raw_body = ''; }
}

function messagesParse(parser, payload) {
  payload.body = parser.parse(payload.body);
}

function usersParse(parser, payload) {
  payload.raw_signature = parser.parse(payload.raw_signature);
}

function imagesSub(imageStore, payload) {
  var html = payload.body;
  // load html in post.body into cheerio
  var $ = cheerio.load(html);

  // collect all the images in the body
  var images = [];
  $('img').each(function(index, element) {
    images.push(element);
  });

  // convert each image's src to cdn version
  return Promise.map(images, function(element) {
    var imgSrc = $(element).attr('src');
    var savedUrl = imageStore.saveImage(imgSrc);

    if (savedUrl) {
      // move original src to data-canonical-src
      $(element).attr('data-canonical-src', imgSrc);
      // update src with new url
      $(element).attr('src', savedUrl);
    }
  })
  .then(function() { payload.body = $.html(); });
}

function imagesSignature(imageStore, payload) {
  // remove images in signature
  if (payload.signature) {
    var $ = cheerio.load(payload.signature);
    $('img').remove();
    payload.signature = $.html();
  }

  // clear the expiration on user's avatar
  if (payload.avatar) {
    imageStore.clearExpiration(payload.avatar);
  }
}

function imagesSite(imageStore, payload) {
  // clear the expiration on logo/favicon
  if (payload.website.logo) {
    imageStore.clearExpiration(payload.website.logo);
  }
  if (payload.website.favicon) {
    imageStore.clearExpiration(payload.website.favicon);
  }
}

function checkView(server, headers, info, threadId) {
  var viewerId = headers['epoch-viewer'];
  var newViewerId = '';

  // Check if viewerId and threadId is found
  var viewerIdKey = viewerId + threadId;
  var promise = checkViewKey(viewerIdKey, server.redis)
  .then(function(valid) { // viewId found
    if (valid) { return server.db.threads.incViewCount(threadId); }
  })
  .catch(function() { // viewId not found
    // save this viewerId to redis
    if (viewerId) { server.redis.setAsync(viewerIdKey, Date.now()); }
    // create new viewerId and save to redis
    else {
      newViewerId = uuid.v4();
      server.redis.setAsync(newViewerId + threadId, Date.now());
    }

    // Check if ip address and threadId is found
    var viewerAddress = info.remoteAddress;
    var addressKey = viewerAddress + threadId;
    return checkViewKey(addressKey, server.redis)
    .then(function(valid) { // address found
      if (valid) { return server.db.threads.incViewCount(threadId); }
    })
    .catch(function() { // address not found
      // save this address + threadId combo to redis
      server.redis.setAsync(addressKey, Date.now());
      // increment view count
      return server.db.threads.incViewCount(threadId);
    });
  })
  .then(function() { return newViewerId; });

  return promise;
}

function updateView(server, auth, threadId) {
  var promise;
  if (auth.isAuthenticated) {
    var userId = auth.credentials.id;
    promise = server.db.users.putUserThreadViews(userId, threadId);
  }
  return promise;
}

// private methods

function checkViewKey(key, redis) {
  return redis.getAsync(key)
  .then(function(storedTime) {
    if (storedTime) { return storedTime; }
    else { return Promise.reject(); } // value is null
  })
  .then(function(storedTime) {
    var timeElapsed = Date.now() - storedTime;
    // key exists and is past the cooling period
    // update key with new value and return true
    if (timeElapsed > 1000 * 60) {
      return redis.setAsync(key, Date.now())
      .then(function() { return true; });
    }
    // key exists but before cooling period
    // do nothing and return false
    else { return false; }
  });
}

// -- API

exports.register = function(server, options, next) {
  options = options || {};
  options.methods = options.methods || [];

  // append hardcoded methods to the server
  var internalMethods = [
    // -- categories
    {
      name: 'common.categories.clean',
      method: categoriesClean,
      options: { callback: false }
    },
    // -- boards
    {
      name: 'common.boards.clean',
      method: boardsClean,
      options: { callback: false }
    },
    // -- users
    {
      name: 'common.users.clean',
      method: usersClean,
      options: { callback: false }
    },
    {
      name: 'common.users.parse',
      method: usersParse,
      options: { callback: false }
    },
    // -- posts
    {
      name: 'common.posts.clean',
      method: postsClean,
      options: { callback: false }
    },
    {
      name: 'common.posts.parse',
      method: postsParse,
      options: { callback: false }
    },
    // -- messages
    {
      name: 'common.messages.clean',
      method: messagesClean,
      options: { callback: false }
    },
    {
      name: 'common.messages.parse',
      method: messagesParse,
      options: { callback: false }
    },
    // -- images
    {
      name: 'common.images.sub',
      method: imagesSub,
      options: { callback: false }
    },
    {
      name: 'common.images.signature',
      method: imagesSignature,
      options: { callback: false }
    },
    {
      name: 'common.images.site',
      method: imagesSite,
      options: { callback: false }
    },
    // -- threads
    {
      name: 'common.threads.checkView',
      method: checkView,
      options: { callback: false }
    },
    {
      name: 'common.threads.updateView',
      method: updateView,
      options: { callback: false }
    },
  ];

  // append any new methods to methods from options
  var methods = [].concat(options.methods, internalMethods);
  server.method(methods);

  next();
};

exports.register.attributes = {
  name: 'common',
  version: '1.0.0'
};