// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/NonfungiblePositionLibrary.sol';

contract TestNonfungiblePositionLibrary {
    function tokenRatioPriority(address token, uint256 chainId) public view returns (int256) {
        return NonfungiblePositionLibrary.tokenRatioPriority(token, chainId);
    }

    function flipRatio(
        address token0,
        address token1,
        uint256 chainId
    ) public view returns (bool) {
        return NonfungiblePositionLibrary.flipRatio(token0, token1, chainId);
    }

    function WETH9() public view returns (address) {
        return NonfungiblePositionLibrary.WETH9;
    }
}
