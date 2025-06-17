```typescript
'use client'

import { useState, useCallback, useRef } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { 
  PublicKey, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram
} from '@solana/web3.js'
import { 
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction
} from '@solana/spl-token'
import BN from 'bn.js'

export interface TradeParams {
  tokenMint: string
  amount: number
  slippage: number
  isSOL: boolean
}

export interface TradeResult {
  signature: string
  amountIn: number
  amountOut: number
  priceImpact: number
}

export interface BondingCurveState {
  virtualTokenReserves: BN
  virtualSolReserves: BN
  realTokenReserves: BN
  realSolReserves: BN
  tokenTotalSupply: BN
  complete: boolean
}

export interface TradingState {
  isLoading: boolean
  error: string | null
  lastTrade: TradeResult | null
  bondingCurve: BondingCurveState | null
}

const PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')
const BONDING_CURVE_SEED = 'bonding-curve'
const METADATA_SEED = 'metadata'
const GLOBAL_SEED = 'global'

const VIRTUAL_SOL_RESERVES = new BN(30 * LAMPORTS_PER_SOL)
const VIRTUAL_TOKEN_RESERVES = new BN(1073000000 * 1000000)
const INITIAL_REAL_TOKEN_RESERVES = new BN(793100000 * 1000000)

export function useTrading() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction, signTransaction } = useWallet()
  const [state, setState] = useState<TradingState>({
    isLoading: false,
    error: null,
    lastTrade: null,
    bondingCurve: null
  })
  
  const abortControllerRef = useRef<AbortController | null>(null)

  const calculateBuyPrice = useCallback((
    solAmount: number,
    virtualSolReserves: BN,
    virtualTokenReserves: BN
  ): { tokensOut: BN; priceImpact: number } => {
    const solAmountLamports = new BN(solAmount * LAMPORTS_PER_SOL)
    const newVirtualSolReserves = virtualSolReserves.add(solAmountLamports)
    const newVirtualTokenReserves = virtualSolReserves.mul(virtualTokenReserves).div(newVirtualSolReserves)
    const tokensOut = virtualTokenReserves.sub(newVirtualTokenReserves)
    
    const currentPrice = virtualSolReserves.toNumber() / virtualTokenReserves.toNumber()
    const newPrice = newVirtualSolReserves.toNumber() / newVirtualTokenReserves.toNumber()
    const priceImpact = ((newPrice - currentPrice) / currentPrice) * 100

    return { tokensOut, priceImpact }
  }, [])

  const calculateSellPrice = useCallback((
    tokenAmount: BN,
    virtualSolReserves: BN,
    virtualTokenReserves: BN
  ): { solOut: BN; priceImpact: number } => {
    const newVirtualTokenReserves = virtualTokenReserves.add(tokenAmount)
    const newVirtualSolReserves = virtualSolReserves.mul(virtualTokenReserves).div(newVirtualTokenReserves)
    const solOut = virtualSolReserves.sub(newVirtualSolReserves)
    
    const currentPrice = virtualSolReserves.toNumber() / virtualTokenReserves.toNumber()
    const newPrice = newVirtualSolReserves.toNumber() / newVirtualTokenReserves.toNumber()
    const priceImpact = ((currentPrice - newPrice) / currentPrice) * 100

    return { solOut, priceImpact }
  }, [])

  const getBondingCurveAddress = useCallback((mint: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(BONDING_CURVE_SEED), mint.toBuffer()],
      PROGRAM_ID
    )[0]
  }, [])

  const getAssociatedBondingCurveAddress = useCallback((mint: PublicKey, bondingCurve: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [bondingCurve.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0]
  }, [])

  const fetchBondingCurveState = useCallback(async (tokenMint: string): Promise<BondingCurveState | null> => {
    try {
      const mint = new PublicKey(tokenMint)
      const bondingCurveAddress = getBondingCurveAddress(mint)
      
      const accountInfo = await connection.getAccountInfo(bondingCurveAddress)
      if (!accountInfo) return null

      const data = accountInfo.data
      const virtualTokenReserves = new BN(data.slice(8, 16), 'le')
      const virtualSolReserves = new BN(data.slice(16, 24), 'le')
      const realTokenReserves = new BN(data.slice(24, 32), 'le')
      const realSolReserves = new BN(data.slice(32, 40), 'le')
      const tokenTotalSupply = new BN(data.slice(40, 48), 'le')
      const complete = data[48] === 1

      return {
        virtualTokenReserves,
        virtualSolReserves,
        realTokenReserves,
        realSolReserves,
        tokenTotalSupply,
        complete
      }
    } catch (error) {
      console.error('Error fetching bonding curve state:', error)
      return null
    }
  }, [connection, getBondingCurveAddress])

  const buyTokens = useCallback(async (params: TradeParams): Promise<TradeResult> => {
    if (!publicKey || !signTransaction) {
      throw new Error('Wallet not connected')
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      const mint = new PublicKey(params.tokenMint)
      const bondingCurve = getBondingCurveAddress(mint)
      const associatedBondingCurve = getAssociatedBondingCurveAddress(mint, bondingCurve)
      const associatedUser = await getAssociatedTokenAddress(mint, publicKey)
      
      const bondingCurveState = await fetchBondingCurveState(params.tokenMint)
      if (!bondingCurveState) {
        throw new Error('Bonding curve not found')
      }

      if (bondingCurveState.complete) {
        throw new Error('Bonding curve is complete')
      }

      const { tokensOut, priceImpact } = calculateBuyPrice(
        params.amount,
        bondingCurveState.virtualSolReserves,
        bondingCurveState.virtualTokenReserves
      )

      const minTokensOut = tokensOut.mul(new BN(10000 - params.slippage * 100)).div(new BN(10000))

      const transaction = new Transaction()

      // Add compute budget
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000000 })
      )

      // Check if user token account exists
      const userTokenAccount = await connection.getAccountInfo(associatedUser)
      if (!userTokenAccount) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            associatedUser,
            publicKey,
            mint
          )
        )
      }

      // Create buy instruction
      const buyInstruction = {
        programId: PROGRAM_ID,
        keys: [
          { pubkey: new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf'), isSigner: false, isWritable: false },
          { pubkey: new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM'), isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: bondingCurve, isSigner: false, isWritable: true },
          { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
          { pubkey: associatedUser, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
          { pubkey: new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1'), isSigner: false, isWritable: false },
          { pubkey: new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'), isSigner: false, isWritable: false }
        ],
        data: Buffer.concat([
          Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]), // buy discriminator
          new BN(params.amount * LAMPORTS_PER_SOL).toArrayLike(Buffer, 'le', 8),
          minTokensOut.toArrayLike(Buffer, 'le', 8)
        ])
      }

      transaction.add(buyInstruction)

      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      })

      await connection.confirmTransaction(signature, 'confirmed')

      const result: TradeResult = {
        signature,
        amountIn: params.amount,
        amountOut: tokensOut.toNumber() / 1000000,
        priceImpact
      }

      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        lastTrade: result,
        bondingCurve: bondingCurveState
      }))

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Buy transaction failed'
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }))
      throw error
    }
  }, [
    publicKey,
    signTransaction,
    connection,
    sendTransaction,
    getBondingCurveAddress,
    getAssociatedBondingCurveAddress,
    fetchBondingCurveState,
    calculateBuyPrice
  ])

  const sellTokens = useCallback(async (params: TradeParams): Promise<TradeResult> => {
    if (!publicKey || !signTransaction) {
      throw new Error('Wallet not connected')
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      const mint = new PublicKey(params.tokenMint)
      const bondingCurve = getBondingCurveAddress(mint)
      const associatedBondingCurve = getAssociatedBondingCurveAddress(mint, bondingCurve)
      const associatedUser = await getAssociatedTokenAddress(mint, publicKey)
      
      const bondingCurveState = await fetchBondingCurveState(params.tokenMint)
      if (!bondingCurveState) {
        throw new Error('Bonding curve not found')
      }

      if (bondingCurveState.complete) {
        throw new Error('Bonding curve is complete')
      }

      const tokenAmount = new BN(params.amount * 1000000)
      const { solOut, priceImpact } = calculateSellPrice(
        tokenAmount,
        bondingCurveState.virtualSolReserves,
        bondingCurveState.virtualTokenReserves
      )

      const minSolOut = solOut.mul(new BN(10000 - params.slippage * 100)).div(new BN(10000))

      const transaction = new Transaction()

      // Add compute budget
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000000 })
      )

      // Create sell instruction
      const sellInstruction = {
        programId: PROGRAM_ID,
        keys: [
          { pubkey: new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf'), isSigner: false, isWritable: false },
          { pubkey: new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM'), isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: bondingCurve, isSigner: false, isWritable: true },
          { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
          { pubkey: associatedUser, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1'), isSigner: false, isWritable: false },
          { pubkey: new PublicKey('6EF8rrecthR5