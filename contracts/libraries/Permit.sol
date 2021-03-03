// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.5.0;

import '../interfaces/external/IPermit.sol';

library Permit {
    function permit(address token, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        // owner should always be msg.sender for now
        // spender is always address(this)
        IPermit(token).permit(msg.sender, address(this), value, deadline, v, r, s);
    }
}
