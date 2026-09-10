use crate::errors::MyOAppError;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;

pub const PROTOCOL_VERSION: u8 = 1;
pub const MESSAGE_TYPE_GENERIC: u8 = 1;
pub const MAX_DATA_SIZE: usize = 4_096;

const ABI_WORD_SIZE: usize = 32;
const ABI_HEAD_WORDS: usize = 7;
const ABI_HEAD_SIZE: usize = ABI_WORD_SIZE * ABI_HEAD_WORDS; // 224
const ABI_DATA_START: usize = ABI_HEAD_SIZE + ABI_WORD_SIZE; // 256

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CrossChainMessage {
    pub version: u8,
    pub message_type: u8,
    pub nonce: u64,
    pub sender: [u8; 32],
    pub receiver: [u8; 32],
    pub timestamp: u64,
    pub data: Vec<u8>,
}

pub fn validate(message: &CrossChainMessage) -> Result<()> {
    require!(message.version == PROTOCOL_VERSION, MyOAppError::InvalidProtocolVersion);

    require!(message.message_type == MESSAGE_TYPE_GENERIC, MyOAppError::InvalidMessageType);

    require!(message.receiver != [0u8; 32], MyOAppError::ZeroReceiver);

    require!(!message.data.is_empty(), MyOAppError::EmptyPayload);

    require!(message.data.len() <= MAX_DATA_SIZE, MyOAppError::PayloadTooLarge);

    Ok(())
}

/// Solidity compatible:
///
/// abi.encode(
///     uint8 version,
///     uint8 messageType,
///     uint64 nonce,
///     bytes32 sender,
///     bytes32 receiver,
///     uint64 timestamp,
///     bytes data
/// )
pub fn encode(message: &CrossChainMessage) -> Result<Vec<u8>> {
    validate(message)?;

    let padded_data_len = padded_32(message.data.len())?;

    let total_len = ABI_DATA_START
        .checked_add(padded_data_len)
        .ok_or(MyOAppError::InvalidMessageLength)?;

    let mut encoded = vec![0u8; total_len];

    write_u8_word(&mut encoded, 0, message.version);
    write_u8_word(&mut encoded, 1, message.message_type);
    write_u64_word(&mut encoded, 2, message.nonce);

    encoded[3 * ABI_WORD_SIZE..4 * ABI_WORD_SIZE].copy_from_slice(&message.sender);

    encoded[4 * ABI_WORD_SIZE..5 * ABI_WORD_SIZE].copy_from_slice(&message.receiver);

    write_u64_word(&mut encoded, 5, message.timestamp);

    // Dynamic bytes offset. With seven ABI arguments the dynamic section
    // starts after the 7-word / 224-byte head.
    write_usize_word(&mut encoded, 6, ABI_HEAD_SIZE)?;

    // Dynamic bytes length.
    write_usize_at(&mut encoded, ABI_HEAD_SIZE, message.data.len())?;

    let data_end = ABI_DATA_START
        .checked_add(message.data.len())
        .ok_or(MyOAppError::InvalidMessageLength)?;

    encoded[ABI_DATA_START..data_end].copy_from_slice(&message.data);

    // Remaining bytes are already zero-initialized ABI padding.
    Ok(encoded)
}

pub fn decode(payload: &[u8]) -> Result<CrossChainMessage> {
    require!(payload.len() >= ABI_DATA_START, MyOAppError::InvalidMessageLength);

    let version = read_u8_word(payload, 0)?;
    let message_type = read_u8_word(payload, 1)?;
    let nonce = read_u64_word(payload, 2)?;

    let mut sender = [0u8; 32];
    sender.copy_from_slice(
        payload
            .get(3 * ABI_WORD_SIZE..4 * ABI_WORD_SIZE)
            .ok_or(MyOAppError::InvalidAbiEncoding)?,
    );

    let mut receiver = [0u8; 32];
    receiver.copy_from_slice(
        payload
            .get(4 * ABI_WORD_SIZE..5 * ABI_WORD_SIZE)
            .ok_or(MyOAppError::InvalidAbiEncoding)?,
    );

    let timestamp = read_u64_word(payload, 5)?;

    let dynamic_offset = read_usize_word(payload, 6)?;

    // MessageCodec.sol uses abi.encode with exactly seven fields, so the
    // canonical dynamic offset is always 224.
    require!(dynamic_offset == ABI_HEAD_SIZE, MyOAppError::InvalidAbiEncoding);

    let data_len = read_usize_at(payload, dynamic_offset)?;

    require!(data_len <= MAX_DATA_SIZE, MyOAppError::PayloadTooLarge);

    let padded_data_len = padded_32(data_len)?;

    let expected_total = ABI_DATA_START
        .checked_add(padded_data_len)
        .ok_or(MyOAppError::InvalidMessageLength)?;

    require!(payload.len() == expected_total, MyOAppError::InvalidMessageLength);

    let data_end = ABI_DATA_START.checked_add(data_len).ok_or(MyOAppError::InvalidMessageLength)?;

    let data = payload
        .get(ABI_DATA_START..data_end)
        .ok_or(MyOAppError::InvalidMessageLength)?
        .to_vec();

    // Solidity abi.encode pads dynamic byte arrays with zeros.
    let padding = payload.get(data_end..expected_total).ok_or(MyOAppError::InvalidMessageLength)?;

    require!(padding.iter().all(|byte| *byte == 0), MyOAppError::InvalidAbiEncoding);

    Ok(CrossChainMessage { version, message_type, nonce, sender, receiver, timestamp, data })
}

