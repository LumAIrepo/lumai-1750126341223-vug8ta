use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};
use anchor_spl::associated_token::AssociatedToken;
use crate::state::*;
use crate::errors::*;
use crate::constants::*;

#[derive(Accounts)]
pub struct MigrateLiquidity<'info> {
    #[account(
        mut,
        seeds = [BONDING_CURVE_SEED, token_mint.key().as_ref()],
        bump = bonding_curve.bump,
        constraint = bonding_curve.is_complete @ PumpError::CurveNotComplete,
        constraint = !bonding_curve.migrated @ PumpError::AlreadyMigrated,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(
        mut,
        constraint = token_mint.key() == bonding_curve.token_mint @ PumpError::InvalidTokenMint,
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [CURVE_TOKEN_ACCOUNT_SEED, bonding_curve.key().as_ref()],
        bump,
        constraint = curve_token_account.mint == token_mint.key() @ PumpError::InvalidTokenAccount,
        constraint = curve_token_account.owner == bonding_curve.key() @ PumpError::InvalidTokenAccount,
    )]
    pub curve_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [CURVE_SOL_VAULT_SEED, bonding_curve.key().as_ref()],
        bump,
    )]
    pub curve_sol_vault: SystemAccount<'info>,

    /// CHECK: Raydium AMM program ID
    #[account(
        constraint = raydium_amm_program.key() == RAYDIUM_AMM_PROGRAM_ID @ PumpError::InvalidProgram,
    )]
    pub raydium_amm_program: UncheckedAccount<'info>,

    /// CHECK: Raydium AMM authority
    #[account(mut)]
    pub amm_authority: UncheckedAccount<'info>,

    /// CHECK: Raydium AMM open orders
    #[account(mut)]
    pub amm_open_orders: UncheckedAccount<'info>,

    /// CHECK: Raydium AMM LP mint
    #[account(mut)]
    pub lp_mint: UncheckedAccount<'info>,

    /// CHECK: Raydium AMM coin vault
    #[account(mut)]
    pub coin_vault: UncheckedAccount<'info>,

    /// CHECK: Raydium AMM PC vault
    #[account(mut)]
    pub pc_vault: UncheckedAccount<'info>,

    /// CHECK: Raydium AMM withdraw queue
    #[account(mut)]
    pub withdraw_queue: UncheckedAccount<'info>,

    /// CHECK: Raydium AMM target orders
    #[account(mut)]
    pub amm_target_orders: UncheckedAccount<'info>,

    /// CHECK: Raydium AMM pool temp LP
    #[account(mut)]
    pub pool_temp_lp: UncheckedAccount<'info>,

    /// CHECK: Serum market
    #[account(mut)]
    pub serum_market: UncheckedAccount<'info>,

    /// CHECK: Serum program
    #[account(
        constraint = serum_program.key() == SERUM_PROGRAM_ID @ PumpError::InvalidProgram,
    )]
    pub serum_program: UncheckedAccount<'info>,

    /// CHECK: Serum coin vault signer
    pub serum_coin_vault_signer: UncheckedAccount<'info>,

    /// CHECK: Serum PC vault signer
    pub serum_pc_vault_signer: UncheckedAccount<'info>,

    /// CHECK: Serum vault signer
    pub serum_vault_signer: UncheckedAccount<'info>,

    /// CHECK: Serum asks
    #[account(mut)]
    pub serum_asks: UncheckedAccount<'info>,

    /// CHECK: Serum bids
    #[account(mut)]
    pub serum_bids: UncheckedAccount<'info>,

    /// CHECK: Serum event queue
    #[account(mut)]
    pub serum_event_queue: UncheckedAccount<'info>,

    /// CHECK: Serum coin vault
    #[account(mut)]
    pub serum_coin_vault: UncheckedAccount<'info>,

    /// CHECK: Serum PC vault
    #[account(mut)]
    pub serum_pc_vault: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = wsol_mint.key() == WSOL_MINT @ PumpError::InvalidMint,
    )]
    pub wsol_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = wsol_mint,
        associated_token::authority = bonding_curve,
    )]
    pub curve_wsol_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = token_mint,
        associated_token::authority = migration_authority,
    )]
    pub migration_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = wsol_mint,
        associated_token::authority = migration_authority,
    )]
    pub migration_wsol_account: Account<'info, TokenAccount>,

    /// CHECK: Migration authority for Raydium
    pub migration_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> MigrateLiquidity<'info> {
    pub fn transfer_tokens_to_migration(&self, amount: u64) -> Result<()> {
        let bonding_curve_key = self.bonding_curve.key();
        let seeds = &[
            BONDING_CURVE_SEED,
            self.token_mint.key().as_ref(),
            &[self.bonding_curve.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: self.curve_token_account.to_account_info(),
            to: self.migration_token_account.to_account_info(),
            authority: self.bonding_curve.to_account_info(),
        };

        let cpi_program = self.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        token::transfer(cpi_ctx, amount)
    }

    pub fn wrap_sol(&self, amount: u64) -> Result<()> {
        let bonding_curve_key = self.bonding_curve.key();
        
        // Transfer SOL from vault to curve's WSOL account
        let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
            &self.curve_sol_vault.key(),
            &self.curve_wsol_account.key(),
            amount,
        );

        let seeds = &[
            CURVE_SOL_VAULT_SEED,
            bonding_curve_key.as_ref(),
            &[self.bonding_curve.sol_vault_bump],
        ];
        let signer_seeds = &[&seeds[..]];

        anchor_lang::solana_program::program::invoke_signed(
            &transfer_instruction,
            &[
                self.curve_sol_vault.to_account_info(),
                self.curve_wsol_account.to_account_info(),
                self.system_program.to_account_info(),
            ],
            signer_seeds,
        )?;

        // Sync wrapped SOL account
        let sync_native_instruction = anchor_spl::token::spl_token::instruction::sync_native(
            &self.token_program.key(),
            &self.curve_wsol_account.key(),
        )?;

        anchor_lang::solana_program::program::invoke(
            &sync_native_instruction,
            &[
                self.curve_wsol_account.to_account_info(),
                self.token_program.to_account_info(),
            ],
        )?;

        Ok(())
    }

    pub fn transfer_wsol_to_migration(&self, amount: u64) -> Result<()> {
        let bonding_curve_key = self.bonding_curve.key();
        let seeds = &[
            BONDING_CURVE_SEED,
            self.token_mint.key().as_ref(),
            &[self.bonding_curve.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: self.curve_wsol_account.to_account_info(),
            to: self.migration_wsol_account.to_account_info(),
            authority: self.bonding_curve.to_account_info(),
        };

        let cpi_program = self.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        token::transfer(cpi_ctx, amount)
    }
}

