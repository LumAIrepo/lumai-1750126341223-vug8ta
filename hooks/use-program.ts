```typescript
'use client'

import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor'
import { PublicKey, Connection, Commitment } from '@solana/web3.js'
import { useMemo, useCallback, useState, useEffect } from 'react'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'

// Program ID - replace with your actual program ID
const PROGRAM_ID = new PublicKey('11111111111111111111111111111111')

// IDL type definitions
interface PumpCloneIDL {
  version: string
  name: string
  instructions: any[]
  accounts: any[]
  types: any[]
}

// Program account types
export interface TokenLaunch {
  creator: PublicKey
  mint: PublicKey
  name: string
  symbol: string
  description: string
  imageUri: string
  websiteUri?: string
  telegramUri?: string
  twitterUri?: string
  totalSupply: BN
  reserveTokens: BN
  reserveSol: BN
  virtualTokenReserves: BN
  virtualSolReserves: BN
  realTokenReserves: BN
  realSolReserves: BN
  targetAmount: BN
  isLaunched: boolean
  createdAt: BN
  bumpSeed: number
}

export interface UserPosition {
  user: PublicKey
  tokenLaunch: PublicKey
  tokenAmount: BN
  solAmount: BN
  lastTradeAt: BN
}

export interface TradeEvent {
  user: PublicKey
  tokenLaunch: PublicKey
  isBuy: boolean
  tokenAmount: BN
  solAmount: BN
  timestamp: BN
  virtualTokenReserves: BN
  virtualSolReserves: BN
}

// Hook return type
export interface UseProgramReturn {
  program: Program | null
  connection: Connection
  provider: AnchorProvider | null
  isConnected: boolean
  isLoading: boolean
  error: string | null
  
  // Account fetching
  getTokenLaunch: (mint: PublicKey) => Promise<TokenLaunch | null>
  getUserPosition: (user: PublicKey, tokenLaunch: PublicKey) => Promise<UserPosition | null>
  getAllTokenLaunches: () => Promise<TokenLaunch[]>
  getUserPositions: (user: PublicKey) => Promise<UserPosition[]>
  
  // Program interactions
  createTokenLaunch: (params: CreateTokenLaunchParams) => Promise<string>
  buyTokens: (params: BuyTokensParams) => Promise<string>
  sellTokens: (params: SellTokensParams) => Promise<string>
  
  // Utility functions
  calculateBuyPrice: (tokenLaunch: TokenLaunch, tokenAmount: BN) => BN
  calculateSellPrice: (tokenLaunch: TokenLaunch, tokenAmount: BN) => BN
  getTokenLaunchPDA: (mint: PublicKey) => [PublicKey, number]
  getUserPositionPDA: (user: PublicKey, tokenLaunch: PublicKey) => [PublicKey, number]
  
  // Real-time subscriptions
  subscribeToTokenLaunch: (mint: PublicKey, callback: (account: TokenLaunch) => void) => () => void
  subscribeToUserPosition: (user: PublicKey, tokenLaunch: PublicKey, callback: (account: UserPosition) => void) => () => void
}

export interface CreateTokenLaunchParams {
  name: string
  symbol: string
  description: string
  imageUri: string
  websiteUri?: string
  telegramUri?: string
  twitterUri?: string
  initialVirtualTokenReserves: BN
  initialVirtualSolReserves: BN
  targetAmount: BN
}

export interface BuyTokensParams {
  tokenLaunch: PublicKey
  solAmount: BN
  minTokensOut: BN
}

export interface SellTokensParams {
  tokenLaunch: PublicKey
  tokenAmount: BN
  minSolOut: BN
}

// Mock IDL - replace with your actual IDL
const IDL: PumpCloneIDL = {
  version: "0.1.0",
  name: "pump_clone",
  instructions: [],
  accounts: [],
  types: []
}

export function useProgram(): UseProgramReturn {
  const { connection } = useConnection()
  const { wallet, publicKey, connected } = useWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create provider and program
  const { provider, program } = useMemo(() => {
    if (!wallet || !publicKey) {
      return { provider: null, program: null }
    }

    try {
      const provider = new AnchorProvider(
        connection,
        wallet.adapter as any,
        {
          commitment: 'confirmed' as Commitment,
          preflightCommitment: 'confirmed' as Commitment,
        }
      )

      const program = new Program(IDL as any, PROGRAM_ID, provider)

      return { provider, program }
    } catch (err) {
      console.error('Failed to create program:', err)
      return { provider: null, program: null }
    }
  }, [connection, wallet, publicKey])

  // Clear error when wallet connects/disconnects
  useEffect(() => {
    setError(null)
  }, [connected])

  // Get token launch PDA
  const getTokenLaunchPDA = useCallback((mint: PublicKey): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('token_launch'), mint.toBuffer()],
      PROGRAM_ID
    )
  }, [])

  // Get user position PDA
  const getUserPositionPDA = useCallback((user: PublicKey, tokenLaunch: PublicKey): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('user_position'), user.toBuffer(), tokenLaunch.toBuffer()],
      PROGRAM_ID
    )
  }, [])

  // Fetch token launch account
  const getTokenLaunch = useCallback(async (mint: PublicKey): Promise<TokenLaunch | null> => {
    if (!program) return null

    try {
      const [tokenLaunchPDA] = getTokenLaunchPDA(mint)
      const account = await program.account.tokenLaunch.fetch(tokenLaunchPDA)
      return account as TokenLaunch
    } catch (err) {
      console.error('Failed to fetch token launch:', err)
      return null
    }
  }, [program, getTokenLaunchPDA])

  // Fetch user position account
  const getUserPosition = useCallback(async (user: PublicKey, tokenLaunch: PublicKey): Promise<UserPosition | null> => {
    if (!program) return null

    try {
      const [userPositionPDA] = getUserPositionPDA(user, tokenLaunch)
      const account = await program.account.userPosition.fetch(userPositionPDA)
      return account as UserPosition
    } catch (err) {
      console.error('Failed to fetch user position:', err)
      return null
    }
  }, [program, getUserPositionPDA])

  // Fetch all token launches
  const getAllTokenLaunches = useCallback(async (): Promise<TokenLaunch[]> => {
    if (!program) return []

    try {
      const accounts = await program.account.tokenLaunch.all()
      return accounts.map(acc => acc.account as TokenLaunch)
    } catch (err) {
      console.error('Failed to fetch token launches:', err)
      return []
    }
  }, [program])

  // Fetch user positions
  const getUserPositions = useCallback(async (user: PublicKey): Promise<UserPosition[]> => {
    if (!program) return []

    try {
      const accounts = await program.account.userPosition.all([
        {
          memcmp: {
            offset: 8, // Skip discriminator
            bytes: user.toBase58(),
          }
        }
      ])
      return accounts.map(acc => acc.account as UserPosition)
    } catch (err) {
      console.error('Failed to fetch user positions:', err)
      return []
    }
  }, [program])

  // Calculate buy price using bonding curve
  const calculateBuyPrice = useCallback((tokenLaunch: TokenLaunch, tokenAmount: BN): BN => {
    const { virtualTokenReserves, virtualSolReserves } = tokenLaunch
    
    // Constant product formula: x * y = k
    // New token reserves = current - amount buying
    const newTokenReserves = virtualTokenReserves.sub(tokenAmount)
    
    // Calculate required SOL reserves to maintain constant product
    const k = virtualTokenReserves.mul(virtualSolReserves)
    const newSolReserves = k.div(newTokenReserves)
    
    // SOL amount needed = new SOL reserves - current SOL reserves
    return newSolReserves.sub(virtualSolReserves)
  }, [])

  // Calculate sell price using bonding curve
  const calculateSellPrice = useCallback((tokenLaunch: TokenLaunch, tokenAmount: BN): BN => {
    const { virtualTokenReserves, virtualSolReserves } = tokenLaunch
    
    // Constant product formula: x * y = k
    // New token reserves = current + amount selling
    const newTokenReserves = virtualTokenReserves.add(tokenAmount)
    
    // Calculate new SOL reserves to maintain constant product
    const k = virtualTokenReserves.mul(virtualSolReserves)
    const newSolReserves = k.div(newTokenReserves)
    
    // SOL amount received = current SOL reserves - new SOL reserves
    return virtualSolReserves.sub(newSolReserves)
  }, [])

  // Create token launch
  const createTokenLaunch = useCallback(async (params: CreateTokenLaunchParams): Promise<string> => {
    if (!program || !publicKey) {
      throw new Error('Program or wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      // Generate new mint keypair
      const mintKeypair = web3.Keypair.generate()
      const [tokenLaunchPDA, bump] = getTokenLaunchPDA(mintKeypair.publicKey)

      const tx = await program.methods
        .createTokenLaunch(
          params.name,
          params.symbol,
          params.description,
          params.imageUri,
          params.websiteUri || null,
          params.telegramUri || null,
          params.twitterUri || null,
          params.initialVirtualTokenReserves,
          params.initialVirtualSolReserves,
          params.targetAmount,
          bump
        )
        .accounts({
          creator: publicKey,
          mint: mintKeypair.publicKey,
          tokenLaunch: tokenLaunchPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([mintKeypair])
        .rpc()

      return tx
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to create token launch'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [program, publicKey, getTokenLaunchPDA])

  // Buy tokens
  const buyTokens = useCallback(async (params: BuyTokensParams): Promise<string> => {
    if (!program || !publicKey) {
      throw new Error('Program or wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      const [tokenLaunchPDA] = getTokenLaunchPDA(params.tokenLaunch)
      const [userPositionPDA, positionBump] = getUserPositionPDA(publicKey, params.tokenLaunch)

      const tx = await program.methods
        .buyTokens(params.solAmount, params.minTokensOut, positionBump)
        .accounts({
          user: publicKey,
          tokenLaunch: tokenLaunchPDA,
          userPosition: userPositionPDA,
          mint: params.tokenLaunch,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc()

      return tx
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to buy tokens'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [program, publicKey, getTokenLaunchPDA, getUserPositionPDA])

  // Sell tokens
  const sellTokens = useCallback(async (params: SellTokensParams): Promise<string> => {
    if (!program || !publicKey) {
      throw new Error('Program or wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      const [tokenLaunchPDA] = getTokenLaunchPDA(params.tokenLaunch)
      const [userPositionPDA] = getUserPositionPDA(publicKey, params.tokenLaunch)

      const tx = await program.methods
        .sellTokens(params.tokenAmount, params.minSolOut)
        .accounts({
          user: publicKey,
          tokenLaunch: tokenLaunchPDA,
          userPosition: userPositionPDA,
          mint: params.tokenLaunch,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc()

      return tx
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to sell tokens'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [program, publicKey, getTokenLaunchPDA, getUserPositionPDA])

  // Subscribe to token launch account changes
  const subscribeToTokenLaunch = useCallback((
    mint: PublicKey,
    callback: (account: TokenLaunch) => void
  ): (() => void) => {
    if (!program) return () => {}

    const [tokenLaunchPDA] = getTokenLaunchPDA(mint)
    
    const subscriptionId = connection.onAccountChange(
      tokenLaunchPDA,
      (accountInfo) => {
        try {
          const account = program.coder.accounts.decode('tokenLaunch', accountInfo.data)
          callback(account as TokenLaunch)
        } catch (err) {
          console.error('Failed to decode token launch account:', err)
        }
      },
      'confirmed'
    )

    return () => {
      connection.removeAccountChangeListener(subscriptionId)
    }
  }, [program, connection, getTokenLaunchPDA])

  // Subscribe to user position account changes
  const subscribeToUserPosition = useCallback((
    user: PublicKey,
    tokenLaunch: PublicKey,
    callback: (account: UserPosition) => void
  ): (() => void) => {
    if (!