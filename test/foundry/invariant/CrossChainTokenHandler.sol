// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Test} from "forge-std/Test.sol";

import {CrossChainToken} from "../../../contracts/CrossChainToken.sol";

import {SendParam} from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";

import {MessagingFee} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";

import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";

interface IPacketVerifier {
    function verifyPackets(uint32 dstEid, bytes32 dstAddress) external;
}

/// @title CrossChainTokenHandler
/// @notice Stateful fuzzing handler for bidirectional OFT transfers.
contract CrossChainTokenHandler is Test {
    using OptionsBuilder for bytes;

    uint32 private constant A_EID = 1;
    uint32 private constant B_EID = 2;

    uint128 private constant RECEIVE_GAS = 100_000;

    /// @dev CCT uses 18 local decimals and
    ///      OFT uses 6 shared decimals.
    uint256 private constant DECIMAL_CONVERSION_RATE = 1e12;

    address public constant USER_A = address(0xA11CE);

    address public constant USER_B = address(0xB0B);

    CrossChainToken private immutable aToken;
    CrossChainToken private immutable bToken;

    IPacketVerifier private immutable verifier;

    // =============================================================
    //                       GHOST VARIABLES
    // =============================================================

    /// @notice Total token amount successfully moved A -> B.
    uint256 public totalAToB;

    /// @notice Total token amount successfully moved B -> A.
    uint256 public totalBToA;

    /// @notice Number of successful A -> B bridge operations.
    uint256 public callsAToB;

    /// @notice Number of successful B -> A bridge operations.
    uint256 public callsBToA;

    constructor(CrossChainToken aToken_, CrossChainToken bToken_, address verifier_) {
        aToken = aToken_;
        bToken = bToken_;

        verifier = IPacketVerifier(verifier_);
    }

    // =============================================================
    //                          A -> B
    // =============================================================

    function bridgeAToB(uint256 amountSeed) external {
        uint256 balance = aToken.balanceOf(USER_A);

        uint256 maxSharedUnits = balance / DECIMAL_CONVERSION_RATE;

        // Nothing transferable on chain A.
        if (maxSharedUnits == 0) {
            return;
        }

        uint256 sharedUnits = bound(amountSeed, 1, maxSharedUnits);

        uint256 amount = sharedUnits * DECIMAL_CONVERSION_RATE;

        _bridge(aToken, bToken, B_EID, USER_A, USER_B, amount);

        totalAToB += amount;
        ++callsAToB;
    }

    // =============================================================
    //                          B -> A
    // =============================================================

    function bridgeBToA(uint256 amountSeed) external {
        uint256 balance = bToken.balanceOf(USER_B);

        uint256 maxSharedUnits = balance / DECIMAL_CONVERSION_RATE;

        // Nothing transferable on chain B.
        if (maxSharedUnits == 0) {
            return;
        }

        uint256 sharedUnits = bound(amountSeed, 1, maxSharedUnits);

        uint256 amount = sharedUnits * DECIMAL_CONVERSION_RATE;

        _bridge(bToken, aToken, A_EID, USER_B, USER_A, amount);

        totalBToA += amount;
        ++callsBToA;
    }

    // =============================================================
    //                      INTERNAL BRIDGE
    // =============================================================

    function _bridge(
        CrossChainToken sourceToken,
        CrossChainToken destinationToken,
        uint32 destinationEid,
        address sender,
        address receiver,
        uint256 amount
    ) internal {
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(RECEIVE_GAS, 0);

        SendParam memory sendParam = SendParam({
            dstEid: destinationEid,
            to: _addressToBytes32(receiver),
            amountLD: amount,
            minAmountLD: amount,
            extraOptions: options,
            composeMsg: "",
            oftCmd: ""
        });

        // Quote using the same sender that will
        // perform the actual bridge.
        vm.prank(sender);

        MessagingFee memory fee = sourceToken.quoteSend(sendParam, false);

        // Burn tokens on the source chain.
        vm.prank(sender);

        sourceToken.send{value: fee.nativeFee}(sendParam, fee, sender);

        // Simulate LayerZero delivery and mint
        // on the destination chain.
        verifier.verifyPackets(destinationEid, _addressToBytes32(address(destinationToken)));
    }

    // =============================================================
    //                          HELPERS
    // =============================================================

    function _addressToBytes32(address account) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(account)));
    }
}
