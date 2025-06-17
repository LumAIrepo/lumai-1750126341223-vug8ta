'use client'

import { useState, useEffect, useMemo } from 'react'
import { Connection, PublicKey } from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { formatDistanceToNow } from 'date-fns'
import { TrendingUp, TrendingDown, ExternalLink, RefreshCw } from 'lucide-react'

interface Trade {
  signature: string
  trader: string
  tokenAddress: string
  tokenSymbol: string
  type: 'buy' | 'sell'
  solAmount: number
  tokenAmount: number
  price: number
  timestamp: number
  blockTime: number
}

interface TradeHistoryProps {
  tokenAddress?: string
  limit?: number
  className?: string
}

export default function TradeHistory({ 
  tokenAddress, 
  limit = 50, 
  className = '' 
}: TradeHistoryProps) {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTrades = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      // Fetch recent transactions
      const signatures = await connection.getSignaturesForAddress(
        tokenAddress ? new PublicKey(tokenAddress) : publicKey!,
        { limit }
      )

      const tradePromises = signatures.map(async (sig) => {
        try {
          const tx = await connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
          })

          if (!tx || !tx.meta || tx.meta.err) return null

          // Parse transaction for trade data
          const instructions = tx.transaction.message.instructions
          let trade: Trade | null = null

          for (const instruction of instructions) {
            if ('parsed' in instruction && instruction.program === 'spl-token') {
              const parsed = instruction.parsed
              
              if (parsed.type === 'transfer') {
                const info = parsed.info
                const amount = info.amount
                const authority = info.authority
                
                // Determine if this is a buy or sell based on token flow
                const isBuy = info.destination === tokenAddress
                
                trade = {
                  signature: sig.signature,
                  trader: authority,
                  tokenAddress: tokenAddress || '',
                  tokenSymbol: 'TOKEN',
                  type: isBuy ? 'buy' : 'sell',
                  solAmount: amount / 1e9, // Convert lamports to SOL
                  tokenAmount: amount,
                  price: 0.001, // Calculate actual price from bonding curve
                  timestamp: Date.now(),
                  blockTime: tx.blockTime || 0
                }
                break
              }
            }
          }

          return trade
        } catch (err) {
          console.error('Error parsing transaction:', err)
          return null
        }
      })

      const parsedTrades = (await Promise.all(tradePromises))
        .filter((trade): trade is Trade => trade !== null)
        .sort((a, b) => b.blockTime - a.blockTime)

      setTrades(parsedTrades)
    } catch (err) {
      console.error('Error fetching trades:', err)
      setError('Failed to load trade history')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (connection && (tokenAddress || publicKey)) {
      fetchTrades()
    }
  }, [connection, tokenAddress, publicKey, limit])

  const handleRefresh = () => {
    fetchTrades(true)
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const formatNumber = (num: number, decimals = 4) => {
    if (num < 0.0001) return '< 0.0001'
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    })
  }

  const formatCurrency = (amount: number) => {
    if (amount < 0.01) return '< $0.01'
    return `$${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  const totalVolume = useMemo(() => {
    return trades.reduce((sum, trade) => sum + trade.solAmount, 0)
  }, [trades])

  const buyTrades = useMemo(() => {
    return trades.filter(trade => trade.type === 'buy')
  }, [trades])

  const sellTrades = useMemo(() => {
    return trades.filter(trade => trade.type === 'sell')
  }, [trades])

  if (loading) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Trade History</h3>
          <div className="animate-spin">
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-12 bg-gray-800 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Trade History</h3>
          <button
            onClick={handleRefresh}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="text-center py-8">
          <p className="text-red-400 mb-2">{error}</p>
          <button
            onClick={() => fetchTrades()}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-gray-900 rounded-lg p-4 md:p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Trade History</h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1 hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6 p-3 bg-gray-800 rounded-lg">
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">Total Volume</p>
          <p className="text-sm font-semibold text-white">
            {formatNumber(totalVolume)} SOL
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">Buys</p>
          <p className="text-sm font-semibold text-green-400">
            {buyTrades.length}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">Sells</p>
          <p className="text-sm font-semibold text-red-400">
            {sellTrades.length}
          </p>
        </div>
      </div>

      {/* Trades List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {trades.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">No trades found</p>
          </div>
        ) : (
          trades.map((trade) => (
            <div
              key={trade.signature}
              className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className={`p-1.5 rounded-full ${
                  trade.type === 'buy' 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {trade.type === 'buy' ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-medium ${
                      trade.type === 'buy' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {trade.type.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatAddress(trade.trader)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(trade.blockTime * 1000), { addSuffix: true })}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-medium text-white">
                  {formatNumber(trade.solAmount)} SOL
                </div>
                <div className="text-xs text-gray-400">
                  {formatNumber(trade.tokenAmount)} tokens
                </div>
              </div>

              <a
                href={`https://solscan.io/tx/${trade.signature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-gray-700 rounded transition-colors"
              >
                <ExternalLink className="w-3 h-3 text-gray-400" />
              </a>
            </div>
          ))
        )}
      </div>

      {trades.length >= limit && (
        <div className="mt-4 text-center">
          <button
            onClick={() => fetchTrades()}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            Load more trades
          </button>
        </div>
      )}
    </div>
  )
}