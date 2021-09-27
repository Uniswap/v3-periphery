pragma solidity =0.7.6;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

contract OpinionatedOracle {

    ISwapRouter factory;

    enum ManipulationResistance {
        Dangerous, // Spot price from beginning of the block
        Weak, // 1 minute
        Medium, // 30 minutes
        Strong // 1 day
    }

    constructor(address _factory) {
        factory = _factory;
    }

    function quoteWithFeeTiers(
        address baseToken,
        address quoteToken,
        uint256 baseTokenAmount,
        ManipulationResistance resistance,
        uint24[] feeTiers
    ) public view returns (uint256 quoteTokenAmount) {
        require(feeTiers.length > 0, 'FT');

        address[] pools;

        address pool;

        for (uint256 i = 0; i < feeTiers.length; i++) {
            pool = IUniswapV3Pool(factory.getPool(baseToken, quoteToken, feeTiers[i]));
            if (pool != address(0)) {
                pools.push(pool);
            }
        }

        

        if (resistance == ManipulationResistance.Dangerous) {
            fetchDangerous
        }


    }

    function quote(
        address baseToken,
        address quoteToken,
        uint256 baseTokenAmount,
        ManipulationResistance resistance
    ) external view returns (uint256 quoteTokenAmount) {
        return quoteWithFeeTiers(
            baseToken,
            quoteToken,
            baseTokenAmount,
            resistance,
            [500, 3000, 10000]
        );
    }

}