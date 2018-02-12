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
    let exit = false;
    const reader = readline.createInterface({ input: fs.createReadStream(fPath) })
    reader.on('error', (err) => { cb(err); reader.close(); })
    reader.on('line', (_line) => {
      if (!exit) {
        line = _line.split(',').splice(1); // Every line has a leading comma
        for (let i = 0; i < line.length; i += 5) {
          if (parseInt(line[i]) != lastNumber + 1) {
            cb(`Problem syncing block headers. Synced to ${lastNumber} but got ${line[i]} after`);
            reader.close();
            exit = true;
          }
          lastHeader = line[i+4];
          lastNumber = parseInt(line[i]);
        }
      }
    })
    reader.on('close', () => {
      cb(null, _zipLineToCache(line));
    })
  }
}

// Sync up to the current block and save to a file. Only header data is stored.
function syncData(currentBlockN, lastBlockN, client, fStream, cache=[], cb,
lastHeader=`0x${leftPad(0, 64, '0')}`) {
  if (currentBlockN <= lastBlockN) {
    fStream.close();
    cb(null, cache);
  } else {
    client.eth.getBlock(lastBlockN + 1, (err, block) => {
      if (err) { cb(err); }
      else if (!block) { cb(null, cache); }
      else {
        let item = [ lastBlockN + 1, block.timestamp, block.transactionsRoot,
          block.receiptsRoot ];
        lastHeader = _hashHeader(lastBlockN + 1, lastHeader, block.timestamp,
          block.transactionsRoot, block.receiptsRoot);
        item.push(lastHeader);
        cache.push(item);
        if (cache.length > 100) {
          // Write chunks of 100, but make sure the cache has at least one value
          // at all times (so it can be referenced in other places)
          fStream.write(_stringify(cache.slice(0, cache.length - 1)));
          cache = [ cache[cache.length - 1] ];
        }
      }
      syncData(currentBlockN, lastBlockN + 1, client, fStream, cache, cb);
    })
  }
}
exports.syncData = syncData;

// Load saved headers inside a range of block numbers
exports.loadHeaders = function(startN, endN, fPath, cb) {
  let headers = [];
  let lastN = 0;
  const reader = readline.createInterface({ input: fs.createReadStream(fPath) })
  reader.on('error', (err) => { cb(err); reader.close(); })
  reader.on('line', (_line) => {
    line = _line.split(',').splice(1); // Every line has a leading comma
    if (parseInt(line[0]) + 99 > parseInt(startN)) {       // 100 items per line
      for (let i = 0; i < line.length; i += 5) {
        if (line[i] >= startN && line[i] <= endN) {
          // Save the header if we are in the range of desired values
          headers.push(line[i + 4]);
          lastN = line[i];
        }
      }
    } else if (line[0] === 'undefined') {
      // Need to chase down this bug. For now, resyncing seems to work
      _flushFile(fPath); reader.close();
    }
  })
  reader.on('close', () => { cb(null, headers, lastN); })
};

function _stringify(data) {
  let s = '';
  data.forEach((d) => {
    s += `,${d[0]},${d[1]},${d[2]},${d[3]},${d[4]}`;
  })
  s += '\n';
  return s;
}

function _zipLineToCache(line) {
  let c = [];
  for (let i = 0; i < line.length; i += 5) {
    c.push([ line[i], line[i + 1], line[i + 2], line[i + 3], line[i + 4] ]);
  }
  return c;
}

function _hashHeader(n, prevHeader, timestamp, transactionsRoot, receiptsRoot) {
  const str = `0x${prevHeader.slice(2)}${timestamp}${leftPad(n, 64, '0')}${transactionsRoot.slice(2)}${receiptsRoot.slice(2)}`
  return sha3(str);
}

function _flushFile(fPath) {
  fs.unlinkSync(fPath);
}
