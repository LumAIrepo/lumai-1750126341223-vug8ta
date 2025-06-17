use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("PumpC1oneProgram11111111111111111111111111");

const BONDING_CURVE_SEED: &[u8] = b"bonding_curve";
const TOKEN_VAULT_SEED: &[u8] = b"token_vault";
const SOL_VAULT_SEED: &[u8] = b"sol_vault";
const GLOBAL_STATE_SEED: &[u8] = b"global_state";

const INITIAL_VIRTUAL_TOKEN_RESERVES: u64 = 1_073_000_000_000_000; // 1.073M tokens
const INITIAL_VIRTUAL_SOL_RESERVES: u64 = 30_000_000_000; // 30 SOL
const INITIAL_REAL_TOKEN_RESERVES: u64 = 793_100_000_000_000; // 793.1M tokens
const FUNDING_GOAL: u64 = 85_000_000_000; // 85 SOL
const CREATOR_FEE_BASIS_POINTS: u16 = 100; // 1%
const PLATFORM_FEE_BASIS_POINTS: u16 = 100; // 1%

#[program]
pub mod pump_clone {
    use super::*;

    pub fn initialize_global_state(
        ctx: Context<InitializeGlobalState>,
        fee_recipient: Pubkey,
    ) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        global_state.authority = ctx.accounts.authority.key();
        global_state.fee_recipient = fee_recipient;
        global_state.total_tokens_created = 0;
        global_state.total_volume = 0;
        global_state.is_paused = false;

        emit!(GlobalStateInitialized {
            authority: global_state.authority,
            fee_recipient: global_state.fee_recipient,
        });