pub fn handler(ctx: Context<MigrateLiquidity>) -> Result<()> {
    let bonding_curve = &mut ctx.accounts.bonding_curve;
    let clock = Clock::get()?;

    // Verify curve is complete and ready for migration
    require!(bonding_curve.is_complete, PumpError::CurveNotComplete);
    require!(!bonding_curve.migrated, PumpError::AlreadyMigrated);
    require!(
        bonding_curve.total_supply >= CURVE_COMPLETE_TOKEN_AMOUNT,
        PumpError::InsufficientTokensForMigration
    );

    // Calculate migration amounts
    let token_balance = ctx.accounts.curve_token_account.amount;
    let sol_balance = ctx.accounts.curve_sol_vault.lamports();

    require!(token_balance > 0, PumpError::InsufficientTokenBalance);
    require!(sol_balance > 0, PumpError::InsufficientSolBalance);

    // Reserve tokens for migration (20% of total supply)
    let migration_token_amount = bonding_curve.total_supply
        .checked_mul(MIGRATION_TOKEN_PERCENTAGE)
        .ok_or(PumpError::MathOverflow)?
        .checked_div(100)
        .ok_or(PumpError::MathOverflow)?;

    // Reserve SOL for migration (matching the bonding curve completion amount)
    let migration_sol_amount = CURVE_COMPLETE_SOL_AMOUNT;

    require!(
        token_balance >= migration_token_amount,
        PumpError::InsufficientTokensForMigration
    );
    require!(
        sol_balance >= migration_sol_amount,
        PumpError::InsufficientSolForMigration
    );

    // Transfer tokens to migration authority
    ctx.accounts.transfer_tokens_to_migration(migration_token_amount)?;

    // Wrap SOL and transfer to migration authority
    ctx.accounts.wrap_sol(migration_sol_amount)?;
    ctx.accounts.transfer_wsol_to_migration(migration_sol_amount)?;

    // Create Raydium AMM pool instruction data
    let initialize_instruction_data = raydium_amm::instruction::Initialize {
        nonce: 0,
        open_time: clock.unix_timestamp as u64,
        init_pc_amount: migration_sol_amount,
        init_coin_amount: migration_token_amount,
    };

    // Build accounts for Raydium AMM initialization
    let raydium_accounts = vec![
        AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
        AccountMeta::new_readonly(ctx.accounts.associated_token_program.key(), false),
        AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
        AccountMeta::new_readonly(ctx.accounts.rent.key(), false),
        AccountMeta::new(ctx.accounts.amm_authority.key(), false),
        AccountMeta::new(ctx.accounts.amm_open_orders.key(), false),
        AccountMeta::new(ctx.accounts.lp_mint.key(), false),
        AccountMeta::new_readonly(ctx.accounts.token_mint.key(), false),
        AccountMeta::new_readonly(ctx.accounts.wsol_mint.key(), false),
        AccountMeta::new(ctx.accounts.coin_vault.key(), false),
        AccountMeta::new(ctx.accounts.pc_vault.key(), false),
        AccountMeta::new(ctx.accounts.withdraw_queue.key(), false),
        AccountMeta::new(ctx.accounts.amm_target_orders.key(), false),
        AccountMeta::new(ctx.accounts.pool_temp_lp.key(), false),
        AccountMeta::new_readonly(ctx.accounts.serum_program.key(), false),
        AccountMeta::new_readonly(ctx.accounts.serum_market.key(), false),
        AccountMeta::new(ctx.accounts.migration_token_account.key(), true),
        AccountMeta::new(ctx.accounts.migration_wsol_account.key(), true),
        AccountMeta::new_readonly(ctx.accounts.migration_authority.key(), true),
    ];

    // Create Raydium AMM pool
    let initialize_instruction = anchor_lang::solana_program::instruction::Instruction {
        program_id: ctx.accounts.raydium_amm_program.key(),
        accounts: raydium_accounts,
        data: initialize_instruction_data.try_to_vec()?,
    };

    anchor_lang::solana_program::program::invoke(
        &initialize_instruction,
        &[
            ctx.accounts.raydium_amm_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.associated_token_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
            ctx.accounts.amm_authority.to_account_info(),
            ctx.accounts.amm_open_orders.to_account_info(),
            ctx.accounts.lp_mint.to_account_info(),
            ctx.accounts.token_mint.to_account_info(),
            ctx.accounts.wsol_mint.to_account_info(),
            ctx.accounts.coin_vault.to_account_info(),
            ctx.accounts.pc_vault.to_account_info(),
            ctx.accounts.withdraw_queue.to_account_info(),
            ctx.accounts.amm_target_orders.to_account_info(),
            ctx.accounts.pool_temp_lp.to_account_info(),
            ctx.accounts.serum_program.to_account_info(),
            ctx.accounts.serum_market.to_account_info(),
            ctx.accounts.migration_token_account.to_account_info(),
            ctx.accounts.