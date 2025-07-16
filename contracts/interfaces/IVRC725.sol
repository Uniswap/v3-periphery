// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2;

import {IERC4494} from "./IERC4494.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Metadata.sol";

interface IVRC725 is IERC721, IERC4494, IERC721Enumerable, IERC721Metadata {
    function permitForAll(address owner, address spender, uint256 deadline, bytes memory signature) external;
    function nonceByAddress(address owner) external view returns(uint256);
}