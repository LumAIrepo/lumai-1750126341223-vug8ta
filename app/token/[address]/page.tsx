```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { TradingViewChart } from '@/components/trading-view-chart'
import { TokenInfo } from '@/components/token-info'
import { TradePanel } from '@/components/trade-panel'
import { TokenHolders } from '@/components/token-holders'
import { TokenComments } from '@/components/token-comments'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowUpIcon, ArrowDownIcon, ExternalLinkIcon, ShareIcon, HeartIcon } from 'lucide-react'
import { toast } from 'sonner'

interface TokenData {
  address: string
  name: string
  symbol: string
  description: string
  image: string
  creator: string
  createdAt: number
  totalSupply: number
  currentSupply: number
  marketCap: number
  price: number
  priceChange24h: number
  volume24h: number
  holders: number
  bondingCurveProgress: number
  isGraduated: boolean
  liquidityPool?: string
  website?: string
  twitter?: string
  telegram?: string
}

interface TradeData {
  timestamp: number
  price: number
  amount: number
  type: 'buy' | 'sell'
  user: string
  txHash: string
}

interface HolderData {
  address: string
  balance: number
  percentage: number
}

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'
const connection = new Connection(RPC_ENDPOINT, 'confirmed')

export default function TokenPage() {
  const params = useParams()
  const { publicKey, wallet, signTransaction } = useWallet()
  const [tokenData, setTokenData] = useState<TokenData | null>(null)
  const [trades, setTrades] = useState<TradeData[]>([])
  const [holders, setHolders] = useState<HolderData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userBalance, setUserBalance] = useState<number>(0)
  const [solBalance, setSolBalance] = useState<number>(0)
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const tokenAddress = params.address as string

  const fetchTokenData = useCallback(async () => {
    try {
      setRefreshing(true)
      
      const tokenPubkey = new PublicKey(tokenAddress)
      const accountInfo = await connection.getAccountInfo(tokenPubkey)
      
      if (!accountInfo) {
        throw new Error('Token not found')
      }

      // Fetch token metadata from our API
      const response = await fetch(`/api/tokens/${tokenAddress}`)
      if (!response.ok) {
        throw new Error('Failed to fetch token data')
      }
      
      const data = await response.json()
      setTokenData(data.token)
      setTrades(data.trades || [])
      setHolders(data.holders || [])
      setLikeCount(data.likes || 0)
      
    } catch (err) {
      console.error('Error fetching token data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load token')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tokenAddress])

  const fetchUserBalance = useCallback(async () => {
    if (!publicKey || !tokenData) return

    try {
      // Fetch SOL balance
      const solBal = await connection.getBalance(publicKey)
      setSolBalance(solBal / LAMPORTS_PER_SOL)

      // Fetch token balance
      const tokenPubkey = new PublicKey(tokenAddress)
      const associatedTokenAddress = await getAssociatedTokenAddress(
        tokenPubkey,
        publicKey
      )

      const tokenAccountInfo = await connection.getAccountInfo(associatedTokenAddress)
      if (tokenAccountInfo) {
        // Parse token account data to get balance
        const balance = 0 // Parse from account data
        setUserBalance(balance)
      }
    } catch (err) {
      console.error('Error fetching user balance:', err)
    }
  }, [publicKey, tokenAddress, tokenData])

  const handleBuy = async (solAmount: number) => {
    if (!publicKey || !signTransaction || !tokenData) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      const response = await fetch('/api/trade/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenAddress,
          solAmount,
          userPublicKey: publicKey.toString(),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create buy transaction')
      }

      const { transaction } = await response.json()
      const tx = web3.Transaction.from(Buffer.from(transaction, 'base64'))
      
      const signedTx = await signTransaction(tx)
      const signature = await connection.sendRawTransaction(signedTx.serialize())
      
      await connection.confirmTransaction(signature, 'confirmed')
      
      toast.success('Buy order successful!')
      fetchTokenData()
      fetchUserBalance()
      
    } catch (err) {
      console.error('Buy error:', err)
      toast.error(err instanceof Error ? err.message : 'Buy failed')
    }
  }

  const handleSell = async (tokenAmount: number) => {
    if (!publicKey || !signTransaction || !tokenData) {
      toast.error('Please connect your wallet')
      return
    }

    try {
      const response = await fetch('/api/trade/sell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenAddress,
          tokenAmount,
          userPublicKey: publicKey.toString(),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create sell transaction')
      }

      const { transaction } = await response.json()
      const tx = web3.Transaction.from(Buffer.from(transaction, 'base64'))
      
      const signedTx = await signTransaction(tx)
      const signature = await connection.sendRawTransaction(signedTx.serialize())
      
      await connection.confirmTransaction(signature, 'confirmed')
      
      toast.success('Sell order successful!')
      fetchTokenData()
      fetchUserBalance()
      
    } catch (err) {
      console.error('Sell error:', err)
      toast.error(err instanceof Error ? err.message : 'Sell failed')
    }
  }

  const handleLike = async () => {
    try {
      const response = await fetch(`/api/tokens/${tokenAddress}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userPublicKey: publicKey?.toString(),
        }),
      })

      if (response.ok) {
        setIsLiked(!isLiked)
        setLikeCount(prev => isLiked ? prev - 1 : prev + 1)
      }
    } catch (err) {
      console.error('Like error:', err)
    }
  }

  const handleShare = async () => {
    try {
      await navigator.share({
        title: `${tokenData?.name} (${tokenData?.symbol})`,
        text: `Check out ${tokenData?.name} on PumpClone!`,
        url: window.location.href,
      })
    } catch (err) {
      navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied to clipboard!')
    }
  }

  const formatNumber = (num: number, decimals: number = 2) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`
    if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`
    if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`
    return num.toFixed(decimals)
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  useEffect(() => {
    fetchTokenData()
  }, [fetchTokenData])

  useEffect(() => {
    fetchUserBalance()
  }, [fetchUserBalance])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchTokenData()
      fetchUserBalance()
    }, 10000) // Refresh every 10 seconds

    return () => clearInterval(interval)
  }, [fetchTokenData, fetchUserBalance])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    )
  }

  if (error || !tokenData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold mb-2">Token Not Found</h2>
            <p className="text-gray-600 mb-4">{error || 'The requested token could not be found.'}</p>
            <Button onClick={() => window.history.back()}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
          <div className="flex items-center gap-4">
            <img
              src={tokenData.image}
              alt={tokenData.name}
              className="w-16 h-16 rounded-full border-2 border-white/20"
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl lg:text-3xl font-bold text-white">{tokenData.name}</h1>
                <Badge variant="secondary">{tokenData.symbol}</Badge>
                {tokenData.isGraduated && (
                  <Badge className="bg-green-500 text-white">Graduated</Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-300">
                <span>Created by {formatAddress(tokenData.creator)}</span>
                <span>•</span>
                <span>{new Date(tokenData.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLike}
              className={`${isLiked ? 'bg-red-500 text-white' : ''}`}
            >
              <HeartIcon className="w-4 h-4 mr-1" />
              {likeCount}
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare}>
              <ShareIcon className="w-4 h-4 mr-1" />
              Share
            </Button>
            <WalletMultiButton className="!bg-purple-600 !rounded-lg" />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Price</div>
              <div className="text-lg font-bold">${tokenData.price.toFixed(8)}</div>
              <div className={`text-sm flex items-center ${
                tokenData.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {tokenData.priceChange24h >= 0 ? (
                  <ArrowUpIcon className="w-3 h-3 mr-1" />
                ) : (
                  <ArrowDownIcon className="w-3 h-3 mr-1" />
                )}
                {Math.abs(tokenData.priceChange24h).toFixed(2)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Market Cap</div>
              <div className="text-lg font-bold">${formatNumber(tokenData.marketCap)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Volume 24h</div>
              <div className="text-lg font-bold">${formatNumber(tokenData.volume24h)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Holders</div>
              <div className="text-lg font-bold">{formatNumber(tokenData.holders, 0)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Progress</div>
              <div className="text-lg font-bold">{tokenData.bondingCurveProgress.toFixed(1)}%</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{ width: `${tokenData.bon