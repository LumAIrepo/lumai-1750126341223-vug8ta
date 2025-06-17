use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::errors::*;
use crate::events::*;

#[derive(Accounts)]
pub struct BuyTokens<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"token_launch", token_mint.key().as_ref()],
        bump = token_launch.bump,
        constraint = token_launch.is_active @ PumpCloneError::LaunchNotActive,
        constraint = !token_launch.migrated @ PumpCloneError::AlreadyMigrated
    )]
    pub token_launch: Account<'info, TokenLaunch>,
    
    #[account(
        mut,
        constraint = token_mint.key() == token_launch.token_mint @ PumpCloneError::InvalidTokenMint
    )]
    pub token_mint: Account<'info, token::Mint>,
    
    #[account(
        mut,
        seeds = [b"bonding_curve", token_mint.key().as_ref()],
        bump = bonding_curve.bump,
        constraint = bonding_curve.token_mint == token_mint.key() @ PumpCloneError::InvalidBondingCurve
    )]
    pub bonding_curve: Account<'info, BondingCurve>,
    
    #[account(
        mut,
        seeds = [b"curve_vault", token_mint.key().as_ref()],
        bump
    )]
    pub curve_vault: SystemAccount<'info>,
    
    #[account(
        mut,
        seeds = [b"token_vault", token_mint.key().as_ref()],
        bump
    )]
    pub token_vault: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = token_mint,
        associated_token::authority = buyer
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = fee_recipient.key() == token_launch.fee_recipient @ PumpCloneError::InvalidFeeRecipient
    )]
    pub fee_recipient: SystemAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> BuyTokens<'info> {
    pub fn buy_tokens(&mut self, sol_amount: u64, min_tokens_out: u64) -> Result<()> {
        require!(sol_amount > 0, PumpCloneError::InvalidAmount);
        require!(sol_amount >= 1_000_000, PumpCloneError::AmountTooSmall); // 0.001 SOL minimum
        require!(sol_amount <= 10_000_000_000, PumpCloneError::AmountTooLarge); // 10 SOL maximum per transaction
        
        let bonding_curve = &mut self.bonding_curve;
        let token_launch = &mut self.token_launch;
        
        // Calculate fee (1% of SOL amount)
        let fee_amount = sol_amount
            .checked_mul(100)
            .ok_or(PumpCloneError::MathOverflow)?
            .checked_div(10000)
            .ok_or(PumpCloneError::MathOverflow)?;
        
        let sol_after_fee = sol_amount
            .checked_sub(fee_amount)
            .ok_or(PumpCloneError::MathOverflow)?;
        
        // Calculate tokens to mint based on bonding curve
        let tokens_to_mint = self.calculate_tokens_out(sol_after_fee)?;
        
        require!(tokens_to_mint >= min_tokens_out, PumpCloneError::SlippageExceeded);
        require!(tokens_to_mint > 0, PumpCloneError::InvalidTokenAmount);
        
        // Check if purchase would exceed supply cap
        let new_total_supply = bonding_curve.current_supply
            .checked_add(tokens_to_mint)
            .ok_or(PumpCloneError::MathOverflow)?;
        
        require!(
            new_total_supply <= bonding_curve.max_supply,
            PumpCloneError::ExceedsMaxSupply
        );
        
        // Transfer SOL from buyer to curve vault
        let transfer_instruction = anchor_lang::system_program::Transfer {
            from: self.buyer.to_account_info(),
            to: self.curve_vault.to_account_info(),
        };
        
        anchor_lang::system_program::transfer(
            CpiContext::new(
                self.system_program.to_account_info(),
                transfer_instruction,
            ),
            sol_after_fee,
        )?;
        
        // Transfer fee to fee recipient
        if fee_amount > 0 {
            let fee_transfer_instruction = anchor_lang::system_program::Transfer {
                from: self.buyer.to_account_info(),
                to: self.fee_recipient.to_account_info(),
            };
            
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    self.system_program.to_account_info(),
                    fee_transfer_instruction,
                ),
                fee_amount,
            )?;
        }
        
        // Mint tokens to buyer
        let token_mint_key = self.token_mint.key();
        let seeds = &[
            b"token_launch",
            token_mint_key.as_ref(),
            &[token_launch.bump],
        ];
        let signer_seeds = &[&seeds[..]];
        
        let mint_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            token::MintTo {
                mint: self.token_mint.to_account_info(),
                to: self.buyer_token_account.to_account_info(),
                authority: token_launch.to_account_info(),
            },
            signer_seeds,
        );
        
        token::mint_to(mint_ctx, tokens_to_mint)?;
        
        // Update bonding curve state
        bonding_curve.current_supply = new_total_supply;
        bonding_curve.sol_reserves = bonding_curve.sol_reserves
            .checked_add(sol_after_fee)
            .ok_or(PumpCloneError::MathOverflow)?;
        bonding_curve.last_price = self.calculate_current_price()?;
        bonding_curve.total_transactions = bonding_curve.total_transactions
            .checked_add(1)
            .ok_or(PumpCloneError::MathOverflow)?;
        
        // Update token launch stats
        token_launch.total_raised = token_launch.total_raised
            .checked_add(sol_after_fee)
            .ok_or(PumpCloneError::MathOverflow)?;
        token_launch.holder_count = token_launch.holder_count
            .checked_add(1)
            .ok_or(PumpCloneError::MathOverflow)?;
        
        // Check if migration threshold is reached
        if bonding_curve.current_supply >= bonding_curve.migration_threshold {
            token_launch.ready_for_migration = true;
        }
        
        // Emit purchase event
        emit!(TokenPurchase {
            buyer: self.buyer.key(),
            token_mint: self.token_mint.key(),
            sol_amount,
            tokens_received: tokens_to_mint,
            price_per_token: bonding_curve.last_price,
            total_supply: bonding_curve.current_supply,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
    
    fn calculate_tokens_out(&self, sol_amount: u64) -> Result<u64> {
        let bonding_curve = &self.bonding_curve;
        
        // Linear bonding curve: price = base_price + (current_supply * slope)
        let current_price = bonding_curve.base_price
            .checked_add(
                bonding_curve.current_supply
                    .checked_mul(bonding_curve.slope)
                    .ok_or(PumpCloneError::MathOverflow)?
                    .checked_div(1_000_000_000) // Scale down slope
                    .ok_or(PumpCloneError::MathOverflow)?
            )
            .ok_or(PumpCloneError::MathOverflow)?;
        
        // For simplicity, use average price approximation
        // tokens = sol_amount / current_price
        let tokens_out = (sol_amount as u128)
            .checked_mul(1_000_000_000) // Scale up for precision
            .ok_or(PumpCloneError::MathOverflow)?
            .checked_div(current_price as u128)
            .ok_or(PumpCloneError::MathOverflow)?;
        
        require!(tokens_out <= u64::MAX as u128, PumpCloneError::MathOverflow);
        
        Ok(tokens_out as u64)
    }
    
    fn calculate_current_price(&self) -> Result<u64> {
        let bonding_curve = &self.bonding_curve;
        
        let price = bonding_curve.base_price
            .checked_add(
                bonding_curve.current_supply
                    .checked_mul(bonding_curve.slope)
                    .ok_or(PumpCloneError::MathOverflow)?
                    .checked_div(1_000_000_000)
                    .ok_or(PumpCloneError::MathOverflow)?
            )
            .ok_or(PumpCloneError::MathOverflow)?;
        
        Ok(price)
    }
}