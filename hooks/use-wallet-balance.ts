```typescript
'use client'

import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { useCallback, useEffect, useState } from 'react'

export interface TokenBalance {
  mint: string
  amount: number
  decimals: number
  uiAmount: number
}

export interface WalletBalanceState {
  solBalance: number
  tokenBalances: TokenBalance[]
  isLoading: boolean
  error: string | null
}

export function useWalletBalance(refreshInterval: number = 30000) {
  const { connection } = useConnection()
  const { publicKey, connected } = useWallet()
  
  const [state, setState] = useState<WalletBalanceState>({
    solBalance: 0,
    tokenBalances: [],
    isLoading: false,
    error: null
  })

  const fetchSolBalance = useCallback(async (walletPublicKey: PublicKey) => {
    try {
      const balance = await connection.getBalance(walletPublicKey)
      return balance / LAMPORTS_PER_SOL
    } catch (error) {
      console.error('Error fetching SOL balance:', error)
      throw new Error('Failed to fetch SOL balance')
    }
  }, [connection])

  const fetchTokenBalances = useCallback(async (walletPublicKey: PublicKey) => {
    try {
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        {
          programId: TOKEN_PROGRAM_ID
        }
      )

      const balances: TokenBalance[] = []

      for (const tokenAccount of tokenAccounts.value) {
        const accountData = tokenAccount.account.data.parsed
        const mintAddress = accountData.info.mint
        const tokenAmount = accountData.info.tokenAmount

        if (tokenAmount.uiAmount && tokenAmount.uiAmount > 0) {
          balances.push({
            mint: mintAddress,
            amount: parseInt(tokenAmount.amount),
            decimals: tokenAmount.decimals,
            uiAmount: tokenAmount.uiAmount
          })
        }
      }

      return balances
    } catch (error) {
      console.error('Error fetching token balances:', error)
      throw new Error('Failed to fetch token balances')
    }
  }, [connection])

  const fetchBalances = useCallback(async () => {
    if (!publicKey || !connected) {
      setState(prev => ({
        ...prev,
        solBalance: 0,
        tokenBalances: [],
        isLoading: false,
        error: null
      }))
      return
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const [solBalance, tokenBalances] = await Promise.all([
        fetchSolBalance(publicKey),
        fetchTokenBalances(publicKey)
      ])

      setState({
        solBalance,
        tokenBalances,
        isLoading: false,
        error: null
      })
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }))
    }
  }, [publicKey, connected, fetchSolBalance, fetchTokenBalances])

  const getTokenBalance = useCallback((mintAddress: string): TokenBalance | null => {
    return state.tokenBalances.find(balance => balance.mint === mintAddress) || null
  }, [state.tokenBalances])

  const hasTokenBalance = useCallback((mintAddress: string, minAmount: number = 0): boolean => {
    const balance = getTokenBalance(mintAddress)
    return balance ? balance.uiAmount > minAmount : false
  }, [getTokenBalance])

  const refreshBalances = useCallback(() => {
    fetchBalances()
  }, [fetchBalances])

  useEffect(() => {
    fetchBalances()
  }, [fetchBalances])

  useEffect(() => {
    if (!connected || !publicKey) return

    const interval = setInterval(() => {
      fetchBalances()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [connected, publicKey, refreshInterval, fetchBalances])

  useEffect(() => {
    if (!connection || !publicKey) return

    const subscriptionId = connection.onAccountChange(
      publicKey,
      () => {
        fetchBalances()
      },
      'confirmed'
    )

    return () => {
      connection.removeAccountChangeListener(subscriptionId)
    }
  }, [connection, publicKey, fetchBalances])

  return {
    ...state,
    getTokenBalance,
    hasTokenBalance,
    refreshBalances,
    isConnected: connected && !!publicKey
  }
}

export default useWalletBalance
```