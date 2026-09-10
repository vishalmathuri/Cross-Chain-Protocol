use crate::*;
use anchor_lang::prelude::*;
use oapp::endpoint::{
    instructions::QuoteParams, state::EndpointSettings, ENDPOINT_SEED, ID as ENDPOINT_ID,
};

#[derive(Accounts)]
#[instruction(params: QuoteSendParams)]
pub struct QuoteSend<'info> {
    #[account(
        seeds = [STORE_SEED],
        bump = store.bump
    )]
    pub store: Account<'info, Store>,

    #[account(
        seeds = [
            PEER_SEED,
            store.key().as_ref(),
            &params.dst_eid.to_be_bytes()
        ],
        bump = peer.bump
    )]
    pub peer: Account<'info, PeerConfig>,

    #[account(
        seeds = [ENDPOINT_SEED],
        bump = endpoint.bump,
        seeds::program = ENDPOINT_ID
    )]
    pub endpoint: Account<'info, EndpointSettings>,
}

impl QuoteSend<'_> {
    pub fn apply(ctx: &Context<QuoteSend>, params: &QuoteSendParams) -> Result<MessagingFee> {
        require!(ctx.accounts.peer.peer_address != [0u8; 32], MyOAppError::InvalidPeerAddress);

        let nonce = ctx
            .accounts
            .store
            .outbound_nonce
            .checked_add(1)
            .ok_or(MyOAppError::NonceOverflow)?;

        let unix_timestamp = Clock::get()?.unix_timestamp;

        let timestamp =
            u64::try_from(unix_timestamp).map_err(|_| error!(MyOAppError::InvalidTimestamp))?;

        let cross_chain_message = msg_codec::CrossChainMessage {
            version: msg_codec::PROTOCOL_VERSION,
            message_type: msg_codec::MESSAGE_TYPE_GENERIC,
            nonce,
            sender: params.sender,
            receiver: params.receiver,
            timestamp,
            data: params.data.clone(),
        };

        let message = msg_codec::encode(&cross_chain_message)?;

        let quote_params = QuoteParams {
            sender: ctx.accounts.store.key(),
            dst_eid: params.dst_eid,

            // Transport receiver is always configured peer.
            receiver: ctx.accounts.peer.peer_address,

            message,

            pay_in_lz_token: params.pay_in_lz_token,

            options: ctx
                .accounts
                .peer
                .enforced_options
                .combine_options(&None::<Vec<u8>>, &params.options)?,
        };

        oapp::endpoint_cpi::quote(ENDPOINT_ID, ctx.remaining_accounts, quote_params)
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct QuoteSendParams {
    pub dst_eid: u32,

    /// Solana sender pubkey serialized as bytes32.
    pub sender: [u8; 32],

    /// Application-level destination receiver.
    pub receiver: [u8; 32],

    pub data: Vec<u8>,

    pub options: Vec<u8>,
    pub pay_in_lz_token: bool,
}
