use anchor_lang::prelude::*;

#[error_code]
pub enum MyOAppError {
    #[msg("Unsupported protocol version")]
    InvalidProtocolVersion,

    #[msg("Unsupported message type")]
    InvalidMessageType,

    #[msg("Invalid ABI encoded message")]
    InvalidAbiEncoding,

    #[msg("Invalid message length")]
    InvalidMessageLength,

    #[msg("Receiver cannot be zero")]
    ZeroReceiver,

    #[msg("Message data cannot be empty")]
    EmptyPayload,

    #[msg("Message data exceeds maximum size")]
    PayloadTooLarge,

    #[msg("Outbound nonce overflow")]
    NonceOverflow,

    #[msg("Invalid timestamp")]
    InvalidTimestamp,

    #[msg("Invalid LayerZero endpoint")]
    InvalidEndpoint,

    #[msg("Store admin must be the initializing signer")]
    AdminMustBePayer,

    #[msg("Peer address cannot be zero")]
    InvalidPeerAddress,

    #[msg("Invalid received-message PDA")]
    InvalidReceiptAccount,

    #[msg("Logical application message has already been processed")]
    DuplicateMessageId,

    #[msg("Missing LayerZero clear accounts")]
    MissingClearAccounts,
}
