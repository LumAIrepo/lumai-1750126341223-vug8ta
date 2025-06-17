```typescript
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Connection, PublicKey, AccountInfo } from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { BorshAccountsCoder } from '@coral-xyz/anchor'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount } from '@solana/spl-token'

export interface TokenMetadata {
  name: string
  symbol: string
  description: string
  image: string
  twitter?: string
  telegram?: string
  website?: string
}

export interface BondingCurveState {
  virtualTokenReserves: number
  virtualSolReserves: number
  realTokenReserves: number
  realSolReserves: number
  tokenTotalSupply: number
  complete: boolean
}

export interface TokenData {
  mint: PublicKey
  metadata: TokenMetadata
  bondingCurve: BondingCurveState
  creator: PublicKey
  createdAt: number
  marketCap: number
  volume24h: number
  holders: number
  price: number
  priceChange24h: number
  replies: number
  isKingOfHill: boolean
  bump: number
}

export interface TokenBalance {
  mint: PublicKey
  balance: number
  decimals: number
  uiAmount: number
}

interface UseTokensOptions {
  autoRefresh?: boolean
  refreshInterval?: number
  includeBalances?: boolean
}

interface UseTokensReturn {
  tokens: TokenData[]
  userBalances: TokenBalance[]
  loading: boolean
  error: string | null
  refreshTokens: () => Promise<void>
  getTokenByMint: (mint: string) => TokenData | undefined
  getUserBalance: (mint: string) => TokenBalance | undefined
  subscribeToToken: (mint: string) => () => void
  kingOfHillToken: TokenData | null
}

const PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')
const BONDING_CURVE_SEED = 'bonding-curve'
const METADATA_SEED = 'metadata'

const TOKEN_ACCOUNT_LAYOUT = {
  mint: 0,
  creator: 32,
  metadata: 64,
  bondingCurve: 96,
  createdAt: 128,
  bump: 136
}

export function useTokens(options: UseTokensOptions = {}): UseTokensReturn {
  const { connection } = useConnection()
  const { publicKey, connected } = useWallet()
  const [tokens, setTokens] = useState<TokenData[]>([])
  const [userBalances, setUserBalances] = useState<TokenBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subscriptions, setSubscriptions] = useState<Map<string, number>>(new Map())

  const {
    autoRefresh = true,
    refreshInterval = 30000,
    includeBalances = true
  } = options

  const parseTokenAccount = useCallback((accountInfo: AccountInfo<Buffer>, pubkey: PublicKey): TokenData | null => {
    try {
      const data = accountInfo.data
      
      const mint = new PublicKey(data.slice(TOKEN_ACCOUNT_LAYOUT.mint, TOKEN_ACCOUNT_LAYOUT.mint + 32))
      const creator = new PublicKey(data.slice(TOKEN_ACCOUNT_LAYOUT.creator, TOKEN_ACCOUNT_LAYOUT.creator + 32))
      const metadataBytes = data.slice(TOKEN_ACCOUNT_LAYOUT.metadata, TOKEN_ACCOUNT_LAYOUT.bondingCurve)
      const bondingCurveBytes = data.slice(TOKEN_ACCOUNT_LAYOUT.bondingCurve, TOKEN_ACCOUNT_LAYOUT.createdAt)
      const createdAt = data.readBigUInt64LE(TOKEN_ACCOUNT_LAYOUT.createdAt)
      const bump = data.readUInt8(TOKEN_ACCOUNT_LAYOUT.bump)

      const metadata = JSON.parse(metadataBytes.toString('utf8').replace(/\0/g, '')) as TokenMetadata
      
      const virtualTokenReserves = bondingCurveBytes.readBigUInt64LE(0)
      const virtualSolReserves = bondingCurveBytes.readBigUInt64LE(8)
      const realTokenReserves = bondingCurveBytes.readBigUInt64LE(16)
      const realSolReserves = bondingCurveBytes.readBigUInt64LE(24)
      const tokenTotalSupply = bondingCurveBytes.readBigUInt64LE(32)
      const complete = bondingCurveBytes.readUInt8(40) === 1

      const bondingCurve: BondingCurveState = {
        virtualTokenReserves: Number(virtualTokenReserves) / 1e6,
        virtualSolReserves: Number(virtualSolReserves) / 1e9,
        realTokenReserves: Number(realTokenReserves) / 1e6,
        realSolReserves: Number(realSolReserves) / 1e9,
        tokenTotalSupply: Number(tokenTotalSupply) / 1e6,
        complete
      }

      const price = bondingCurve.virtualSolReserves / bondingCurve.virtualTokenReserves
      const marketCap = price * bondingCurve.tokenTotalSupply

      return {
        mint,
        metadata,
        bondingCurve,
        creator,
        createdAt: Number(createdAt),
        marketCap,
        volume24h: 0,
        holders: 0,
        price,
        priceChange24h: 0,
        replies: 0,
        isKingOfHill: false,
        bump
      }
    } catch (err) {
      console.error('Error parsing token account:', err)
      return null
    }
  }, [])

  const fetchTokens = useCallback(async () => {
    try {
      setError(null)
      
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            dataSize: 200
          }
        ]
      })

      const parsedTokens = accounts
        .map(({ account, pubkey }) => parseTokenAccount(account, pubkey))
        .filter((token): token is TokenData => token !== null)
        .sort((a, b) => b.createdAt - a.createdAt)

      if (parsedTokens.length > 0) {
        const kingOfHill = parsedTokens.reduce((prev, current) => 
          prev.marketCap > current.marketCap ? prev : current
        )
        kingOfHill.isKingOfHill = true
      }

      setTokens(parsedTokens)
    } catch (err) {
      console.error('Error fetching tokens:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch tokens')
    }
  }, [connection, parseTokenAccount])

  const fetchUserBalances = useCallback(async () => {
    if (!publicKey || !connected || !includeBalances) return

    try {
      const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID
      })

      const balances: TokenBalance[] = []

      for (const { account } of tokenAccounts) {
        try {
          const accountData = getAccount(connection, account.pubkey)
          const tokenAccount = await accountData
          
          if (tokenAccount.amount > 0) {
            balances.push({
              mint: tokenAccount.mint,
              balance: Number(tokenAccount.amount),
              decimals: 6,
              uiAmount: Number(tokenAccount.amount) / 1e6
            })
          }
        } catch (err) {
          console.error('Error fetching token account:', err)
        }
      }

      setUserBalances(balances)
    } catch (err) {
      console.error('Error fetching user balances:', err)
    }
  }, [connection, publicKey, connected, includeBalances])

  const refreshTokens = useCallback(async () => {
    setLoading(true)
    await Promise.all([
      fetchTokens(),
      fetchUserBalances()
    ])
    setLoading(false)
  }, [fetchTokens, fetchUserBalances])

  const getTokenByMint = useCallback((mint: string): TokenData | undefined => {
    return tokens.find(token => token.mint.toString() === mint)
  }, [tokens])

  const getUserBalance = useCallback((mint: string): TokenBalance | undefined => {
    return userBalances.find(balance => balance.mint.toString() === mint)
  }, [userBalances])

  const subscribeToToken = useCallback((mint: string) => {
    const mintPubkey = new PublicKey(mint)
    
    const subscriptionId = connection.onAccountChange(
      mintPubkey,
      (accountInfo) => {
        const updatedToken = parseTokenAccount(accountInfo, mintPubkey)
        if (updatedToken) {
          setTokens(prev => prev.map(token => 
            token.mint.toString() === mint ? updatedToken : token
          ))
        }
      },
      'confirmed'
    )

    setSubscriptions(prev => new Map(prev).set(mint, subscriptionId))

    return () => {
      connection.removeAccountChangeListener(subscriptionId)
      setSubscriptions(prev => {
        const newMap = new Map(prev)
        newMap.delete(mint)
        return newMap
      })
    }
  }, [connection, parseTokenAccount])

  const kingOfHillToken = useMemo(() => {
    return tokens.find(token => token.isKingOfHill) || null
  }, [tokens])

  useEffect(() => {
    refreshTokens()
  }, [refreshTokens])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(refreshTokens, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, refreshTokens])

  useEffect(() => {
    return () => {
      subscriptions.forEach((subscriptionId) => {
        connection.removeAccountChangeListener(subscriptionId)
      })
    }
  }, [connection, subscriptions])

  return {
    tokens,
    userBalances,
    loading,
    error,
    refreshTokens,
    getTokenByMint,
    getUserBalance,
    subscribeToToken,
    kingOfHillToken
  }
}
```