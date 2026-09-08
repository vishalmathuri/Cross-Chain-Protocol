// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {OApp, Origin, MessagingFee, MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";

import {OAppOptionsType3} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {MessageCodec} from "./libraries/MessageCodec.sol";

/// @title CrossChainRouter
/// @notice Production-style cross-chain messaging router built using LayerZero V2.
/// @dev Supports authenticated messaging, replay protection, payload validation,
///      destination controls, rate limiting and emergency pause functionality.
contract CrossChainRouter is OApp, OAppOptionsType3, Pausable {
    // =============================================================
    //                          CONSTANTS
    // =============================================================

    /// @notice Current application protocol version.
    uint8 public constant PROTOCOL_VERSION = 1;

    /// @notice Generic cross-chain message type.
    uint8 public constant MESSAGE_TYPE_GENERIC = 1;

    /// @notice LayerZero OptionsType3 message identifier.
    uint16 public constant SEND_MESSAGE = 1;

    /// @notice Maximum arbitrary application data allowed in one message.
    uint256 public constant MAX_DATA_SIZE = 4_096;

    // =============================================================
    //                            STATE
    // =============================================================

    /// @notice Application-level nonce incremented for every outbound message.
    uint64 public outboundNonce;

    /// @notice Number of successfully processed inbound messages.
    uint64 public receivedCount;

    /// @notice GUID of the most recently processed LayerZero message.
    bytes32 public lastReceivedGuid;

    /// @notice LayerZero GUID replay protection.
    mapping(bytes32 guid => bool processed) public processedGuids;

    /// @notice Application-level logical message replay protection.
    mapping(bytes32 messageId => bool processed) public processedMessageIds;

    /// @notice Last successfully received application message.
    MessageCodec.CrossChainMessage private _lastReceivedMessage;

    // =============================================================
    //                    DESTINATION CONFIGURATION
    // =============================================================

    struct DestinationConfig {
        bool enabled;
        uint256 maxMessagesPerWindow;
        uint256 windowSeconds;
        uint256 windowStart;
        uint256 messagesSent;
    }

    /// @notice Configuration and rate-limit state for each destination EID.
    mapping(uint32 dstEid => DestinationConfig config) public destinationConfigs;

    // =============================================================
    //                            ERRORS
    // =============================================================

    error ZeroReceiver();

    error EmptyPayload();

    error PayloadTooLarge(uint256 size, uint256 maxSize);

    error UnsupportedProtocolVersion(uint8 version);

    error UnsupportedMessageType(uint8 messageType);

    error DuplicateMessage(bytes32 guid);

    error DuplicateMessageId(bytes32 messageId);

    error DestinationDisabled(uint32 dstEid);

    error InvalidRateLimit();

    error RateLimitExceeded(uint32 dstEid);

    // =============================================================
    //                            EVENTS
    // =============================================================

    event MessageSent(
        bytes32 indexed guid, uint32 indexed dstEid, uint64 indexed nonce, bytes32 sender, bytes32 receiver, bytes data
    );

    event MessageReceived(
        bytes32 indexed guid, uint32 indexed srcEid, uint64 indexed nonce, bytes32 sender, bytes32 receiver, bytes data
    );

    event DestinationConfigured(
        uint32 indexed dstEid, bool enabled, uint256 maxMessagesPerWindow, uint256 windowSeconds
    );

    event ProtocolPaused(address indexed account);

    event ProtocolUnpaused(address indexed account);

    // =============================================================
    //                          CONSTRUCTOR
    // =============================================================

    /// @param endpoint_ LayerZero Endpoint V2 address for this chain.
    /// @param owner_ Owner responsible for protocol configuration.
    constructor(address endpoint_, address owner_) OApp(endpoint_, owner_) Ownable(owner_) {}

    // =============================================================
    //                    ADMIN CONFIGURATION
    // =============================================================

    /// @notice Configures a destination chain and its message rate limit.
    /// @param dstEid LayerZero destination endpoint ID.
    /// @param enabled Whether sending to the destination is allowed.
    /// @param maxMessagesPerWindow Maximum messages allowed per window.
    /// @param windowSeconds Duration of one rate-limit window.
    function configureDestination(uint32 dstEid, bool enabled, uint256 maxMessagesPerWindow, uint256 windowSeconds)
        external
        onlyOwner
    {
        if (maxMessagesPerWindow == 0 || windowSeconds == 0) {
            revert InvalidRateLimit();
        }

        DestinationConfig storage config = destinationConfigs[dstEid];

        config.enabled = enabled;

        config.maxMessagesPerWindow = maxMessagesPerWindow;

        config.windowSeconds = windowSeconds;

        config.windowStart = block.timestamp;

        config.messagesSent = 0;

        emit DestinationConfigured(dstEid, enabled, maxMessagesPerWindow, windowSeconds);
    }

    /// @notice Emergency pause for outbound protocol operations.
    function pause() external onlyOwner {
        _pause();

        emit ProtocolPaused(msg.sender);
    }

    /// @notice Restores outbound protocol operations.
    function unpause() external onlyOwner {
        _unpause();

        emit ProtocolUnpaused(msg.sender);
    }

    // =============================================================
    //                         FEE QUOTING
    // =============================================================

    /// @notice Quotes the LayerZero fee required to send a message.
    function quoteMessage(uint32 dstEid, bytes32 receiver, bytes calldata data, bytes calldata options)
        external
        view
        returns (MessagingFee memory fee)
    {
        _validateDestination(dstEid);

        _validatePayload(receiver, data);

        MessageCodec.CrossChainMessage memory message = _buildMessage(outboundNonce + 1, msg.sender, receiver, data);

        bytes memory payload = MessageCodec.encode(message);

        fee = _quote(dstEid, payload, combineOptions(dstEid, SEND_MESSAGE, options), false);
    }

    // =============================================================
    //                        MESSAGE SENDING
    // =============================================================

    /// @notice Sends an application message to another configured chain.
    function sendMessage(uint32 dstEid, bytes32 receiver, bytes calldata data, bytes calldata options)
        external
        payable
        whenNotPaused
        returns (MessagingReceipt memory receipt)
    {
        _validateDestination(dstEid);

        _validatePayload(receiver, data);

        _consumeRateLimit(dstEid);

        uint64 nonce = ++outboundNonce;

        MessageCodec.CrossChainMessage memory message = _buildMessage(nonce, msg.sender, receiver, data);

        bytes memory payload = MessageCodec.encode(message);

        receipt = _lzSend(
            dstEid,
            payload,
            combineOptions(dstEid, SEND_MESSAGE, options),
            MessagingFee({nativeFee: msg.value, lzTokenFee: 0}),
            payable(msg.sender)
        );

        emit MessageSent(receipt.guid, dstEid, nonce, message.sender, receiver, data);
    }

    // =============================================================
    //                       MESSAGE RECEIVING
    // =============================================================

    /// @dev Called after LayerZero Endpoint and peer validation succeeds.
    function _lzReceive(Origin calldata origin, bytes32 guid, bytes calldata payload, address, bytes calldata)
        internal
        override
    {
        // ---------------------------------------------------------
        // LayerZero GUID replay protection
        // ---------------------------------------------------------

        if (processedGuids[guid]) {
            revert DuplicateMessage(guid);
        }

        // ---------------------------------------------------------
        // Decode application payload
        // ---------------------------------------------------------

        MessageCodec.CrossChainMessage memory message = MessageCodec.decode(payload);

        // ---------------------------------------------------------
        // Protocol-version validation
        // ---------------------------------------------------------

        if (message.version != PROTOCOL_VERSION) {
            revert UnsupportedProtocolVersion(message.version);
        }

        // ---------------------------------------------------------
        // Message-type validation
        // ---------------------------------------------------------

        if (message.messageType != MESSAGE_TYPE_GENERIC) {
            revert UnsupportedMessageType(message.messageType);
        }

        // ---------------------------------------------------------
        // Payload validation
        // ---------------------------------------------------------

        _validatePayload(message.receiver, message.data);

        // ---------------------------------------------------------
        // Logical application-message replay protection
        // ---------------------------------------------------------

        bytes32 messageId = computeMessageId(origin.srcEid, origin.sender, message.nonce);

        if (processedMessageIds[messageId]) {
            revert DuplicateMessageId(messageId);
        }

        // ---------------------------------------------------------
        // Effects
        // ---------------------------------------------------------

        processedGuids[guid] = true;

        processedMessageIds[messageId] = true;

        ++receivedCount;

        lastReceivedGuid = guid;

        _lastReceivedMessage = message;

        // ---------------------------------------------------------
        // Event
        // ---------------------------------------------------------

        emit MessageReceived(guid, origin.srcEid, message.nonce, message.sender, message.receiver, message.data);
    }

    // =============================================================
    //                          VIEW HELPERS
    // =============================================================

    /// @notice Returns the most recently processed application message.
    function getLastReceivedMessage()
        external
        view
        returns (
            uint8 version,
            uint8 messageType,
            uint64 nonce,
            bytes32 sender,
            bytes32 receiver,
            uint64 timestamp,
            bytes memory data
        )
    {
        MessageCodec.CrossChainMessage storage message = _lastReceivedMessage;

        return (
            message.version,
            message.messageType,
            message.nonce,
            message.sender,
            message.receiver,
            message.timestamp,
            message.data
        );
    }

    /// @notice Creates the logical application message ID.
    /// @dev Combines source chain, source router and application nonce.
    function computeMessageId(uint32 srcEid, bytes32 sourceRouter, uint64 nonce) public pure returns (bytes32) {
        return keccak256(abi.encode(srcEid, sourceRouter, nonce));
    }

    /// @notice Converts an EVM address into the protocol's bytes32 format.
    function addressToBytes32(address account) public pure returns (bytes32) {
        return bytes32(uint256(uint160(account)));
    }

    // =============================================================
    //                      INTERNAL HELPERS
    // =============================================================

    function _buildMessage(uint64 nonce, address sender, bytes32 receiver, bytes memory data)
        internal
        view
        returns (MessageCodec.CrossChainMessage memory)
    {
        return MessageCodec.CrossChainMessage({
            version: PROTOCOL_VERSION,
            messageType: MESSAGE_TYPE_GENERIC,
            nonce: nonce,
            sender: addressToBytes32(sender),
            receiver: receiver,
            // uint64 is sufficient for Unix timestamps for
            // an extremely long period of time.
            timestamp: uint64(block.timestamp),
            data: data
        });
    }

    /// @notice Validates receiver and application payload.
    function _validatePayload(bytes32 receiver, bytes memory data) internal pure {
        if (receiver == bytes32(0)) {
            revert ZeroReceiver();
        }

        if (data.length == 0) {
            revert EmptyPayload();
        }

        if (data.length > MAX_DATA_SIZE) {
            revert PayloadTooLarge(data.length, MAX_DATA_SIZE);
        }
    }

    /// @notice Ensures a destination is enabled.
    function _validateDestination(uint32 dstEid) internal view {
        if (!destinationConfigs[dstEid].enabled) {
            revert DestinationDisabled(dstEid);
        }
    }

    /// @notice Consumes one message from a destination's rate-limit window.
    function _consumeRateLimit(uint32 dstEid) internal {
        DestinationConfig storage config = destinationConfigs[dstEid];

        // Start a new rate-limit window when
        // the previous one has expired.
        if (block.timestamp >= config.windowStart + config.windowSeconds) {
            config.windowStart = block.timestamp;

            config.messagesSent = 0;
        }

        if (config.messagesSent >= config.maxMessagesPerWindow) {
            revert RateLimitExceeded(dstEid);
        }

        ++config.messagesSent;
    }
}
