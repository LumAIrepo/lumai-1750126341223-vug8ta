use anchor_lang::prelude::*;
use anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL;

#[error_code]
pub enum UtilsError {
    #[msg("Mathematical overflow occurred")]
    MathOverflow,
    #[msg("Division by zero")]
    DivisionByZero,
    #[msg("Invalid bonding curve parameters")]
    InvalidBondingCurveParams,
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
    #[msg("Price calculation failed")]
    PriceCalculationFailed,
    #[msg("Token supply exceeded maximum")]
    TokenSupplyExceeded,
    #[msg("Invalid token amount")]
    InvalidTokenAmount,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
}

pub const BONDING_CURVE_SEED: &[u8] = b"bonding_curve";
pub const TOKEN_VAULT_SEED: &[u8] = b"token_vault";
pub const SOL_VAULT_SEED: &[u8] = b"sol_vault";
pub const METADATA_SEED: &[u8] = b"metadata";

// Bonding curve constants
pub const VIRTUAL_SOL_RESERVES: u64 = 30 * LAMPORTS_PER_SOL; // 30 SOL virtual reserves
pub const VIRTUAL_TOKEN_RESERVES: u64 = 1_073_000_000 * 1_000_000; // 1.073B tokens with 6 decimals
pub const REAL_SOL_RESERVES: u64 = 85 * LAMPORTS_PER_SOL; // 85 SOL for migration
pub const REAL_TOKEN_RESERVES: u64 = 793_100_000 * 1_000_000; // 793.1M tokens for migration
pub const MAX_TOKEN_SUPPLY: u64 = 1_000_000_000 * 1_000_000; // 1B tokens with 6 decimals
pub const CREATOR_FEE_BASIS_POINTS: u16 = 100; // 1%
pub const PLATFORM_FEE_BASIS_POINTS: u16 = 100; // 1%
pub const BASIS_POINTS_DENOMINATOR: u16 = 10_000;

#[derive(Clone, Copy, Debug)]
pub struct BondingCurveState {
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub real_token_reserves: u64,
}

impl Default for BondingCurveState {
    fn default() -> Self {
        Self {
            virtual_sol_reserves: VIRTUAL_SOL_RESERVES,
            virtual_token_reserves: VIRTUAL_TOKEN_RESERVES,
            real_sol_reserves: 0,
            real_token_reserves: REAL_TOKEN_RESERVES,
        }
    }
}

impl BondingCurveState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn calculate_buy_price(&self, token_amount: u64) -> Result<u64> {
        if token_amount == 0 {
            return Err(UtilsError::InvalidTokenAmount.into());
        }

        if token_amount > self.virtual_token_reserves {
            return Err(UtilsError::InsufficientLiquidity.into());
        }

        // Using constant product formula: x * y = k
        // Where x = SOL reserves, y = token reserves
        let k = self.virtual_sol_reserves
            .checked_mul(self.virtual_token_reserves)
            .ok_or(UtilsError::MathOverflow)?;

        let new_token_reserves = self.virtual_token_reserves
            .checked_sub(token_amount)
            .ok_or(UtilsError::MathOverflow)?;

        if new_token_reserves == 0 {
            return Err(UtilsError::DivisionByZero.into());
        }

        let new_sol_reserves = k
            .checked_div(new_token_reserves)
            .ok_or(UtilsError::DivisionByZero)?;

        let sol_amount = new_sol_reserves
            .checked_sub(self.virtual_sol_reserves)
            .ok_or(UtilsError::MathOverflow)?;

