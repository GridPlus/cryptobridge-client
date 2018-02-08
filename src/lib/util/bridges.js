// Formatted calls to the bridge contracts
const leftPad = require('left-pad');
const ethutil = require('ethereumjs-util');

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

// Check if a signature was made by a validator
exports.checkSig = function(h, sig, bridge, client, cb) {
  console.log('r', sig.r, 's', sig.s, 'v', sig.v, 'h', h)
  const msg = Buffer.from(h.slice(2), 'hex');
  const r = Buffer.from(sig.r, 'hex');
  const s = Buffer.from(sig.s, 'hex');
  const v = parseInt(sig.v);
  const signerPub = ethutil.ecrecover(msg, v, r, s);
  const signer = ethutil.pubToAddress(signerPub);
  // getStake(address)
  console.log('signer', signer)
  const data = `0x7a766460${leftPad(signer.toString('hex').slice(2), 64, '0')}`
  client.eth.call({ to: bridge, data: data }, (err, stake) => {
    if (err) { cb(err); }
    else if (parseInt(stake) == 0) { cb(null, null); }
    else { cb(null, `0x${signer.toString('hex')}`); }
  })
}


// getLastBlock(address)
const LAST_BLOCK_ABI = '0x4929dfa1';
// getProposer()
const GET_PROPOSER_ABI = '0xe9790d02';
