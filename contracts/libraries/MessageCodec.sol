// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @title MessageCodec
/// @notice Encoding and decoding utilities for CrossChainRouter messages.
library MessageCodec {
    struct CrossChainMessage {
        uint8 version;
        uint8 messageType;
        uint64 nonce;
        bytes32 sender;
        bytes32 receiver;
        uint64 timestamp;
        bytes data;
    }

    function encode(CrossChainMessage memory message) internal pure returns (bytes memory) {
        return abi.encode(
            message.version,
            message.messageType,
            message.nonce,
            message.sender,
            message.receiver,
            message.timestamp,
            message.data
        );
    }

    function decode(bytes calldata payload) internal pure returns (CrossChainMessage memory message) {
        (
            message.version,
            message.messageType,
            message.nonce,
            message.sender,
            message.receiver,
            message.timestamp,
            message.data
        ) = abi.decode(payload, (uint8, uint8, uint64, bytes32, bytes32, uint64, bytes));
    }
}
