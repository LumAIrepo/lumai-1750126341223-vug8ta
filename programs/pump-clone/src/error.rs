use anchor_lang::prelude::*;

#[error_code]
pub enum PumpCloneError {
    #[msg("Insufficient funds for token creation")]
    InsufficientFunds,
    
    #[msg("Token name too long (max 32 characters)")]
    TokenNameTooLong,
    
    #[msg("Token symbol too long (max 10 characters)")]
    TokenSymbolTooLong,
    
    #[msg("Token description too long (max 500 characters)")]
    TokenDescriptionTooLong,
    
    #[msg("Invalid token metadata URI")]
    InvalidMetadataUri,
    
    #[msg("Token already exists")]
    TokenAlreadyExists,
    
    #[msg("Token not found")]
    TokenNotFound,
    
    #[msg("Bonding curve not initialized")]
    BondingCurveNotInitialized,
    
    #[msg("Invalid bonding curve parameters")]
    InvalidBondingCurveParams,
    
    #[msg("Bonding curve already completed")]
    BondingCurveCompleted,
    
    #[msg("Bonding curve not completed")]
    BondingCurveNotCompleted,
    
    #[msg("Insufficient SOL for purchase")]
    InsufficientSolForPurchase,
    
    #[msg("Insufficient tokens for sale")]
    InsufficientTokensForSale,
    
    #[msg("Purchase amount too small")]
    PurchaseAmountTooSmall,
    
    #[msg("Sale amount too small")]
    SaleAmountTooSmall,
    
    #[msg("Maximum purchase amount exceeded")]
    MaxPurchaseAmountExceeded,
    
    #[msg("Maximum sale amount exceeded")]
    MaxSaleAmountExceeded,
    
    #[msg("Slippage tolerance exceeded")]
    SlippageToleranceExceeded,
    
    #[msg("Trading not active")]
    TradingNotActive,
    
    #[msg("Trading already active")]
    TradingAlreadyActive,
    
    #[msg("Fair launch not started")]
    FairLaunchNotStarted,
    
    #[msg("Fair launch already started")]
    FairLaunchAlreadyStarted,
    
    #[msg("Fair launch already ended")]
    FairLaunchAlreadyEnded,
    
    #[msg("Fair launch duration invalid")]
    FairLaunchDurationInvalid,
    
    #[msg("Fair launch minimum not reached")]
    FairLaunchMinimumNotReached,
    
    #[msg("Fair launch maximum exceeded")]
    FairLaunchMaximumExceeded,
    
    #[msg("Liquidity migration not ready")]
    LiquidityMigrationNotReady,
    
    #[msg("Liquidity already migrated")]
    LiquidityAlreadyMigrated,
    
    #[msg("Insufficient liquidity for migration")]
    InsufficientLiquidityForMigration,
    
    #[msg("Invalid migration parameters")]
    InvalidMigrationParameters,
    
    #[msg("Unauthorized access")]
    Unauthorized,
    
    #[msg("Invalid authority")]
    InvalidAuthority,
    
    #[msg("Invalid creator")]
    InvalidCreator,
    
    #[msg("Invalid fee recipient")]
    InvalidFeeRecipient,
    
    #[msg("Invalid fee percentage")]
    InvalidFeePercentage,
    
    #[msg("Fee calculation overflow")]
    FeeCalculationOverflow,
    
    #[msg("Price calculation overflow")]
    PriceCalculationOverflow,
    
    #[msg("Supply calculation overflow")]
    SupplyCalculationOverflow,
    
    #[msg("Reserve calculation overflow")]
    ReserveCalculationOverflow,
    
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    
    #[msg("Invalid token mint")]
    InvalidTokenMint,
    
    #[msg("Invalid associated token account")]
    InvalidAssociatedTokenAccount,
    
    #[msg("Token account not owned by user")]
    TokenAccountNotOwnedByUser,
    
    #[msg("Insufficient token balance")]
    InsufficientTokenBalance,
    
    #[msg("Invalid program account")]
    InvalidProgramAccount,
    
    #[msg("Invalid system program")]
    InvalidSystemProgram,
    
    #[msg("Invalid token program")]
    InvalidTokenProgram,
    
    #[msg("Invalid associated token program")]
    InvalidAssociatedTokenProgram,
    
    #[msg("Invalid rent sysvar")]
    InvalidRentSysvar,
    
    #[msg("Invalid clock sysvar")]
    InvalidClockSysvar,
    
    #[msg("Account already initialized")]
    AccountAlreadyInitialized,
    
    #[msg("Account not initialized")]
    AccountNotInitialized,
    
    #[msg("Invalid account size")]
    InvalidAccountSize,
    
    #[msg("Invalid account owner")]
    InvalidAccountOwner,
    
    #[msg("Account discriminator mismatch")]
    AccountDiscriminatorMismatch,
    
    #[msg("Invalid PDA derivation")]
    InvalidPdaDerivation,
    
