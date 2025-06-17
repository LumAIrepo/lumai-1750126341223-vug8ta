import { AnchorProvider, BN, Program, web3 } from '@project-serum/anchor';
import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { IDL, PumpClone } from './idl';

export const PROGRAM_ID = new PublicKey('PumpCLoneProgram11111111111111111111111111');
export const BONDING_CURVE_SEED = 'bonding_curve';
export const TOKEN_VAULT_SEED = 'token_vault';
export const SOL_VAULT_SEED = 'sol_vault';
export const METADATA_SEED = 'metadata';

export interface TokenLaunchParams {
  name: string;
  symbol: string;
  description: string;
  imageUri: string;
  websiteUri?: string;
  telegramUri?: string;
  twitterUri?: string;
  initialSupply: BN;
  reserveRatio: number;
  targetAmount: BN;
}

export interface TradeParams {
  tokenMint: PublicKey;
  amount: BN;
  minAmountOut: BN;
  isBuy: boolean;
}

export interface BondingCurveData {
  tokenMint: PublicKey;
  creator: PublicKey;
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
  realTokenReserves: BN;
  realSolReserves: BN;
  targetAmount: BN;
  reserveRatio: number;
  complete: boolean;
  bump: number;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  imageUri: string;
  websiteUri: string;
  telegramUri: string;
  twitterUri: string;
  creator: PublicKey;
  createdAt: BN;
}

export class ProgramClient {
  private program: Program<PumpClone>;
  private connection: Connection;
  private wallet: WalletContextState;

  constructor(connection: Connection, wallet: WalletContextState) {
    this.connection = connection;
    this.wallet = wallet;
    
    const provider = new AnchorProvider(
      connection,
      wallet as any,
      { commitment: 'confirmed' }
    );
    
    this.program = new Program(IDL, PROGRAM_ID, provider);
  }

