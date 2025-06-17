'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { Connection, PublicKey } from '@solana/web3.js'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  TooltipItem
} from 'chart.js'
import { format } from 'date-fns'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface PricePoint {
  timestamp: number
  price: number
  volume: number
  marketCap: number
}

interface TokenChartProps {
  tokenAddress: string
  className?: string
  height?: number
  timeframe?: '1H' | '4H' | '1D' | '7D' | '30D'
  showVolume?: boolean
  showMarketCap?: boolean
}

interface BondingCurveData {
  virtualSolReserves: number
  virtualTokenReserves: number
  realSolReserves: number
  realTokenReserves: number
  tokenTotalSupply: number
  complete: boolean
}

const TIMEFRAME_INTERVALS = {
  '1H': 60 * 1000, // 1 minute
  '4H': 5 * 60 * 1000, // 5 minutes
  '1D': 15 * 60 * 1000, // 15 minutes
  '7D': 60 * 60 * 1000, // 1 hour
  '30D': 4 * 60 * 60 * 1000 // 4 hours
}

const TIMEFRAME_DURATION = {
  '1H': 60 * 60 * 1000,
  '4H': 4 * 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
  '7D': 7 * 24 * 60 * 60 * 1000,
  '30D': 30 * 24 * 60 * 60 * 1000
}

