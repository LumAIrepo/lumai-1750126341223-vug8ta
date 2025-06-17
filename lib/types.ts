import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

// Program Account Types
export interface TokenLaunch {
  creator: PublicKey;
  mint: PublicKey;
  bondingCurve: PublicKey;
  metadata: PublicKey;
  name: string;
  symbol: string;
  description: string;
  image: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  totalSupply: BN;
  decimals: number;
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
  realTokenReserves: BN;
  realSolReserves: BN;
  tokensMinted: BN;
  complete: boolean;
  bumpSeed: number;
  createdAt: BN;
  migrationTarget?: PublicKey;
}

export interface BondingCurve {
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
  realTokenReserves: BN;
  realSolReserves: BN;
  tokenTotalSupply: BN;
  complete: boolean;
}

export interface UserPosition {
  user: PublicKey;
  tokenMint: PublicKey;
  tokenAmount: BN;
  solInvested: BN;
  averagePrice: BN;
  createdAt: BN;
  lastUpdated: BN;
}

export interface GlobalConfig {
  authority: PublicKey;
  feeDestination: PublicKey;
  initialVirtualTokenReserves: BN;
  initialVirtualSolReserves: BN;
  initialRealTokenReserves: BN;
  targetMarketCapLamports: BN;
  creationFeeLamports: BN;
  tradingFeeNumerator: BN;
  tradingFeeDenominator: BN;
  migrationFeeNumerator: BN;
  migrationFeeDenominator: BN;
  maxNameLength: number;
  maxSymbolLength: number;
  maxDescriptionLength: number;
  maxUriLength: number;
  bump: number;
}

// Instruction Data Types
export interface CreateTokenArgs {
  name: string;
  symbol: string;
  description: string;
  image: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  initialBuy?: BN;
}

export interface BuyTokenArgs {
  amount: BN;
  maxSolCost: BN;
}

export interface SellTokenArgs {
  amount: BN;
  minSolOutput: BN;
}

export interface SetParamsArgs {
  feeDestination?: PublicKey;
  initialVirtualTokenReserves?: BN;
  initialVirtualSolReserves?: BN;
  initialRealTokenReserves?: BN;
  targetMarketCapLamports?: BN;
  creationFeeLamports?: BN;
  tradingFeeNumerator?: BN;
  tradingFeeDenominator?: BN;
  migrationFeeNumerator?: BN;
  migrationFeeDenominator?: BN;
}

// Event Types
export interface TokenCreatedEvent {
  mint: PublicKey;
  bondingCurve: PublicKey;
  user: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  timestamp: BN;
}

export interface TradeEvent {
  mint: PublicKey;
  user: PublicKey;
  isBuy: boolean;
  tokenAmount: BN;
  solAmount: BN;
  virtualTokenReserves: BN;
  virtualSolReserves: BN;
  timestamp: BN;
}

export interface CompleteEvent {
  mint: PublicKey;
  bondingCurve: PublicKey;
  timestamp: BN;
}

// Frontend Types
export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  external_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
}

export interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  creator: string;
  createdAt: number;
  marketCap: number;
  price: number;
  volume24h: number;
  holders: number;
  complete: boolean;
  progress: number;
  virtualTokenReserves: string;
  virtualSolReserves: string;
  realTokenReserves: string;
  realSolReserves: string;
  totalSupply: string;
  decimals: number;
}

export interface TradeData {
  signature: string;
  mint: string;
  user: string;
  type: 'buy' | 'sell';
  tokenAmount: string;
  solAmount: string;
  price: number;
  timestamp: number;
  blockTime: number;
}

export interface ChartDataPoint {
  timestamp: number;
  price: number;
  volume: number;
  marketCap: number;
}

export interface UserHolding {
  mint: string;
  tokenAmount: string;
  solInvested: string;
  averagePrice: number;
  currentValue: number;
  pnl: number;
  pnlPercentage: number;
}

export interface CreateTokenFormData {
  name: string;
  symbol: string;
  description: string;
  image: File | null;
  website?: string;
  twitter?: string;
  telegram?: string;
  initialBuy?: number;
}