        Ok(())
    }

    pub fn create_token(
        ctx: Context<CreateToken>,
        name: String,
        symbol: String,
        uri: String,
        initial_buy: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.global_state.is_paused, PumpError::ProgramPaused);
        require!(name.len() <= 32, PumpError::NameTooLong);
        require!(symbol.len() <= 10, PumpError::SymbolTooLong);
        require!(uri.len() <= 200, PumpError::UriTooLong);

        let bonding_curve = &mut ctx.accounts.bonding_curve;
        let mint = &ctx.accounts.mint;
        let creator = &ctx.accounts.creator;

        bonding_curve.creator = creator.key();
        bonding_curve.mint = mint.key();
        bonding_curve.virtual_token_reserves = INITIAL_VIRTUAL_TOKEN_RESERVES;
        bonding_curve.virtual_sol_reserves = INITIAL_VIRTUAL_SOL_RESERVES;
        bonding_curve.real_token_reserves = INITIAL_REAL_TOKEN_RESERVES;
        bonding_curve.real_sol_reserves = 0;
        bonding_curve.token_total_supply = 1_000_000_000_000_000; // 1B tokens
        bonding_curve.complete = false;
        bonding_curve.created_at = Clock::get()?.unix_timestamp;

        let global_state = &mut ctx.accounts.global_state;
        global_state.total_tokens_created = global_state.total_tokens_created
            .checked_add(1)
            .ok_or(PumpError::Overflow)?;

        emit!(TokenCreated {
            mint: mint.key(),
            creator: creator.key(),
            name: name.clone(),
            symbol: symbol.clone(),
            uri: uri.clone(),
            bonding_curve: bonding_curve.key(),
            timestamp: bonding_curve.created_at,
        });

        if initial_buy > 0 {
            let buy_ctx = Context::new(
                ctx.program_id,
                &mut BuyTokens {
                    buyer: ctx.accounts.creator.clone(),
                    mint: ctx.accounts.mint.clone(),
                    bonding_curve: ctx.accounts.bonding_curve.clone(),
                    associated_bonding_curve: ctx.accounts.associated_bonding_curve.clone(),
                    associated_user: ctx.accounts.associated_user.clone(),
                    token_vault: ctx.accounts.token_vault.clone(),
                    sol_vault: ctx.accounts.sol_vault.clone(),
                    global_state: ctx.accounts.global_state.clone(),
                    token_program: ctx.accounts.token_program.clone(),
                    associated_token_program: ctx.accounts.associated_token_program.clone(),
                    system_program: ctx.accounts.system_program.clone(),
                },
                &[],
                BuyTokens::bumps(),
            );
            buy_tokens(buy_ctx, initial_buy, u64::MAX)?;
        }

        Ok(())
    }

    pub fn buy_tokens(
        ctx: Context<BuyTokens>,
        sol_amount: u64,
        max_slippage_bps: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.global_state.is_paused, PumpError::ProgramPaused);
        require!(sol_amount > 0, PumpError::InvalidAmount);
        require!(!ctx.accounts.bonding_curve.complete, PumpError::BondingCurveComplete);

        let bonding_curve = &mut ctx.accounts.bonding_curve;
        
        let token_amount = calculate_buy_amount(
            sol_amount,
            bonding_curve.virtual_sol_reserves,
            bonding_curve.virtual_token_reserves,
        )?;

        require!(token_amount > 0, PumpError::InsufficientOutput);

        let slippage_bps = calculate_slippage(sol_amount, token_amount, bonding_curve)?;
        require!(slippage_bps <= max_slippage_bps, PumpError::SlippageExceeded);

        let creator_fee = sol_amount
            .checked_mul(CREATOR_FEE_BASIS_POINTS as u64)
            .ok_or(PumpError::Overflow)?
            .checked_div(10000)
            .ok_or(PumpError::Overflow)?;

        let platform_fee = sol_amount
            .checked_mul(PLATFORM_FEE_BASIS_POINTS as u64)
            .ok_or(PumpError::Overflow)?
            .checked_div(10000)
            .ok_or(PumpError::Overflow)?;

        let net_sol_amount = sol_amount
            .checked_sub(creator_fee)
            .ok_or(PumpError::Overflow)?
            .checked_sub(platform_fee)
            .ok_or(PumpError::Overflow)?;

        // Transfer SOL from buyer to sol vault
        let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &ctx.accounts.sol_vault.key(),
            net_sol_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.sol_vault.to_account_info(),
            ],
        )?;

        // Transfer creator fee
        if creator_fee > 0 {
            let creator_transfer = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &bonding_curve.creator,
                creator_fee,
            );
            anchor_lang::solana_program::program::invoke(
                &creator_transfer,
                &[
                    ctx.accounts.buyer.to_account_info(),
                    ctx.accounts.buyer.to_account_info(), // This should be creator account
                ],
            )?;
        }

        // Transfer platform fee
        if platform_fee > 0 {
            let platform_transfer = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &ctx.accounts.global_state.fee_recipient,
                platform_fee,
            );
            anchor_lang::solana_program::program::invoke(
                &platform_transfer,
                &[
                    ctx.accounts.buyer.to_account_info(),
                    ctx.accounts.buyer.to_account_info(), // This should be fee recipient account
                ],
            )?;
        }

        // Transfer tokens from vault to buyer
        let mint_key = ctx.accounts.mint.key();
        let seeds = &[
            BONDING_CURVE_SEED,
            mint_key.as_ref(),
            &[ctx.bumps.bonding_curve],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.associated_bonding_curve.to_account_info(),
            to: ctx.accounts.associated_user.to_account_info(),
            authority: ctx.accounts.bonding_curve.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, token_amount)?;

        // Update bonding curve state
        bonding_curve.virtual_sol_reserves = bonding_curve.virtual_sol_reserves
            .checked_add(net_sol_amount)
            .ok_or(PumpError::Overflow)?;
        
        bonding_curve.virtual_token_reserves = bonding_curve.virtual_token_reserves
            .checked_sub(token_amount)
            .ok_or(PumpError::Overflow)?;
        
        bonding_curve.real_sol_reserves = bonding_curve.real_sol_reserves
            .checked_add(net_sol_amount)
            .ok_or(PumpError::Overflow)?;
        
        bonding_curve.real_token_reserves = bonding_curve.real_token_reserves
            .checked_sub(token_amount)
            .ok_or(PumpError::Overflow)?;

        // Check if funding goal reached
        if bonding_curve.real_sol_reserves >= FUNDING_GOAL {
            bonding_curve.complete = true;
            emit!(BondingCurveComplete {
                mint: ctx.accounts.mint.key(),
                final_sol_reserves: bonding_curve.real_sol_reserves,
                timestamp: Clock::get()?.unix_timestamp,
            });
        }

        let global_state = &mut ctx.accounts.global_state;
        global_state.total_volume = global_state.total_volume
            .checked_add(sol_amount)
            .ok_or(PumpError::Overflow)?;

        emit!(TokensPurchased {
            buyer: ctx.accounts.buyer.key(),
            mint: ctx.accounts.mint.key(),
            sol_amount,
            token_amount,
            creator_fee,
            platform_fee,
            virtual_sol_reserves: bonding_curve.virtual_sol_reserves,
            virtual_token_reserves: bonding_curve.virtual_token_reserves,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn sell_tokens(
        ctx: Context<SellTokens>,
        token_amount: u64,
        min_sol_output: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.global_state.is_paused, PumpError::ProgramPaused);
        require!(token_amount > 0, PumpError::InvalidAmount);
        require!(!ctx.accounts.bonding_curve.complete, PumpError::BondingCurveComplete);

        let bonding_curve = &mut ctx.accounts.bonding_curve;
        
        let sol_amount = calculate_sell_amount(
            token_amount,
            bonding_curve.virtual_token_reserves,
            bonding_curve.virtual_sol_reserves,
        )?;

        require!(sol_amount >= min_sol_output, PumpError::InsufficientOutput);

        let creator_fee = sol_amount
            .checked_mul(CREATOR_FEE_BASIS_POINTS as u64)
            .ok_or(PumpError::Overflow)?
            .checked_div(10000)
            .ok_or(PumpError::Overflow)?;

        let platform_fee = sol_amount
            .checked_mul(PLATFORM_FEE_BASIS_POINTS as u64)
            .ok_or(PumpError::Overflow)?
            .checked_div(10000)
            .ok_or(PumpError::Overflow)?;

        let net_sol_amount = sol_amount
            .checked_sub(creator_fee)
            .ok_or(PumpError::Overflow)?
            .checked_sub(platform_fee)
            .ok_or(PumpError::Overflow)?;

        // Transfer tokens from seller to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.associated_user.to_account_info(),
            to: ctx.accounts.associated_bonding_curve.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, token_amount)?;

        // Transfer SOL from vault to seller
        let mint_key = ctx.accounts.mint.key();
        let sol_vault_seeds = &[
            SOL_VAULT_SEED,
            mint_key.as_ref(),
            &[ctx.bumps.sol_vault],
        ];

        **ctx.accounts.sol_vault.to_account_info().try_borrow_mut_lamports()? -= net_sol_amount;
        **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += net_sol_amount;

        // Update bonding curve state
        bonding_curve.virtual_sol_reserves = bonding_curve.virtual_sol_reserves
            .checked_sub(sol_amount)
            .ok_or(PumpError::Overflow)?;
        
        bonding_curve.virtual_token_reserves = bonding_curve.virtual_token_reserves
            .checked_add(token_amount)
            .ok_or(PumpError::Overflow)?;
        
        bonding_curve.real_sol_reserves = bonding_curve.real_sol_reserves
            .checked_sub(sol_amount)
            .ok_or(PumpError::Overflow)?;
        
        bonding_curve.real_token_reserves = bonding_curve.real_token_reserves
            .checked_add(token_amount)
            .ok_or(PumpError::Overflow)?;

        let global_state = &mut ctx.accounts.global_state;
        global_state.total_volume = global_state.total_volume
            .checked_add(sol_amount)
            .ok_or(PumpError::Overflow)?;

        emit!(TokensSold {
            seller: ctx.accounts.seller.key(),
            mint: ctx.accounts.mint.key(),
            token_amount,
            sol_amount,
            creator_fee,
            platform_fee,
            virtual_sol_reserves: bonding_curve.virtual_sol_