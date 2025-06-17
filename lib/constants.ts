import { PublicKey } from '@solana/web3.js';

// Network Configuration
export const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
export const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.devnet.solana.com';

// Program IDs
export const PUMP_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
export const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
export const RENT_PROGRAM_ID = new PublicKey('SysvarRent111111111111111111111111111111111');

// Metaplex Program IDs
export const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// Raydium Program IDs (for liquidity migration)
export const RAYDIUM_AMM_PROGRAM_ID = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
export const RAYDIUM_AUTHORITY = new PublicKey('5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1');

// Serum Program IDs
export const SERUM_PROGRAM_ID = new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');

// PDA Seeds
export const BONDING_CURVE_SEED = 'bonding-curve';
export const ASSOCIATED_USER_SEED = 'associated-user';
export const METADATA_SEED = 'metadata';
export const EDITION_SEED = 'edition';

// Token Configuration
export const TOKEN_DECIMALS = 6;
export const INITIAL_VIRTUAL_TOKEN_RESERVES = 1_073_000_000_000_000; // 1.073B tokens
export const INITIAL_VIRTUAL_SOL_RESERVES = 30_000_000_000; // 30 SOL in lamports
export const INITIAL_REAL_TOKEN_RESERVES = 793_100_000_000_000; // 793.1B tokens
export const INITIAL_REAL_SOL_RESERVES = 0; // 0 SOL initially

// Bonding Curve Configuration
export const BONDING_CURVE_LIMIT = 85_000_000_000; // 85 SOL in lamports
export const CREATOR_FEE_BASIS_POINTS = 100; // 1%
export const PLATFORM_FEE_BASIS_POINTS = 100; // 1%
export const TOTAL_SUPPLY = 1_000_000_000_000_000; // 1B tokens with 6 decimals

// Trading Configuration
export const MIN_SOL_AMOUNT = 0.00001; // Minimum SOL amount for trades
export const MAX_SOL_AMOUNT = 50; // Maximum SOL amount for trades
export const SLIPPAGE_TOLERANCE = 0.01; // 1% default slippage
export const MAX_SLIPPAGE = 0.5; // 50% maximum slippage

// UI Configuration
export const CHART_UPDATE_INTERVAL = 5000; // 5 seconds
export const PRICE_UPDATE_INTERVAL = 1000; // 1 second
export const TRANSACTION_TIMEOUT = 30000; // 30 seconds
export const MAX_RETRIES = 3;

// File Upload Configuration
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

// Social Features
export const MAX_COMMENT_LENGTH = 280;
export const MAX_TOKEN_NAME_LENGTH = 32;
export const MAX_TOKEN_SYMBOL_LENGTH = 10;
export const MAX_DESCRIPTION_LENGTH = 500;

// Wallet Configuration
export const SUPPORTED_WALLETS = [
  'phantom',
  'solflare',
  'backpack',
  'glow',
  'slope',
  'sollet',
  'mathwallet',
  'coin98',
  'clover',
  'ledger',
  'torus'
] as const;

// API Endpoints
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';
export const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3001';

// Error Messages
export const ERROR_MESSAGES = {
  WALLET_NOT_CONNECTED: 'Please connect your wallet',
  INSUFFICIENT_BALANCE: 'Insufficient SOL balance',
  TRANSACTION_FAILED: 'Transaction failed',
  INVALID_AMOUNT: 'Invalid amount',
  SLIPPAGE_EXCEEDED: 'Price impact too high',
  NETWORK_ERROR: 'Network error occurred',
  TOKEN_NOT_FOUND: 'Token not found',
  UNAUTHORIZED: 'Unauthorized access',
  RATE_LIMITED: 'Too many requests',
  INVALID_FILE_TYPE: 'Invalid file type',
  FILE_TOO_LARGE: 'File too large',
  CREATION_FAILED: 'Token creation failed',
  MIGRATION_FAILED: 'Liquidity migration failed'
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  TOKEN_CREATED: 'Token created successfully',
  TRADE_EXECUTED: 'Trade executed successfully',
  LIQUIDITY_MIGRATED: 'Liquidity migrated to Raydium',
  COMMENT_POSTED: 'Comment posted successfully',
  PROFILE_UPDATED: 'Profile updated successfully'
} as const;

// Chart Configuration
export const CHART_COLORS = {
  PRIMARY: '#10b981',
  SECONDARY: '#ef4444',
  BACKGROUND: '#1f2937',
  GRID: '#374151',
  TEXT: '#f9fafb'
} as const;

// Animation Durations
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  WALLET_PREFERENCE: 'pump_wallet_preference',
  SLIPPAGE_TOLERANCE: 'pump_slippage_tolerance',
  THEME_PREFERENCE: 'pump_theme_preference',
  RECENT_TOKENS: 'pump_recent_tokens',
  FAVORITES: 'pump_favorites'
} as const;

// Rate Limiting
export const RATE_LIMITS = {
  TOKEN_CREATION: 5, // per hour
  COMMENTS: 30, // per hour
  TRADES: 100, // per hour
  API_CALLS: 1000 // per hour
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  ENABLE_COMMENTS: true,
  ENABLE_FAVORITES: true,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_ANALYTICS: true,
  ENABLE_DARK_MODE: true,
  ENABLE_MOBILE_APP: false
} as const;

// Validation Rules
export const VALIDATION_RULES = {
  TOKEN_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: MAX_TOKEN_NAME_LENGTH,
    PATTERN: /^[a-zA-Z0-9\s\-_]+$/
  },
  TOKEN_SYMBOL: {
    MIN_LENGTH: 1,
    MAX_LENGTH: MAX_TOKEN_SYMBOL_LENGTH,
    PATTERN: /^[A-Z0-9]+$/
  },
  DESCRIPTION: {
    MIN_LENGTH: 0,
    MAX_LENGTH: MAX_DESCRIPTION_LENGTH
  },
  WEBSITE_URL: {
    PATTERN: /^https?:\/\/.+/
  },
  TWITTER_HANDLE: {
    PATTERN: /^@?[a-zA-Z0-9_]+$/
  },
  TELEGRAM_HANDLE: {
    PATTERN: /^@?[a-zA-Z0-9_]+$/
  }
} as const;

// Default Values
export const DEFAULT_VALUES = {
  SLIPPAGE_TOLERANCE: 0.01,
  CHART_TIMEFRAME: '1H',
  TOKENS_PER_PAGE: 20,
  COMMENTS_PER_PAGE: 10,
  REFRESH_INTERVAL: 30000
} as const;

// Environment Checks
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const IS_CLIENT = typeof window !== 'undefined';