// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import './BlockTimestamp.sol';
import '../interfaces/IPeripheryValidation.sol';

/// @title Periphery validation
contract PeripheryValidation is IPeripheryValidation, BlockTimestamp {
    /// @inheritdoc IPeripheryValidation
    function checkDeadline(uint256 deadline) public view override {
        require(_blockTimestamp() <= deadline, 'Transaction too old');
    }

    /// @inheritdoc IPeripheryValidation
    function checkPreviousBlockHash(bytes32 previousBlockHash) public view override {
        require(blockhash(block.number - 1) == previousBlockHash, 'Previous block hash incorrect');
    }
}
