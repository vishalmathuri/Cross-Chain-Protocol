mod errors;
mod instructions;
mod msg_codec;
mod state;

use anchor_lang::prelude::*;
use errors::*;
use instructions::*;
use oapp::{
    endpoint::MessagingFee,
    lz_receive_types_v2::{LzReceiveTypesV2Accounts, LzReceiveTypesV2Result},
    LzReceiveParams,
};
use solana_helper::program_id_from_env;
use state::*;

declare_id!(anchor_lang::solana_program::pubkey::Pubkey::new_from_array(program_id_from_env!(
    "MYOAPP_ID",
    "86twc7j7pKySmWBV7pRBFkDkxqKs3bzJMjLCatjaKLSi"
)));

const LZ_RECEIVE_TYPES_SEED: &[u8] = b"LzReceiveTypes";
const STORE_SEED: &[u8] = b"Store";
const PEER_SEED: &[u8] = b"Peer";

/// Logical application message receipt.
///
/// This is separate from LayerZero Endpoint replay protection.
const RECEIVED_MESSAGE_SEED: &[u8] = b"ReceivedMessage";

#[program]
pub mod my_oapp {
    use super::*;

    pub fn init_store(mut ctx: Context<InitStore>, params: InitStoreParams) -> Result<()> {
        InitStore::apply(&mut ctx, &params)
    }

    pub fn set_peer_config(
        mut ctx: Context<SetPeerConfig>,
        params: SetPeerConfigParams,
    ) -> Result<()> {
        SetPeerConfig::apply(&mut ctx, &params)
    }

    pub fn quote_send(ctx: Context<QuoteSend>, params: QuoteSendParams) -> Result<MessagingFee> {
        QuoteSend::apply(&ctx, &params)
    }

    pub fn send(mut ctx: Context<Send>, params: SendMessageParams) -> Result<()> {
        Send::apply(&mut ctx, &params)
    }

    pub fn lz_receive(mut ctx: Context<LzReceive>, params: LzReceiveParams) -> Result<()> {
        LzReceive::apply(&mut ctx, &params)
    }

    pub fn lz_receive_types_v2(
        ctx: Context<LzReceiveTypesV2>,
        params: LzReceiveParams,
    ) -> Result<LzReceiveTypesV2Result> {
        LzReceiveTypesV2::apply(&ctx, &params)
    }

    pub fn lz_receive_types_info(
        ctx: Context<LzReceiveTypesInfo>,
        params: LzReceiveParams,
    ) -> Result<(u8, LzReceiveTypesV2Accounts)> {
        LzReceiveTypesInfo::apply(&ctx, &params)
    }
}
