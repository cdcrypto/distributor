import dotenv from 'dotenv';
import * as anchor from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';

dotenv.config();

export const SOL = new anchor.BN(10**9);
export const RPC = "http://api.devnet.solana.com/"
export const ROYALTY = new anchor.BN(500); // basis points 1% = 100
export const SYMBOL = "GEN"
export const PRICE = SOL.mul(new anchor.BN(5));

export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
export const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);
export const CANDY_MACHINE_PROGRAM_ID = new anchor.web3.PublicKey(
  //"21W9HZQq8vsWPPPmVT4x1xaPrakrBMs47YznSA9FZPT7"
  "cndyAnrLdpjq1Ssp1z8xxDsB8dxe7u4HL5Nxi2K5WXZ"
)