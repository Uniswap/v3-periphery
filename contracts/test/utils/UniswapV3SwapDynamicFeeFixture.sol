// SPDX-License-Identifier: BUSL-1.1 
pragma solidity =0.7.6;
pragma abicoder v2;

import "contracts/SwapRouter.sol";
import "contracts/interfaces/ISwapRouter.sol";

import "contracts/test/TestERC20.sol";
import "contracts/libraries/LiquidityAmounts.sol";

import "v3-core/UniswapV3Pool.sol";
import "v3-core/UniswapV3Factory.sol";
import "v3-core/interfaces/IUniswapV3Pool.sol";
import "v3-core/libraries/TickMath.sol";

import "forge-std/Test.sol";
import { console } from "forge-std/console.sol";

contract UniswapV3SwapDynamicFeeFixture is Test, IUniswapV3MintCallback, IUniswapV3SwapCallback {
    // Contract variables
    UniswapV3Pool public uniswapV3Pool;
    UniswapV3Factory public uniswapV3Factory;
    SwapRouter public swapRouter;

    TestERC20 public token0; 
    TestERC20 public token1; 

    // Addresses
    address public poolDeployer = vm.addr(1);
    address public alice = vm.addr(2);
    address public bob = vm.addr(3);

    // Initialization variables
    uint24 fee = 3000; // 0.3% fee. It doesn't matter because its not used
    int24 tickSpacing;

    address public WETH9; // SwapRouter

    function setUp() public virtual {
        // Label and deal addresses
        vm.label(poolDeployer, "Pool Deployer");
        vm.label(alice, "Alice");
        vm.label(bob, "Bob");

        // Deal ETH
        vm.deal(poolDeployer, 5 ether);
        vm.deal(alice, 5 ether);
        vm.deal(bob, 5 ether);

        vm.startPrank(poolDeployer);

        // Deploy Factory
        uniswapV3Factory = new UniswapV3Factory();

        // Deploy token WETH9
        WETH9 = address(new TestERC20(1_000_000 * 1e18));

        // Deploy Router
        swapRouter = new SwapRouter(
            address(uniswapV3Factory), 
            WETH9
        );

        // Deploy and deal TestERC20 tokens
        token0 = new TestERC20(500_000 * 1e18);
        token1 = new TestERC20(500_000 * 1e18);

        // Test contract, to add liquidity
        token0.mint(address(this), 1_000_000 * 1e18);
        token1.mint(address(this), 1_000_000 * 1e18);

        // Users
        token0.mint(alice, 400_000 * 1e18);
        token1.mint(alice, 400_000 * 1e18);
        token0.mint(bob, 400_000 * 1e18);
        token1.mint(bob, 400_000 * 1e18);

        // Deploy the UniswapV3Pool
        address poolAddress = uniswapV3Factory.createPool(
            address(token0), 
            address(token1), 
            fee
        );
        uniswapV3Pool = UniswapV3Pool(poolAddress);

        // Get tick spacing
        tickSpacing = uniswapV3Pool.tickSpacing();

        // Initialize the pool
        (uint160 sqrtPriceX96, ) = getSqrtPriceX96AndTick(1, 1);
        uniswapV3Pool.initialize(sqrtPriceX96);

        vm.stopPrank();

        // Approve tokens for adding liquidity
        token0.approve(poolAddress, type(uint256).max);
        token1.approve(poolAddress, type(uint256).max);

        // Add liquidity
        uint128 liquidity = addLiquidity(
            sqrtPriceX96,
            -tickSpacing * 10,       // Lower tick
            tickSpacing * 10,        // Upper tick
            1_000_000 * 1e18,          // Amount of token0
            1_000_000 * 1e18           // Amount of token1
        );

        // UniswapV3Pool hash computation (To update in PoolAddress.sol)
        /*bytes memory bytecode = type(UniswapV3Pool).creationCode;
        bytes32 initCodeHash = keccak256(bytecode);
        console.logBytes32(initCodeHash);*/
    }

    // Helper function to add liquidity
    function addLiquidity(
        uint160 sqrtPriceX96,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) internal returns (uint128 liquidity) {
        uint160 sqrtPriceLowerX96 = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtPriceUpperX96 = TickMath.getSqrtRatioAtTick(tickUpper);

        liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            sqrtPriceLowerX96,
            sqrtPriceUpperX96,
            amount0Desired,
            amount1Desired
        );
        
        uniswapV3Pool.mint(
            poolDeployer,
            tickLower,
            tickUpper,
            liquidity,
            abi.encode(0)
        );
    }

    // Helper function to get the sqrtPriceX96
    function getSqrtPriceX96AndTick(
        uint256 token0Amount, 
        uint256 token1Amount
    ) internal pure returns (uint160 sqrtPriceX96, int24 tick) {
        // Calculate initial price based on the ratio of tokens (simplified 1:1)
        sqrtPriceX96 = uint160(2**96);

        tick = 0;
    }

    /// @inheritdoc IUniswapV3MintCallback
    function uniswapV3MintCallback(
        uint256 amount0Owed,
        uint256 amount1Owed,
        bytes calldata data
    ) external override {
        // Transfer required tokens
        if (amount0Owed > 0) {
            token0.transfer(msg.sender, amount0Owed);
        }
        if (amount1Owed > 0) {
            token1.transfer(msg.sender, amount1Owed);
        }
    }

    /// @inheritdoc IUniswapV3SwapCallback
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        // Transfer required tokens
        if (amount0Delta > 0) {
            token0.transfer(msg.sender, uint256(amount0Delta));
        }
        if (amount1Delta > 0) {
            token1.transfer(msg.sender, uint256(amount1Delta));
        }
    }
}
