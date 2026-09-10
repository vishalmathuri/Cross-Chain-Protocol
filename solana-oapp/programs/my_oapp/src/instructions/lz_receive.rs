use crate::*;
use anchor_lang::{prelude::*, system_program};
use oapp::{
    endpoint::{
        cpi::accounts::Clear, instructions::ClearParams, ConstructCPIContext, ID as ENDPOINT_ID,
    },
    LzReceiveParams,
};

#[derive(Accounts)]
#[instruction(params: LzReceiveParams)]
pub struct LzReceive<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [STORE_SEED],
        bump = store.bump
    )]
    pub store: Account<'info, Store>,

    #[account(
        seeds = [
            PEER_SEED,
            &store.key().to_bytes(),
            &params.src_eid.to_be_bytes()
        ],
        bump = peer.bump,
        constraint =
            params.sender == peer.peer_address
    )]
    pub peer: Account<'info, PeerConfig>,

    /// CHECK:
    /// PDA address is recomputed from the logical application message ID
    /// before use. It is created and owned by this program.
    #[account(mut)]
    pub received_message: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl LzReceive<'_> {
    pub fn apply(ctx: &mut Context<LzReceive>, params: &LzReceiveParams) -> Result<()> {
        let message = msg_codec::decode(&params.message)?;

        msg_codec::validate(&message)?;

        let message_id =
            msg_codec::compute_message_id(params.src_eid, params.sender, message.nonce);

        let (expected_receipt, receipt_bump) =
            Pubkey::find_program_address(&[RECEIVED_MESSAGE_SEED, &message_id], ctx.program_id);

        require_keys_eq!(
            ctx.accounts.received_message.key(),
            expected_receipt,
            MyOAppError::InvalidReceiptAccount
        );

        let receipt_info = ctx.accounts.received_message.to_account_info();

        // If this PDA already exists, then this logical
        // srcEid + sourceOApp + applicationNonce was processed before.
        require!(
            receipt_info.lamports() == 0 && receipt_info.data_is_empty(),
            MyOAppError::DuplicateMessageId
        );

        require!(
            ctx.remaining_accounts.len() >= Clear::MIN_ACCOUNTS_LEN,
            MyOAppError::MissingClearAccounts
        );

        let store_bump = [ctx.accounts.store.bump];

        let store_seeds: &[&[u8]] = &[STORE_SEED, &store_bump];

        let accounts_for_clear = &ctx.remaining_accounts[0..Clear::MIN_ACCOUNTS_LEN];

        // LayerZero transport-level replay protection.
        //
        // If anything later in this instruction fails, Solana transaction
        // atomicity rolls this CPI back as well.
        oapp::endpoint_cpi::clear(
            ENDPOINT_ID,
            ctx.accounts.store.key(),
            accounts_for_clear,
            store_seeds,
            ClearParams {
                receiver: ctx.accounts.store.key(),
                src_eid: params.src_eid,
                sender: params.sender,
                nonce: params.nonce,
                guid: params.guid,
                message: params.message.clone(),
            },
        )?;

        let rent = Rent::get()?;

        let receipt_lamports = rent.minimum_balance(ReceivedMessage::SIZE);

        let receipt_bump_seed = [receipt_bump];

        let receipt_seeds: &[&[u8]] = &[RECEIVED_MESSAGE_SEED, &message_id, &receipt_bump_seed];

        let signer_seeds: &[&[&[u8]]] = &[receipt_seeds];

        let create_accounts = system_program::CreateAccount {
            from: ctx.accounts.payer.to_account_info(),
            to: ctx.accounts.received_message.to_account_info(),
        };

        let create_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            create_accounts,
            signer_seeds,
        );

        system_program::create_account(
            create_ctx,
            receipt_lamports,
            ReceivedMessage::SIZE as u64,
            ctx.program_id,
        )?;

        let receipt = ReceivedMessage {
            src_eid: params.src_eid,
            source_oapp: params.sender,
            guid: params.guid,
            message_id,

            version: message.version,
            message_type: message.message_type,
            nonce: message.nonce,

            sender: message.sender,
            receiver: message.receiver,

            timestamp: message.timestamp,
            data: message.data,

            bump: receipt_bump,
        };

        {
            let mut account_data = ctx.accounts.received_message.try_borrow_mut_data()?;

            let mut destination: &mut [u8] = &mut account_data[..];

            receipt.try_serialize(&mut destination)?;
        }

        let store = &mut ctx.accounts.store;

        store.received_count =
            store.received_count.checked_add(1).ok_or(MyOAppError::NonceOverflow)?;

        store.last_received_guid = params.guid;
        store.last_received_message_id = message_id;

        Ok(())
    }
}
