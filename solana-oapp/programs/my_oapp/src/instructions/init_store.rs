use crate::*;
use anchor_lang::{
    prelude::*,
    solana_program::{address_lookup_table::program::ID as ALT_PROGRAM_ID, pubkey},
};

use oapp::endpoint::{instructions::RegisterOAppParams, ID as ENDPOINT_ID};

/// Only this wallet may perform the one-time OApp initialization.
///
/// This prevents another wallet from front-running initialization
/// and assigning itself as the Store admin.
pub const INITIALIZATION_AUTHORITY: Pubkey =
    pubkey!("FfWFHtyP9Z1bfqxeyxZhYZX7YXXgQRnGkkuMXfuLZepS");

#[derive(Accounts)]
#[instruction(params: InitStoreParams)]
pub struct InitStore<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = Store::SIZE,
        seeds = [STORE_SEED],
        bump
    )]
    pub store: Account<'info, Store>,

    #[account(
        init,
        payer = payer,
        space = LzReceiveTypesAccounts::SIZE,
        seeds = [
            LZ_RECEIVE_TYPES_SEED,
            &store.key().to_bytes()
        ],
        bump
    )]
    pub lz_receive_types_accounts: Account<'info, LzReceiveTypesAccounts>,

    #[account(owner = ALT_PROGRAM_ID)]
    pub alt: Option<UncheckedAccount<'info>>,

    pub system_program: Program<'info, System>,
}

impl InitStore<'_> {
    pub fn apply(ctx: &mut Context<InitStore>, params: &InitStoreParams) -> Result<()> {
        // ---------------------------------------------------------
        // INITIALIZATION AUTHORITY
        // ---------------------------------------------------------

        // Only our configured deployment wallet can initialize
        // the Store PDA.
        require_keys_eq!(
            ctx.accounts.payer.key(),
            INITIALIZATION_AUTHORITY,
            MyOAppError::UnauthorizedInitializer
        );

        // The initialized admin must also be the initializing signer.
        require_keys_eq!(params.admin, ctx.accounts.payer.key(), MyOAppError::AdminMustBePayer);

        // ---------------------------------------------------------
        // ENDPOINT VALIDATION
        // ---------------------------------------------------------

        require_keys_eq!(params.endpoint, ENDPOINT_ID, MyOAppError::InvalidEndpoint);

        // ---------------------------------------------------------
        // STORE INITIALIZATION
        // ---------------------------------------------------------

        let store = &mut ctx.accounts.store;

        store.admin = params.admin;
        store.bump = ctx.bumps.store;
        store.endpoint_program = ENDPOINT_ID;

        store.outbound_nonce = 0;
        store.received_count = 0;
        store.last_received_guid = [0u8; 32];
        store.last_received_message_id = [0u8; 32];

        // ---------------------------------------------------------
        // LZ RECEIVE TYPES ACCOUNT
        // ---------------------------------------------------------

        ctx.accounts.lz_receive_types_accounts.store = store.key();

        ctx.accounts.lz_receive_types_accounts.alt =
            ctx.accounts.alt.as_ref().map(|account| account.key()).unwrap_or_default();

        ctx.accounts.lz_receive_types_accounts.bump = ctx.bumps.lz_receive_types_accounts;

        // ---------------------------------------------------------
        // REGISTER OAPP WITH LAYERZERO ENDPOINT
        // ---------------------------------------------------------

        let register_params = RegisterOAppParams { delegate: store.admin };

        let store_bump = [store.bump];

        let seeds: &[&[u8]] = &[STORE_SEED, &store_bump];

        oapp::endpoint_cpi::register_oapp(
            ENDPOINT_ID,
            store.key(),
            ctx.remaining_accounts,
            seeds,
            register_params,
        )?;

        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InitStoreParams {
    pub admin: Pubkey,
    pub endpoint: Pubkey,
}
