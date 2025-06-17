'use client'

import { useState, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createInitializeMintInstruction, createMintToInstruction, MintLayout } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Upload, X, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface TokenFormData {
  name: string
  symbol: string
  description: string
  image: File | null
  website: string
  twitter: string
  telegram: string
  initialSupply: string
}

interface ValidationErrors {
  name?: string
  symbol?: string
  description?: string
  image?: string
  initialSupply?: string
}

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
const connection = new Connection(SOLANA_RPC_URL, 'confirmed')

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export default function CreateTokenForm() {
  const { publicKey, signTransaction, connected } = useWallet()
  const [formData, setFormData] = useState<TokenFormData>({
    name: '',
    symbol: '',
    description: '',
    image: null,
    website: '',
    twitter: '',
    telegram: '',
    initialSupply: '1000000000'
  })
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isCreating, setIsCreating] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const validateForm = useCallback((): boolean => {
    const newErrors: ValidationErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Token name is required'
    } else if (formData.name.length > 32) {
      newErrors.name = 'Token name must be 32 characters or less'
    }

    if (!formData.symbol.trim()) {
      newErrors.symbol = 'Token symbol is required'
    } else if (formData.symbol.length > 10) {
      newErrors.symbol = 'Token symbol must be 10 characters or less'
    } else if (!/^[A-Z0-9]+$/.test(formData.symbol)) {
      newErrors.symbol = 'Token symbol must contain only uppercase letters and numbers'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Token description is required'
    } else if (formData.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less'
    }

    if (!formData.image) {
      newErrors.image = 'Token image is required'
    }

    const supply = parseFloat(formData.initialSupply)
    if (!formData.initialSupply || isNaN(supply) || supply <= 0) {
      newErrors.initialSupply = 'Initial supply must be a positive number'
    } else if (supply > 1e15) {
      newErrors.initialSupply = 'Initial supply is too large'
    }

    if (formData.website && !isValidUrl(formData.website)) {
      newErrors.website = 'Please enter a valid website URL'
    }

    if (formData.twitter && !isValidTwitter(formData.twitter)) {
      newErrors.twitter = 'Please enter a valid Twitter handle or URL'
    }

    if (formData.telegram && !isValidTelegram(formData.telegram)) {
      newErrors.telegram = 'Please enter a valid Telegram handle or URL'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`)
      return true
    } catch {
      return false
    }
  }

  const isValidTwitter = (twitter: string): boolean => {
    const twitterRegex = /^(?:https?:\/\/)?(?:www\.)?(?:twitter\.com\/|x\.com\/)?@?([A-Za-z0-9_]{1,15})$/
    return twitterRegex.test(twitter)
  }

  const isValidTelegram = (telegram: string): boolean => {
    const telegramRegex = /^(?:https?:\/\/)?(?:www\.)?(?:t\.me\/|telegram\.me\/)?@?([A-Za-z0-9_]{5,32})$/
    return telegramRegex.test(telegram)
  }

  const handleInputChange = (field: keyof TokenFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field as keyof ValidationErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const handleImageUpload = (file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrors(prev => ({ ...prev, image: 'Please upload a valid image file (JPEG, PNG, GIF, or WebP)' }))
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrors(prev => ({ ...prev, image: 'Image file size must be less than 5MB' }))
      return
    }

    setFormData(prev => ({ ...prev, image: file }))
    setErrors(prev => ({ ...prev, image: undefined }))

    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0])
    }
  }

  const removeImage = () => {
    setFormData(prev => ({ ...prev, image: null }))
    setImagePreview(null)
    setErrors(prev => ({ ...prev, image: undefined }))
  }

  const uploadImageToIPFS = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to upload image')
      }

      const data = await response.json()
      return data.url
    } catch (error) {
      console.error('Image upload error:', error)
      throw new Error('Failed to upload image to IPFS')
    }
  }

  const createTokenMetadata = async (imageUrl: string) => {
    const metadata = {
      name: formData.name,
      symbol: formData.symbol,
      description: formData.description,
      image: imageUrl,
      external_url: formData.website || '',
      attributes: [],
      properties: {
        files: [
          {
            uri: imageUrl,
            type: formData.image?.type || 'image/png'
          }
        ],
        category: 'image',
        creators: [
          {
            address: publicKey?.toString() || '',
            share: 100
          }
        ]
      },
      social: {
        twitter: formData.twitter || '',
        telegram: formData.telegram || ''
      }
    }

    try {
      const response = await fetch('/api/upload-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      })

      if (!response.ok) {
        throw new Error('Failed to upload metadata')
      }

      const data = await response.json()
      return data.url
    } catch (error) {
      console.error('Metadata upload error:', error)
      throw new Error('Failed to upload metadata to IPFS')
    }
  }

  const createSolanaToken = async (metadataUri: string): Promise<string> => {
    if (!publicKey || !signTransaction) {
      throw new Error('Wallet not connected')
    }

    const mintKeypair = Keypair.generate()
    const decimals = 9
    const supply = Math.floor(parseFloat(formData.initialSupply) * Math.pow(10, decimals))

    const lamports = await connection.getMinimumBalanceForRentExemption(MintLayout.span)

    const associatedTokenAccount = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )

    const transaction = new Transaction()

    // Create mint account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MintLayout.span,
        lamports,
        programId: TOKEN_PROGRAM_ID
      })
    )

    // Initialize mint
    transaction.add(
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        decimals,
        publicKey,
        publicKey,
        TOKEN_PROGRAM_ID
      )
    )

    // Create associated token account
    transaction.add(
      createAssociatedTokenAccountInstruction(
        publicKey,
        associatedTokenAccount,
        publicKey,
        mintKeypair.publicKey,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    )

    // Mint tokens to associated account
    transaction.add(
      createMintToInstruction(
        mintKeypair.publicKey,
        associatedTokenAccount,
        publicKey,
        supply,
        [],
        TOKEN_PROGRAM_ID
      )
    )

    const { blockhash } = await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = publicKey

    transaction.partialSign(mintKeypair)

    const signedTransaction = await signTransaction(transaction)
    const signature = await connection.sendRawTransaction(signedTransaction.serialize())

    await connection.confirmTransaction(signature, 'confirmed')

    // Store token data in database
    await fetch('/api/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mint: mintKeypair.publicKey.toString(),
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description,
        image: imagePreview,
        metadataUri,
        creator: publicKey.toString(),
        initialSupply: formData.initialSupply,
        decimals,
        website: formData.website,
        twitter: formData.twitter,
        telegram: formData.telegram,
        signature
      })
    })

    return mintKeypair.publicKey.toString()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!connected || !publicKey) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!validateForm()) {
      toast.error('Please fix the form errors')
      return
    }

    setIsCreating(true)

    try {
      // Upload image to IPFS
      const imageUrl = await uploadImageToIPFS(formData.image!)
      
      // Create and upload metadata
      const metadataUri = await createTokenMetadata(imageUrl)
      
      // Create token on Solana
      const mintAddress = await createSolanaToken(metadataUri)

      toast.success('Token created successfully!')
      
      // Reset form
      setFormData({
        name: '',
        symbol: '',
        description: '',
        image: null,
        website: '',
        twitter: '',
        telegram: '',
        initialSupply: '1000000000'
      })
      setImagePreview(null)
      setErrors({})

      // Redirect to token page
      window.location.href = `/token/${mintAddress}`

    } catch (error) {
      console.error('Token creation error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create token')
    } finally {
      setIsCreating(false)
    }
  }

  if (!connected) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Create Your Meme Token</CardTitle>
          <CardDescription>
            Connect your wallet to start creating your own meme token
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your Solana wallet to create a token
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Your Meme Token</CardTitle>
        <CardDescription>
          Launch your meme token with fair distribution and bonding curve mechanics
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Token Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Token Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g., Doge Coin"
              maxLength={32}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Token Symbol */}
          <div