import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'

const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
  'confirmed'
)

interface TokenMetadata {
  mint: string
  name: string
  symbol: string
  description: string
  image: string
  creator: string
  createdAt: number
  supply: number
  decimals: number
  marketCap: number
  price: number
  volume24h: number
  holders: number
  bondingCurveProgress: number
  isGraduated: boolean
  liquidityPool?: string
  website?: string
  twitter?: string
  telegram?: string
}

interface TokenStats {
  totalTokens: number
  totalVolume: number
  totalMarketCap: number
  graduatedTokens: number
}

const BONDING_CURVE_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')

async function getTokenMetadata(mint: string): Promise<TokenMetadata | null> {
  try {
    const mintPubkey = new PublicKey(mint)
    
    // Get token supply
    const supply = await connection.getTokenSupply(mintPubkey)
    
    // Get bonding curve account
    const [bondingCurveAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mintPubkey.toBuffer()],
      BONDING_CURVE_PROGRAM_ID
    )
    
    const bondingCurveAccount = await connection.getAccountInfo(bondingCurveAddress)
    
    if (!bondingCurveAccount) {
      return null
    }
    
    // Parse bonding curve data
    const data = bondingCurveAccount.data
    const virtualTokenReserves = data.readBigUInt64LE(8)
    const virtualSolReserves = data.readBigUInt64LE(16)
    const realTokenReserves = data.readBigUInt64LE(24)
    const realSolReserves = data.readBigUInt64LE(32)
    const tokenTotalSupply = data.readBigUInt64LE(40)
    const complete = data.readUInt8(48) === 1
    
    // Calculate current price
    const price = Number(virtualSolReserves) / Number(virtualTokenReserves) * 1e9
    
    // Calculate market cap
    const marketCap = price * Number(supply.value.amount) / Math.pow(10, supply.value.decimals)
    
    // Calculate bonding curve progress
    const maxSupply = 1000000000 // 1B tokens
    const soldTokens = maxSupply - Number(realTokenReserves) / 1e6
    const bondingCurveProgress = (soldTokens / (maxSupply * 0.8)) * 100 // 80% for bonding curve
    
    // Get metadata from chain (simplified)
    const metadataAddress = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
        mintPubkey.toBuffer(),
      ],
      new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
    )[0]
    
    const metadataAccount = await connection.getAccountInfo(metadataAddress)
    
    // Parse metadata (simplified)
    let name = 'Unknown Token'
    let symbol = 'UNK'
    let description = ''
    let image = ''
    let creator = ''
    let website = ''
    let twitter = ''
    let telegram = ''
    
    if (metadataAccount) {
      // This is a simplified metadata parsing
      // In production, use @metaplex-foundation/mpl-token-metadata
      const metadataData = metadataAccount.data
      
      // Extract basic info (this is simplified)
      try {
        const nameLength = metadataData.readUInt32LE(69)
        name = metadataData.slice(73, 73 + nameLength).toString('utf8').replace(/\0/g, '')
        
        const symbolStart = 73 + nameLength + 4
        const symbolLength = metadataData.readUInt32LE(symbolStart - 4)
        symbol = metadataData.slice(symbolStart, symbolStart + symbolLength).toString('utf8').replace(/\0/g, '')
        
        const uriStart = symbolStart + symbolLength + 4
        const uriLength = metadataData.readUInt32LE(uriStart - 4)
        const uri = metadataData.slice(uriStart, uriStart + uriLength).toString('utf8').replace(/\0/g, '')
        
        // Fetch off-chain metadata
        if (uri) {
          try {
            const response = await fetch(uri)
            const offChainMetadata = await response.json()
            description = offChainMetadata.description || ''
            image = offChainMetadata.image || ''
            
            if (offChainMetadata.external_url) {
              website = offChainMetadata.external_url
            }
            
            if (offChainMetadata.attributes) {
              const twitterAttr = offChainMetadata.attributes.find((attr: any) => attr.trait_type === 'twitter')
              const telegramAttr = offChainMetadata.attributes.find((attr: any) => attr.trait_type === 'telegram')
              
              if (twitterAttr) twitter = twitterAttr.value
              if (telegramAttr) telegram = telegramAttr.value
            }
          } catch (error) {
            console.error('Failed to fetch off-chain metadata:', error)
          }
        }
        
        // Get creator from first creator in metadata
        creator = metadataData.slice(326, 358).toString('hex')
      } catch (error) {
        console.error('Failed to parse metadata:', error)
      }
    }
    
    // Get holder count (simplified)
    const holders = await getTokenHolderCount(mintPubkey)
    
    // Get 24h volume (this would typically come from a database)
    const volume24h = await get24hVolume(mint)
    
    return {
      mint,
      name,
      symbol,
      description,
      image,
      creator,
      createdAt: Date.now() - 86400000, // Placeholder
      supply: Number(supply.value.amount),
      decimals: supply.value.decimals,
      marketCap,
      price,
      volume24h,
      holders,
      bondingCurveProgress: Math.min(bondingCurveProgress, 100),
      isGraduated: complete,
      liquidityPool: complete ? 'placeholder-pool-address' : undefined,
      website: website || undefined,
      twitter: twitter || undefined,
      telegram: telegram || undefined,
    }
  } catch (error) {
    console.error('Error fetching token metadata:', error)
    return null
  }
}

