// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {OFT} from "@layerzerolabs/oft-evm/contracts/OFT.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title CrossChainToken
/// @notice Omnichain ERC20 used by the Cross-Chain Protocol.
/// @dev Tokens are burned on the source chain and minted on
///      the destination chain through LayerZero OFT.
contract CrossChainToken is OFT {
    error ZeroInitialHolder();

    /// @param name_ ERC20 token name.
    /// @param symbol_ ERC20 token symbol.
    /// @param endpoint_ Local LayerZero Endpoint V2.
    /// @param owner_ Protocol owner/configuration authority.
    /// @param initialHolder_ Address receiving initial supply.
    /// @param initialSupply_ Initial supply minted on this chain.
    constructor(
        string memory name_,
        string memory symbol_,
        address endpoint_,
        address owner_,
        address initialHolder_,
        uint256 initialSupply_
    ) OFT(name_, symbol_, endpoint_, owner_) Ownable(owner_) {
        if (initialSupply_ > 0) {
            if (initialHolder_ == address(0)) {
                revert ZeroInitialHolder();
            }

            _mint(initialHolder_, initialSupply_);
        }
    }
}