    #[msg("PDA bump seed not found")]
    PdaBumpSeedNotFound,
    
    #[msg("Invalid bump seed")]
    InvalidBumpSeed,
    
    #[msg("Numerical overflow")]
    NumericalOverflow,
    
    #[msg("Numerical underflow")]
    NumericalUnderflow,
    
    #[msg("Division by zero")]
    DivisionByZero,
    
    #[msg("Invalid timestamp")]
    InvalidTimestamp,
    
    #[msg("Timestamp overflow")]
    TimestampOverflow,
    
    #[msg("Operation expired")]
    OperationExpired,
    
    #[msg("Operation too early")]
    OperationTooEarly,
    
    #[msg("Invalid configuration")]
    InvalidConfiguration,
    
    #[msg("Configuration not found")]
    ConfigurationNotFound,
    
    #[msg("Program paused")]
    ProgramPaused,
    
    #[msg("Program not paused")]
    ProgramNotPaused,
    
    #[msg("Emergency mode active")]
    EmergencyModeActive,
    
    #[msg("Emergency mode not active")]
    EmergencyModeNotActive,
    
    #[msg("Invalid emergency authority")]
    InvalidEmergencyAuthority,
    
    #[msg("Rate limit exceeded")]
    RateLimitExceeded,
    
    #[msg("Daily limit exceeded")]
    DailyLimitExceeded,
    
    #[msg("Weekly limit exceeded")]
    WeeklyLimitExceeded,
    
    #[msg("Monthly limit exceeded")]
    MonthlyLimitExceeded,
    
    #[msg("User blacklisted")]
    UserBlacklisted,
    
    #[msg("Token blacklisted")]
    TokenBlacklisted,
    
    #[msg("Invalid whitelist")]
    InvalidWhitelist,
    
    #[msg("User not whitelisted")]
    UserNotWhitelisted,
    
    #[msg("Whitelist period expired")]
    WhitelistPeriodExpired,
    
    #[msg("Invalid social verification")]
    InvalidSocialVerification,
    
    #[msg("Social verification required")]
    SocialVerificationRequired,
    
    #[msg("Invalid comment length")]
    InvalidCommentLength,
    
    #[msg("Comment not found")]
    CommentNotFound,
    
    #[msg("Invalid vote type")]
    InvalidVoteType,
    
    #[msg("Already voted")]
    AlreadyVoted,
    
    #[msg("Vote not found")]
    VoteNotFound,
    
    #[msg("Invalid reputation score")]
    InvalidReputationScore,
    
    #[msg("Insufficient reputation")]
    InsufficientReputation,
    
    #[msg("Invalid referral code")]
    InvalidReferralCode,
    
    #[msg("Referral code expired")]
    ReferralCodeExpired,
    
    #[msg("Self referral not allowed")]
    SelfReferralNotAllowed,
    
    #[msg("Maximum referrals exceeded")]
    MaximumReferralsExceeded,
    
    #[msg("Invalid reward calculation")]
    InvalidRewardCalculation,
    
    #[msg("Reward already claimed")]
    RewardAlreadyClaimed,
    
    #[msg("Reward not available")]
    RewardNotAvailable,
    
    #[msg("Invalid airdrop parameters")]
    InvalidAirdropParameters,
    
    #[msg("Airdrop not active")]
    AirdropNotActive,
    
    #[msg("Airdrop already claimed")]
    AirdropAlreadyClaimed,
    
    #[msg("Airdrop eligibility not met")]
    AirdropEligibilityNotMet,
    
    #[msg("Invalid vesting schedule")]
    InvalidVestingSchedule,
    
    #[msg("Vesting not started")]
    VestingNotStarted,
    
    #[msg("Vesting already completed")]
    VestingAlreadyCompleted,
    
    #[msg("Insufficient vested amount")]
    InsufficientVestedAmount,
    
    #[msg("Invalid lock period")]
    InvalidLockPeriod,
    
    #[msg("Tokens still locked")]
    TokensStillLocked,
    
    #[msg("Lock already released")]
    LockAlreadyReleased,
    
    #[msg("Invalid governance proposal")]
    InvalidGovernanceProposal,
    
    #[msg("Proposal not active")]
    ProposalNotActive,
    
    #[msg("Proposal already executed")]
    ProposalAlreadyExecuted,
    
    #[msg("Insufficient voting power")]
    InsufficientVotingPower,
    
    #[msg("Voting period expired")]
    VotingPeriodExpired,
    
    #[msg("Quorum not reached")]
    QuorumNotReached,
    
    #[msg("Invalid oracle price")]
    InvalidOraclePrice,
    
    #[msg("Oracle price too old")]
    OraclePriceTooOld,
    
    #[msg("Oracle not found")]
    OracleNotFound,
    
    #[msg("Price deviation too high")]
    PriceDeviationTooHigh,
    
