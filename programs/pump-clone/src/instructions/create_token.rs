use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
        Metadata,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

use crate::{
    constants::*,
    errors::PumpError,
    events::TokenCreated,
    state::{BondingCurve, GlobalConfig, TokenConfig},
    utils::calculate_bonding_curve_price,
};

#[derive(Accounts)]
#[instruction(name: String, symbol: String, uri: String)]
pub struct CreateToken<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        seeds = [GLOBAL_CONFIG_SEED],
        bump,
        has_one = authority @ PumpError::InvalidAuthority
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        init,
        payer = creator,
        mint::decimals = TOKEN_DECIMALS,
        mint::authority = bonding_curve,
        mint::freeze_authority = bonding_curve,
        seeds = [TOKEN_MINT_SEED, creator.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        space = TokenConfig::LEN,
        seeds = [TOKEN_CONFIG_SEED, token_mint.key().as_ref()],
        bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        init,
        payer = creator,
        space = BondingCurve::LEN,
        seeds = [BONDING_CURVE_SEED, token_mint.key().as_ref()],
        bump
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = token_mint,
        associated_token::authority = bonding_curve
    )]
    pub bonding_curve_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = token_mint,
        associated_token::authority = creator
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn create_token(
    ctx: Context<CreateToken>,
    name: String,
    symbol: String,
    uri: String,
    initial_virtual_token_reserves: u64,
    initial_virtual_sol_reserves: u64,
) -> Result<()> {
    require!(name.len() <= MAX_NAME_LENGTH, PumpError::NameTooLong);
    require!(symbol.len() <= MAX_SYMBOL_LENGTH, PumpError::SymbolTooLong);
    require!(uri.len() <= MAX_URI_LENGTH, PumpError::UriTooLong);
    require!(
        initial_virtual_token_reserves > 0,
        PumpError::InvalidReserves
    );
    require!(
        initial_virtual_sol_reserves > 0,
        PumpError::InvalidReserves
    );

    let global_config = &ctx.accounts.global_config;
    let token_mint = &ctx.accounts.token_mint;
    let token_config = &mut ctx.accounts.token_config;
    let bonding_curve = &mut ctx.accounts.bonding_curve;
    let creator = &ctx.accounts.creator;

    // Validate creation fee payment
    let creation_fee = global_config.token_creation_fee;
    if creation_fee > 0 {
        let creator_balance = creator.lamports();
        require!(
            creator_balance >= creation_fee,
            PumpError::InsufficientFunds
        );

        // Transfer creation fee to fee recipient
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &creator.key(),
            &global_config.fee_recipient,
            creation_fee,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                creator.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    }

    // Initialize token config
    token_config.creator = creator.key();
    token_config.mint = token_mint.key();
    token_config.name = name.clone();
    token_config.symbol = symbol.clone();
    token_config.uri = uri.clone();
    token_config.created_at = Clock::get()?.unix_timestamp;
    token_config.is_launched = false;
    token_config.bump = ctx.bumps.token_config;

    // Initialize bonding curve
    bonding_curve.token_mint = token_mint.key();
    bonding_curve.virtual_token_reserves = initial_virtual_token_reserves;
    bonding_curve.virtual_sol_reserves = initial_virtual_sol_reserves;
    bonding_curve.real_token_reserves = 0;
    bonding_curve.real_sol_reserves = 0;
    bonding_curve.total_supply = TOTAL_SUPPLY;
    bonding_curve.creator = creator.key();
    bonding_curve.created_at = Clock::get()?.unix_timestamp;
    bonding_curve.is_complete = false;
    bonding_curve.bump = ctx.bumps.bonding_curve;

    // Calculate initial price
    let initial_price = calculate_bonding_curve_price(
        initial_virtual_sol_reserves,
        initial_virtual_token_reserves,
    )?;
    bonding_curve.current_price = initial_price;

    // Mint initial supply to bonding curve
    let bonding_curve_key = bonding_curve.key();
    let bonding_curve_seeds = &[
        BONDING_CURVE_SEED,
        token_mint.key().as_ref(),
        &[bonding_curve.bump],
    ];
    let bonding_curve_signer = &[&bonding_curve_seeds[..]];

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: token_mint.to_account_info(),
                to: ctx.accounts.bonding_curve_token_account.to_account_info(),
                authority: bonding_curve.to_account_info(),
            },
            bonding_curve_signer,
        ),
        TOTAL_SUPPLY,
    )?;

    // Create metadata
    let metadata_seeds = &[
        "metadata".as_bytes(),
        ctx.accounts.token_metadata_program.key().as_ref(),
        token_mint.key().as_ref(),
    ];
    let (metadata_key, _metadata_bump) =
        Pubkey::find_program_address(metadata_seeds, &ctx.accounts.token_metadata_program.key());
    require_keys_eq!(metadata_key, ctx.accounts.metadata.key());

    create_metadata_accounts_v3(
        CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata.to_account_info(),
                mint: token_mint.to_account_info(),
                mint_authority: bonding_curve.to_account_info(),
                update_authority: bonding_curve.to_account_info(),
                payer: creator.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            bonding_curve_signer,
        ),
        DataV2 {
            name: name.clone(),
            symbol: symbol.clone(),
            uri: uri.clone(),
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        },
        false,
        true,
        None,
    )?;

    // Emit event
    emit!(TokenCreated {
        mint: token_mint.key(),
        creator: creator.key(),
        name: name.clone(),
        symbol: symbol.clone(),
        uri: uri.clone(),
        bonding_curve: bonding_curve_key,
        virtual_token_reserves: initial_virtual_token_reserves,
        virtual_sol_reserves: initial_virtual_sol_reserves,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!(
        "Token created: {} ({}) by {}",
        name,
        symbol,
        creator.key()
    );

    Ok(())
}