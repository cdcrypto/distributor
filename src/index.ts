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
import nftCandyMachineIDL from './nft_candy_machine.json';
import mintData from './mint_data.json';
import { PRICE, ROYALTY, RPC, SYMBOL, TOKEN_PROGRAM_ID, SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID, TOKEN_METADATA_PROGRAM_ID, CANDY_MACHINE_PROGRAM_ID } from "./config";

function fromUTF8Array(data: number[]) {
  // array of bytes
  let str = "",
    i;

  for (i = 0; i < data.length; i++) {
    const value = data[i];

    if (value < 0x80) {
      str += String.fromCharCode(value);
    } else if (value > 0xbf && value < 0xe0) {
      str += String.fromCharCode(((value & 0x1f) << 6) | (data[i + 1] & 0x3f));
      i += 1;
    } else if (value > 0xdf && value < 0xf0) {
      str += String.fromCharCode(
        ((value & 0x0f) << 12) |
          ((data[i + 1] & 0x3f) << 6) |
          (data[i + 2] & 0x3f)
      );
      i += 2;
    } else {
      // surrogate pair
      const charCode =
        (((value & 0x07) << 18) |
          ((data[i + 1] & 0x3f) << 12) |
          ((data[i + 2] & 0x3f) << 6) |
          (data[i + 3] & 0x3f)) -
        0x010000;

      str += String.fromCharCode(
        (charCode >> 10) | 0xd800,
        (charCode & 0x03ff) | 0xdc00
      );
      i += 3;
    }
  }

  return str;
}
export function createAssociatedTokenAccountInstruction(
  associatedTokenAddress: PublicKey,
  payer: PublicKey,
  walletAddress: PublicKey,
  splTokenMintAddress: PublicKey
) {
  const keys = [
    {
      pubkey: payer,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: associatedTokenAddress,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: walletAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: splTokenMintAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new TransactionInstruction({
    keys,
    programId: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    data: Buffer.from([]),
  });
}
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

const CANDY_MACHINE = "candy_machine";

const myWallet = anchor.web3.Keypair.fromSecretKey(
  new Uint8Array(
    JSON.parse(process.env.MY_WALLET!)
  )
);

const connection = new anchor.web3.Connection(
  RPC,
  "recent"
);

// Address of the deployed program.
const programId = new anchor.web3.PublicKey(
  "cndyAnrLdpjq1Ssp1z8xxDsB8dxe7u4HL5Nxi2K5WXZ"
);

const walletWrapper = new anchor.Wallet(myWallet);

const provider = new anchor.Provider(connection, walletWrapper, {
  preflightCommitment: "recent",
});
const program = new anchor.Program(nftCandyMachineIDL as anchor.Idl, CANDY_MACHINE_PROGRAM_ID, provider);

const getCandyMachine = async (
  config: anchor.web3.PublicKey,
  uuid: string
) => {
  return await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(CANDY_MACHINE), config.toBuffer(), Buffer.from(uuid)],
    CANDY_MACHINE_PROGRAM_ID
  );
};

const getMetadata = async (
  mint: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )
  )[0];
};

const getMasterEdition = async (
  mint: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )
  )[0];
};

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
      maxSupply: new anchor.BN(0),
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

const getTokenWallet = async function (wallet: PublicKey, mint: PublicKey) {
  return (
    await PublicKey.findProgramAddress(
      [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
    )
  )[0];
};

async function start() {
  console.log("Start Initialization process");

  const config = await anchor.web3.Keypair.generate();

  const authority = anchor.web3.Keypair.generate();
  const uuid = anchor.web3.Keypair.generate().publicKey.toBase58().slice(0, 6);
  
  const txInstr = await createConfig(config, authority, uuid, true);

  const addConfigInstr = await addConfigLines(config, authority);

  const tokenMint = anchor.web3.Keypair.generate();

  const candyMachineUuid = anchor.web3.Keypair.generate()
    .publicKey.toBase58()
    .slice(0, 6);

  const [candyMachine, bump] = await getCandyMachine(
    config.publicKey,
    candyMachineUuid
  );

  const walletToken = await getTokenWallet(
    myWallet.publicKey,
    tokenMint.publicKey
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
          wallet: walletToken,
          config: config.publicKey,
          authority: authority.publicKey,
          payer: myWallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        remainingAccounts: [
          {
            pubkey: tokenMint.publicKey,
            isWritable: false,
            isSigner: true,
          },
        ],
        signers: [myWallet, tokenMint, authority, config],
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
          anchor.web3.SystemProgram.createAccount({
            fromPubkey: myWallet.publicKey,
            newAccountPubkey: tokenMint.publicKey,
            space: MintLayout.span,
            lamports:
              await provider.connection.getMinimumBalanceForRentExemption(
                MintLayout.span
              ),
            programId: TOKEN_PROGRAM_ID,
          }),
          Token.createInitMintInstruction(
            TOKEN_PROGRAM_ID,
            tokenMint.publicKey,
            0,
            myWallet.publicKey,
            myWallet.publicKey
          ),
          createAssociatedTokenAccountInstruction(
            walletToken,
            myWallet.publicKey,
            myWallet.publicKey,
            tokenMint.publicKey
          ),
          txInstr,
          addConfigInstr,
        ],
      }
    );

    console.log('initialized - ', tx)
  } catch (e) {
    console.log(e);
    throw e;
  }
}

start();