    #[msg("Circuit breaker triggered")]
    CircuitBreakerTriggered,
    
    #[msg("Market volatility too high")]
    MarketVolatilityTooHigh,
    
    #[msg("Invalid market maker")]
    InvalidMarketMaker,
    
    #[msg("Market maker not active")]
    MarketMakerNotActive,
    
    #[msg("Insufficient market maker balance")]
    InsufficientMarketMakerBalance,
    
    #[msg("Invalid arbitrage opportunity")]
    InvalidArbitrageOpportunity,
    
    #[msg("Arbitrage window expired")]
    ArbitrageWindowExpired,
    
    #[msg("Flash loan not repaid")]
    FlashLoanNotRepaid,
    
    #[msg("Flash loan amount exceeded")]
    FlashLoanAmountExceeded,
    
    #[msg("Invalid flash loan callback")]
    InvalidFlashLoanCallback,
    
    #[msg("MEV protection active")]
    MevProtectionActive,
    
    #[msg("Sandwich attack detected")]
    SandwichAttackDetected,
    
    #[msg("Front running detected")]
    FrontRunningDetected,
    
    #[msg("Invalid transaction ordering")]
    InvalidTransactionOrdering,
    
    #[msg("Block height mismatch")]
    BlockHeightMismatch,
    
    #[msg("Invalid signature")]
    InvalidSignature,
    
    #[msg("Signature verification failed")]
    SignatureVerificationFailed,
    
    #[msg("Invalid nonce")]
    InvalidNonce,
    
    #[msg("Nonce already used")]
    NonceAlreadyUsed,
    
    #[msg("Transaction replay detected")]
    TransactionReplayDetected,
    
    #[msg("Invalid transaction hash")]
    InvalidTransactionHash,
    
    #[msg("Transaction not found")]
    TransactionNotFound,
    
    #[msg("Invalid block hash")]
    InvalidBlockHash,
    
    #[msg("Block not found")]
    BlockNotFound,
    
    #[msg("Chain reorganization detected")]
    ChainReorganizationDetected,
    
    #[msg("Invalid network")]
    InvalidNetwork,
    
    #[msg("Network congestion")]
    NetworkCongestion,
    
    #[msg("RPC endpoint unavailable")]
    RpcEndpointUnavailable,
    
    #[msg("Invalid RPC response")]
    InvalidRpcResponse,
    
    #[msg("Timeout exceeded")]
    TimeoutExceeded,
    
    #[msg("Connection failed")]
    ConnectionFailed,
    
    #[msg("Service unavailable")]
    ServiceUnavailable,
    
    #[msg("Maintenance mode active")]
    MaintenanceModeActive,
    
    #[msg("Version mismatch")]
    VersionMismatch,
    
    #[msg("Upgrade required")]
    UpgradeRequired,
    
    #[msg("Feature not supported")]
    FeatureNotSupported,
    
    #[msg("Invalid feature flag")]
    InvalidFeatureFlag,
    
    #[msg("Feature disabled")]
    FeatureDisabled,
    
    #[msg("Beta feature access required")]
    BetaFeatureAccessRequired,
    
    #[msg("Premium feature access required")]
    PremiumFeatureAccessRequired,
    
    #[msg("Subscription expired")]
    SubscriptionExpired,
    
    #[msg("Invalid subscription")]
    InvalidSubscription,
    
    #[msg("Payment required")]
    PaymentRequired,
    
    #[msg("Payment failed")]
    PaymentFailed,
    
    #[msg("Refund not available")]
    RefundNotAvailable,
    
    #[msg("Invalid payment method")]
    InvalidPaymentMethod,
    
    #[msg("Insufficient balance for fees")]
    InsufficientBalanceForFees,
    
    #[msg("Fee payment failed")]
    FeePaymentFailed,
    
    #[msg("Invalid fee structure")]
    InvalidFeeStructure,
    
    #[msg("Fee tier not found")]
    FeeTierNotFound,
    
    #[msg("Discount not applicable")]
    DiscountNotApplicable,
    
    #[msg("Promotion expired")]
    PromotionExpired,
    
    #[msg("Invalid promotion code")]
    InvalidPromotionCode,
    
    #[msg("Promotion limit exceeded")]
    PromotionLimitExceeded,
    
    #[msg("Invalid loyalty points")]
    InvalidLoyaltyPoints,
    
    #[msg("Insufficient loyalty points")]
    InsufficientLoyaltyPoints,
    
    #[msg("Loyalty program not active")]
    LoyaltyProgramNotActive,
    
    #[msg("Invalid tier requirements")]
    InvalidTierRequirements,
    
    #[msg("Tier upgrade not available")]
    TierUpgradeNotAvailable,
    
    #[msg("Tier downgrade not allowed")]
    TierDowngradeNotAllowed,
    
    #[msg("Invalid achievement")]
    InvalidAchievement,
    
    #[msg("Achievement already unlocked")]