use crate::*;
use anchor_lang::prelude::*;
use oapp::endpoint::{
    instructions::SendParams, state::EndpointSettings, ENDPOINT_SEED, ID as ENDPOINT_ID,
};

#[derive(Accounts)]
#[instruction(params: SendMessageParams)]
pub struct Send<'info> {
    /// Actual Solana application-level sender.
    pub sender: Signer<'info>,

    #[account(
        seeds = [
            PEER_SEED,
            &store.key().to_bytes(),
            &params.dst_eid.to_be_bytes()
        ],
        bump = peer.bump
    )]
    pub peer: Account<'info, PeerConfig>,

    #[account(
        mut,
        seeds = [STORE_SEED],
        bump = store.bump
    )]
    pub store: Account<'info, Store>,

    #[account(
        seeds = [ENDPOINT_SEED],
        bump = endpoint.bump,
        seeds::program = ENDPOINT_ID
    )]
    pub endpoint: Account<'info, EndpointSettings>,
}

impl Send<'_> {
    pub fn apply(ctx: &mut Context<Send>, params: &SendMessageParams) -> Result<()> {
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
            sender: ctx.accounts.sender.key().to_bytes(),
            receiver: params.receiver,
            timestamp,
            data: params.data.clone(),
        };

        let message = msg_codec::encode(&cross_chain_message)?;

        let store_bump = [ctx.accounts.store.bump];

        let seeds: &[&[u8]] = &[STORE_SEED, &store_bump];

        let send_params = SendParams {
            dst_eid: params.dst_eid,

            // LayerZero transport receiver = remote OApp.
            receiver: ctx.accounts.peer.peer_address,

            message,

            options: ctx
                .accounts
                .peer
                .enforced_options
                .combine_options(&None::<Vec<u8>>, &params.options)?,

            native_fee: params.native_fee,
            lz_token_fee: params.lz_token_fee,
        };

        oapp::endpoint_cpi::send(
            ENDPOINT_ID,
            ctx.accounts.store.key(),
            ctx.remaining_accounts,
            seeds,
            send_params,
        )?;

        // The entire Solana transaction is atomic. If Endpoint::send
        // fails, this nonce update is rolled back too.
        ctx.accounts.store.outbound_nonce = nonce;

        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SendMessageParams {
    pub dst_eid: u32,

    /// Application-level receiver, not the LayerZero peer.
    pub receiver: [u8; 32],

    pub data: Vec<u8>,

    pub options: Vec<u8>,
    pub native_fee: u64,
    pub lz_token_fee: u64,
}
