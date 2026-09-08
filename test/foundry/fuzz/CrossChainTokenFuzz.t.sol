// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {CrossChainToken} from "../../../contracts/CrossChainToken.sol";

import {SendParam} from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";

import {MessagingFee} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";

import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";

import {TestHelperOz5} from "@layerzerolabs/test-devtools-evm-foundry/contracts/TestHelperOz5.sol";

contract CrossChainTokenFuzzTest is TestHelperOz5 {
    using OptionsBuilder for bytes;

    uint32 private constant A_EID = 1;
    uint32 private constant B_EID = 2;

    uint128 private constant RECEIVE_GAS = 100_000;

    uint256 private constant INITIAL_SUPPLY = 1_000_000 ether;

    address private constant USER_A = address(0xA11CE);

    address private constant USER_B = address(0xB0B);

    uint256 private constant DECIMAL_CONVERSION_RATE = 1e12;

    CrossChainToken private aToken;
    CrossChainToken private bToken;

    function setUp() public override {
        super.setUp();

        vm.deal(USER_A, 100 ether);
        vm.deal(USER_B, 100 ether);

        setUpEndpoints(2, LibraryType.UltraLightNode);

        aToken = CrossChainToken(
            _deployOApp(
                type(CrossChainToken).creationCode,
                abi.encode("Cross Chain Token", "CCT", address(endpoints[A_EID]), address(this), USER_A, INITIAL_SUPPLY)
            )
        );

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

    function testFuzz_crossChainTransfer(uint256 sharedUnits) public {
        // OFT uses 6 shared decimals while CCT uses
        // 18 local decimals.
        //
        // decimalConversionRate = 10^(18 - 6) = 1e12
        //
        // Generate only amounts exactly representable
        // by the OFT shared-decimal system.
        sharedUnits = bound(sharedUnits, 1, INITIAL_SUPPLY / DECIMAL_CONVERSION_RATE);

        uint256 amount = sharedUnits * DECIMAL_CONVERSION_RATE;

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

        uint256 globalSupplyBefore = aToken.totalSupply() + bToken.totalSupply();

        uint256 userASourceBalanceBefore = aToken.balanceOf(USER_A);

        uint256 userBDestinationBalanceBefore = bToken.balanceOf(USER_B);

        vm.prank(USER_A);

        MessagingFee memory fee = aToken.quoteSend(sendParam, false);

        vm.prank(USER_A);

        aToken.send{value: fee.nativeFee}(sendParam, fee, USER_A);

        verifyPackets(B_EID, addressToBytes32(address(bToken)));

        uint256 globalSupplyAfter = aToken.totalSupply() + bToken.totalSupply();

        // Global omnichain supply must never change.
        assertEq(globalSupplyAfter, globalSupplyBefore);

        // Exact amount burned from chain A.
        assertEq(aToken.balanceOf(USER_A), userASourceBalanceBefore - amount);

        // Exact amount minted on chain B.
        assertEq(bToken.balanceOf(USER_B), userBDestinationBalanceBefore + amount);
    }
}
