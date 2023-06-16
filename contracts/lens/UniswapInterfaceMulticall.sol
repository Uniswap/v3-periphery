// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

/// @notice A fork of Multicall2 specifically tailored for the Uniswap Interface
contract UniswapInterfaceMulticall {
    struct Call {
        address target;
        uint256 gasLimit;
        bytes callData;
    }

    struct Result {
        bool success;
        uint256 gasUsed;
        bytes returnData;
    }

    function getCurrentBlockTimestamp() public view returns (uint256 timestamp) {
        timestamp = block.timestamp;
    }

    function getEthBalance(address addr) public view returns (uint256 balance) {
        balance = addr.balance;
    }

    function multicall(Call[] memory calls) public returns (uint256 blockNumber, Result[] memory returnData) {
        blockNumber = block.number;
        uint256 len = calls.length;
        returnData = new Result[](len);
        address target; 
        uint256 gasLimit; 
        bytes memory callData;
        uint256 gasLeftBefore;
        bool success;
        bytes memory ret;
        uint256 gasUsed;
        for (uint256 i = 0; i < len; i++) {
            (target, gasLimit, callData) =
                (calls[i].target, calls[i].gasLimit, calls[i].callData);
            gasLeftBefore = gasleft();
            (success, ret) = target.call{gas: gasLimit}(callData);
            gasUsed = gasLeftBefore - gasleft();
            returnData[i] = Result(success, gasUsed, ret);
        }
    }
}
