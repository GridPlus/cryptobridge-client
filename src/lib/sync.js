// Functions for syncing clients, checking headers, etc
const fs = require('fs');
const leftPad = require('left-pad');
const sha3 = require('solidity-sha3').default;
const readline = require('readline');

// Read headers from a file and make sure they are correct.
// Headers are stored with metadata as comma separated values in lines of 100
exports.syncHeaders = function(fPath, cb) {
  let lastHeader = `0x${leftPad(0, 64, '0')}`;
  let lastNumber;

  if (!fs.existsSync(fPath)) { cb(null, []); }
  else {
    let line;
    const reader = readline.createInterface({ input: fs.createReadStream(fPath) })
    reader.on('error', (err) => { console.log('got dur err', err); cb(err); reader.close(); })
    reader.on('line', (_line) => {
      line = _line.split(',');
      for (let i = 0; i < line.length / 4; i += 4) {
        if (line[i] != lastNumber + 1) { cb('Problem syncing block headers.') }
        lastHeader = _hashHeader(line[i], lastHeader, line[i+1], line[i+2], line[i+3])
        lastNumber = line[i];
      }
    })
    reader.on('end', () => {
      cb(null, line)
    })
  }
}

function syncData(currentBlockN, lastBlockN, client, fStream, cache=[], cb) {
  if (currentBlockN == lastBlockN) {
    fStream.end(_stringify(cache));
    cb(null);
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
        if (cache.length > 9) {
          fStream.write(_stringify(cache));
          cache = [];
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
    s += `${d.n},${d.timestamp},${d.transactionsRoot},${d.receiptsRoot}`;
  })
  s += '\n';
  return s;
}

function _hashHeader(n, prevHeader, timestamp, transactionsRoot, receiptsRoot) {
  const str = `0x${prevHeader.slice(2)}${timestamp}${leftPad(n, 64, '0')}${transactionsRoot.slice(2)}${receiptsRoot.slice(2)}`
}
