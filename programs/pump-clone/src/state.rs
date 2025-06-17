use anchor_lang::prelude::*;

#[account]
pub struct GlobalState {
    pub authority: Pubkey,
    pub fee_recipient: Pubkey,
    pub platform_fee_bps: u16,
    pub creator_fee_bps: u16,
    pub migration_threshold: u64,
    pub min_sol_threshold: u64,
    pub max_sol_threshold: u64,
    pub total_tokens_created: u64,
    pub total_volume: u64,
    pub is_paused: bool,
    pub bump: u8,
}

impl GlobalState {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        32 + // fee_recipient
        2 + // platform_fee_bps
        2 + // creator_fee_bps
        8 + // migration_threshold
        8 + // min_sol_threshold
        8 + // max_sol_threshold
        8 + // total_tokens_created
        8 + // total_volume
        1 + // is_paused
        1; // bump
}

#[account]
pub struct TokenLaunch {
    pub creator: Pubkey,
    pub mint: Pubkey,
    pub bonding_curve: Pubkey,
    pub metadata_uri: String,
    pub name: String,
    pub symbol: String,
    pub description: String,
    pub image_uri: String,
    pub website: String,
    pub twitter: String,
    pub telegram: String,
    pub discord: String,
    pub created_at: i64,
    pub is_migrated: bool,
    pub migration_timestamp: Option<i64>,
    pub raydium_pool: Option<Pubkey>,
    pub total_supply: u64,
    pub decimals: u8,
    pub bump: u8,
}

impl TokenLaunch {
    pub const LEN: usize = 8 + // discriminator
        32 + // creator
        32 + // mint
        32 + // bonding_curve
        4 + 200 + // metadata_uri (max 200 chars)
        4 + 32 + // name (max 32 chars)
        4 + 10 + // symbol (max 10 chars)
        4 + 500 + // description (max 500 chars)
        4 + 200 + // image_uri (max 200 chars)
        4 + 100 + // website (max 100 chars)
        4 + 50 + // twitter (max 50 chars)
        4 + 50 + // telegram (max 50 chars)
        4 + 50 + // discord (max 50 chars)
        8 + // created_at
        1 + // is_migrated
        1 + 8 + // migration_timestamp (Option<i64>)
        1 + 32 + // raydium_pool (Option<Pubkey>)
        8 + // total_supply
        1 + // decimals
        1; // bump
}

