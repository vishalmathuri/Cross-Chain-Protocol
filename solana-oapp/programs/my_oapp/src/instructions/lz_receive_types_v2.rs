use crate::*;
use anchor_lang::{prelude::*, system_program};
use oapp::{
    common::{
        compact_accounts_with_alts, AccountMetaRef, AddressLocator, EXECUTION_CONTEXT_VERSION_1,
    },
    endpoint::ID as ENDPOINT_ID,
    lz_receive_types_v2::{get_accounts_for_clear, Instruction, LzReceiveTypesV2Result},
    LzReceiveParams,
};

#[derive(Accounts)]
#[instruction(params: LzReceiveParams)]
pub struct LzReceiveTypesV2<'info> {
    #[account(
        seeds = [STORE_SEED],
        bump = store.bump
    )]
    pub store: Account<'info, Store>,
}

impl LzReceiveTypesV2<'_> {
    pub fn apply(
        ctx: &Context<LzReceiveTypesV2>,
        params: &LzReceiveParams,
    ) -> Result<LzReceiveTypesV2Result> {
        let store_key = ctx.accounts.store.key();

        let peer_seeds = [PEER_SEED, store_key.as_ref(), &params.src_eid.to_be_bytes()];

        let (peer, _) = Pubkey::find_program_address(&peer_seeds, ctx.program_id);

        // Decode only so that we can derive the application-level
        // replay-protection PDA required by lz_receive.
        let message = msg_codec::decode(&params.message)?;

        let message_id =
            msg_codec::compute_message_id(params.src_eid, params.sender, message.nonce);

        let (received_message, _) =
            Pubkey::find_program_address(&[RECEIVED_MESSAGE_SEED, &message_id], ctx.program_id);

        let mut accounts = vec![
            // LzReceive.payer
            AccountMetaRef { pubkey: AddressLocator::Payer, is_writable: true },
            // LzReceive.store
            AccountMetaRef { pubkey: store_key.into(), is_writable: true },
            // LzReceive.peer
            AccountMetaRef { pubkey: peer.into(), is_writable: false },
            // LzReceive.received_message
            AccountMetaRef { pubkey: received_message.into(), is_writable: true },
            // LzReceive.system_program
            AccountMetaRef { pubkey: system_program::ID.into(), is_writable: false },
        ];

        let accounts_for_clear = get_accounts_for_clear(
            ENDPOINT_ID,
            &store_key,
            params.src_eid,
            &params.sender,
            params.nonce,
        );

        accounts.extend(accounts_for_clear);

        Ok(LzReceiveTypesV2Result {
            context_version: EXECUTION_CONTEXT_VERSION_1,

            alts: ctx.remaining_accounts.iter().map(|alt| alt.key()).collect(),

            instructions: vec![Instruction::LzReceive {
                accounts: compact_accounts_with_alts(&ctx.remaining_accounts, accounts)?,
            }],
        })
    }
}
