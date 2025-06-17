```tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { Connection, PublicKey } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'
import { Search, TrendingUp, Clock, Users, DollarSign, Filter, SortAsc, SortDesc } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface TokenData {
  mint: string
  name: string
  symbol: string
  description: string
  image: string
  creator: string
  createdAt: number
  marketCap: number
  price: number
  volume24h: number
  holders: number
  progress: number
  isGraduated: boolean
  replies: number
  lastReply?: number
  bondingCurveKey: string
  associatedBondingCurve: string
  virtualTokenReserves: number
  virtualSolReserves: number
  realTokenReserves: number
  realSolReserves: number
}

interface TokenListProps {
  className?: string
}

type SortOption = 'created' | 'marketCap' | 'volume' | 'replies' | 'progress'
type FilterOption = 'all' | 'active' | 'graduated' | 'trending'

const SORT_OPTIONS = [
  { value: 'created' as const, label: 'Recently Created', icon: Clock },
  { value: 'marketCap' as const, label: 'Market Cap', icon: DollarSign },
  { value: 'volume' as const, label: '24h Volume', icon: TrendingUp },
  { value: 'replies' as const, label: 'Most Replies', icon: Users },
  { value: 'progress' as const, label: 'Progress', icon: TrendingUp },
]

const FILTER_OPTIONS = [
  { value: 'all' as const, label: 'All Tokens' },
  { value: 'active' as const, label: 'Active' },
  { value: 'graduated' as const, label: 'Graduated' },
  { value: 'trending' as const, label: 'Trending' },
]

export default function TokenList({ className = '' }: TokenListProps) {
  const { connection } = useWallet()
  const [tokens, setTokens] = useState<TokenData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('created')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [showFilters, setShowFilters] = useState(false)

  const rpcConnection = useMemo(() => {
    return connection || new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com')
  }, [connection])

  useEffect(() => {
    fetchTokens()
    const interval = setInterval(fetchTokens, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [rpcConnection])

  const fetchTokens = async () => {
    try {
      setError(null)
      
      // In a real implementation, you would fetch from your program accounts
      // This is a mock implementation with realistic data structure
      const mockTokens: TokenData[] = [
        {
          mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
          name: 'Pepe the Frog',
          symbol: 'PEPE',
          description: 'The original meme token on Solana. Feels good man!',
          image: 'https://pump.mypinata.cloud/ipfs/QmYeC9Kv8VqVhVhVhVhVhVhVhVhVhVhVhVhVhVhVhVhVh',
          creator: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          createdAt: Date.now() - 3600000,
          marketCap: 125000,
          price: 0.000125,
          volume24h: 45000,
          holders: 1250,
          progress: 85.5,
          isGraduated: false,
          replies: 342,
          lastReply: Date.now() - 300000,
          bondingCurveKey: '8GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
          associatedBondingCurve: '9GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
          virtualTokenReserves: 1000000000,
          virtualSolReserves: 30,
          realTokenReserves: 800000000,
          realSolReserves: 25,
        },
        {
          mint: '8HCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
          name: 'Doge Coin Solana',
          symbol: 'DOGES',
          description: 'Much wow, very Solana, such speed!',
          image: 'https://pump.mypinata.cloud/ipfs/QmZeC9Kv8VqVhVhVhVhVhVhVhVhVhVhVhVhVhVhVhVhVh',
          creator: 'AXzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          createdAt: Date.now() - 7200000,
          marketCap: 89000,
          price: 0.000089,
          volume24h: 32000,
          holders: 890,
          progress: 67.2,
          isGraduated: false,
          replies: 156,
          lastReply: Date.now() - 600000,
          bondingCurveKey: '9HCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
          associatedBondingCurve: 'AHCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
          virtualTokenReserves: 1000000000,
          virtualSolReserves: 30,
          realTokenReserves: 750000000,
          realSolReserves: 22,
        },
        {
          mint: '9ICihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
          name: 'Solana Cat',
          symbol: 'SCAT',
          description: 'The fastest cat on the fastest blockchain!',
          image: 'https://pump.mypinata.cloud/ipfs/QmXeC9Kv8VqVhVhVhVhVhVhVhVhVhVhVhVhVhVhVhVhVh',
          creator: 'BYzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          createdAt: Date.now() - 10800000,
          marketCap: 250000,
          price: 0.00025,
          volume24h: 78000,
          holders: 2100,
          progress: 100,
          isGraduated: true,
          replies: 567,
          lastReply: Date.now() - 120000,
          bondingCurveKey: 'AICihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
          associatedBondingCurve: 'BICihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
          virtualTokenReserves: 0,
          virtualSolReserves: 0,
          realTokenReserves: 0,
          realSolReserves: 0,
        },
        {
          mint: 'AJCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
          name: 'Moon Rocket',
          symbol: 'MOON',
          description: 'To the moon and beyond! 🚀',
          image: 'https://pump.mypinata.cloud/ipfs/QmWeC9Kv8VqVhVhVhVhVhVhVhVhVhVhVhVhVhVhVhVhVh',
          creator: 'CZzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          createdAt: Date.now() - 1800000,
          marketCap: 45000,
          price: 0.000045,
          volume24h: 15000,
          holders: 320,
          progress: 32.1,
          isGraduated: false,
          replies: 89,
          lastReply: Date.now() - 900000,
          bondingCurveKey: 'BJCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
          associatedBondingCurve: 'CJCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
          virtualTokenReserves: 1000000000,
          virtualSolReserves: 30,
          realTokenReserves: 900000000,
          realSolReserves: 28,
        },
        {
          mint: 'BKCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
          name: 'Solana Shiba',
          symbol: 'SSHIB',
          description: 'The Shiba Inu of Solana ecosystem',
          image: 'https://pump.mypinata.cloud/ipfs/QmVeC9Kv8VqVhVhVhVhVhVhVhVhVhVhVhVhVhVhVhVhVh',
          creator: 'DazDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          createdAt: Date.now() - 14400000,
          marketCap: 156000,
          price: 0.000156,
          volume24h: 52000,
          holders: 1450,
          progress: 78.9,
          isGraduated: false,
          replies: 234,
          lastReply: Date.now() - 450000,
          bondingCurveKey: 'CKCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
          associatedBondingCurve: 'DKCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
          virtualTokenReserves: 1000000000,
          virtualSolReserves: 30,
          realTokenReserves: 720000000,
          realSolReserves: 21,
        },
      ]

      setTokens(mockTokens)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching tokens:', err)
      setError('Failed to load tokens. Please try again.')
      setLoading(false)
    }
  }

  const filteredAndSortedTokens = useMemo(() => {
    let filtered = tokens

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(token =>
        token.name.toLowerCase().includes(query) ||
        token.symbol.toLowerCase().includes(query) ||
        token.description.toLowerCase().includes(query)
      )
    }

    // Apply category filter
    switch (filterBy) {
      case 'active':
        filtered = filtered.filter(token => !token.isGraduated)
        break
      case 'graduated':
        filtered = filtered.filter(token => token.isGraduated)
        break
      case 'trending':
        filtered = filtered.filter(token => token.volume24h > 30000)
        break
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: number
      let bValue: number

      switch (sortBy) {
        case 'created':
          aValue = a.createdAt
          bValue = b.createdAt
          break
        case 'marketCap':
          aValue = a.marketCap
          bValue = b.marketCap
          break
        case 'volume':
          aValue = a.volume24h
          bValue = b.volume24h
          break
        case 'replies':
          aValue = a.replies
          bValue = b.replies
          break
        case 'progress':
          aValue = a.progress
          bValue = b.progress
          break
        default:
          aValue = a.createdAt
          bValue = b.createdAt
      }

      return sortOrder === 'desc' ? bValue - aValue : aValue - bValue
    })

    return filtered
  }, [tokens, searchQuery, filterBy, sortBy, sortOrder])

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  const formatPrice = (price: number): string => {
    if (price < 0.000001) {
      return price.toExponential(2)
    }
    return price.toFixed(6)
  }

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse" />