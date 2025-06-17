```typescript
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

export interface BondingCurveConfig {
  initialPrice: number;
  finalPrice: number;
  totalSupply: number;
  reserveRatio: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
}

export interface TradeResult {
  amountOut: number;
  priceImpact: number;
  newPrice: number;
  newReserves: {
    sol: number;
    token: number;
  };
}

export interface CurveState {
  solReserves: number;
  tokenReserves: number;
  currentPrice: number;
  marketCap: number;
  progress: number;
  isComplete: boolean;
}

export class BondingCurve {
  private config: BondingCurveConfig;
  private readonly GRADUATION_THRESHOLD = 85000; // SOL
  private readonly SLIPPAGE_TOLERANCE = 0.005; // 0.5%
  private readonly MAX_SLIPPAGE = 0.15; // 15%
  private readonly FEE_RATE = 0.01; // 1%

  constructor(config: BondingCurveConfig) {
    this.config = config;
  }

  // Calculate current price based on reserves
  getCurrentPrice(solReserves: number, tokenReserves: number): number {
    if (tokenReserves <= 0) return 0;
    return solReserves / tokenReserves;
  }

  // Calculate market cap
  getMarketCap(solReserves: number, tokenReserves: number, totalSupply: number): number {
    const price = this.getCurrentPrice(solReserves, tokenReserves);
    return price * totalSupply;
  }

  // Calculate bonding curve progress (0-100%)
  getProgress(solReserves: number): number {
    const progress = (solReserves / this.GRADUATION_THRESHOLD) * 100;
    return Math.min(progress, 100);
  }

  // Check if curve is complete and ready for Raydium migration
  isGraduationReady(solReserves: number): boolean {
    return solReserves >= this.GRADUATION_THRESHOLD;
  }

  // Calculate tokens received for SOL input (buy)
  calculateBuyAmount(
    solAmount: number,
    currentSolReserves: number,
    currentTokenReserves: number
  ): TradeResult {
    if (solAmount <= 0) {
      throw new Error('SOL amount must be positive');
    }

    // Apply fee
    const solAfterFee = solAmount * (1 - this.FEE_RATE);
    
    // Calculate new reserves after trade
    const newSolReserves = currentSolReserves + solAfterFee;
    
    // Using constant product formula: x * y = k
    const k = currentSolReserves * currentTokenReserves;
    const newTokenReserves = k / newSolReserves;
    
    const tokensOut = currentTokenReserves - newTokenReserves;
    
    if (tokensOut <= 0) {
      throw new Error('Insufficient liquidity');
    }

    const oldPrice = this.getCurrentPrice(currentSolReserves, currentTokenReserves);
    const newPrice = this.getCurrentPrice(newSolReserves, newTokenReserves);
    
    const priceImpact = ((newPrice - oldPrice) / oldPrice) * 100;

    if (priceImpact > this.MAX_SLIPPAGE * 100) {
      throw new Error(`Price impact too high: ${priceImpact.toFixed(2)}%`);
    }

    return {
      amountOut: tokensOut,
      priceImpact,
      newPrice,
      newReserves: {
        sol: newSolReserves,
        token: newTokenReserves
      }
    };
  }

  // Calculate SOL received for token input (sell)
  calculateSellAmount(
    tokenAmount: number,
    currentSolReserves: number,
    currentTokenReserves: number
  ): TradeResult {
    if (tokenAmount <= 0) {
      throw new Error('Token amount must be positive');
    }

    if (tokenAmount > currentTokenReserves) {
      throw new Error('Insufficient token reserves');
    }

    // Calculate new reserves after trade
    const newTokenReserves = currentTokenReserves + tokenAmount;
    
    // Using constant product formula: x * y = k
    const k = currentSolReserves * currentTokenReserves;
    const newSolReserves = k / newTokenReserves;
    
    const solOut = currentSolReserves - newSolReserves;
    
    if (solOut <= 0) {
      throw new Error('Insufficient liquidity');
    }

    // Apply fee
    const solAfterFee = solOut * (1 - this.FEE_RATE);

    const oldPrice = this.getCurrentPrice(currentSolReserves, currentTokenReserves);
    const newPrice = this.getCurrentPrice(newSolReserves, newTokenReserves);
    
    const priceImpact = ((oldPrice - newPrice) / oldPrice) * 100;

    if (priceImpact > this.MAX_SLIPPAGE * 100) {
      throw new Error(`Price impact too high: ${priceImpact.toFixed(2)}%`);
    }

    return {
      amountOut: solAfterFee,
      priceImpact,
      newPrice,
      newReserves: {
        sol: newSolReserves,
        token: newTokenReserves
      }
    };
  }

  // Calculate minimum amount out with slippage protection
  calculateMinAmountOut(expectedAmount: number, slippageTolerance?: number): number {
    const slippage = slippageTolerance || this.SLIPPAGE_TOLERANCE;
    return expectedAmount * (1 - slippage);
  }

  // Get current curve state
  getCurveState(
    solReserves: number,
    tokenReserves: number,
    totalSupply: number
  ): CurveState {
    const currentPrice = this.getCurrentPrice(solReserves, tokenReserves);
    const marketCap = this.getMarketCap(solReserves, tokenReserves, totalSupply);
    const progress = this.getProgress(solReserves);
    const isComplete = this.isGraduationReady(solReserves);

    return {
      solReserves,
      tokenReserves,
      currentPrice,
      marketCap,
      progress,
      isComplete
    };
  }

  // Calculate price at specific point on curve
  getPriceAtReserves(solReserves: number, tokenReserves: number): number {
    return this.getCurrentPrice(solReserves, tokenReserves);
  }

  // Calculate reserves needed for target price
  getReservesForPrice(targetPrice: number, currentTokenReserves: number): number {
    return targetPrice * currentTokenReserves;
  }

  // Validate trade parameters
  validateTrade(
    amount: number,
    isBuy: boolean,
    currentSolReserves: number,
    currentTokenReserves: number
  ): { isValid: boolean; error?: string } {
    if (amount <= 0) {
      return { isValid: false, error: 'Amount must be positive' };
    }

    if (isBuy) {
      // For buys, check if there are enough tokens in reserves
      if (currentTokenReserves <= 0) {
        return { isValid: false, error: 'No tokens available' };
      }
    } else {
      // For sells, check if trying to sell more than available
      if (amount > currentTokenReserves) {
        return { isValid: false, error: 'Insufficient token reserves' };
      }
    }

    return { isValid: true };
  }

  // Calculate fees for a trade
  calculateFees(amount: number): { fee: number; amountAfterFee: number } {
    const fee = amount * this.FEE_RATE;
    const amountAfterFee = amount - fee;
    
    return { fee, amountAfterFee };
  }

  // Get graduation requirements
  getGraduationInfo(currentSolReserves: number): {
    required: number;
    current: number;
    remaining: number;
    progress: number;
    isReady: boolean;
  } {
    const progress = this.getProgress(currentSolReserves);
    const remaining = Math.max(0, this.GRADUATION_THRESHOLD - currentSolReserves);
    
    return {
      required: this.GRADUATION_THRESHOLD,
      current: currentSolReserves,
      remaining,
      progress,
      isReady: this.isGraduationReady(currentSolReserves)
    };
  }

  // Calculate optimal trade size to avoid excessive slippage
  getOptimalTradeSize(
    maxAmount: number,
    isBuy: boolean,
    currentSolReserves: number,
    currentTokenReserves: number,
    maxSlippage: number = this.MAX_SLIPPAGE
  ): number {
    let optimalAmount = maxAmount;
    let iterations = 0;
    const maxIterations = 20;

    while (iterations < maxIterations) {
      try {
        const result = isBuy 
          ? this.calculateBuyAmount(optimalAmount, currentSolReserves, currentTokenReserves)
          : this.calculateSellAmount(optimalAmount, currentSolReserves, currentTokenReserves);

        if (result.priceImpact <= maxSlippage * 100) {
          return optimalAmount;
        }

        optimalAmount *= 0.8; // Reduce by 20%
        iterations++;
      } catch (error) {
        optimalAmount *= 0.5; // Reduce by 50% on error
        iterations++;
      }
    }

    return optimalAmount;
  }

  // Format numbers for display
  static formatPrice(price: number): string {
    if (price < 0.000001) {
      return price.toExponential(2);
    } else if (price < 0.01) {
      return price.toFixed(6);
    } else if (price < 1) {
      return price.toFixed(4);
    } else {
      return price.toFixed(2);
    }
  }

  static formatAmount(amount: number, decimals: number = 6): string {
    if (amount < 0.000001) {
      return '0';
    } else if (amount < 0.01) {
      return amount.toFixed(decimals);
    } else if (amount < 1000) {
      return amount.toFixed(2);
    } else if (amount < 1000000) {
      return `${(amount / 1000).toFixed(1)}K`;
    } else {
      return `${(amount / 1000000).toFixed(1)}M`;
    }
  }

  // Convert to/from lamports for Solana transactions
  static toLamports(sol: number): BN {
    return new BN(Math.floor(sol * 1e9));
  }

  static fromLamports(lamports: BN): number {
    return lamports.toNumber() / 1e9;
  }

  // Create default bonding curve configuration
  static createDefaultConfig(): BondingCurveConfig {
    return {
      initialPrice: 0.00001,
      finalPrice: 0.1,
      totalSupply: 1000000000, // 1B tokens
      reserveRatio: 0.5,
      virtualSolReserves: 30,
      virtualTokenReserves: 1073000000
    };
  }
}

// Utility functions for bonding curve calculations
export const bondingCurveUtils = {
  // Calculate K constant for AMM
  calculateK: (solReserves: number, tokenReserves: number): number => {
    return solReserves * tokenReserves;
  },

  // Calculate square root for price calculations
  sqrt: (value: number): number => {
    return Math.sqrt(value);
  },

  // Calculate percentage change
  calculatePercentageChange: (oldValue: number, newValue: number): number => {
    if (oldValue === 0) return 0;
    return ((newValue - oldValue) / oldValue) * 100;
  },

  // Validate public key
  isValidPublicKey: (key: string): boolean => {
    try {
      new PublicKey(key);
      return true;
    } catch {
      return false;
    }
  },

  // Generate random seed for testing
  generateRandomSeed: (): number => {
    return Math.floor(Math.random() * 1000000);
  }
};

export default BondingCurve;
```