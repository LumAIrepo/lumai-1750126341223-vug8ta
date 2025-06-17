'use client'

import { useState, useEffect } from 'react'
import { PublicKey } from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import Image from 'next/image'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { TrendingUp, TrendingDown, Users, DollarSign, Activity, ExternalLink } from 'lucide-react'

interface TokenMetadata {
  name: string
  symbol: string
  description: string
  image: string
  creator: string
  createdAt: Date
}

interface BondingCurveData {
  virtualSolReserves: number
  virtualTokenReserves: number
  realSolReserves: number
  realTokenReserves: number
  complete: boolean
  progress: number
}

interface TokenStats {
  marketCap: number
  volume24h: number
  holders: number
  priceChange24h: number
  currentPrice: number
  liquidity: number
}

interface TokenCardProps {
  tokenMint: string
  metadata: TokenMetadata
  bondingCurve: BondingCurveData
  stats: TokenStats
  className?: string
  showActions?: boolean
  variant?: 'default' | 'compact' | 'featured'
}

export default function TokenCard({
  tokenMint,
  metadata,
  bondingCurve,
  stats,
  className = '',
  showActions = true,
  variant = 'default'
}: TokenCardProps) {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [livePrice, setLivePrice] = useState(stats.currentPrice)
  const [priceHistory, setPriceHistory] = useState<number[]>([])

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const tokenPubkey = new PublicKey(tokenMint)
        const accountInfo = await connection.getAccountInfo(tokenPubkey)
        
        if (accountInfo) {
          const newPrice = calculateCurrentPrice(bondingCurve)
          setLivePrice(newPrice)
          setPriceHistory(prev => [...prev.slice(-19), newPrice])
        }
      } catch (err) {
        console.error('Error fetching live price:', err)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [connection, tokenMint, bondingCurve])

  const calculateCurrentPrice = (curve: BondingCurveData): number => {
    if (curve.virtualTokenReserves === 0) return 0
    return curve.virtualSolReserves / curve.virtualTokenReserves
  }

  const formatNumber = (num: number, decimals: number = 2): string => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`
    if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`
    if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`
    return num.toFixed(decimals)
  }

  const formatPrice = (price: number): string => {
    if (price < 0.000001) return price.toExponential(2)
    if (price < 0.01) return price.toFixed(6)
    return price.toFixed(4)
  }

  const getPriceChangeColor = (change: number): string => {
    if (change > 0) return 'text-green-500'
    if (change < 0) return 'text-red-500'
    return 'text-gray-500'
  }

  const getPriceChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4" />
    if (change < 0) return <TrendingDown className="w-4 h-4" />
    return <Activity className="w-4 h-4" />
  }

  const getProgressColor = (progress: number): string => {
    if (progress >= 80) return 'bg-green-500'
    if (progress >= 50) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  if (variant === 'compact') {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
            <Image
              src={metadata.image || '/placeholder-token.png'}
              alt={metadata.name}
              fill
              className="object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = '/placeholder-token.png'
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {metadata.name}
              </h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                ${metadata.symbol}
              </span>
            </div>
            <div className="flex items-center space-x-4 mt-1">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                ${formatPrice(livePrice)}
              </span>
              <div className={`flex items-center space-x-1 text-sm ${getPriceChangeColor(stats.priceChange24h)}`}>
                {getPriceChangeIcon(stats.priceChange24h)}
                <span>{stats.priceChange24h > 0 ? '+' : ''}{stats.priceChange24h.toFixed(2)}%</span>
              </div>
            </div>
          </div>
          <Link
            href={`/token/${tokenMint}`}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  if (variant === 'featured') {
    return (
      <div className={`bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-6 text-white ${className}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="relative w-16 h-16 rounded-full overflow-hidden bg-white/20">
              <Image
                src={metadata.image || '/placeholder-token.png'}
                alt={metadata.name}
                fill
                className="object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = '/placeholder-token.png'
                }}
              />
            </div>
            <div>
              <h3 className="text-xl font-bold">{metadata.name}</h3>
              <p className="text-white/80">${metadata.symbol}</p>
            </div>
          </div>
          <div className="bg-white/20 rounded-lg px-3 py-1">
            <span className="text-sm font-medium">Featured</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-white/80 text-sm">Price</p>
            <p className="text-2xl font-bold">${formatPrice(livePrice)}</p>
          </div>
          <div>
            <p className="text-white/80 text-sm">24h Change</p>
            <div className="flex items-center space-x-1">
              {getPriceChangeIcon(stats.priceChange24h)}
              <span className="text-xl font-bold">
                {stats.priceChange24h > 0 ? '+' : ''}{stats.priceChange24h.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Bonding Curve Progress</span>
            <span>{bondingCurve.progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <div
              className="bg-white rounded-full h-2 transition-all duration-300"
              style={{ width: `${bondingCurve.progress}%` }}
            />
          </div>
        </div>

        <Link
          href={`/token/${tokenMint}`}
          className="block w-full bg-white text-purple-600 text-center py-3 rounded-lg font-semibold hover:bg-white/90 transition-colors"
        >
          Trade Now
        </Link>
      </div>
    )
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-200 ${className}`}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="relative w-14 h-14 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
              <Image
                src={metadata.image || '/placeholder-token.png'}
                alt={metadata.name}
                fill
                className="object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = '/placeholder-token.png'
                }}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {metadata.name}
              </h3>
              <p className="text-gray-500 dark:text-gray-400">${metadata.symbol}</p>
            </div>
          </div>
          
          {bondingCurve.complete && (
            <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full text-xs font-medium">
              Graduated
            </div>
          )}
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
          {metadata.description}
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Price</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                ${formatPrice(livePrice)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Market Cap</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                ${formatNumber(stats.marketCap)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">24h Volume</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                ${formatNumber(stats.volume24h)}
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">24h Change</span>
              <div className={`flex items-center space-x-1 font-semibold ${getPriceChangeColor(stats.priceChange24h)}`}>
                {getPriceChangeIcon(stats.priceChange24h)}
                <span>{stats.priceChange24h > 0 ? '+' : ''}{stats.priceChange24h.toFixed(2)}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                <Users className="w-3 h-3 mr-1" />
                Holders
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatNumber(stats.holders, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                <DollarSign className="w-3 h-3 mr-1" />
                Liquidity
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                ${formatNumber(stats.liquidity)}
              </span>
            </div>
          </div>
        </div>

        {!bondingCurve.complete && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500 dark:text-gray-400">Bonding Curve Progress</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {bondingCurve.progress.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`${getProgressColor(bondingCurve.progress)} rounded-full h-2 transition-all duration-300`}
                style={{ width: `${bondingCurve.progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {bondingCurve.progress >= 100 ? 'Ready for DEX migration' : 'Funding for liquidity pool'}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
          <span>Created by {metadata.creator.slice(0, 4)}...{metadata.creator.slice(-4)}</span>
          <span>{formatDistanceToNow(metadata.createdAt, { addSuffix: true })}</span>
        </div>

        {showActions && (
          <div className="