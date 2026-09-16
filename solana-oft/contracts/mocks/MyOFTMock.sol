// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {CrossChainToken} from "../CrossChainToken.sol";

/// @dev Test-only wrapper around the production CrossChainToken.
contract MyOFTMock is CrossChainToken {
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate
    )
        CrossChainToken(
            _name,
            _symbol,
            _lzEndpoint,
            _delegate,
            address(0),
            0
        )
    {}

    function mint(
        address _to,
        uint256 _amount
    ) public {
        _mint(_to, _amount);
    }
}