async function getTokenHolderCount(mint: PublicKey): Promise<number> {
  try {
    const accounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
      filters: [
        {
          dataSize: 165,
        },
        {
          memcmp: {
            offset: 0,
            bytes: mint.toBase58(),
          },
        },
      ],
    })
    
    // Filter out accounts with zero balance
    let holderCount = 0
    for (const account of accounts) {
      const balance = account.account.data.readBigUInt64LE(64)
      if (balance > 0n) {
        holderCount++
      }
    }
    
    return holderCount
  } catch (error) {
    console.error('Error getting holder count:', error)
    return 0
  }
}

async function get24hVolume(mint: string): Promise<number> {
  // In production, this would query your database for transaction history
  // For now, return a placeholder value
  return Math.random() * 100000
}

async function getAllTokens(limit: number = 50, offset: number = 0): Promise<TokenMetadata[]> {
  try {
    // Get all bonding curve accounts
    const accounts = await connection.getProgramAccounts(BONDING_CURVE_PROGRAM_ID, {
      filters: [
        {
          dataSize: 49, // Size of bonding curve account
        },
      ],
    })
    
    const tokens: TokenMetadata[] = []
    
    for (let i = offset; i < Math.min(offset + limit, accounts.length); i++) {
      const account = accounts[i]
      
      // Extract mint from account data
      const mint = new PublicKey(account.account.data.slice(0, 32))
      
      const tokenMetadata = await getTokenMetadata(mint.toBase58())
      if (tokenMetadata) {
        tokens.push(tokenMetadata)
      }
    }
    
    // Sort by market cap descending
    return tokens.sort((a, b) => b.marketCap - a.marketCap)
  } catch (error) {
    console.error('Error fetching all tokens:', error)
    return []
  }
}

async function getTokenStats(): Promise<TokenStats> {
  try {
    const accounts = await connection.getProgramAccounts(BONDING_CURVE_PROGRAM_ID, {
      filters: [
        {
          dataSize: 49,
        },
      ],
    })
    
    let totalVolume = 0
    let totalMarketCap = 0
    let graduatedTokens = 0
    
    for (const account of accounts) {
      const data = account.account.data
      const complete = data.readUInt8(48) === 1
      
      if (complete) {
        graduatedTokens++
      }
      
      // Add to totals (simplified calculation)
      const virtualSolReserves = Number(data.readBigUInt64LE(16))
      totalMarketCap += virtualSolReserves / 1e9 * 100 // Rough estimate
      totalVolume += Math.random() * 10000 // Placeholder
    }
    
    return {
      totalTokens: accounts.length,
      totalVolume,
      totalMarketCap,
      graduatedTokens,
    }
  } catch (error) {
    console.error('Error fetching token stats:', error)
    return {
      totalTokens: 0,
      totalVolume: 0,
      totalMarketCap: 0,
      graduatedTokens: 0,
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mint = searchParams.get('mint')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const stats = searchParams.get('stats') === 'true'
    
    if (stats) {
      const tokenStats = await getTokenStats()
      return NextResponse.json(tokenStats)
    }
    
    if (mint) {
      const tokenMetadata = await getTokenMetadata(mint)
      
      if (!tokenMetadata) {
        return NextResponse.json(
          { error: 'Token not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(tokenMetadata)
    }
    
    const tokens = await getAllTokens(limit, offset)
    
    return NextResponse.json({
      tokens,
      pagination: {
        limit,
        offset,
        hasMore: tokens.length === limit,
      },
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mints } = body
    
    if (!Array.isArray(mints)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }
    
    const tokens: TokenMetadata[] = []
    
    for (const mint of mints) {
      const tokenMetadata = await getTokenMetadata(mint)
      if (tokenMetadata) {
        tokens.push(tokenMetadata)
      }
    }
    
    return NextResponse.json({ tokens })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}