export interface TradeFormData {
  amount: number;
  slippage: number;
  type: 'buy' | 'sell';
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface TokenListResponse extends PaginatedResponse<TokenInfo> {}

export interface TradeListResponse extends PaginatedResponse<TradeData> {}

// WebSocket Types
export interface WebSocketMessage {
  type: 'token_created' | 'trade' | 'price_update' | 'completion' | 'error';
  data: any;
  timestamp: number;
}

export interface PriceUpdateMessage {
  mint: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  timestamp: number;
}

// Error Types
export interface ProgramError {
  code: number;
  name: string;
  msg: string;
}

export interface TransactionError {
  signature?: string;
  error: string;
  logs?: string[];
}

// Utility Types
export type SortOrder = 'asc' | 'desc';

export type TokenSortBy = 
  | 'created_at'
  | 'market_cap'
  | 'volume_24h'
  | 'price'
  | 'holders'
  | 'name';

export type TradeSortBy = 
  | 'timestamp'
  | 'token_amount'
  | 'sol_amount'
  | 'price';

export interface SortConfig {
  field: TokenSortBy | TradeSortBy;
  order: SortOrder;
}

export interface FilterConfig {
  minMarketCap?: number;
  maxMarketCap?: number;
  minVolume24h?: number;
  maxVolume24h?: number;
  creator?: string;
  complete?: boolean;
  search?: string;
}

// Constants
export const PROGRAM_ERRORS: Record<number, ProgramError> = {
  6000: { code: 6000, name: 'InvalidCalculation', msg: 'Invalid calculation' },
  6001: { code: 6001, name: 'InsufficientFunds', msg: 'Insufficient funds' },
  6002: { code: 6002, name: 'SlippageExceeded', msg: 'Slippage tolerance exceeded' },
  6003: { code: 6003, name: 'BondingCurveComplete', msg: 'Bonding curve is complete' },
  6004: { code: 6004, name: 'BondingCurveNotComplete', msg: 'Bonding curve is not complete' },
  6005: { code: 6005, name: 'InvalidTokenAmount', msg: 'Invalid token amount' },
  6006: { code: 6006, name: 'InvalidSolAmount', msg: 'Invalid SOL amount' },
  6007: { code: 6007, name: 'NameTooLong', msg: 'Name too long' },
  6008: { code: 6008, name: 'SymbolTooLong', msg: 'Symbol too long' },
  6009: { code: 6009, name: 'DescriptionTooLong', msg: 'Description too long' },
  6010: { code: 6010, name: 'UriTooLong', msg: 'URI too long' },
  6011: { code: 6011, name: 'Unauthorized', msg: 'Unauthorized' },
  6012: { code: 6012, name: 'InvalidMint', msg: 'Invalid mint' },
  6013: { code: 6013, name: 'InvalidBondingCurve', msg: 'Invalid bonding curve' },
  6014: { code: 6014, name: 'InvalidMetadata', msg: 'Invalid metadata' },
  6015: { code: 6015, name: 'MigrationFailed', msg: 'Migration failed' },
};

export const TOKEN_DECIMALS = 6;
export const SOL_DECIMALS = 9;
export const LAMPORTS_PER_SOL = 1_000_000_000;
export const MAX_NAME_LENGTH = 32;
export const MAX_SYMBOL_LENGTH = 10;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_URI_LENGTH = 200;
export const INITIAL_VIRTUAL_TOKEN_RESERVES = new BN('1073000000000000');
export const INITIAL_VIRTUAL_SOL_RESERVES = new BN('30000000000');
export const INITIAL_REAL_TOKEN_RESERVES = new BN('793100000000000');
export const TARGET_MARKET_CAP_LAMPORTS = new BN('85000000000');
export const CREATION_FEE_LAMPORTS = new BN('2000000');
export const TRADING_FEE_NUMERATOR = new BN('1');
export const TRADING_FEE_DENOMINATOR = new BN('100');
export const MIGRATION_FEE_NUMERATOR = new BN('1');
export const MIGRATION_FEE_DENOMINATOR = new BN('100');