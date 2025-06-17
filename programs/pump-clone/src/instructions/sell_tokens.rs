use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::*;
use crate::events::*;

#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"token_launch", token_launch.mint.as_ref()],
        bump = token_launch.bump,
        constraint = token_launch.is_active @ PumpCloneError::LaunchNotActive,
        constraint = !token_launch.migrated @ PumpCloneError::AlreadyMigrated
    )]
    pub token_launch: Account<'info, TokenLaunch>,
    
    #[account(
        mut,
        associated_token::mint = token_launch.mint,
        associated_token::authority = seller
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"bonding_curve", token_launch.mint.as_ref()],
        bump = bonding_curve.bump
    )]
    pub bonding_curve: Account<'info, BondingCurve>,
    
    #[account(
        mut,
        associated_token::mint = token_launch.mint,
        associated_token::authority = bonding_curve
    )]
    pub bonding_curve_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = sol_vault.key() == bonding_curve.sol_vault @ PumpCloneError::InvalidSolVault
    )]
    pub sol_vault: SystemAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn sell_tokens(ctx: Context<SellTokens>, token_amount: u64) -> Result<()> {
    require!(token_amount > 0, PumpCloneError::InvalidAmount);
    
    let bonding_curve = &mut ctx.accounts.bonding_curve;
    let token_launch = &mut ctx.accounts.token_launch;
    
    // Check if seller has enough tokens
    require!(
        ctx.accounts.seller_token_account.amount >= token_amount,
        PumpCloneError::InsufficientTokenBalance
    );
    
    // Calculate SOL amount to receive based on bonding curve
    let sol_amount = calculate_sell_price(
        bonding_curve.virtual_token_reserves,
        bonding_curve.virtual_sol_reserves,
        token_amount,
        bonding_curve.k_constant
    )?;
    
    require!(sol_amount > 0, PumpCloneError::InvalidSellAmount);
    
    // Check if bonding curve has enough SOL
    require!(
        bonding_curve.real_sol_reserves >= sol_amount,
        PumpCloneError::InsufficientSolReserves
    );
    
    // Update bonding curve reserves
    bonding_curve.virtual_token_reserves = bonding_curve
        .virtual_token_reserves
        .checked_add(token_amount)
        .ok_or(PumpCloneError::MathOverflow)?;
    
    bonding_curve.virtual_sol_reserves = bonding_curve
        .virtual_sol_reserves
        .checked_sub(sol_amount)
        .ok_or(PumpCloneError::MathOverflow)?;
    
    bonding_curve.real_token_reserves = bonding_curve
        .real_token_reserves
        .checked_add(token_amount)
        .ok_or(PumpCloneError::MathOverflow)?;
    
    bonding_curve.real_sol_reserves = bonding_curve
        .real_sol_reserves
        .checked_sub(sol_amount)
        .ok_or(PumpCloneError::MathOverflow)?;
    
    // Update token launch stats
    token_launch.total_supply_sold = token_launch
        .total_supply_sold
        .checked_sub(token_amount)
        .ok_or(PumpCloneError::MathOverflow)?;
    
    token_launch.sol_raised = token_launch
        .sol_raised
        .checked_sub(sol_amount)
        .ok_or(PumpCloneError::MathOverflow)?;
    
    // Transfer tokens from seller to bonding curve
    let transfer_tokens_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.seller_token_account.to_account_info(),
            to: ctx.accounts.bonding_curve_token_account.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
        },
    );
    
    token::transfer(transfer_tokens_ctx, token_amount)?;
    
    // Transfer SOL from vault to seller
    let sol_vault_info = ctx.accounts.sol_vault.to_account_info();
    let seller_info = ctx.accounts.seller.to_account_info();
    
    **sol_vault_info.try_borrow_mut_lamports()? = sol_vault_info
        .lamports()
        .checked_sub(sol_amount)
        .ok_or(PumpCloneError::MathOverflow)?;
    
    **seller_info.try_borrow_mut_lamports()? = seller_info
        .lamports()
        .checked_add(sol_amount)
        .ok_or(PumpCloneError::MathOverflow)?;
    
    // Update last trade timestamp
    bonding_curve.last_trade_timestamp = Clock::get()?.unix_timestamp;
    
    // Emit sell event
    emit!(TokenSold {
        mint: token_launch.mint,
        seller: ctx.accounts.seller.key(),
        token_amount,
        sol_amount,
        virtual_token_reserves: bonding_curve.virtual_token_reserves,
        virtual_sol_reserves: bonding_curve.virtual_sol_reserves,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}

fn calculate_sell_price(
    virtual_token_reserves: u64,
    virtual_sol_reserves: u64,
    token_amount: u64,
    k_constant: u128,
) -> Result<u64> {
    // Using constant product formula: x * y = k
    // When selling tokens: new_token_reserves = virtual_token_reserves + token_amount
    // new_sol_reserves = k / new_token_reserves
    // sol_amount = virtual_sol_reserves - new_sol_reserves
    
    let new_token_reserves = virtual_token_reserves
        .checked_add(token_amount)
        .ok_or(PumpCloneError::MathOverflow)?;
    
    let new_sol_reserves = (k_constant as u64)
        .checked_div(new_token_reserves)
        .ok_or(PumpCloneError::MathOverflow)?;
    
    let sol_amount = virtual_sol_reserves
        .checked_sub(new_sol_reserves)
        .ok_or(PumpCloneError::MathOverflow)?;
    
    // Apply 1% fee
    let fee = sol_amount
        .checked_mul(100)
        .ok_or(PumpCloneError::MathOverflow)?
        .checked_div(10000)
        .ok_or(PumpCloneError::MathOverflow)?;
    
    sol_amount
        .checked_sub(fee)
        .ok_or(PumpCloneError::MathOverflow)
}