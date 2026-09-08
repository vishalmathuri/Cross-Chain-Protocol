// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {CrossChainRouter} from "../../contracts/CrossChainRouter.sol";

import {MessagingFee} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";

import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";

import {TestHelperOz5} from "@layerzerolabs/test-devtools-evm-foundry/contracts/TestHelperOz5.sol";

import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract CrossChainRouterTest is TestHelperOz5 {
    using OptionsBuilder for bytes;

    uint32 private constant A_EID = 1;
    uint32 private constant B_EID = 2;

    uint128 private constant RECEIVE_GAS = 500_000;

    address private constant USER_A = address(0xA11CE);
    address private constant USER_B = address(0xB0B);

    CrossChainRouter private aRouter;
    CrossChainRouter private bRouter;

    function setUp() public override {
        super.setUp();

        vm.deal(USER_A, 100 ether);
        vm.deal(USER_B, 100 ether);

        setUpEndpoints(2, LibraryType.UltraLightNode);

        aRouter = CrossChainRouter(
            _deployOApp(type(CrossChainRouter).creationCode, abi.encode(address(endpoints[A_EID]), address(this)))
        );

        bRouter = CrossChainRouter(
            _deployOApp(type(CrossChainRouter).creationCode, abi.encode(address(endpoints[B_EID]), address(this)))
        );

        address[] memory oapps = new address[](2);

        oapps[0] = address(aRouter);
        oapps[1] = address(bRouter);

        this.wireOApps(oapps);

        // Enable A -> B
        aRouter.configureDestination(B_EID, true, 100, 1 hours);

        // Enable B -> A
        bRouter.configureDestination(A_EID, true, 100, 1 hours);
    }

    function test_constructor() public view {
        assertEq(aRouter.owner(), address(this));

        assertEq(bRouter.owner(), address(this));

        assertEq(address(aRouter.endpoint()), address(endpoints[A_EID]));

        assertEq(address(bRouter.endpoint()), address(endpoints[B_EID]));

        assertEq(aRouter.outboundNonce(), 0);

        assertEq(bRouter.receivedCount(), 0);
    }

    function test_sendMessage() public {
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(RECEIVE_GAS, 0);

        bytes memory data = bytes("Hello from chain A");

        bytes32 receiver = aRouter.addressToBytes32(USER_B);

        vm.prank(USER_A);

        MessagingFee memory fee = aRouter.quoteMessage(B_EID, receiver, data, options);

        vm.prank(USER_A);

        aRouter.sendMessage{value: fee.nativeFee}(B_EID, receiver, data, options);

        verifyPackets(B_EID, addressToBytes32(address(bRouter)));

        bytes32 messageId = bRouter.computeMessageId(A_EID, addressToBytes32(address(aRouter)), 1);

        assertTrue(bRouter.processedMessageIds(messageId));

        assertEq(aRouter.outboundNonce(), 1);

        assertEq(bRouter.receivedCount(), 1);

        (
            uint8 version,
            uint8 messageType,
            uint64 nonce,
            bytes32 sender,
            bytes32 receivedReceiver,,
            bytes memory receivedData
        ) = bRouter.getLastReceivedMessage();

        assertEq(version, 1);
        assertEq(messageType, 1);
        assertEq(nonce, 1);

        assertEq(sender, bytes32(uint256(uint160(USER_A))));

        assertEq(receivedReceiver, receiver);

        assertEq(keccak256(receivedData), keccak256(data));

        assertTrue(bRouter.processedGuids(bRouter.lastReceivedGuid()));
    }

    function test_revertWhenReceiverIsZero() public {
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(RECEIVE_GAS, 0);

        vm.expectRevert(CrossChainRouter.ZeroReceiver.selector);

        aRouter.quoteMessage(B_EID, bytes32(0), bytes("message"), options);
    }

    function test_revertWhenPayloadIsEmpty() public {
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(RECEIVE_GAS, 0);

        bytes32 receiver = aRouter.addressToBytes32(USER_B);

        vm.expectRevert(CrossChainRouter.EmptyPayload.selector);

        aRouter.quoteMessage(B_EID, receiver, bytes(""), options);
    }

    function test_revertWhenPayloadTooLarge() public {
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(RECEIVE_GAS, 0);

        bytes32 receiver = aRouter.addressToBytes32(USER_B);

        bytes memory oversizedData = new bytes(4_097);

        vm.expectRevert(abi.encodeWithSelector(CrossChainRouter.PayloadTooLarge.selector, 4_097, 4_096));

        aRouter.quoteMessage(B_EID, receiver, oversizedData, options);
    }

    function test_multipleMessagesUseDifferentNonces() public {
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(RECEIVE_GAS, 0);

        bytes32 receiver = aRouter.addressToBytes32(USER_B);

        bytes memory first = bytes("first");

        bytes memory second = bytes("second");

        vm.startPrank(USER_A);

        MessagingFee memory firstFee = aRouter.quoteMessage(B_EID, receiver, first, options);

        aRouter.sendMessage{value: firstFee.nativeFee}(B_EID, receiver, first, options);

        MessagingFee memory secondFee = aRouter.quoteMessage(B_EID, receiver, second, options);

        aRouter.sendMessage{value: secondFee.nativeFee}(B_EID, receiver, second, options);

        vm.stopPrank();

        verifyPackets(B_EID, addressToBytes32(address(bRouter)));

        assertEq(aRouter.outboundNonce(), 2);

        assertEq(bRouter.receivedCount(), 2);

        bytes32 firstId = bRouter.computeMessageId(A_EID, addressToBytes32(address(aRouter)), 1);

        bytes32 secondId = bRouter.computeMessageId(A_EID, addressToBytes32(address(aRouter)), 2);

        assertTrue(bRouter.processedMessageIds(firstId));

        assertTrue(bRouter.processedMessageIds(secondId));

        assertTrue(firstId != secondId);
    }

    function test_revertWhenDestinationDisabled() public {
        uint32 disabledEid = 99;

        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(RECEIVE_GAS, 0);

        bytes32 receiver = aRouter.addressToBytes32(USER_B);

        vm.expectRevert(abi.encodeWithSelector(CrossChainRouter.DestinationDisabled.selector, disabledEid));

        aRouter.quoteMessage(disabledEid, receiver, bytes("hello"), options);
    }

    function test_pauseBlocksSending() public {
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(RECEIVE_GAS, 0);

        bytes32 receiver = aRouter.addressToBytes32(USER_B);

        bytes memory data = bytes("hello");

        MessagingFee memory fee = aRouter.quoteMessage(B_EID, receiver, data, options);

        aRouter.pause();

        vm.prank(USER_A);

        vm.expectRevert(Pausable.EnforcedPause.selector);

        aRouter.sendMessage{value: fee.nativeFee}(B_EID, receiver, data, options);
    }

    function test_unpauseRestoresSending() public {
        aRouter.pause();

        assertTrue(aRouter.paused());

        aRouter.unpause();

        assertFalse(aRouter.paused());
    }

    function test_nonOwnerCannotPause() public {
        vm.prank(USER_A);

        vm.expectRevert();

        aRouter.pause();
    }

    function test_nonOwnerCannotUnpause() public {
        aRouter.pause();

        vm.prank(USER_A);

        vm.expectRevert();

        aRouter.unpause();
    }

    function test_rateLimitBlocksExcessMessages() public {
        aRouter.configureDestination(B_EID, true, 2, 1 hours);

        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(RECEIVE_GAS, 0);

        bytes32 receiver = aRouter.addressToBytes32(USER_B);

        bytes memory data = bytes("rate-limit-test");

        vm.startPrank(USER_A);

        MessagingFee memory fee1 = aRouter.quoteMessage(B_EID, receiver, data, options);

        aRouter.sendMessage{value: fee1.nativeFee}(B_EID, receiver, data, options);

        MessagingFee memory fee2 = aRouter.quoteMessage(B_EID, receiver, data, options);

        aRouter.sendMessage{value: fee2.nativeFee}(B_EID, receiver, data, options);

        MessagingFee memory fee3 = aRouter.quoteMessage(B_EID, receiver, data, options);

        vm.expectRevert(abi.encodeWithSelector(CrossChainRouter.RateLimitExceeded.selector, B_EID));

        aRouter.sendMessage{value: fee3.nativeFee}(B_EID, receiver, data, options);

        vm.stopPrank();
    }

    function test_rateLimitResetsAfterWindow() public {
        aRouter.configureDestination(B_EID, true, 1, 1 hours);

        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(RECEIVE_GAS, 0);

        bytes32 receiver = aRouter.addressToBytes32(USER_B);

        bytes memory data = bytes("hello");

        vm.startPrank(USER_A);

        MessagingFee memory firstFee = aRouter.quoteMessage(B_EID, receiver, data, options);

        aRouter.sendMessage{value: firstFee.nativeFee}(B_EID, receiver, data, options);

        vm.stopPrank();

        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(USER_A);

        MessagingFee memory secondFee = aRouter.quoteMessage(B_EID, receiver, data, options);

        vm.prank(USER_A);

        aRouter.sendMessage{value: secondFee.nativeFee}(B_EID, receiver, data, options);

        assertEq(aRouter.outboundNonce(), 2);
    }
}
