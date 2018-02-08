// Functions for merkling
const sha3 = require('solidity-sha3').default;

function buildMerkleTree(nodes, layers=[]) {
  layers.push(nodes);
  if (nodes.length < 2) { return layers; }
  let newNodes = [];
  for (let i = 0; i < nodes.length - 1; i += 2) {
    newNodes.push(hash(nodes[i], nodes[i+1]));
  }
  return buildMerkleTree(newNodes, layers);
}
exports.buildMerkleTree = buildMerkleTree;


exports.getMerkleRoot = function(leaves) {
  const tree = buildMerkleTree(leaves);
  return tree[tree.length - 1][0];
}

function hash(left, right) {
  return sha3(`0x${left.slice(2)}${right.slice(2)}`);
}
