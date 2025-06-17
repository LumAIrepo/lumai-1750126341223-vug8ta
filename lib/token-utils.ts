```typescript
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
  AccountMeta,
  Keypair
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  getMint,
  getAccount,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  createSetAuthorityInstruction,
  AuthorityType
} from '@solana/spl-token';
import { 
  Metaplex, 
  keypairIdentity, 
  bundlrStorage,
  toMetaplexFile,
  CreateNftInput
} from '@metaplex-foundation/js';
import { BN } from '@coral-xyz/anchor';

export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties?: {
    files?: Array<{
      uri: string;
      type: string;
    }>;
    category?: string;
  };
}

export interface CreateTokenParams {
  name: string;
  symbol: string;
  description: string;
  imageFile: File;
  decimals: number;
  initialSupply: number;
  creator: PublicKey;
  connection: Connection;
  payer: Keypair;
}

export interface BondingCurveParams {
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
  realTokenReserves: BN;
  realSolReserves: BN;
  tokenTotalSupply: BN;
  complete: boolean;
}

export interface TradeParams {
  tokenMint: PublicKey;
  amount: BN;
  isBuy: boolean;
  slippageBps: number;
  user: PublicKey;
}

export interface TokenInfo {
  mint: PublicKey;
  name: string;
  symbol: string;
  description: string;
  image: string;
  creator: PublicKey;
  createdAt: number;
  marketCap: number;
  bondingCurve: BondingCurveParams;
  volume24h: number;
  holders: number;
  replies: number;
}

export const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
export const PUMP_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
export const PUMP_GLOBAL_ACCOUNT = new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf');
export const PUMP_EVENT_AUTHORITY = new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1');
export const PUMP_FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV2AbicfhtW4xC9iM');

export const TOKEN_DECIMALS = 6;
export const INITIAL_VIRTUAL_TOKEN_RESERVES = new BN(1_073_000_000).mul(new BN(10).pow(new BN(TOKEN_DECIMALS)));
export const INITIAL_VIRTUAL_SOL_RESERVES = new BN(30).mul(new BN(10).pow(new BN(9)));
export const INITIAL_REAL_TOKEN_RESERVES = new BN(793_100_000).mul(new BN(10).pow(new BN(TOKEN_DECIMALS)));

export async function uploadMetadata(
  metadata: TokenMetadata,
  imageFile: File,
  connection: Connection,
  payer: Keypair
): Promise<string> {
  try {
    const metaplex = Metaplex.make(connection)
      .use(keypairIdentity(payer))
      .use(bundlrStorage());

    const imageBuffer = await imageFile.arrayBuffer();
    const imageMetaplexFile = toMetaplexFile(new Uint8Array(imageBuffer), imageFile.name);
    
    const imageUri = await metaplex.storage().upload(imageMetaplexFile);
    
    const updatedMetadata = {
      ...metadata,
      image: imageUri,
      properties: {
        ...metadata.properties,
        files: [
          {
            uri: imageUri,
            type: imageFile.type
          }
        ]
      }
    };

    const metadataUri = await metaplex.storage().uploadJson(updatedMetadata);
    return metadataUri;
  } catch (error) {
    console.error('Error uploading metadata:', error);
    throw new Error('Failed to upload metadata');
  }
}

export async function createToken(params: CreateTokenParams): Promise<{
  mint: PublicKey;
  transaction: Transaction;
}> {
  const {
    name,
    symbol,
    description,
    imageFile,
    decimals,
    creator,
    connection,
    payer
  } = params;

  try {
    const mintKeypair = Keypair.generate();
    const mint = mintKeypair.publicKey;

    const metadata: TokenMetadata = {
      name,
      symbol,
      description,
      image: '',
      external_url: `https://pump.fun/${mint.toString()}`,
      attributes: [
        {
          trait_type: 'Creator',
          value: creator.toString()
        }
      ]
    };

    const metadataUri = await uploadMetadata(metadata, imageFile, connection, payer);

    const lamports = await getMinimumBalanceForRentExemptMint(connection);
    
    const transaction = new Transaction();

    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      })
    );

    transaction.add(
      createInitializeMintInstruction(
        mint,
        decimals,
        creator,
        creator,
        TOKEN_PROGRAM_ID
      )
    );

    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      METADATA_PROGRAM_ID
    );

    const createMetadataInstruction = createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPDA,
        mint,
        mintAuthority: creator,
        payer: payer.publicKey,
        updateAuthority: creator,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      },
      {
        createMetadataAccountArgsV3: {
          data: {
            name,
            symbol,
            uri: metadataUri,
            sellerFeeBasisPoints: 0,
            creators: [
              {
                address: creator,
                verified: false,
                share: 100,
              },
            ],
            collection: null,
            uses: null,
          },
          isMutable: true,
          collectionDetails: null,
        },
      }
    );

    transaction.add(createMetadataInstruction);

    transaction.partialSign(mintKeypair);

    return {
      mint,
      transaction
    };
  } catch (error) {
    console.error('Error creating token:', error);
    throw new Error('Failed to create token');
  }
}

