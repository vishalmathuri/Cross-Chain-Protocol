use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Store {
    pub admin: Pubkey,
    pub bump: u8,
    pub endpoint_program: Pubkey,

    pub outbound_nonce: u64,
    pub received_count: u64,

    pub last_received_guid: [u8; 32],
    pub last_received_message_id: [u8; 32],
}

impl Store {
    pub const SIZE: usize = 8 + Self::INIT_SPACE;
}

#[account]
#[derive(InitSpace)]
pub struct ReceivedMessage {
    pub src_eid: u32,

    pub source_oapp: [u8; 32],
    pub guid: [u8; 32],
    pub message_id: [u8; 32],

    pub version: u8,
    pub message_type: u8,
    pub nonce: u64,

    pub sender: [u8; 32],
    pub receiver: [u8; 32],

    pub timestamp: u64,

    /// Keccak-256 hash of the original application payload.
    ///
    /// Storing only the hash avoids allocating up to 4096 bytes
    /// for every successfully processed cross-chain message.
    pub data_hash: [u8; 32],

    /// Original application payload length in bytes.
    pub data_len: u32,

    pub bump: u8,
}

impl ReceivedMessage {
    pub const SIZE: usize = 8 + Self::INIT_SPACE;
}

/// The Executor uses this PDA to discover how to execute lz_receive.
#[account]
#[derive(InitSpace)]
pub struct LzReceiveTypesAccounts {
    pub store: Pubkey,
    pub alt: Pubkey,
    pub bump: u8,
}

impl LzReceiveTypesAccounts {
    pub const SIZE: usize = 8 + Self::INIT_SPACE;
}
