import * as anchor from '@project-serum/anchor'
import { CANDY_MACHINE_PROGRAM_ID, RPC } from './config';
import nftCandyMachineIDL from './nft_candy_machine.json';

export const myWallet = anchor.web3.Keypair.fromSecretKey(
  new Uint8Array(
    JSON.parse(process.env.MY_WALLET!)
  )
);

export const connection = new anchor.web3.Connection(
  RPC,
  "recent"
);

const walletWrapper = new anchor.Wallet(myWallet);

export const provider = new anchor.Provider(connection, walletWrapper, {
  preflightCommitment: "recent",
});

export const program = new anchor.Program(nftCandyMachineIDL as anchor.Idl, CANDY_MACHINE_PROGRAM_ID, provider);