export function createCreateMetadataAccountV3Instruction(
  accounts: {
    metadata: PublicKey;
    mint: PublicKey;
    mintAuthority: PublicKey;
    payer: PublicKey;
    updateAuthority: PublicKey;
    systemProgram: PublicKey;
    rent: PublicKey;
  },
  args: {
    createMetadataAccountArgsV3: {
      data: {
        name: string;
        symbol: string;
        uri: string;
        sellerFeeBasisPoints: number;
        creators: Array<{
          address: PublicKey;
          verified: boolean;
          share: number;
        }> | null;
        collection: any;
        uses: any;
      };
      isMutable: boolean;
      collectionDetails: any;
    };
  }
): TransactionInstruction {
  const keys: AccountMeta[] = [
    { pubkey: accounts.metadata, isSigner: false, isWritable: true },
    { pubkey: accounts.mint, isSigner: false, isWritable: false },
    { pubkey: accounts.mintAuthority, isSigner: true, isWritable: false },
    { pubkey: accounts.payer, isSigner: true, isWritable: true },
    { pubkey: accounts.updateAuthority, isSigner: false, isWritable: false },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
    { pubkey: accounts.rent, isSigner: false, isWritable: false },
  ];

  const data = Buffer.alloc(1000);
  let offset = 0;

  data.writeUInt8(33, offset);
  offset += 1;

  const nameBytes = Buffer.from(args.createMetadataAccountArgsV3.data.name, 'utf8');
  data.writeUInt32LE(nameBytes.length, offset);
  offset += 4;
  nameBytes.copy(data, offset);
  offset += nameBytes.length;

  const symbolBytes = Buffer.from(args.createMetadataAccountArgsV3.data.symbol, 'utf8');
  data.writeUInt32LE(symbolBytes.length, offset);
  offset += 4;
  symbolBytes.copy(data, offset);
  offset += symbolBytes.length;

  const uriBytes = Buffer.from(args.createMetadataAccountArgsV3.data.uri, 'utf8');
  data.writeUInt32LE(uriBytes.length, offset);
  offset += 4;
  uriBytes.copy(data, offset);
  offset += uriBytes.length;

  data.writeUInt16LE(args.createMetadataAccountArgsV3.data.sellerFeeBasisPoints, offset);
  offset += 2;

  if (args.createMetadataAccountArgsV3.data.creators) {
    data.writeUInt8(1, offset);
    offset += 1;
    data.writeUInt32LE(args.createMetadataAccountArgsV3.data.creators.length, offset);
    offset += 4;
    
    for (const creator of args.createMetadataAccountArgsV3.data.creators) {
      creator.address.toBuffer().copy(data, offset);
      offset += 32;
      data.writeUInt8(creator.verified ? 1 : 0, offset);
      offset += 1;
      data.writeUInt8(creator.share, offset);
      offset += 1;
    }
  } else {
    data.writeUInt8(0, offset);
    offset += 1;
  }

  data.writeUInt8(args.createMetadataAccountArgsV3.isMutable ? 1 : 0, offset);
  offset += 1;

  return new TransactionInstruction({
    keys,
    programId: METADATA_PROGRAM_ID,
    data: data.subarray(0, offset),
  });
}

export async function getTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey
): Promise<number> {
  try {
    const account = await getAccount(connection, tokenAccount);
    return Number(account.amount);
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError || error instanceof TokenInvalidAccountOwnerError) {
      return 0;
    }
    throw error;
  }
}

export async function getOrCreateAssociatedTokenAccount(
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
  owner: PublicKey
): Promise<{
  address: PublicKey;
  instruction?: TransactionInstruction;
}> {
  const associatedToken = await getAssociatedTokenAddress(mint, owner);

  try {
    await getAccount(connection, associatedToken);
    return { address: associatedToken };
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError || error instanceof TokenInvalidAccountOwnerError) {
      const instruction = createAssociatedTokenAccountInstruction(
        payer,
        associatedToken,
        owner,
        mint
      );
      return { address: associatedToken, instruction };
    }
    throw error;
  }
}

export function calculateBondingCurvePrice(
  virtualSolReserves: BN,
  virtualTokenReserves: BN,
  tokenAmount: BN,
  isBuy: boolean
): BN {
  if (isBuy) {
    const numerator = virtualSolReserves.mul(tokenAmount);
    const denominator = virtualTokenReserves.sub(tokenAmount);
    return numerator.div(denominator);
  } else {
    const numerator = virtualSolReserves.mul(tokenAmount);
    const denominator = virtualTokenReserves.add(tokenAmount);
    return numerator.div(denominator);
  }
}

export function calculateTokensOut(
  virtualSolReserves: BN,
  virtualTokenReserves: BN,
  solAmount: BN
): BN {
  const numerator = virtualTokenReserves.mul(solAmount);
  const denominator = virtualSolReserves.add(solAmount);
  return numerator.div(denominator);
}

export function calculateSolOut(
  virtualSolReserves: BN,
  virtualTokenReserves: BN,
  tokenAmount: BN
): BN {
  const numerator = virtualSolReserves.mul(tokenAmount);
  const denominator = virtualTokenReserves.add(tokenAmount);
  return numerator.div(denominator);
}

export function applySlippage(amount: BN, slippageBps: number, isMinimum: boolean): BN {
  const slippageFactor = new BN(10000 + (isMinimum ? -slippageBps : slippageBps));
  return amount.mul(slippageFactor).div(new BN(10000));
}

export async function getBondingCurveAccount(
  connection: Connection,
  mint: PublicKey
): Promise<BondingCurveParams | null> {
  try {
    const [bondingCurvePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mint.toBuffer()],
      PUMP_PROGRAM_ID
    );

    const accountInfo = await connection.getAccountInfo(bondingCurvePDA);
    if (!accountInfo) return null;

    const data = accountInfo.