        Ok(sol_amount)
    }

    pub fn calculate_sell_price(&self, token_amount: u64) -> Result<u64> {
        if token_amount == 0 {
            return Err(UtilsError::InvalidTokenAmount.into());
        }

        // Using constant product formula: x * y = k
        let k = self.virtual_sol_reserves
            .checked_mul(self.virtual_token_reserves)
            .ok_or(UtilsError::MathOverflow)?;

        let new_token_reserves = self.virtual_token_reserves
            .checked_add(token_amount)
            .ok_or(UtilsError::MathOverflow)?;

        let new_sol_reserves = k
            .checked_div(new_token_reserves)
            .ok_or(UtilsError::DivisionByZero)?;

        let sol_amount = self.virtual_sol_reserves
            .checked_sub(new_sol_reserves)
            .ok_or(UtilsError::MathOverflow)?;

        Ok(sol_amount)
    }

    pub fn calculate_tokens_for_sol(&self, sol_amount: u64) -> Result<u64> {
        if sol_amount == 0 {
            return Err(UtilsError::InvalidTokenAmount.into());
        }

        // Using constant product formula: x * y = k
        let k = self.virtual_sol_reserves
            .checked_mul(self.virtual_token_reserves)
            .ok_or(UtilsError::MathOverflow)?;

        let new_sol_reserves = self.virtual_sol_reserves
            .checked_add(sol_amount)
            .ok_or(UtilsError::MathOverflow)?;

        let new_token_reserves = k
            .checked_div(new_sol_reserves)
            .ok_or(UtilsError::DivisionByZero)?;

        let token_amount = self.virtual_token_reserves
            .checked_sub(new_token_reserves)
            .ok_or(UtilsError::MathOverflow)?;

        Ok(token_amount)
    }

    pub fn update_after_buy(&mut self, sol_amount: u64, token_amount: u64) -> Result<()> {
        self.virtual_sol_reserves = self.virtual_sol_reserves
            .checked_add(sol_amount)
            .ok_or(UtilsError::MathOverflow)?;

        self.virtual_token_reserves = self.virtual_token_reserves
            .checked_sub(token_amount)
            .ok_or(UtilsError::MathOverflow)?;

        self.real_sol_reserves = self.real_sol_reserves
            .checked_add(sol_amount)
            .ok_or(UtilsError::MathOverflow)?;

        Ok(())
    }

    pub fn update_after_sell(&mut self, sol_amount: u64, token_amount: u64) -> Result<()> {
        self.virtual_sol_reserves = self.virtual_sol_reserves
            .checked_sub(sol_amount)
            .ok_or(UtilsError::MathOverflow)?;

        self.virtual_token_reserves = self.virtual_token_reserves
            .checked_add(token_amount)
            .ok_or(UtilsError::MathOverflow)?;

        self.real_sol_reserves = self.real_sol_reserves
            .checked_sub(sol_amount)
            .ok_or(UtilsError::MathOverflow)?;

        Ok(())
    }

    pub fn is_migration_ready(&self) -> bool {
        self.real_sol_reserves >= REAL_SOL_RESERVES
    }

    pub fn get_current_price(&self) -> Result<u64> {
        if self.virtual_token_reserves == 0 {
            return Err(UtilsError::DivisionByZero.into());
        }

        // Price = SOL reserves / Token reserves
        let price = self.virtual_sol_reserves
            .checked_mul(1_000_000) // Scale for precision
            .ok_or(UtilsError::MathOverflow)?
            .checked_div(self.virtual_token_reserves)
            .ok_or(UtilsError::DivisionByZero)?;

        Ok(price)
    }

    pub fn get_market_cap(&self) -> Result<u64> {
        let price = self.get_current_price()?;
        let circulating_supply = REAL_TOKEN_RESERVES
            .checked_sub(self.virtual_token_reserves)
            .ok_or(UtilsError::MathOverflow)?;

        let market_cap = price
            .checked_mul(circulating_supply)
            .ok_or(UtilsError::MathOverflow)?
            .checked_div(1_000_000) // Remove price scaling
            .ok_or(UtilsError::DivisionByZero)?;

        Ok(market_cap)
    }
}

pub fn calculate_fee(amount: u64, fee_basis_points: u16) -> Result<u64> {
    let fee = (amount as u128)
        .checked_mul(fee_basis_points as u128)
        .ok_or(UtilsError::MathOverflow)?
        .checked_div(BASIS_POINTS_DENOMINATOR as u128)
        .ok_or(UtilsError::DivisionByZero)?;

    Ok(fee as u64)
}

pub fn calculate_amount_after_fee(amount: u64, fee_basis_points: u16) -> Result<u64> {
    let fee = calculate_fee(amount, fee_basis_points)?;
    amount.checked_sub(fee).ok_or(UtilsError::MathOverflow.into())
}

