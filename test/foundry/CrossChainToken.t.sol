// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {CrossChainToken} from "../../contracts/CrossChainToken.sol";

import {SendParam} from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";

import {MessagingFee} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";

import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";

import {TestHelperOz5} from "@layerzerolabs/test-devtools-evm-foundry/contracts/TestHelperOz5.sol";

import {IOFT, SendParam} from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";

contract CrossChainTokenTest is TestHelperOz5 {
    using OptionsBuilder for bytes;

    uint32 private constant A_EID = 1;
    uint32 private constant B_EID = 2;

    uint128 private constant RECEIVE_GAS = 100_000;

    uint256 private constant INITIAL_SUPPLY = 1_000_000 ether;

    address private constant USER_A = address(0xA11CE);

    address private constant USER_B = address(0xB0B);

    CrossChainToken private aToken;
    CrossChainToken private bToken;

    uint256 private constant DECIMAL_CONVERSION_RATE = 1e12;

    function setUp() public override {
        super.setUp();

        vm.deal(USER_A, 100 ether);

        vm.deal(USER_B, 100 ether);

        setUpEndpoints(2, LibraryType.UltraLightNode);

        // Chain A is the initial/canonical supply chain.
        aToken = CrossChainToken(
            _deployOApp(
                type(CrossChainToken).creationCode,
                abi.encode("Cross Chain Token", "CCT", address(endpoints[A_EID]), address(this), USER_A, INITIAL_SUPPLY)
            )
        );

        // Chain B starts with zero supply.
        bToken = CrossChainToken(
            _deployOApp(
                type(CrossChainToken).creationCode,
                abi.encode("Cross Chain Token", "CCT", address(endpoints[B_EID]), address(this), address(0), 0)
            )
        );

        address[] memory oapps = new address[](2);

        oapps[0] = address(aToken);
        oapps[1] = address(bToken);

        this.wireOApps(oapps);
    }

    function test_constructor() public view {
        assertEq(aToken.name(), "Cross Chain Token");

        assertEq(aToken.symbol(), "CCT");

        assertEq(aToken.owner(), address(this));

        assertEq(aToken.totalSupply(), INITIAL_SUPPLY);

        assertEq(bToken.totalSupply(), 0);

        assertEq(aToken.balanceOf(USER_A), INITIAL_SUPPLY);
    }

    function test_initialSupplyOnlyExistsOnSourceChain() public view {
        assertEq(aToken.totalSupply(), INITIAL_SUPPLY);

        assertEq(bToken.totalSupply(), 0);

        assertEq(aToken.totalSupply() + bToken.totalSupply(), INITIAL_SUPPLY);
    }

    function test_crossChainTokenTransfer() public {
        uint256 amount = 10 ether;

        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(RECEIVE_GAS, 0);

        SendParam memory sendParam = SendParam({
            dstEid: B_EID,
            to: addressToBytes32(USER_B),
            amountLD: amount,
            minAmountLD: amount,
            extraOptions: options,
            composeMsg: "",
            oftCmd: ""
        });

        vm.prank(USER_A);

        MessagingFee memory fee = aToken.quoteSend(sendParam, false);

        uint256 sourceSupplyBefore = aToken.totalSupply();

        uint256 destinationSupplyBefore = bToken.totalSupply();

        vm.prank(USER_A);

        aToken.send{value: fee.nativeFee}(sendParam, fee, USER_A);

        verifyPackets(B_EID, addressToBytes32(address(bToken)));

        // Tokens burned from USER_A on chain A.
        assertEq(aToken.balanceOf(USER_A), INITIAL_SUPPLY - amount);

        // Same amount minted to USER_B on chain B.
        assertEq(bToken.balanceOf(USER_B), amount);

        assertEq(aToken.totalSupply(), sourceSupplyBefore - amount);

        assertEq(bToken.totalSupply(), destinationSupplyBefore + amount);

        // Global supply remains unchanged.
        assertEq(aToken.totalSupply() + bToken.totalSupply(), INITIAL_SUPPLY);
    }

    function test_revertWhenAmountBelowSharedPrecision() public {
        uint256 amount = 1;

        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(RECEIVE_GAS, 0);

        SendParam memory sendParam = SendParam({
            dstEid: B_EID,
            to: addressToBytes32(USER_B),
            amountLD: amount,
            minAmountLD: amount,
            extraOptions: options,
            composeMsg: "",
            oftCmd: ""
        });

        vm.expectRevert(abi.encodeWithSelector(IOFT.SlippageExceeded.selector, 0, amount));

        aToken.quoteSend(sendParam, false);
    }

    function test_dustIsNotLost() public {
        uint256 cleanAmount = 1 ether;

        uint256 dust = 123_456_789;

        uint256 requestedAmount = cleanAmount + dust;

        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(RECEIVE_GAS, 0);

        SendParam memory sendParam = SendParam({
            dstEid: B_EID,
            to: addressToBytes32(USER_B),
            amountLD: requestedAmount,
            minAmountLD: cleanAmount,
            extraOptions: options,
            composeMsg: "",
            oftCmd: ""
        });

        uint256 sourceBalanceBefore = aToken.balanceOf(USER_A);

        vm.prank(USER_A);

        MessagingFee memory fee = aToken.quoteSend(sendParam, false);

        vm.prank(USER_A);

        aToken.send{value: fee.nativeFee}(sendParam, fee, USER_A);

        verifyPackets(B_EID, addressToBytes32(address(bToken)));

        // Only the transferable amount is burned.
        assertEq(aToken.balanceOf(USER_A), sourceBalanceBefore - cleanAmount);

        // Destination receives only the normalized amount.
        assertEq(bToken.balanceOf(USER_B), cleanAmount);

        // Global supply remains unchanged.
        assertEq(aToken.totalSupply() + bToken.totalSupply(), INITIAL_SUPPLY);
    }

    function test_revertWhenSendingMoreThanBalance() public {
        uint256 amount = INITIAL_SUPPLY + 1 ether;

        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(RECEIVE_GAS, 0);

        SendParam memory sendParam = SendParam({
            dstEid: B_EID,
            to: addressToBytes32(USER_B),
            amountLD: amount,
            minAmountLD: amount,
            extraOptions: options,
            composeMsg: "",
            oftCmd: ""
        });

        vm.prank(USER_A);

        MessagingFee memory fee = aToken.quoteSend(sendParam, false);

        vm.prank(USER_A);

        vm.expectRevert();

        aToken.send{value: fee.nativeFee}(sendParam, fee, USER_A);
    }
}
