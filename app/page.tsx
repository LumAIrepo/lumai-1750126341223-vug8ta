```tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Loader2, TrendingUp, Users, Zap, Rocket, Star, ExternalLink, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import Link from 'next/link'

interface TokenData {
  mint: string
  name: string
  symbol: string
  description: string
  image: string
  creator: string
  marketCap: number
  price: number
  volume24h: number
  holders: number
  progress: number
  createdAt: number
  isGraduated: boolean
  bondingCurveProgress: number
  totalSupply: number
  liquidityPool?: string
}

interface CreateTokenForm {
  name: string
  symbol: string
  description: string
  image: File | null
  website: string
  twitter: string
  telegram: string
}

const FEATURED_TOKENS: TokenData[] = [
  {
    mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    name: 'Pepe Classic',
    symbol: 'PEPEC',
    description: 'The original Pepe meme token on Solana',
    image: '/tokens/pepe.png',
    creator: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    marketCap: 2500000,
    price: 0.000025,
    volume24h: 450000,
    holders: 12500,
    progress: 85,
    createdAt: Date.now() - 86400000 * 3,
    isGraduated: false,
    bondingCurveProgress: 85,
    totalSupply: 1000000000
  },
  {
    mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    name: 'Doge Solana',
    symbol: 'DOGES',
    description: 'Much wow, very Solana',
    image: '/tokens/doge.png',
    creator: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    marketCap: 1800000,
    price: 0.000018,
    volume24h: 320000,
    holders: 8900,
    progress: 72,
    createdAt: Date.now() - 86400000 * 2,
    isGraduated: false,
    bondingCurveProgress: 72,
    totalSupply: 1000000000
  },
  {
    mint: '8qJSyQprMC57TWKaYEmetUR3UUiTP2M3hXdcvFhkZdmv',
    name: 'Bonk Inu',
    symbol: 'BONK',
    description: 'The first dog coin for the people, by the people',
    image: '/tokens/bonk.png',
    creator: '36c739D36SiLF4Dum4W8hNvVGDtGgdaCkKjWjMvKZdZk',
    marketCap: 5200000,
    price: 0.000052,
    volume24h: 890000,
    holders: 25600,
    progress: 100,
    createdAt: Date.now() - 86400000 * 7,
    isGraduated: true,
    bondingCurveProgress: 100,
    totalSupply: 1000000000,
    liquidityPool: 'raydium'
  }
]

export default function HomePage() {
  const { connected, publicKey, signTransaction } = useWallet()
  const { connection } = useConnection()
  const [tokens, setTokens] = useState<TokenData[]>(FEATURED_TOKENS)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'marketCap' | 'volume24h' | 'createdAt'>('marketCap')
  const [filterBy, setFilterBy] = useState<'all' | 'new' | 'graduated'>('all')
  const [createTokenForm, setCreateTokenForm] = useState<CreateTokenForm>({
    name: '',
    symbol: '',
    description: '',
    image: null,
    website: '',
    twitter: '',
    telegram: ''
  })
  const [imagePreview, setImagePreview] = useState<string>('')
  const [copied, setCopied] = useState<string>('')

  const filteredAndSortedTokens = useMemo(() => {
    let filtered = tokens.filter(token => {
      const matchesSearch = token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
      
      if (filterBy === 'new') return matchesSearch && !token.isGraduated
      if (filterBy === 'graduated') return matchesSearch && token.isGraduated
      return matchesSearch
    })

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'marketCap':
          return b.marketCap - a.marketCap
        case 'volume24h':
          return b.volume24h - a.volume24h
        case 'createdAt':
          return b.createdAt - a.createdAt
        default:
          return 0
      }
    })
  }, [tokens, searchQuery, sortBy, filterBy])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB')
        return
      }
      
      setCreateTokenForm(prev => ({ ...prev, image: file }))
      
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCreateToken = async () => {
    if (!connected || !publicKey || !signTransaction) {
      toast.error('Please connect your wallet')
      return
    }

    if (!createTokenForm.name || !createTokenForm.symbol || !createTokenForm.description || !createTokenForm.image) {
      toast.error('Please fill in all required fields')
      return
    }

    setCreating(true)
    
    try {
      // Upload image to IPFS or similar service
      const formData = new FormData()
      formData.append('image', createTokenForm.image)
      
      const uploadResponse = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      })
      
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image')
      }
      
      const { imageUrl } = await uploadResponse.json()
      
      // Create token metadata
      const metadata = {
        name: createTokenForm.name,
        symbol: createTokenForm.symbol,
        description: createTokenForm.description,
        image: imageUrl,
        external_url: createTokenForm.website,
        attributes: [
          { trait_type: 'Creator', value: publicKey.toString() },
          { trait_type: 'Platform', value: 'PumpClone' }
        ],
        properties: {
          files: [{ uri: imageUrl, type: 'image/png' }],
          category: 'image'
        }
      }
      
      // Create token on Solana
      const createResponse = await fetch('/api/create-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata,
          creator: publicKey.toString(),
          social: {
            website: createTokenForm.website,
            twitter: createTokenForm.twitter,
            telegram: createTokenForm.telegram
          }
        })
      })
      
      if (!createResponse.ok) {
        throw new Error('Failed to create token')
      }
      
      const { mint, transaction } = await createResponse.json()
      
      // Sign and send transaction
      const signedTx = await signTransaction(transaction)
      const signature = await connection.sendRawTransaction(signedTx.serialize())
      await connection.confirmTransaction(signature)
      
      // Add new token to list
      const newToken: TokenData = {
        mint,
        name: createTokenForm.name,
        symbol: createTokenForm.symbol,
        description: createTokenForm.description,
        image: imageUrl,
        creator: publicKey.toString(),
        marketCap: 0,
        price: 0.000001,
        volume24h: 0,
        holders: 1,
        progress: 0,
        createdAt: Date.now(),
        isGraduated: false,
        bondingCurveProgress: 0,
        totalSupply: 1000000000
      }
      
      setTokens(prev => [newToken, ...prev])
      
      // Reset form
      setCreateTokenForm({
        name: '',
        symbol: '',
        description: '',
        image: null,
        website: '',
        twitter: '',
        telegram: ''
      })
      setImagePreview('')
      
      toast.success('Token created successfully!')
      
    } catch (error) {
      console.error('Error creating token:', error)
      toast.error('Failed to create token')
    } finally {
      setCreating(false)
    }
  }

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    setCopied(type)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopied(''), 2000)
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`
    return `$${num.toFixed(2)}`
  }

  const formatPrice = (price: number) => {
    if (price < 0.000001) return price.toExponential(2)
    return price.toFixed(6)
  }

  const getTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    return 'Just now'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Rocket className="h-8 w-8 text-yellow-400" />
                <h1 className="text-2xl font-bold text-white">PumpClone</h1>
              </div>
              <Badge variant="secondary" className="bg-yellow-400/20 text-yellow-400">
                Beta
              </Badge>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-6 text-sm text-gray-300">
                <Link href="/tokens" className="hover:text-white transition-colors">
                  All Tokens
                </Link>
                <Link href="/portfolio" className="hover:text-white transition-colors">
                  Portfolio
                </Link>
                <Link href="/docs" className="hover:text-white transition-colors">
                  Docs
                </Link>
              </div>
              <WalletMultiButton className="!bg-gradient-to-r !from-purple-600 !to-blue-600 hover:!from-purple-700 hover:!to-blue-700" />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 text-center">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Launch Your
              <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                {' '}Meme Token
              </span>
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Fair launch meme tokens with bonding curves. No presales, no team allocation. 
              Community-driven from day one.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="lg" className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black font-semibold">
                    <Zap className="mr-2 h-5 w-5" />
                    Create Token
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Create New Token</DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y