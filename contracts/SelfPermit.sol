// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

import './interfaces/external/IERC2612.sol';

abstract contract SelfPermit {
    function selfPermit(
        address token,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // owner should always be msg.sender for now
        // spender is always address(this)
        IERC2612(token).permit(msg.sender, address(this), value, deadline, v, r, s);
    }
}
