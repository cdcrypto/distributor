import * as anchor from '@project-serum/anchor';
import { Keypair, PublicKey, SystemProgram, SYSVAR_CLOCK_PUBKEY, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { getTokenWallet, getMetadata, getCandyMachine, getMasterEdition, createAssociatedTokenAccountInstruction } from './utils'
import { program, myWallet, provider } from './chain'
import { TOKEN_METADATA_PROGRAM_ID, TOKEN_PROGRAM_ID } from './config';
import { MintLayout, Token } from '@solana/spl-token';

async function mintNFT(config: PublicKey, authority: Keypair, mintTo: PublicKey, candyMachineUuid: string) {
  const mint = Keypair.generate(); // Generate a proper name

  // Create token associated token account
  const token = await getTokenWallet(
    mintTo,
    mint.publicKey
  );

  const metadata = await getMetadata(mint.publicKey);
  const masterEdition = await getMasterEdition(mint.publicKey);
  const [candyMachine, _] = await getCandyMachine(
    config,
    candyMachineUuid
  );

  console.log('authority', authority.publicKey.toString());

  try {
    const tx = await program.rpc.mintNft({
      accounts: {
        config: config,
        candyMachine: candyMachine,
        payer: authority.publicKey,
        wallet: myWallet.publicKey,
        mint: mint.publicKey,
        metadata,
        masterEdition,
        mintAuthority: authority.publicKey,
        updateAuthority: authority.publicKey,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      signers: [mint, authority, myWallet],
      instructions: [
        // Give authority enough to pay off the cost of the nft!
        // it'll be funnneled right back
        SystemProgram.transfer({ // Gives authority some tokens
          fromPubkey: myWallet.publicKey,
          toPubkey: authority.publicKey,
          lamports: 5000000000 + 10000000, // add minting fees in there
        }),
        SystemProgram.createAccount({ //
          fromPubkey: mintTo,
          newAccountPubkey: mint.publicKey,
          space: MintLayout.span,
          lamports:
            await provider.connection.getMinimumBalanceForRentExemption(
              MintLayout.span
            ),
          programId: TOKEN_PROGRAM_ID,
        }),
        Token.createInitMintInstruction(
          TOKEN_PROGRAM_ID,
          mint.publicKey,
          0,
          authority.publicKey,
          authority.publicKey
        ),
        createAssociatedTokenAccountInstruction(
          token,
          myWallet.publicKey,
          mintTo,
          mint.publicKey
        ),
        Token.createMintToInstruction(
          TOKEN_PROGRAM_ID,
          mint.publicKey,
          token,
          authority.publicKey,
          [],
          1
        ),
      ],
    });
    console.log('mint complete!')
  } catch (e) {
    console.log(e);
  }
}

const config = anchor.web3.Keypair.fromSecretKey(
  new Uint8Array(
    JSON.parse(process.env.CONFIG!)
  )
);

const authority = anchor.web3.Keypair.fromSecretKey(
  new Uint8Array(
    JSON.parse(process.env.AUTHORITY!)
  )
)

mintNFT(config.publicKey, authority, myWallet.publicKey, process.env.CANDY_MACHINE_UUID!);

