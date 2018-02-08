// Functions for staking and destaking
const leftPad = require('left-pad');

exports.stake = function(bridge, amount, from, client, wallet, gasPrice=1000000000, gas=500000) {
  let stakeToken;
  let tx = {
    gas: gas,
    gasPrice: gasPrice,
    from: from,
    to: bridge,
    data: `0xa694fc3a${leftPad(parseInt(amount).toString(16), 64, '0')}`,
    value: 0,
  };
  // Get staking token
  const stakingCall = `0x51ed6a30`;
  client.eth.call({ to: bridge, data: stakingCall }, (err, token) => {
    stakeToken = `0x${token.slice(26)}`;
    // Get the number of tokens
    const balanceCall = `0x70a08231${leftPad(from.slice(2), 64, '0')}`;
    client.eth.call({ to: stakeToken, data: balanceCall }, (err, balance) => {
      if (parseInt(balance) < parseInt(amount)) { console.log(`Insufficient balance (${parseInt(balance)}). Reduce your --stake argument`); }
      else {
        // Approve token transfer if needed
        const allowanceCall = `0xdd62ed3e${leftPad(from.slice(2), 64, '0')}${leftPad(bridge.slice(2), 64, '0')}`;
        client.eth.call({ to: stakeToken, data: allowanceCall}, (err, allowance) => {
          if (parseInt(allowance) < parseInt(amount)) {
            // Set an allowance
            const approveFor = leftPad(bridge.slice(2), 64, '0');
            const approveAmt = leftPad(parseInt(amount).toString(16), 64, '0');
            const approveData = `0x095ea7b3${approveFor}${approveAmt}`;
            const approveTx = {
              from: from,
              to: stakeToken,
              gasPrice: gasPrice,
              gas: 100000,
              data: approveData,
            };
            _approve(approveTx, wallet, client, (err) => {
              if (err) { console.log('Error approving', err); }
              else {
                _stake(tx, wallet, client, (err) => {
                  if (err) { console.log('Error: ', err); }
                  else { console.log('Staking successful.'); }
                });
              }
            })
          } else {
            // Send tx
            _stake(tx, wallet, client, (err) => {
              if (err) { console.log('Error:', err); }
              else { console.log('Staking successful.'); }
            });
          }
        })
      }
    })
  })
}

function _approve(tx, wallet, client, cb) {
  client.eth.getTransactionCount(tx.from, (err, nonce) => {
    tx.nonce = nonce;
    const signedTx = wallet.signTx(tx);
    client.eth.sendSignedTransaction(signedTx, (err, h) => {
      if (err) { cb(err); }
      else {
        client.eth.getTransactionReceipt(h, (err, receipt) => {
          if (err) { cb(err); }
          else if (receipt.logs.length < 1) { cb('Approval did not execute.'); }
          else { cb(null); }
        })
      }
    })
  })
}

function _stake(tx, wallet, client, cb) {
  client.eth.getTransactionCount(tx.from, (err, nonce) => {
    tx.nonce = nonce;
    const signedTx = wallet.signTx(tx);
    client.eth.sendSignedTransaction(signedTx, (err, h) => {
      if (err) { console.log('Error staking', err); }
      else {
        client.eth.getTransactionReceipt(h, (err, receipt) => {
          console.log('receipt', receipt);
          if (err) { cb(err); }
          else if (receipt.logs.length < 1) { cb('Stake did not execute'); }
          else { cb(null); }
        })
      }
    })
  })
}
