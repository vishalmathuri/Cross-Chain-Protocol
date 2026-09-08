// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {CrossChainToken} from "../../../contracts/CrossChainToken.sol";

import {CrossChainTokenHandler} from "./CrossChainTokenHandler.sol";

import {TestHelperOz5} from "@layerzerolabs/test-devtools-evm-foundry/contracts/TestHelperOz5.sol";

contract CrossChainTokenInvariantTest is TestHelperOz5 {
    uint32 private constant A_EID = 1;
    uint32 private constant B_EID = 2;

    uint256 private constant INITIAL_SUPPLY = 1_000_000 ether;

    address private constant USER_A = address(0xA11CE);

    address private constant USER_B = address(0xB0B);

    CrossChainToken private aToken;
    CrossChainToken private bToken;

    CrossChainTokenHandler private handler;

    function setUp() public override {
        super.setUp();

        // Give both bridge actors plenty of
        // native gas for LayerZero fee payments.
        vm.deal(USER_A, 1_000_000 ether);

        vm.deal(USER_B, 1_000_000 ether);

        // ---------------------------------------------------------
        // LayerZero mock endpoints
        // ---------------------------------------------------------

        setUpEndpoints(2, LibraryType.UltraLightNode);

        // ---------------------------------------------------------
        // Chain A token
        // ---------------------------------------------------------

        aToken = CrossChainToken(
            _deployOApp(
                type(CrossChainToken).creationCode,
                abi.encode("Cross Chain Token", "CCT", address(endpoints[A_EID]), address(this), USER_A, INITIAL_SUPPLY)
            )
        );

        // ---------------------------------------------------------
        // Chain B token
        // ---------------------------------------------------------

        bToken = CrossChainToken(
            _deployOApp(
                type(CrossChainToken).creationCode,
                abi.encode("Cross Chain Token", "CCT", address(endpoints[B_EID]), address(this), address(0), 0)
            )
        );

        // ---------------------------------------------------------
        // Configure OFT peers
        // ---------------------------------------------------------

        address[] memory oapps = new address[](2);

        oapps[0] = address(aToken);
        oapps[1] = address(bToken);

        this.wireOApps(oapps);

        // ---------------------------------------------------------
        // Stateful handler
        // ---------------------------------------------------------

        handler = new CrossChainTokenHandler(aToken, bToken, address(this));

        // ---------------------------------------------------------
        // Tell Foundry exactly which operations
        // should be randomly executed.
        // ---------------------------------------------------------

        bytes4[] memory selectors = new bytes4[](2);

        selectors[0] = CrossChainTokenHandler.bridgeAToB.selector;

        selectors[1] = CrossChainTokenHandler.bridgeBToA.selector;

        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));

        targetContract(address(handler));
    }

    // =============================================================
    //                       MAIN INVARIANT
    // =============================================================

    /// @notice Global omnichain supply must never change.
    function invariant_globalSupplyIsConserved() public view {
        assertEq(aToken.totalSupply() + bToken.totalSupply(), INITIAL_SUPPLY);
    }

    // =============================================================
    //                    DISTRIBUTION INVARIANT
    // =============================================================

    /// @notice All minted CCT must remain accounted
    ///         for between the two intended holders.
    function invariant_userBalancesMatchSupply() public view {
        assertEq(aToken.balanceOf(USER_A) + bToken.balanceOf(USER_B), INITIAL_SUPPLY);

        assertEq(aToken.totalSupply(), aToken.balanceOf(USER_A));

        assertEq(bToken.totalSupply(), bToken.balanceOf(USER_B));
    }

    // =============================================================
    //                     GHOST ACCOUNTING
    // =============================================================

    /// @notice Actual per-chain supply must match
    ///         every bridge operation recorded
    ///         by the handler.

    function invariant_ghostAccountingMatchesSupply() public view {
        uint256 totalAToB = handler.totalAToB();

        uint256 totalBToA = handler.totalBToA();

        // Chain B starts with zero supply, so it
        // can never return more tokens to A than
        // have previously been transferred A -> B.
        assertGe(totalAToB, totalBToA);

        uint256 netAToB = totalAToB - totalBToA;

        assertLe(netAToB, INITIAL_SUPPLY);

        uint256 expectedSupplyA = INITIAL_SUPPLY - netAToB;

        uint256 expectedSupplyB = netAToB;

        assertEq(aToken.totalSupply(), expectedSupplyA);

        assertEq(bToken.totalSupply(), expectedSupplyB);
    }

    // =============================================================
    //                   NO STRANDED TOKENS
    // =============================================================

    function invariant_noTokensHeldByOFTContracts() public view {
        assertEq(aToken.balanceOf(address(aToken)), 0);

        assertEq(bToken.balanceOf(address(bToken)), 0);
    }
}
