// Functions for syncing clients, checking headers, etc
const fs = require('fs');
const leftPad = require('left-pad');
const sha3 = require('solidity-sha3').default;
const readline = require('readline');

// Read headers from a file and make sure they are correct.
// Headers are stored with metadata as comma separated values in lines of 100
exports.checkHeaders = function(fPath, cb) {
  let lastHeader = `0x${leftPad(0, 64, '0')}`;
  let lastNumber = 0;
  if (!fs.existsSync(fPath)) { cb(null, []); }
  else {
    let line;
    const reader = readline.createInterface({ input: fs.createReadStream(fPath) })
    reader.on('error', (err) => { cb(err); reader.close(); })
    reader.on('line', (_line) => {
      line = _line.split(',').splice(1); // Every line has a leading comma
      for (let i = 0; i < line.length; i += 4) {
        if (parseInt(line[i]) != lastNumber + 1) { cb('Problem syncing block headers.'); break; }
        lastHeader = _hashHeader(line[i], lastHeader, line[i+1], line[i+2], line[i+3])
        lastNumber = parseInt(line[i]);
      }
    })
    reader.on('close', () => {
      cb(null, _zipLineToCache(line));
    })
  }
}

// Sync up to the current block and save to a file. Only header data is stored.
function syncData(currentBlockN, lastBlockN, client, fStream, cache=[], cb) {
  if (currentBlockN == lastBlockN) {
    fStream.end(_stringify(cache));
    cb(null, _zipCache(cache));
  }
  else {
    client.eth.getBlock(lastBlockN + 1, (err, block) => {
      if (err) { cb(err); }
      else {
        const item = {
          n: lastBlockN + 1,
          timestamp: block.timestamp,
          transactionsRoot: block.transactionsRoot,
          receiptsRoot: block.receiptsRoot,
        };
        cache.push(item);
        if (cache.length > 100) {
          // Write chunks of 100, but make sure the cache has at least one value
          // at all times (so it can be referenced in other places)
          fStream.write(_stringify(cache.slice(0, cache.length - 1)));
          cache = cache[cache.length - 1];
        }
      }
      syncData(currentBlockN, lastBlockN + 1, client, fStream, cache, cb);
    })
  }
}
exports.syncData = syncData;

function _stringify(data) {
  let s = '';
  data.forEach((d) => {
    s += `,${d.n},${d.timestamp},${d.transactionsRoot},${d.receiptsRoot}`;
  })
  s += '\n';
  return s;
}

function _zipCache(data) {
  let c = [];
  data.forEach((d) => {
    c.push([ d.n, d.timestamp, d.transactionsRoot, d.receiptsRoot ]);
  })
  return c;
}

function _zipLineToCache(line) {
  let c = [];
  for (let i = 0; i < line.length; i += 4) {
    c.push([ line[i], line[i + 1], line[i + 2], line[i + 3] ]);
  }
  return c;
}

function _hashHeader(n, prevHeader, timestamp, transactionsRoot, receiptsRoot) {
  const str = `0x${prevHeader.slice(2)}${timestamp}${leftPad(n, 64, '0')}${transactionsRoot.slice(2)}${receiptsRoot.slice(2)}`
  return sha3(str);
}