pub fn validate_slippage(expected_amount: u64, actual_amount: u64, slippage_bps: u16) -> Result<()> {
    let min_amount = calculate_amount_after_fee(expected_amount, slippage_bps)?;
    
    if actual_amount < min_amount {
        return Err(UtilsError::SlippageExceeded.into());
    }
    
    Ok(())
}

pub fn calculate_sqrt(value: u64) -> u64 {
    if value == 0 {
        return 0;
    }

    let mut x = value;
    let mut y = (value + 1) / 2;

    while y < x {
        x = y;
        y = (x + value / x) / 2;
    }

    x
}

pub fn safe_mul_div(a: u64, b: u64, c: u64) -> Result<u64> {
    if c == 0 {
        return Err(UtilsError::DivisionByZero.into());
    }

    let result = (a as u128)
        .checked_mul(b as u128)
        .ok_or(UtilsError::MathOverflow)?
        .checked_div(c as u128)
        .ok_or(UtilsError::DivisionByZero)?;

    if result > u64::MAX as u128 {
        return Err(UtilsError::MathOverflow.into());
    }

    Ok(result as u64)
}

pub fn calculate_liquidity_tokens(sol_amount: u64, token_amount: u64) -> Result<u64> {
    let sqrt_product = calculate_sqrt(
        sol_amount
            .checked_mul(token_amount)
            .ok_or(UtilsError::MathOverflow)?
    );
    
    Ok(sqrt_product)
}

pub fn validate_token_amount(amount: u64) -> Result<()> {
    if amount == 0 {
        return Err(UtilsError::InvalidTokenAmount.into());
    }
    
    if amount > MAX_TOKEN_SUPPLY {
        return Err(UtilsError::TokenSupplyExceeded.into());
    }
    
    Ok(())
}

pub fn validate_sol_amount(amount: u64) -> Result<()> {
    if amount == 0 {
        return Err(UtilsError::InvalidTokenAmount.into());
    }
    
    // Minimum 0.001 SOL
    if amount < 1_000_000 {
        return Err(UtilsError::InvalidTokenAmount.into());
    }
    
    Ok(())
}

pub fn get_timestamp() -> i64 {
    Clock::get().unwrap().unix_timestamp
}

pub fn calculate_progress_percentage(current_sol: u64, target_sol: u64) -> u16 {
    if target_sol == 0 {
        return 0;
    }
    
    let percentage = (current_sol as u128)
        .checked_mul(10000)
        .unwrap_or(0)
        .checked_div(target_sol as u128)
        .unwrap_or(0);
    
    std::cmp::min(percentage as u16, 10000)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bonding_curve_buy_calculation() {
        let curve = BondingCurveState::new();
        let token_amount = 1_000_000; // 1 token
        let sol_cost = curve.calculate_buy_price(token_amount).unwrap();
        assert!(sol_cost > 0);
    }

    #[test]
    fn test_bonding_curve_sell_calculation() {
        let curve = BondingCurveState::new();
        let token_amount = 1_000_000; // 1 token
        let sol_received = curve.calculate_sell_price(token_amount).unwrap();
        assert!(sol_received > 0);
    }

    #[test]
    fn test_fee_calculation() {
        let amount = 1_000_000;
        let fee = calculate_fee(amount, 100).unwrap(); // 1%
        assert_eq!(fee, 10_000);
    }

    #[test]
    fn test_slippage_validation() {
        let expected = 1_000_000;
        let actual = 990_000;
        let slippage = 200; // 2%
        
        assert!(validate_slippage(expected, actual, slippage).is_ok());
        
        let actual_too_low = 970_000;
        assert!(validate_slippage(expected, actual_too_low, slippage).is_err());
    }

    #[test]
    fn test_sqrt_calculation() {
        assert_eq!(calculate_sqrt(0), 0);
        assert_eq!(calculate_sqrt(1), 1);
        assert_eq!(calculate_sqrt(4), 2);
        assert_eq!(calculate_sqrt(9), 3);
        assert_eq!(calculate_sqrt(16), 4);
    }

    #[test]
    fn test_progress_percentage() {
        assert_eq!(calculate_progress_percentage(0, 100), 0);
        assert_eq!(calculate_progress_percentage(50, 100), 5000);
        assert_eq!(calculate_progress_percentage(100, 100), 10000);