import * as anchor from "@project-serum/anchor";

import { AccountLayout, MintLayout, Token } from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import mintData from './mint_data.json';
import { PRICE, ROYALTY, RPC, SYMBOL, TOKEN_PROGRAM_ID, SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID, TOKEN_METADATA_PROGRAM_ID, CANDY_MACHINE_PROGRAM_ID } from "./config";
import { createAssociatedTokenAccountInstruction, getTokenWallet, getCandyMachine } from './utils'
import { connection, program, provider, myWallet } from './chain'

const configArrayStart =
  32 + // authority
  4 +
  6 + // uuid + u32 len
  4 +
  10 + // u32 len + symbol
  2 + // seller fee basis points
  1 +
  4 +
  5 * 34 + // optional + u32 len + actual vec
  8 + //max supply
  1 + //is mutable
  1 + // retain authority
  4; // max number of lines;

// TODO: Update this dynamically
const configLineSize = 4 + 32 + 4 + 200;

const createConfig = async function (
  config: Keypair,
  authority: Keypair,
  uuid: string,
  retainAuthority: boolean,
): Promise<TransactionInstruction> {
  return await program.instruction.initializeConfig(
    {
      uuid: uuid,
      maxNumberOfLines: new anchor.BN(mintData.length),
      symbol: SYMBOL,
      sellerFeeBasisPoints: ROYALTY,
      isMutable: true,
      maxSupply: new anchor.BN(1),
      retainAuthority,
      creators: [
        { address: myWallet.publicKey, verified: false, share: 100 },
      ],
    },
    {
      accounts: {
        config: config.publicKey,
        authority: authority.publicKey,
        payer: myWallet.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
    }
  );
};

const addConfigLines = async function (
  config: Keypair,
  authority: Keypair,
): Promise<TransactionInstruction[]> {
  const tx = await program.instruction.addConfigLines(0, mintData, {
    accounts: {
      config: config.publicKey,
      authority: authority.publicKey,
    },
    signers: [authority, myWallet],
  });

  return tx;
};

async function initializeMachine() {
  console.log("Start Initialization process");

  const config = await anchor.web3.Keypair.generate();

  const authority = anchor.web3.Keypair.generate();
  const uuid = anchor.web3.Keypair.generate().publicKey.toBase58().slice(0, 6);
  
  const txInstr = await createConfig(config, authority, uuid, true);

  const addConfigInstr = await addConfigLines(config, authority);

  const candyMachineUuid = anchor.web3.Keypair.generate()
    .publicKey.toBase58()
    .slice(0, 6);

  const [candyMachine, bump] = await getCandyMachine(
    config.publicKey,
    candyMachineUuid
  );

  try {
    const tx = await program.rpc.initializeCandyMachine(
      bump,
      {
        uuid: candyMachineUuid,
        price: PRICE,
        itemsAvailable: new anchor.BN(mintData.length),
        goLiveDate: null,
      },
      {
        accounts: {
          candyMachine,
          wallet: myWallet.publicKey,
          config: config.publicKey,
          authority: authority.publicKey,
          payer: myWallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [myWallet, authority, config],
        instructions: [
          anchor.web3.SystemProgram.createAccount({
            fromPubkey: myWallet.publicKey,
            newAccountPubkey: config.publicKey,
            space: configArrayStart + 4 + 5 * configLineSize + 4 + 1,
            lamports:
              await provider.connection.getMinimumBalanceForRentExemption(
                configArrayStart + 4 + 5 * configLineSize + 4 + 1
              ),
            programId: CANDY_MACHINE_PROGRAM_ID,
          }),
          anchor.web3.SystemProgram.transfer({
            fromPubkey: myWallet.publicKey,
            toPubkey: authority.publicKey,
            lamports: 5,
          }),
          txInstr,
          addConfigInstr,
        ],
      }
    );

    console.log('initialized - ', tx)
    console.log(`CONFIG=[${config.secretKey.toString()}]`)
    console.log(`AUTHORITY=[${authority.secretKey.toString()}]`);
    console.log(`CANDY_MACHINE_UUID=${candyMachineUuid}`);
  } catch (e) {
    console.log(e);
    throw e;
  }
}

initializeMachine();

// Have an assert to check