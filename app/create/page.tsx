'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, createInitializeMintInstruction, createAssociatedTokenAccountInstruction, createMintToInstruction, getAssociatedTokenAddress, MINT_SIZE, getMinimumBalanceForRentExemptMint } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Upload, Image as ImageIcon, Loader2, AlertCircle, CheckCircle, Wallet, Coins, TrendingUp, Users } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

interface TokenMetadata {
  name: string
  symbol: string
  description: string
  image: File | null
  imageUrl: string
  website: string
  twitter: string
  telegram: string
}

interface BondingCurveConfig {
  initialPrice: number
  targetPrice: number
  totalSupply: number
  liquidityThreshold: number
}

interface CreationStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'processing' | 'completed' | 'error'
}

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
const PUMP_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')

export default function CreateTokenPage() {
  const { publicKey, signTransaction, connected } = useWallet()
  const [connection] = useState(() => new Connection(SOLANA_RPC_URL, 'confirmed'))
  
  const [metadata, setMetadata] = useState<TokenMetadata>({
    name: '',
    symbol: '',
    description: '',
    image: null,
    imageUrl: '',
    website: '',
    twitter: '',
    telegram: ''
  })

  const [bondingCurve, setBondingCurve] = useState<BondingCurveConfig>({
    initialPrice: 0.0001,
    targetPrice: 0.01,
    totalSupply: 1000000000,
    liquidityThreshold: 85
  })

  const [isCreating, setIsCreating] = useState(false)
  const [creationSteps, setCreationSteps] = useState<CreationStep[]>([
    { id: 'validate', title: 'Validate Token Data', description: 'Checking token metadata and parameters', status: 'pending' },
    { id: 'upload', title: 'Upload Metadata', description: 'Uploading token image and metadata to IPFS', status: 'pending' },
    { id: 'mint', title: 'Create Token Mint', description: 'Creating SPL token mint account', status: 'pending' },
    { id: 'curve', title: 'Initialize Bonding Curve', description: 'Setting up automated market maker', status: 'pending' },
    { id: 'finalize', title: 'Finalize Launch', description: 'Completing token launch process', status: 'pending' }
  ])

  const [previewMode, setPreviewMode] = useState(false)
  const [estimatedCost, setEstimatedCost] = useState(0.1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    calculateEstimatedCost()
  }, [bondingCurve])

  const calculateEstimatedCost = useCallback(() => {
    const baseCost = 0.05
    const metadataCost = 0.02
    const bondingCurveCost = 0.03
    setEstimatedCost(baseCost + metadataCost + bondingCurveCost)
  }, [])

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {}

    if (!metadata.name.trim()) {
      newErrors.name = 'Token name is required'
    } else if (metadata.name.length > 32) {
      newErrors.name = 'Token name must be 32 characters or less'
    }

    if (!metadata.symbol.trim()) {
      newErrors.symbol = 'Token symbol is required'
    } else if (metadata.symbol.length > 10) {
      newErrors.symbol = 'Token symbol must be 10 characters or less'
    } else if (!/^[A-Z0-9]+$/.test(metadata.symbol)) {
      newErrors.symbol = 'Token symbol must contain only uppercase letters and numbers'
    }

    if (!metadata.description.trim()) {
      newErrors.description = 'Token description is required'
    } else if (metadata.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less'
    }

    if (!metadata.image && !metadata.imageUrl) {
      newErrors.image = 'Token image is required'
    }

    if (bondingCurve.totalSupply < 1000000) {
      newErrors.totalSupply = 'Total supply must be at least 1,000,000'
    }

    if (bondingCurve.initialPrice >= bondingCurve.targetPrice) {
      newErrors.pricing = 'Target price must be higher than initial price'
    }

    if (bondingCurve.liquidityThreshold < 50 || bondingCurve.liquidityThreshold > 100) {
      newErrors.liquidityThreshold = 'Liquidity threshold must be between 50% and 100%'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [metadata, bondingCurve])

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      setMetadata(prev => ({
        ...prev,
        image: file,
        imageUrl: e.target?.result as string
      }))
    }
    reader.readAsDataURL(file)
  }, [])

  const updateCreationStep = useCallback((stepId: string, status: CreationStep['status']) => {
    setCreationSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ))
  }, [])

  const uploadToIPFS = useCallback(async (data: any): Promise<string> => {
    try {
      const response = await fetch('/api/ipfs/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) throw new Error('Failed to upload to IPFS')
      
      const result = await response.json()
      return result.hash
    } catch (error) {
      throw new Error('IPFS upload failed')
    }
  }, [])

  const createTokenMint = useCallback(async (): Promise<{ mint: PublicKey, transaction: Transaction }> => {
    if (!publicKey || !signTransaction) throw new Error('Wallet not connected')

    const mintKeypair = Keypair.generate()
    const lamports = await getMinimumBalanceForRentExemptMint(connection)

    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        9,
        publicKey,
        publicKey,
        TOKEN_PROGRAM_ID
      )
    )

    const { blockhash } = await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = publicKey
    transaction.partialSign(mintKeypair)

    return { mint: mintKeypair.publicKey, transaction }
  }, [publicKey, signTransaction, connection])

  const initializeBondingCurve = useCallback(async (mint: PublicKey): Promise<Transaction> => {
    if (!publicKey) throw new Error('Wallet not connected')

    const [bondingCurvePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mint.toBuffer()],
      PUMP_PROGRAM_ID
    )

    const [globalPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('global')],
      PUMP_PROGRAM_ID
    )

    const instruction = {
      keys: [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: bondingCurvePDA, isSigner: false, isWritable: true },
        { pubkey: globalPDA, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: PUMP_PROGRAM_ID,
      data: Buffer.from([
        0, // Initialize instruction
        ...new Uint8Array(new Float64Array([bondingCurve.initialPrice]).buffer),
        ...new Uint8Array(new Float64Array([bondingCurve.targetPrice]).buffer),
        ...new Uint8Array(new BigUint64Array([BigInt(bondingCurve.totalSupply)]).buffer),
        bondingCurve.liquidityThreshold,
      ])
    }

    const transaction = new Transaction().add(instruction)
    const { blockhash } = await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = publicKey

    return transaction
  }, [publicKey, connection, bondingCurve])

  const handleCreateToken = useCallback(async () => {
    if (!connected || !publicKey || !signTransaction) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!validateForm()) {
      toast.error('Please fix the form errors before proceeding')
      return
    }

    setIsCreating(true)

    try {
      updateCreationStep('validate', 'processing')
      await new Promise(resolve => setTimeout(resolve, 1000))
      updateCreationStep('validate', 'completed')

      updateCreationStep('upload', 'processing')
      let imageHash = ''
      if (metadata.image) {
        const imageFormData = new FormData()
        imageFormData.append('file', metadata.image)
        const imageResponse = await fetch('/api/ipfs/upload-file', {
          method: 'POST',
          body: imageFormData
        })
        const imageResult = await imageResponse.json()
        imageHash = imageResult.hash
      }

      const tokenMetadata = {
        name: metadata.name,
        symbol: metadata.symbol,
        description: metadata.description,
        image: imageHash ? `https://ipfs.io/ipfs/${imageHash}` : metadata.imageUrl,
        external_url: metadata.website,
        attributes: [
          { trait_type: 'Type', value: 'Meme Token' },
          { trait_type: 'Launch Type', value: 'Fair Launch' },
          { trait_type: 'Total Supply', value: bondingCurve.totalSupply.toLocaleString() }
        ],
        properties: {
          files: imageHash ? [{ uri: `https://ipfs.io/ipfs/${imageHash}`, type: 'image/png' }] : [],
          category: 'image'
        },
        social: {
          twitter: metadata.twitter,
          telegram: metadata.telegram,
          website: metadata.website
        }
      }

      const metadataHash = await uploadToIPFS(tokenMetadata)
      updateCreationStep('upload', 'completed')

      updateCreationStep('mint', 'processing')
      const { mint, transaction: mintTransaction } = await createTokenMint()
      const signedMintTx = await signTransaction(mintTransaction)
      const mintTxId = await connection.sendRawTransaction(signedMintTx.serialize())
      await connection.confirmTransaction(mintTxId, 'confirmed')
      updateCreationStep('mint', 'completed')

      updateCreationStep('curve', 'processing')
      const bondingCurveTransaction = await initializeBondingCurve(mint)
      const signedBondingTx = await signTransaction(bondingCurveTransaction)
      const bondingTxId = await connection.sendRawTransaction(signedBondingTx.serialize())
      await connection.confirmTransaction(bondingTxId, 'confirmed')
      updateCreationStep('curve', 'completed')

      updateCreationStep('finalize', 'processing')
      
      const launchData = {
        mint: mint.toString(),
        metadata: `https://ipfs.io/ipfs/${metadataHash}`,
        creator: publicKey.toString(),
        bondingCurve: bondingCurve,
        social: {
          twitter: metadata.twitter,
          telegram: metadata.telegram,
          website: metadata.website
        },
        createdAt: new Date().toISOString()
      }

      await fetch('/api/tokens/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(launchData)
      })

      updateCreationStep('finalize', 'completed')

      toast.success('Token created successfully!')
      
      setTimeout(() => {
        window.location.href = `/token/${mint.toString()}`
      }, 2000)

    } catch (error) {
      console.error('Token creation failed:', error)
      toast.error(error instanceof Error ? error.message : 'Token creation failed')
      
      setCreationSteps(prev => prev.map(step => 
        step.status === 'processing' ? { ...step, status: 'error' } : step
      ))
    } finally {
      setIsCreating(false)
    }
  }, [connected, publicKey, signTransaction, validateForm, metadata, bondingCurve, updateCreationStep, uploadToIPFS, createTokenMint, initializeBonding