  async createToken(params: TokenLaunchParams): Promise<{ signature: string; tokenMint: PublicKey }> {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');

    const tokenMint = web3.Keypair.generate();
    
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from(BONDING_CURVE_SEED), tokenMint.publicKey.toBuffer()],
      PROGRAM_ID
    );

    const [tokenVault] = PublicKey.findProgramAddressSync(
      [Buffer.from(TOKEN_VAULT_SEED), tokenMint.publicKey.toBuffer()],
      PROGRAM_ID
    );

    const [solVault] = PublicKey.findProgramAddressSync(
      [Buffer.from(SOL_VAULT_SEED), tokenMint.publicKey.toBuffer()],
      PROGRAM_ID
    );

    const [metadata] = PublicKey.findProgramAddressSync(
      [Buffer.from(METADATA_SEED), tokenMint.publicKey.toBuffer()],
      PROGRAM_ID
    );

    const creatorTokenAccount = await getAssociatedTokenAddress(
      tokenMint.publicKey,
      this.wallet.publicKey
    );

    const instructions: TransactionInstruction[] = [];

    const createTokenAccountIx = createAssociatedTokenAccountInstruction(
      this.wallet.publicKey,
      creatorTokenAccount,
      this.wallet.publicKey,
      tokenMint.publicKey
    );
    instructions.push(createTokenAccountIx);

    const createTokenIx = await this.program.methods
      .createToken(
        params.name,
        params.symbol,
        params.description,
        params.imageUri,
        params.websiteUri || '',
        params.telegramUri || '',
        params.twitterUri || '',
        params.initialSupply,
        params.reserveRatio,
        params.targetAmount
      )
      .accounts({
        creator: this.wallet.publicKey,
        tokenMint: tokenMint.publicKey,
        bondingCurve,
        tokenVault,
        solVault,
        metadata,
        creatorTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    instructions.push(createTokenIx);

    const transaction = new Transaction().add(...instructions);
    transaction.feePayer = this.wallet.publicKey;
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

    transaction.partialSign(tokenMint);

    const signature = await this.wallet.sendTransaction(transaction, this.connection);
    await this.connection.confirmTransaction(signature, 'confirmed');

    return { signature, tokenMint: tokenMint.publicKey };
  }

  async buyTokens(params: TradeParams): Promise<string> {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');

    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from(BONDING_CURVE_SEED), params.tokenMint.toBuffer()],
      PROGRAM_ID
    );

    const [tokenVault] = PublicKey.findProgramAddressSync(
      [Buffer.from(TOKEN_VAULT_SEED), params.tokenMint.toBuffer()],
      PROGRAM_ID
    );

    const [solVault] = PublicKey.findProgramAddressSync(
      [Buffer.from(SOL_VAULT_SEED), params.tokenMint.toBuffer()],
      PROGRAM_ID
    );

    const userTokenAccount = await getAssociatedTokenAddress(
      params.tokenMint,
      this.wallet.publicKey
    );

    const instructions: TransactionInstruction[] = [];

    try {
      await this.connection.getAccountInfo(userTokenAccount);
    } catch {
      const createTokenAccountIx = createAssociatedTokenAccountInstruction(
        this.wallet.publicKey,
        userTokenAccount,
        this.wallet.publicKey,
        params.tokenMint
      );
      instructions.push(createTokenAccountIx);
    }

    const buyIx = await this.program.methods
      .buy(params.amount, params.minAmountOut)
      .accounts({
        user: this.wallet.publicKey,
        tokenMint: params.tokenMint,
        bondingCurve,
        tokenVault,
        solVault,
        userTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    instructions.push(buyIx);

    const transaction = new Transaction().add(...instructions);
    transaction.feePayer = this.wallet.publicKey;
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

    const signature = await this.wallet.sendTransaction(transaction, this.connection);
    await this.connection.confirmTransaction(signature, 'confirmed');

    return signature;
  }

  async sellTokens(params: TradeParams): Promise<string> {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');

    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from(BONDING_CURVE_SEED), params.tokenMint.toBuffer()],
      PROGRAM_ID
    );

    const [tokenVault] = PublicKey.findProgramAddressSync(
      [Buffer.from(TOKEN_VAULT_SEED), params.tokenMint.toBuffer()],
      PROGRAM_ID
    );

    const [solVault] = PublicKey.findProgramAddressSync(
      [Buffer.from(SOL_VAULT_SEED), params.tokenMint.toBuffer()],
      PROGRAM_ID
    );

    const userTokenAccount = await getAssociatedTokenAddress(
      params.tokenMint,
      this.wallet.publicKey
    );

    const sellIx = await this.program.methods
      .sell(params.amount, params.minAmountOut)
      .accounts({
        user: this.wallet.publicKey,
        tokenMint: params.tokenMint,
        bondingCurve,
        tokenVault,
        solVault,
        userTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const transaction = new Transaction().add(sellIx);
    transaction.feePayer = this.wallet.publicKey;
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

    const signature = await this.wallet.sendTransaction(transaction, this.connection);
    await this.connection.confirmTransaction(signature, 'confirmed');

    return signature;
  }

  async migrateLiquidity(tokenMint: PublicKey): Promise<string> {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');

    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from(BONDING_CURVE_SEED), tokenMint.toBuffer()],
      PROGRAM_ID
    );

    const [tokenVault] = PublicKey.findProgramAddressSync(
      [Buffer.from(TOKEN_VAULT_SEED), tokenMint.toBuffer()],
      PROGRAM_ID
    );

    const [solVault] = PublicKey.findProgramAddressSync(
      [Buffer.from(SOL_VAULT_SEED), tokenMint.toBuffer()],
      PROGRAM_ID
    );

    const migrateIx = await this.program.methods
      .migrateLiquidity()
      .accounts({
        creator: this.wallet.publicKey,
        tokenMint,
        bondingCurve,
        tokenVault,
        solVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const transaction = new Transaction().add(migrateIx);
    transaction.feePayer = this.wallet.publicKey;
    transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;

    const signature = await this.wallet.sendTransaction(transaction, this.connection);
    await this.connection.confirmTransaction(signature, 'confirmed');

    return signature;
  }

  async getBondingCurve(tokenMint: PublicKey): Promise<BondingCurveData | null> {
    try {
      const [bondingCurveAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from(BONDING_CURVE_SEED), tokenMint.toBuffer()],
        PROGRAM_ID
      );

      const bondingCurve = await this.program.account.bondingCurve.fetch(bondingCurveAddress);
      
      return {
        tokenMint: bondingCurve.tokenMint,
        creator: bondingCurve.creator,
        virtualTokenReserves: bondingCurve.virtualTokenReserves,
        virtualSolReserves: bondingCurve.virtualSolReserves,
        realTokenReserves: bondingCurve.realTokenReserves,
        realSolReserves: bondingCurve.realSolReserves,
        targetAmount: bondingCurve.targetAmount,
        reserveRatio: bondingCurve.reserveRatio,
        complete: bondingCurve.complete,
        bump: bondingCurve.bump,
      };
    } catch (error) {
      console.error('Error fetching bonding curve:', error);
      return null;
    }
  }

  async getTokenMetadata(tokenMint: PublicKey): Promise<TokenMetadata | null> {
    try {
      const [metadataAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from(METADATA_SEED), tokenMint.toBuffer()],
        PROGRAM_ID
      );

      const metadata = await this.program.account.tokenMetadata.fetch(metadataAddress);
      
      return {
        name: metadata.name,
        symbol: metadata.symbol,
        description: metadata.description,
        imageUri: metadata.imageUri,
        websiteUri: metadata.websiteUri,
        telegramUri: metadata.telegramUri,
        twitterUri: metadata.twitterUri,
        creator: metadata.creator,
        createdAt: metadata.createdAt,
      };
    } catch (error) {
      console.error('Error fetching token metadata:', error);
      return null;
    }
  }

  async getAllBondingCurves(): Promise<Array<{ publicKey: PublicKey; account: BondingCurveData }>> {
    try {
      const bondingCurves = await this.program.account.bondingCurve.all();
      
      return bondingCurves.map(curve => ({
        publicKey: curve.publicKey,
        account: {
          tokenMint: curve.account.tokenMint,
          creator: curve.account.creator,
          virtualTokenReserves: curve.account.virtualTokenReserves,
          virtualSolReserves: curve.account.virtualSolReserves,
          realTokenReserves: curve.account.realTokenReserves,
          realSolReserves: curve.account.realSolReserves,
          targetAmount: curve.account.targetAmount,
          reserveRatio: curve.account.reserveRatio,
          complete: curve.account.complete,
          bump: curve.account.bump,
        }
      }));
    } catch (error) {
      console.error('Error fetching all bonding curves:', error);
      return [];
    }
  }

  calculateBuyPrice(
    solAmount: BN,
    virtualSolReserves: BN,
    virtualTokenReserves: BN,
    reserveRatio: number
  ): BN {
    const k = virtualSolReserves.mul(virtualTokenReserves);
    const newSolReserves = virtualSolReserves.add(solAmount);
    const newTokenReserves = k.div(newSolReserves);
    const tokensOut = virtualTokenReserves.sub(newTokenReserves);
    
    const fee = tokensOut.mul(new BN(100)).div(new BN(10000)); // 1% fee
    return tokensOut.sub(fee);
  }

  calculateSellPrice(
    tokenAmount: BN,
    virtualSolReserves: BN,
    virtualTokenReserves: BN,
    reserveRatio: number
  ): BN {
    const k = virtualSolReserves.mul(virtualTokenReserves);
    const newTokenReserves = virtualTokenReserves.add(tokenAmount);
    const newSolReserves = k.div(new