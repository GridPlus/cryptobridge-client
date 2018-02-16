// Generic util Functions
const fs = require('fs');

exports.lastPowTwo = function(n) {
  return Math.pow(2, Math.floor(Math.log(n) / Math.log(2)))
}

exports.getCacheBlock = function(cache) {
  let cacheBlock = 0;
  if (cache && cache.length > 0) {
    cacheBlock = parseInt(cache[cache.length - 1][0]);
  }
  return cacheBlock;
}

exports.concatHeadersCache = function(headers, cache, endBlock) {
  let flatCache = [];
  cache.forEach((c) => {
    if (c && c.length > 0 && c[0] <= endBlock) {
      flatCache.push(c[4]);
    }
  })
  return headers.concat(flatCache);
}

function deleteFolderRecursive(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function(file, index){
      var curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};
exports.deleteFolderRecursive = deleteFolderRecursive;

exports.parseRequest = function(req) {
  const data = req.toString('utf8');
  try {
    const j = JSON.parse(data);
    return j;
  } catch (e) {
    let msg = { type: 'REJECT' };
    if (data.indexOf('HTTP/') > 0) {
      msg.reason = 'Not compatible with HTTP requests.';
    } else {
      msg.reason = 'Could not parse your request.';
    }
    console.log(msg);
    return msg;
  }
}
