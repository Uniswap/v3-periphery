// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import './interfaces/IETHConnector.sol';
import './interfaces/IRouterImmutableState.sol';
import './interfaces/external/IWETH.sol';

import './libraries/TransferHelper.sol';

abstract contract ETHConnector is IETHConnector, IRouterImmutableState {
    /// @inheritdoc IETHConnector
    function depositETHAndMulticall(bytes[] calldata data) external payable override returns (bytes[] memory) {
        return this.multicall(data);
    }

    /// @inheritdoc IETHConnector
    function sweepETH(address recipient) public override {
        uint256 balance = address(this).balance;
        if (balance > 0) TransferHelper.safeTransferETH(recipient, balance);
    }

    /// @inheritdoc IETHConnector
    function unwrapAndWithdrawETH(address recipient) external override {
        uint256 balance = IWETH(this.WETH()).balanceOf(address(this));
        require(balance > 0, 'ZW');
        IWETH(this.WETH()).withdraw(balance);
        this.sweepETH(recipient);
    }

    receive() external payable {
        require(msg.sender == this.WETH(), 'NW');
    }
}
