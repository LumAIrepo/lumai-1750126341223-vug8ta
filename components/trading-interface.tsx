'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from '@solana/spl-token'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Loader2, TrendingUp, TrendingDown, Wallet, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface TokenData {
  mint: string
  name: string
  symbol: string
  description: string
  image: string
  creator: string
  createdAt: number
  totalSupply: number
  currentSupply: number
  virtualSolReserves: number
  virtualTokenReserves: number
  realSolReserves: number
  realTokenReserves: number
  complete: boolean
  marketCap: number
  price: number
  volume24h: number
  holders: number
  transactions: number
}

interface TradingInterfaceProps {
  tokenData: TokenData
  onTradeComplete?: () => void
}

interface TradeState {
  type: 'buy' | 'sell'
  amount: string
  estimatedOutput: number
  slippage: number
  loading: boolean
  error: string | null
}

const BONDING_CURVE_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')
const VIRTUAL_SOL_RESERVES = 30 * LAMPORTS_PER_SOL
const VIRTUAL_TOKEN_RESERVES = 1073000000 * 1000000
const REAL_SOL_RESERVES = 0
const REAL_TOKEN_RESERVES = 793100000 * 1000000

export default function TradingInterface({ tokenData, onTradeComplete }: TradingInterfaceProps) {
  const { publicKey, signTransaction, connected } = useWallet()
  const [connection] = useState(() => new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com'))
  
  const [tradeState, setTradeState] = useState<TradeState>({
    type: 'buy',
    amount: '',
    estimatedOutput: 0,
    slippage: 1,
    loading: false,
    error: null
  })

  const [balances, setBalances] = useState({
    sol: 0,
    token: 0,
    loading: true
  })

  const [priceData, setPriceData] = useState({
    currentPrice: tokenData.price,
    priceChange24h: 0,
    volume24h: tokenData.volume24h,
    marketCap: tokenData.marketCap
  })

  const fetchBalances = useCallback(async () => {
    if (!publicKey || !connected) {
      setBalances({ sol: 0, token: 0, loading: false })
      return
    }

    try {
      setBalances(prev => ({ ...prev, loading: true }))
      
      const solBalance = await connection.getBalance(publicKey)
      
      let tokenBalance = 0
      try {
        const tokenMint = new PublicKey(tokenData.mint)
        const associatedTokenAddress = await getAssociatedTokenAddress(tokenMint, publicKey)
        const tokenAccount = await connection.getTokenAccountBalance(associatedTokenAddress)
        tokenBalance = tokenAccount.value.uiAmount || 0
      } catch (error) {
        tokenBalance = 0
      }

      setBalances({
        sol: solBalance / LAMPORTS_PER_SOL,
        token: tokenBalance,
        loading: false
      })
    } catch (error) {
      console.error('Error fetching balances:', error)
      setBalances({ sol: 0, token: 0, loading: false })
    }
  }, [publicKey, connected, connection, tokenData.mint])

  useEffect(() => {
    fetchBalances()
  }, [fetchBalances])

  const calculateBondingCurvePrice = useCallback((solReserves: number, tokenReserves: number, solAmount: number, isBuy: boolean) => {
    if (isBuy) {
      const newSolReserves = solReserves + solAmount
      const newTokenReserves = (solReserves * tokenReserves) / newSolReserves
      return tokenReserves - newTokenReserves
    } else {
      const newTokenReserves = tokenReserves + solAmount
      const newSolReserves = (solReserves * tokenReserves) / newTokenReserves
      return solReserves - newSolReserves
    }
  }, [])

  const estimateTradeOutput = useCallback((amount: string, type: 'buy' | 'sell') => {
    if (!amount || isNaN(parseFloat(amount))) return 0

    const inputAmount = parseFloat(amount)
    const totalSolReserves = VIRTUAL_SOL_RESERVES + tokenData.realSolReserves
    const totalTokenReserves = VIRTUAL_TOKEN_RESERVES - tokenData.currentSupply

    if (type === 'buy') {
      const solAmountLamports = inputAmount * LAMPORTS_PER_SOL
      return calculateBondingCurvePrice(totalSolReserves, totalTokenReserves, solAmountLamports, true) / 1000000
    } else {
      const tokenAmountRaw = inputAmount * 1000000
      return calculateBondingCurvePrice(totalSolReserves, totalTokenReserves, tokenAmountRaw, false) / LAMPORTS_PER_SOL
    }
  }, [tokenData.realSolReserves, tokenData.currentSupply, calculateBondingCurvePrice])

  useEffect(() => {
    const output = estimateTradeOutput(tradeState.amount, tradeState.type)
    setTradeState(prev => ({ ...prev, estimatedOutput: output }))
  }, [tradeState.amount, tradeState.type, estimateTradeOutput])

  const validateTrade = useCallback(() => {
    if (!connected) return 'Please connect your wallet'
    if (!tradeState.amount || parseFloat(tradeState.amount) <= 0) return 'Enter a valid amount'
    
    const amount = parseFloat(tradeState.amount)
    
    if (tradeState.type === 'buy') {
      if (amount > balances.sol) return 'Insufficient SOL balance'
      if (amount < 0.001) return 'Minimum buy amount is 0.001 SOL'
    } else {
      if (amount > balances.token) return 'Insufficient token balance'
      if (amount < 1) return 'Minimum sell amount is 1 token'
    }
    
    return null
  }, [connected, tradeState.amount, tradeState.type, balances.sol, balances.token])

  const executeTrade = async () => {
    const validationError = validateTrade()
    if (validationError) {
      toast.error(validationError)
      return
    }

    if (!publicKey || !signTransaction) {
      toast.error('Wallet not connected')
      return
    }

    setTradeState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const transaction = new Transaction()
      const amount = parseFloat(tradeState.amount)
      
      if (tradeState.type === 'buy') {
        const solAmount = amount * LAMPORTS_PER_SOL
        const minTokensOut = Math.floor(tradeState.estimatedOutput * (1 - tradeState.slippage / 100) * 1000000)
        
        const tokenMint = new PublicKey(tokenData.mint)
        const associatedTokenAddress = await getAssociatedTokenAddress(tokenMint, publicKey)
        
        try {
          await connection.getAccountInfo(associatedTokenAddress)
        } catch {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              associatedTokenAddress,
              publicKey,
              tokenMint
            )
          )
        }

        const buyInstruction = SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(tokenData.creator),
          lamports: Math.floor(solAmount * 0.01)
        })
        
        transaction.add(buyInstruction)
      } else {
        const tokenAmount = Math.floor(amount * 1000000)
        const minSolOut = Math.floor(tradeState.estimatedOutput * (1 - tradeState.slippage / 100) * LAMPORTS_PER_SOL)
        
        const tokenMint = new PublicKey(tokenData.mint)
        const associatedTokenAddress = await getAssociatedTokenAddress(tokenMint, publicKey)
        
        const transferInstruction = createTransferInstruction(
          associatedTokenAddress,
          new PublicKey(tokenData.creator),
          publicKey,
          tokenAmount
        )
        
        transaction.add(transferInstruction)
      }

      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      const signedTransaction = await signTransaction(transaction)
      const signature = await connection.sendRawTransaction(signedTransaction.serialize())
      
      await connection.confirmTransaction(signature, 'confirmed')
      
      toast.success(`${tradeState.type === 'buy' ? 'Buy' : 'Sell'} order completed successfully!`)
      
      setTradeState(prev => ({ ...prev, amount: '', estimatedOutput: 0 }))
      await fetchBalances()
      onTradeComplete?.()
      
    } catch (error: any) {
      console.error('Trade execution error:', error)
      const errorMessage = error?.message || 'Transaction failed'
      setTradeState(prev => ({ ...prev, error: errorMessage }))
      toast.error(errorMessage)
    } finally {
      setTradeState(prev => ({ ...prev, loading: false }))
    }
  }

  const formatNumber = (num: number, decimals: number = 2) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`
    if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`
    if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`
    return num.toFixed(decimals)
  }

  const priceChangeColor = priceData.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'
  const priceChangeIcon = priceData.priceChange24h >= 0 ? TrendingUp : TrendingDown

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <img 
                src={tokenData.image} 
                alt={tokenData.name}
                className="w-8 h-8 rounded-full"
              />
              {tokenData.symbol}
            </CardTitle>
            <Badge variant={tokenData.complete ? "default" : "secondary"}>
              {tokenData.complete ? "Graduated" : "Bonding Curve"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Price</p>
              <div className="flex items-center gap-1">
                <p className="font-semibold">${priceData.currentPrice.toFixed(8)}</p>
                <div className={`flex items-center gap-1 ${priceChangeColor}`}>
                  {React.createElement(priceChangeIcon, { size: 12 })}
                  <span className="text-xs">{Math.abs(priceData.priceChange24h).toFixed(2)}%</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Market Cap</p>
              <p className="font-semibold">${formatNumber(priceData.marketCap)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Volume 24h</p>
              <p className="font-semibold">${formatNumber(priceData.volume24h)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Holders</p>
              <p className="font-semibold">{formatNumber(tokenData.holders, 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet size={20} />
            Your Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balances.loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} />
              <span>Loading balances...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">SOL</p>
                <p className="font-semibold">{balances.sol.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{tokenData.symbol}</p>
                <p className="font-semibold">{formatNumber(balances.token)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trade</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tradeState.type} onValueChange={(value) => setTradeState(prev => ({ ...prev, type: value as 'buy' | 'sell', amount: '', estimatedOutput: 0 }))}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buy" className="text-green-600 data-[state=active]:bg-green-100">Buy</TabsTrigger>
              <TabsTrigger value="sell" className="text-red-600 data-[state=active]:bg-red-100">Sell</TabsTrigger>
            </TabsList>
            
            <TabsContent value="buy" className="space-y-4">
              <div>
                <label className="text-sm font-medium">Amount (SOL