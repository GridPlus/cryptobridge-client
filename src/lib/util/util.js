// Generic util Functions
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