#[account]
pub struct BondingCurve {
    pub token_launch: Pubkey,
    pub mint: Pubkey,
    pub sol_reserves: u64,
    pub token_reserves: u64,
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub real_token_reserves: u64,
    pub complete: bool,
    pub total_supply: u64,
    pub initial_virtual_sol_reserves: u64,
    pub initial_virtual_token_reserves: u64,
    pub initial_real_token_reserves: u64,
    pub k_constant: u128,
    pub last_price: u64,
    pub volume_24h: u64,
    pub trades_24h: u32,
    pub holders_count: u32,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl BondingCurve {
    pub const LEN: usize = 8 + // discriminator
        32 + // token_launch
        32 + // mint
        8 + // sol_reserves
        8 + // token_reserves
        8 + // virtual_sol_reserves
        8 + // virtual_token_reserves
        8 + // real_sol_reserves
        8 + // real_token_reserves
        1 + // complete
        8 + // total_supply
        8 + // initial_virtual_sol_reserves
        8 + // initial_virtual_token_reserves
        8 + // initial_real_token_reserves
        16 + // k_constant
        8 + // last_price
        8 + // volume_24h
        4 + // trades_24h
        4 + // holders_count
        8 + // created_at
        8 + // updated_at
        1; // bump

    pub fn calculate_buy_price(&self, sol_amount: u64) -> Result<u64> {
        require!(!self.complete, crate::error::ErrorCode::BondingCurveComplete);
        require!(sol_amount > 0, crate::error::ErrorCode::InvalidAmount);

        let virtual_sol_reserves = self.virtual_sol_reserves
            .checked_add(self.real_sol_reserves)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;
        
        let virtual_token_reserves = self.virtual_token_reserves
            .checked_add(self.real_token_reserves)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        let new_sol_reserves = virtual_sol_reserves
            .checked_add(sol_amount)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        let k = (virtual_sol_reserves as u128)
            .checked_mul(virtual_token_reserves as u128)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        let new_token_reserves = k
            .checked_div(new_sol_reserves as u128)
            .ok_or(crate::error::ErrorCode::MathOverflow)? as u64;

        let tokens_out = virtual_token_reserves
            .checked_sub(new_token_reserves)
            .ok_or(crate::error::ErrorCode::InsufficientLiquidity)?;

        require!(tokens_out > 0, crate::error::ErrorCode::InsufficientLiquidity);
        Ok(tokens_out)
    }

    pub fn calculate_sell_price(&self, token_amount: u64) -> Result<u64> {
        require!(!self.complete, crate::error::ErrorCode::BondingCurveComplete);
        require!(token_amount > 0, crate::error::ErrorCode::InvalidAmount);

        let virtual_sol_reserves = self.virtual_sol_reserves
            .checked_add(self.real_sol_reserves)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;
        
        let virtual_token_reserves = self.virtual_token_reserves
            .checked_add(self.real_token_reserves)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        let new_token_reserves = virtual_token_reserves
            .checked_add(token_amount)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        let k = (virtual_sol_reserves as u128)
            .checked_mul(virtual_token_reserves as u128)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        let new_sol_reserves = k
            .checked_div(new_token_reserves as u128)
            .ok_or(crate::error::ErrorCode::MathOverflow)? as u64;

        let sol_out = virtual_sol_reserves
            .checked_sub(new_sol_reserves)
            .ok_or(crate::error::ErrorCode::InsufficientLiquidity)?;

        require!(sol_out > 0, crate::error::ErrorCode::InsufficientLiquidity);
        Ok(sol_out)
    }

    pub fn update_reserves_after_buy(&mut self, sol_amount: u64, token_amount: u64) -> Result<()> {
        self.real_sol_reserves = self.real_sol_reserves
            .checked_add(sol_amount)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        self.real_token_reserves = self.real_token_reserves
            .checked_sub(token_amount)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        self.sol_reserves = self.virtual_sol_reserves
            .checked_add(self.real_sol_reserves)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        self.token_reserves = self.virtual_token_reserves
            .checked_add(self.real_token_reserves)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        self.last_price = sol_amount
            .checked_mul(1_000_000_000)
            .and_then(|x| x.checked_div(token_amount))
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        self.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn update_reserves_after_sell(&mut self, sol_amount: u64, token_amount: u64) -> Result<()> {
        self.real_sol_reserves = self.real_sol_reserves
            .checked_sub(sol_amount)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        self.real_token_reserves = self.real_token_reserves
            .checked_add(token_amount)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        self.sol_reserves = self.virtual_sol_reserves
            .checked_add(self.real_sol_reserves)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        self.token_reserves = self.virtual_token_reserves
            .checked_add(self.real_token_reserves)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        self.last_price = sol_amount
            .checked_mul(1_000_000_000)
            .and_then(|x| x.checked_div(token_amount))
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        self.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }
}

#[account]
pub struct UserPosition {
    pub user: Pubkey,
    pub token_launch: Pubkey,
    pub mint: Pubkey,
    pub token_balance: u64,
    pub sol_invested: u64,
    pub tokens_bought: u64,
    pub tokens_sold: u64,
    pub realized_profit: i64,
    pub unrealized_profit: i64,
    pub average_buy_price: u64,
    pub first_buy_timestamp: i64,
    pub last_trade_timestamp: i64,
    pub trade_count: u32,
    pub is_creator: bool,
    pub bump: u8,
}

impl UserPosition {
    pub const LEN: usize = 8 + // discriminator
        32 + // user
        32 + // token_launch
        32 + // mint
        8 + // token_balance
        8 + // sol_invested
        8 + // tokens_bought
        8 + // tokens_sold
        8 + // realized_profit
        8 + // unrealized_profit
        8 + // average_buy_price
        8 + // first_buy_timestamp
        8 + // last_trade_timestamp
        4 + // trade_count
        1 + // is_creator
        1; // bump

    pub fn update_after_buy(&mut self, sol_amount: u64, token_amount: u64, price: u64) -> Result<()> {
        let current_timestamp = Clock::get()?.unix_timestamp;
        
        if self.first_buy_timestamp == 0 {
            self.first_buy_timestamp = current_timestamp;
        }

        let total_sol_invested = self.sol_invested
            .checked_add(sol_amount)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        let total_tokens_bought = self.tokens_bought
            .checked_add(token_amount)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        self.average_buy_price = total_sol_invested
            .checked_mul(1_000_000_000)
            .and_then(|x| x.checked_div(total_tokens_bought))
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        self.sol_invested = total_sol_invested;
        self.tokens_bought = total_tokens_bought;
        self.token_balance = self.token_balance
            .checked_add(token_amount)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        self.last_trade_timestamp = current_timestamp;
        self.trade_count = self.trade_count
            .checked_add(1)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        Ok(())
    }

    pub fn update_after_sell(&mut self, sol_amount: u64, token_amount: u64, price: u64) -> Result<()> {
        let current_timestamp = Clock::get()?.unix_timestamp;

        self.tokens_sold = self.tokens_sold
            .checked_add(token_amount)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        self.token_balance = self.token_balance
            .checked_sub(token_amount)
            .ok_or(crate::error::ErrorCode::InsufficientBalance)?;

        let cost_basis = self.average_buy_price
            .checked_mul(token_amount)
            .and_then(|x| x.checked_div(1_000_000_000))
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        let profit = (sol_amount as i64)
            .checked_sub(cost_basis as i64)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        self.realized_profit = self.realized_profit
            .checked_add(profit)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        self.last_trade_timestamp = current_timestamp;
        self.trade_count = self.trade_count
            .checked_add(1)
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        Ok(())
    }

    pub fn calculate_unrealized_profit(&mut self, current_price: u64) -> Result<()> {
        if self.token_balance == 0 {
            self.unrealized_profit = 0;
            return Ok(());
        }

        let current_value = current_price
            .checked_mul(self.token_balance)
            .and_then(|x| x.checked_div(1_000_000_000))
            .ok_or(crate::error::ErrorCode::MathOverflow)?;

        let cost_basis = self.average_buy_price
            .checked_mul(self.token_balance)
            .and_then(|x| x.checked_div(1_000_000_000))
            .ok_or(crate::error::ErrorCode