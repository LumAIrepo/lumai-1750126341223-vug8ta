'use client'

import React, { FC, ReactNode, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
  BackpackWalletAdapter,
  GlowWalletAdapter,
  SolletWalletAdapter,
  MathWalletAdapter,
  Coin98WalletAdapter,
  CloverWalletAdapter,
  LedgerWalletAdapter,
  SafePalWalletAdapter,
  SlopeWalletAdapter,
  TokenPocketWalletAdapter,
  TrustWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'

require('@solana/wallet-adapter-react-ui/styles.css')

interface WalletAdapterProps {
  children: ReactNode
}

export const WalletAdapter: FC<WalletAdapterProps> = ({ children }) => {
  const network = WalletAdapterNetwork.Mainnet
  
  const endpoint = useMemo(() => {
    if (process.env.NODE_ENV === 'development') {
      return process.env.NEXT_PUBLIC_RPC_ENDPOINT || clusterApiUrl(WalletAdapterNetwork.Devnet)
    }
    return process.env.NEXT_PUBLIC_RPC_ENDPOINT || clusterApiUrl(network)
  }, [network])

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
      new GlowWalletAdapter(),
      new TorusWalletAdapter(),
      new SolletWalletAdapter(),
      new MathWalletAdapter(),
      new Coin98WalletAdapter(),
      new CloverWalletAdapter(),
      new LedgerWalletAdapter(),
      new SafePalWalletAdapter(),
      new SlopeWalletAdapter(),
      new TokenPocketWalletAdapter(),
      new TrustWalletAdapter(),
    ],
    []
  )

  return (
    <ConnectionProvider 
      endpoint={endpoint}
      config={{
        commitment: 'confirmed',
        wsEndpoint: endpoint.replace('https://', 'wss://').replace('http://', 'ws://'),
        confirmTransactionInitialTimeout: 60000,
      }}
    >
      <WalletProvider 
        wallets={wallets} 
        autoConnect={true}
        onError={(error) => {
          console.error('Wallet error:', error)
        }}
      >
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

export default WalletAdapter