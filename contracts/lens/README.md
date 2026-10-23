# lens

These contracts are not designed to be called on-chain. They simplify
fetching on-chain data from off-chain.

## QuoterV2 gas estimate after Glamsterdam

The deployed contracts do not change. The meaning of the `QuoterV2` `gasEstimate` on Ethereum mainnet changes after the Glamsterdam activation (EIP-7773). Other chains keep their current gas rules until they adopt the same changes.

After the activation, a new storage slot costs 97,920 state gas and a new account costs 183,600 state gas (EIP-8037). `QuoterV2` measures `gasleft()` before and after a pool `swap` that always reverts in the swap callback. The revert returns all state gas of the simulated swap, and `gasleft()` does not include state gas that comes from the reservoir. The `gasEstimate` therefore never includes state gas. It still increases after the activation because of the higher cost of cold state access (EIP-8038).

`gasEstimate` includes the execution cost of the simulated swap, including the output transfer that the pool makes before the callback reverts. It does not include state gas, for example a balance slot for a first-time holder of the output token, the intrinsic gas, or work of the real transaction outside the pool swap. Integrators that build a gas limit from `gasEstimate` must add these costs, or estimate the full transaction with `eth_estimateGas` on a node that runs the new rules.
