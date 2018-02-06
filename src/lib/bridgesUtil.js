// Formatted calls to the bridge contracts
const leftPad = require('left-pad');

// Get the block corresponding to the last block header Merkle root committed
// to the chain. queryAddr is the address of the bridge contract on the chain
// being queried and bridgedAddr is the address of the bridge on the other chain.
exports.getLastBlock = function(queryAddr, bridgedAddr, client, cb) {
  const data = `${LAST_BLOCK_ABI}${leftPad(bridgedAddr.slice(2), 64, '0')}`;
  client.eth.call({ to: queryAddr, data: data }, (err, ret) => {
    if (err) { cb(err); }
    else { cb(null, parseInt(ret, 16)); }
  })
}

// Get the current proposer for the chain being queried
exports.getProposer = function(queryAddr, client, cb) {
  const data = GET_PROPOSER_ABI;
  client.eth.call({ to: queryAddr, data: data }, (err, ret) => {
    if (err) { cb(err); }
    else { cb(null, ret); }
  })
}

// getLastBlock(address)
const LAST_BLOCK_ABI = '0x4929dfa1';
// getProposer()
const GET_PROPOSER_ABI = '0xe9790d02';
