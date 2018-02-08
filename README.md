# Trustless Bridge Client

**WARNING:** This client is under heavy development and is not production-ready.

A client to bridge two EVM blockchain networks. This corresponds to contracts [here](https://github.com/GridPlus/trustless-bridge-contracts).

## General Overview

The bridge client maintains connections with peers and has the ability to propose block header Merkle roots to bridge contracts. A user adds a bridge (defined by two bridge contract addresses, which exist on two separate chains) and watches contracts on both sides of it. That user may stake tokens onto either side of the bridge and, when he/she is selected as the proposer, may propose a header root to the bridge contract.

## Command Line Interface

The bridge client runs as a p2p daemon, but also has the ability to create wallets and stake tokens onto a given bridge. This section covers the command line API.

### --add <string>,<string>,<string>,<string>

Add a bridge of form `<network_a_host>,<network_a_address>,<network_b_host>,<network_b_address>` to your configuration (it will be persisted). Networks A and B are associated with addresses A and B, where `network` is formatted as a socket host (e.g. `http://localhost:8000`) and `address` is the bridge contract address on the associated network.

Example:
```
client --add http://localhost:7545,0x27fa13e74d1aff21d18119053fbbe1b7e10ba0d0,http://localhost:8545,0xb85cae815b3f05b0c8c8f277312dba1f747d3171
```
*This API function is pretty bad. I'll clean it up in future versions.*

### --bootstrap <string>,<string>,...,<string>

Add peers to your bridge config file. These will be persisted. You may supply any number of hosts.

Example:
```
client --bootstrap http://localhost:7545,http://localhost:8545
```

### --datadir <string>

Specify the location of your data (wallets, config, header data).

### --network <string>

Specify which bridge you want to use. To use this option, you must use it *twice*, once per bridge contract address.

Example:
```
client --network 0x27fa13e74d1aff21d18119053fbbe1b7e10ba0d0 --network 0xb85cae815b3f05b0c8c8f277312dba1f747d3171
```

### --wallet <int>

Use wallet in specified index. To get indices, see `--list-wallets`. If no bridge is supplied with `--network` flags, the default bridge is assumed.

### --start <int>

Start the client.

Defaults:
* If no `port` is supplied, port `8000` will be used
* If `--network` flags are not used, the default bridge will be used
* If no `--wallet` is specified, wallet with index 0 will be used

### --create-wallet

Enter interactive interface to create a wallet.

### --list-wallets

List wallet indices and corresponding account addresses.

### --proposal-threshold <int>

Specify the number of blocks that must elapse before you propose a header root. (Default `512`).

### --stake <int>

Stake a specified number of tokens. Must be coupled with `--bridge` option. If no `--wallet` is selected, `wallets[0]` will be selected by default.

### --bridge <string>

Address of the bridge contract on which you wish to stake. Must be combined with `--stake` option.

### --gasprice <int>

Gasprice to use with all transactions. Default `1000000000`.

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
