```typescript
import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com')

interface TradeData {
  signature: string
  timestamp: number
  trader: string
  tokenMint: string
  isBuy: boolean
  solAmount: number
  tokenAmount: number
  price: number
  marketCap: number
  slot: number
  blockTime: number
}

interface TradeHistoryResponse {
  trades: TradeData[]
  hasMore: boolean
  lastSignature?: string
}

const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')

async function parseTradeTransaction(signature: string): Promise<TradeData | null> {
  try {
    const transaction = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    })

    if (!transaction || !transaction.meta || transaction.meta.err) {
      return null
    }

    const { transaction: tx, meta, blockTime, slot } = transaction
    const message = tx.message

    let tokenMint = ''
    let trader = ''
    let isBuy = false
    let solAmount = 0
    let tokenAmount = 0
    let price = 0
    let marketCap = 0

    // Parse instruction data
    for (const instruction of message.instructions) {
      if (instruction.programId.equals(PROGRAM_ID)) {
        const accounts = instruction.accounts
        const data = instruction.data

        if (accounts.length >= 8) {
          trader = message.accountKeys[accounts[0]].toBase58()
          tokenMint = message.accountKeys[accounts[4]].toBase58()

          // Parse instruction data to determine trade type and amounts
          const instructionData = Buffer.from(data)
          if (instructionData.length >= 9) {
            const discriminator = instructionData.readUInt8(0)
            
            if (discriminator === 0x66) { // Buy instruction
              isBuy = true
              const solAmountBN = new BN(instructionData.subarray(1, 9), 'le')
              solAmount = solAmountBN.toNumber() / 1e9
            } else if (discriminator === 0x33) { // Sell instruction
              isBuy = false
              const tokenAmountBN = new BN(instructionData.subarray(1, 9), 'le')
              tokenAmount = tokenAmountBN.toNumber() / 1e6
            }
          }
        }
      }
    }

    // Calculate token amount for buys and sol amount for sells from balance changes
    if (meta.preBalances && meta.postBalances) {
      for (let i = 0; i < meta.preBalances.length; i++) {
        const preBalance = meta.preBalances[i]
        const postBalance = meta.postBalances[i]
        const balanceChange = postBalance - preBalance

        if (message.accountKeys[i].toBase58() === trader) {
          if (isBuy && balanceChange < 0) {
            solAmount = Math.abs(balanceChange) / 1e9
          } else if (!isBuy && balanceChange > 0) {
            solAmount = balanceChange / 1e9
          }
        }
      }
    }

    // Parse token balance changes
    if (meta.preTokenBalances && meta.postTokenBalances) {
      for (const preToken of meta.preTokenBalances) {
        const postToken = meta.postTokenBalances.find(
          post => post.accountIndex === preToken.accountIndex
        )
        
        if (postToken && preToken.mint === tokenMint) {
          const preAmount = parseFloat(preToken.uiTokenAmount.uiAmountString || '0')
          const postAmount = parseFloat(postToken.uiTokenAmount.uiAmountString || '0')
          const tokenChange = Math.abs(postAmount - preAmount)
          
          if (tokenChange > 0) {
            tokenAmount = tokenChange
          }
        }
      }
    }

    // Calculate price and market cap
    if (solAmount > 0 && tokenAmount > 0) {
      price = solAmount / tokenAmount
      
      // Estimate market cap based on bonding curve
      const totalSupply = 1000000000 // 1B tokens typical supply
      marketCap = price * totalSupply
    }

    return {
      signature,
      timestamp: blockTime || Date.now() / 1000,
      trader,
      tokenMint,
      isBuy,
      solAmount,
      tokenAmount,
      price,
      marketCap,
      slot: slot || 0,
      blockTime: blockTime || 0
    }
  } catch (error) {
    console.error('Error parsing trade transaction:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tokenMint = searchParams.get('mint')
    const limit = parseInt(searchParams.get('limit') || '50')
    const before = searchParams.get('before')
    const trader = searchParams.get('trader')

    if (!tokenMint) {
      return NextResponse.json(
        { error: 'Token mint address is required' },
        { status: 400 }
      )
    }

    // Validate mint address
    try {
      new PublicKey(tokenMint)
    } catch {
      return NextResponse.json(
        { error: 'Invalid token mint address' },
        { status: 400 }
      )
    }

    // Get recent signatures for the program
    const signatures = await connection.getSignaturesForAddress(
      PROGRAM_ID,
      {
        limit: Math.min(limit * 3, 1000), // Get more signatures to filter
        before: before || undefined
      }
    )

    const trades: TradeData[] = []
    const processedSignatures = new Set<string>()

    for (const sigInfo of signatures) {
      if (trades.length >= limit) break
      if (processedSignatures.has(sigInfo.signature)) continue

      processedSignatures.add(sigInfo.signature)

      const tradeData = await parseTradeTransaction(sigInfo.signature)
      
      if (tradeData && tradeData.tokenMint === tokenMint) {
        // Filter by trader if specified
        if (trader && tradeData.trader !== trader) {
          continue
        }

        trades.push(tradeData)
      }
    }

    // Sort by timestamp descending
    trades.sort((a, b) => b.timestamp - a.timestamp)

    const response: TradeHistoryResponse = {
      trades: trades.slice(0, limit),
      hasMore: signatures.length === Math.min(limit * 3, 1000),
      lastSignature: signatures[signatures.length - 1]?.signature
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30'
      }
    })

  } catch (error) {
    console.error('Error fetching trade history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trade history' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { signature } = body

    if (!signature) {
      return NextResponse.json(
        { error: 'Transaction signature is required' },
        { status: 400 }
      )
    }

    // Parse and return trade data for a specific transaction
    const tradeData = await parseTradeTransaction(signature)
    
    if (!tradeData) {
      return NextResponse.json(
        { error: 'Failed to parse trade transaction' },
        { status: 404 }
      )
    }

    return NextResponse.json({ trade: tradeData })

  } catch (error) {
    console.error('Error processing trade transaction:', error)
    return NextResponse.json(
      { error: 'Failed to process trade transaction' },
      { status: 500 }
    )
  }
}
```