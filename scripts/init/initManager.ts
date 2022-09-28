import { ethers } from 'hardhat';
import keccak256 from 'keccak256';
import { orderBy } from 'lodash';
import MerkleTree from 'merkletreejs';
import { getPairID } from '../../test/lib/Utils';
import { ORManager } from '../../typechain-types';
import { deploy, printContract, printSuccess } from '../utils';
import { chains, pairs } from './georli.data.json';
let contractAddress = process.env['ORManager'] || '';
async function getManagerContract(): Promise<ORManager> {
  if (contractAddress) {
    const manager = await ethers.getContractAt('ORManager', contractAddress);
    printContract('load manager contract:', manager.address.toString());
    return manager;
  } else {
    const manager = await deploy<ORManager>(true, 'ORManager');
    contractAddress = manager.address;
    return manager;
  }
}
async function initChain() {
  const contract = await getManagerContract();
  for (const chain of chains) {
    const tokenList = chain.tokenList.map((row) => row.address);
    const tx = await contract.setChainInfo(
      chain.chainID,
      chain.batchLimit,
      chain.maxDisputeTime,
      tokenList,
    );
    printSuccess(`Add Chain ${chain.chainID} Hash: ${tx.hash}`);
    for (const token of chain.tokenList) {
      const tx = await contract.setTokenInfo(
        chain.chainID,
        token.address,
        token.decimals,
        token.pledgeToken,
      );
      printSuccess(
        `Add Chain Token ${token.symbol} ${chain.chainID} Token:${token.address} Hash: ${tx.hash}`,
      );
    }
  }
}
async function initPair() {
  const contract = await getManagerContract();
  const newPairs = pairs.map((row: any) => {
    row.id = Buffer.from(getPairID(row), 'hex');
    return row;
  });
  const sortAfter = orderBy(newPairs, ['id'], ['asc']);
  const pairTree = new MerkleTree(
    newPairs.map((row) => row.id),
    keccak256,
    {
      sort: true,
    },
  );
  const leaves = pairTree.getLeaves();
  const proof = pairTree.getMultiProof(leaves);
  const proofFlag = pairTree.getProofFlags(leaves, proof);
  const tx = await contract.createPair(
    sortAfter,
    pairTree.getHexRoot(),
    proof,
    proofFlag,
  );
  printSuccess(`Multiple CreatePair Hash:${tx.hash}`);
}
export async function main() {
  await initChain();
  await initPair();
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