export default function TokenChart({
  tokenAddress,
  className = '',
  height = 400,
  timeframe = '1D',
  showVolume = true,
  showMarketCap = false
}: TokenChartProps) {
  const [priceData, setPriceData] = useState<PricePoint[]>([])
  const [bondingCurveData, setBondingCurveData] = useState<BondingCurveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPrice, setCurrentPrice] = useState<number>(0)
  const [priceChange24h, setPriceChange24h] = useState<number>(0)
  const [volume24h, setVolume24h] = useState<number>(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const connectionRef = useRef<Connection | null>(null)

  const connection = useMemo(() => {
    if (!connectionRef.current) {
      connectionRef.current = new Connection(
        process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'confirmed'
      )
    }
    return connectionRef.current
  }, [])

  const calculatePriceFromBondingCurve = (bondingCurve: BondingCurveData): number => {
    if (!bondingCurve || bondingCurve.virtualTokenReserves === 0) return 0
    
    // Price = virtualSolReserves / virtualTokenReserves
    return bondingCurve.virtualSolReserves / bondingCurve.virtualTokenReserves
  }

  const fetchBondingCurveData = async (): Promise<BondingCurveData | null> => {
    try {
      const tokenPubkey = new PublicKey(tokenAddress)
      
      // This would be replaced with actual program account fetching
      // For now, simulating bonding curve data
      const accountInfo = await connection.getAccountInfo(tokenPubkey)
      
      if (!accountInfo) {
        throw new Error('Token account not found')
      }

      // Simulate bonding curve data parsing
      // In real implementation, this would parse the actual program account data
      const simulatedData: BondingCurveData = {
        virtualSolReserves: 30 + Math.random() * 100,
        virtualTokenReserves: 1000000000 - Math.random() * 100000000,
        realSolReserves: Math.random() * 50,
        realTokenReserves: Math.random() * 50000000,
        tokenTotalSupply: 1000000000,
        complete: Math.random() > 0.8
      }

      return simulatedData
    } catch (err) {
      console.error('Error fetching bonding curve data:', err)
      return null
    }
  }

  const fetchHistoricalData = async (): Promise<PricePoint[]> => {
    try {
      const now = Date.now()
      const duration = TIMEFRAME_DURATION[timeframe]
      const interval = TIMEFRAME_INTERVALS[timeframe]
      const points = Math.floor(duration / interval)
      
      const data: PricePoint[] = []
      let basePrice = 0.000001 + Math.random() * 0.00001
      
      for (let i = 0; i < points; i++) {
        const timestamp = now - duration + (i * interval)
        
        // Simulate price movement with some volatility
        const volatility = 0.1
        const change = (Math.random() - 0.5) * volatility
        basePrice = Math.max(basePrice * (1 + change), 0.0000001)
        
        const volume = Math.random() * 1000 + 100
        const marketCap = basePrice * 1000000000 // Assuming 1B token supply
        
        data.push({
          timestamp,
          price: basePrice,
          volume,
          marketCap
        })
      }
      
      return data
    } catch (err) {
      console.error('Error fetching historical data:', err)
      return []
    }
  }

  const updateRealTimeData = async () => {
    try {
      const bondingCurve = await fetchBondingCurveData()
      if (bondingCurve) {
        setBondingCurveData(bondingCurve)
        const newPrice = calculatePriceFromBondingCurve(bondingCurve)
        setCurrentPrice(newPrice)
        
        // Update price data with new point
        setPriceData(prev => {
          const now = Date.now()
          const newPoint: PricePoint = {
            timestamp: now,
            price: newPrice,
            volume: Math.random() * 100 + 10,
            marketCap: newPrice * bondingCurve.tokenTotalSupply
          }
          
          const updated = [...prev, newPoint]
          const cutoff = now - TIMEFRAME_DURATION[timeframe]
          return updated.filter(point => point.timestamp >= cutoff)
        })
      }
    } catch (err) {
      console.error('Error updating real-time data:', err)
    }
  }

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const [historical, bondingCurve] = await Promise.all([
          fetchHistoricalData(),
          fetchBondingCurveData()
        ])
        
        setPriceData(historical)
        setBondingCurveData(bondingCurve)
        
        if (historical.length > 0) {
          const latest = historical[historical.length - 1]
          const earliest = historical[0]
          setCurrentPrice(latest.price)
          setPriceChange24h(((latest.price - earliest.price) / earliest.price) * 100)
          setVolume24h(historical.reduce((sum, point) => sum + point.volume, 0))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load chart data')
      } finally {
        setLoading(false)
      }
    }
    
    loadInitialData()
  }, [tokenAddress, timeframe])

  useEffect(() => {
    // Set up real-time updates
    intervalRef.current = setInterval(updateRealTimeData, 5000) // Update every 5 seconds
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [tokenAddress])

  const chartData = useMemo(() => {
    if (priceData.length === 0) return null
    
    const labels = priceData.map(point => {
      const date = new Date(point.timestamp)
      switch (timeframe) {
        case '1H':
        case '4H':
          return format(date, 'HH:mm')
        case '1D':
          return format(date, 'HH:mm')
        case '7D':
          return format(date, 'MMM dd')
        case '30D':
          return format(date, 'MMM dd')
        default:
          return format(date, 'HH:mm')
      }
    })
    
    const prices = priceData.map(point => point.price)
    const volumes = priceData.map(point => point.volume)
    
    return {
      labels,
      datasets: [
        {
          label: 'Price',
          data: prices,
          borderColor: priceChange24h >= 0 ? '#10b981' : '#ef4444',
          backgroundColor: priceChange24h >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: priceChange24h >= 0 ? '#10b981' : '#ef4444',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2
        },
        ...(showVolume ? [{
          label: 'Volume',
          data: volumes,
          borderColor: 'rgba(99, 102, 241, 0.5)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderWidth: 1,
          fill: false,
          yAxisID: 'volume',
          type: 'bar' as const,
          barThickness: 2
        }] : [])
      ]
    }
  }, [priceData, timeframe, priceChange24h, showVolume])

  const chartOptions: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index'
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          title: (context) => {
            const point = priceData[context[0].dataIndex]
            return format(new Date(point.timestamp), 'MMM dd, yyyy HH:mm')
          },
          label: (context: TooltipItem<'line'>) => {
            const point = priceData[context.dataIndex]
            const lines = [
              `Price: $${point.price.toFixed(8)}`,
              `Volume: ${point.volume.toFixed(2)} SOL`
            ]
            if (showMarketCap) {
              lines.push(`Market Cap: $${(point.marketCap / 1000).toFixed(2)}K`)
            }
            return lines
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: false
        },
        ticks: {
          color: '#6b7280',
          maxTicksLimit: 8
        }
      },
      y: {
        display: true,
        position: 'right',
        grid: {
          color: 'rgba(107, 114, 128, 0.1)'
        },
        ticks: {
          color: '#6b7280',
          callback: function(value) {
            return '$' + Number(value).toFixed(8)
          }
        }
      },
      ...(showVolume ? {
        volume: {
          type: 'linear' as const,
          display: false,
          position: 'left' as const,
          max: Math.max(...priceData.map(p => p.volume)) * 4
        }
      } : {})
    },
    elements: {
      point: {
        hoverRadius: 6
      }
    }
  }), [priceData, showVolume, showMarketCap])

  if (loading) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 ${className}`} style={{ height }}>
        <div className="animate-pulse">
          <div className="flex justify-between items-center mb-4">
            <div className="h-6 bg-gray-700 rounded w-32"></div>
            <div className="h-4 bg-gray-700 rounded w-24"></div>
          </div>
          <div className="h-full bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="text-red-400 mb-2">⚠️</div>
          <p className="text-red-400 text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!chartData) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 flex items-center justify-center ${className}`} style={{ height }}>
        <p className="text-gray-400">No chart data available</p>
      </div>
    )
  }

  return (
    <div className={`bg-gray-900 rounded-lg p-4 sm:p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-