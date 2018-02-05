# trustless-bridge-client
A client to bridge two EVM blockchain networks

## Peers

A set of peers is maintained in memory based on the two networks being bridged. A network id is defined by the address of the bridge contract on that network. The index for the given bridge is:

```
networkA_networkB
```

Where `networkA` is the smaller of the two network addresses, evaluated as integers. A list of known peers is stored in a file named on this indexing convention and stored in the a subdirectory of the data directory (`./data/peers` by default).

Upon boot, each list of peers is loaded into memory and connections are made with each peer. These are stored as set of connections based on the network index.

## Syncing

Connections are made to all blockchain networks specified in a config file. These are stored in pairs in the format:

```
...
networks: [
  [ <string>, <string>, <string>, <string> ]
],
...
```

These groups are of format: `[ network_a_host, network_a_address, network_b_host, network_b_address ]`. Where `networkA` simply evaluates to a smaller integer than `networkB` when comparing the address fields. "Host" indicates an RPC entry point for the network and "address" indicates the address of the bridge contract on that network.


Your client will periodically check all networks for new blocks. Modified headers are stored, which are indexed by block number. These headers only contain the following information:

```
{
  blockNumber: <int>
  timestamp: <int>
  prevHeader: <string>
  transactionsRoot: <string>
  receiptsRoot: <string>
}
```

## Messages

Messages are passed between clients to stay consistent with the data on the bridges. A resting server responds to messages played over sockets by triggering an appropriate event and possibly responding with a message.

### SIGREQ

Request a signature on a header root. The signer should find the block headers on the given chain (`fromChain`) and form a Merkle tree. If the root of that tree is identical to the `headerRoot` supplied, sign that hash and respond with a `SIGPASS` event to all known peers.

```
{
  type: 'SIGREQ',
  data: {
    fromChain: <string>
    startBlock: <int>
    endBlock: <int>
    headerRoot: <string>
  }
}
```

### SIGPASS

Receipt a signature on a header root. Form a header root from the supplied data and, if they match, broadcast the received header root to all known peers except the one who sent the original message.

```
{
  type: 'SIGPASS',
  data: {
    fromChain: <string>
    startBlock: <int>
    endBlock: <int>
    headerRoot: <string>
    fromSigner: <string>
    sig: {
      r: <string>
      s: <string>
      v: <tinyint>
    }
  }
}
```