/// Matches:
///
/// keccak256(abi.encode(srcEid, sourceRouter, nonce))
pub fn compute_message_id(src_eid: u32, source_router: [u8; 32], nonce: u64) -> [u8; 32] {
    // abi.encode(uint32, bytes32, uint64)
    let mut encoded = [0u8; 96];

    // uint32 occupies the final 4 bytes of its 32-byte ABI slot.
    encoded[28..32].copy_from_slice(&src_eid.to_be_bytes());

    // bytes32 occupies the complete second slot.
    encoded[32..64].copy_from_slice(&source_router);

    // uint64 occupies the final 8 bytes of the third slot.
    encoded[88..96].copy_from_slice(&nonce.to_be_bytes());

    keccak::hash(&encoded).to_bytes()
}

fn padded_32(len: usize) -> Result<usize> {
    len.checked_add(ABI_WORD_SIZE - 1)
        .and_then(|value| value.checked_div(ABI_WORD_SIZE))
        .and_then(|value| value.checked_mul(ABI_WORD_SIZE))
        .ok_or_else(|| error!(MyOAppError::InvalidMessageLength))
}

fn write_u8_word(buffer: &mut [u8], word_index: usize, value: u8) {
    let end = (word_index + 1) * ABI_WORD_SIZE;
    buffer[end - 1] = value;
}

fn write_u64_word(buffer: &mut [u8], word_index: usize, value: u64) {
    let start = word_index * ABI_WORD_SIZE;
    buffer[start + 24..start + 32].copy_from_slice(&value.to_be_bytes());
}

fn write_usize_word(buffer: &mut [u8], word_index: usize, value: usize) -> Result<()> {
    let start = word_index.checked_mul(ABI_WORD_SIZE).ok_or(MyOAppError::InvalidMessageLength)?;

    write_usize_at(buffer, start, value)
}

fn write_usize_at(buffer: &mut [u8], start: usize, value: usize) -> Result<()> {
    let end = start.checked_add(ABI_WORD_SIZE).ok_or(MyOAppError::InvalidMessageLength)?;

    require!(end <= buffer.len(), MyOAppError::InvalidMessageLength);

    let value = u64::try_from(value).map_err(|_| error!(MyOAppError::InvalidMessageLength))?;

    buffer[start + 24..start + 32].copy_from_slice(&value.to_be_bytes());

    Ok(())
}

fn read_u8_word(payload: &[u8], word_index: usize) -> Result<u8> {
    let start = word_index.checked_mul(ABI_WORD_SIZE).ok_or(MyOAppError::InvalidAbiEncoding)?;

    let end = start.checked_add(ABI_WORD_SIZE).ok_or(MyOAppError::InvalidAbiEncoding)?;

    let word = payload.get(start..end).ok_or(MyOAppError::InvalidAbiEncoding)?;

    require!(word[..31].iter().all(|byte| *byte == 0), MyOAppError::InvalidAbiEncoding);

    Ok(word[31])
}

fn read_u64_word(payload: &[u8], word_index: usize) -> Result<u64> {
    let start = word_index.checked_mul(ABI_WORD_SIZE).ok_or(MyOAppError::InvalidAbiEncoding)?;

    read_u64_at(payload, start)
}

fn read_u64_at(payload: &[u8], start: usize) -> Result<u64> {
    let end = start.checked_add(ABI_WORD_SIZE).ok_or(MyOAppError::InvalidAbiEncoding)?;

    let word = payload.get(start..end).ok_or(MyOAppError::InvalidAbiEncoding)?;

    require!(word[..24].iter().all(|byte| *byte == 0), MyOAppError::InvalidAbiEncoding);

    let bytes: [u8; 8] =
        word[24..32].try_into().map_err(|_| error!(MyOAppError::InvalidAbiEncoding))?;

    Ok(u64::from_be_bytes(bytes))
}

fn read_usize_word(payload: &[u8], word_index: usize) -> Result<usize> {
    let start = word_index.checked_mul(ABI_WORD_SIZE).ok_or(MyOAppError::InvalidAbiEncoding)?;

    read_usize_at(payload, start)
}

fn read_usize_at(payload: &[u8], start: usize) -> Result<usize> {
    let value = read_u64_at(payload, start)?;

    usize::try_from(value).map_err(|_| error!(MyOAppError::InvalidMessageLength))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn example_message() -> CrossChainMessage {
        CrossChainMessage {
            version: PROTOCOL_VERSION,
            message_type: MESSAGE_TYPE_GENERIC,
            nonce: 7,
            sender: [1u8; 32],
            receiver: [2u8; 32],
            timestamp: 1_700_000_000,
            data: b"hello".to_vec(),
        }
    }

    #[test]
    fn test_encode_decode_round_trip() {
        let message = example_message();

        let encoded = encode(&message).unwrap();
        let decoded = decode(&encoded).unwrap();

        assert_eq!(decoded, message);
    }

    #[test]
    fn test_solidity_abi_layout() {
        let encoded = encode(&example_message()).unwrap();

        // println!(
        //     "RUST_ABI=0x{}",
        //     encoded
        //     .iter()
        //     .map(|byte| format!("{:02x}", byte))
        //     .collect::<String>()
        // );

        // uint8 version
        assert_eq!(encoded[31], PROTOCOL_VERSION);

        // uint8 message type
        assert_eq!(encoded[63], MESSAGE_TYPE_GENERIC);

        // uint64 nonce
        assert_eq!(&encoded[88..96], &7u64.to_be_bytes());

        // dynamic bytes offset = 224 / 0xe0
        assert_eq!(&encoded[216..224], &224u64.to_be_bytes());

        // data length = 5
        assert_eq!(&encoded[248..256], &5u64.to_be_bytes());

        assert_eq!(&encoded[256..261], b"hello");

        // 224-byte head + 32-byte length + 32-byte padded data.
        assert_eq!(encoded.len(), 288);
    }
}
