// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/drafts/IERC20Permit.sol';

import '../interfaces/external/IERC1271.sol';
import '../interfaces/external/IERC20PermitAllowed.sol';
import '../base/Multicall.sol';

/// @title Permit Registry
/// @notice Allows anyone to register that a token supports EIP2612 permit, DAI style permit, and ERC1271 signatures.
/// @dev This information can be used by interfaces to show different workflows depending on the off-chain signature
/// features that a token supports
contract PermitRegistry is Multicall, IERC1271 {
    /// @notice Emitted when it is registered that a token supports a specific type of permit
    event PermitRegistered(address indexed token, uint8 indexed permitType);
    /// @notice Emitted when the domain details for a token are registered
    event DomainRegistered(address indexed token, string indexed name, string indexed version);

    // The bits in the bitmap for each feature that is supported by the token
    uint8 private constant NONE = 0;
    uint8 private constant DAI = 1;
    uint8 private constant ERC2612 = 2;
    uint8 private constant ERC1271 = 4;

    /// @dev For each token, the bitmap of which features are supported
    mapping(address => uint8) private _permits;
    /// @dev The overridden components of the domain
    struct DomainComponents {
        string name;
        string version;
    }
    mapping(address => DomainComponents) private _domainComponents;

    /// @dev Return all registered data for a given token address.
    function get(address token)
        external
        view
        returns (
            uint8,
            string memory,
            string memory
        )
    {
        return (_permits[token], _domainComponents[token].name, _domainComponents[token].version);
    }

    /// @dev Verify if the parameters were used to build a domain separator in a target contract, and store everything if positive.
    function registerDomain(address token, DomainComponents calldata domain) public {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }

        bytes32 domainSeparator =
            keccak256(
                abi.encode(
                    keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
                    keccak256(bytes(domain.name)),
                    keccak256(bytes(domain.version)),
                    chainId,
                    token
                )
            );

        require(domainSeparator == IERC20Permit(token).DOMAIN_SEPARATOR(), 'Mismatched domains');
        _domainComponents[token] = domain;
        emit DomainRegistered(token, domain.name, domain.version);
    }

    /// @dev Use an ERC2612 permit to register if `token` implements it.
    /// The permit should have this contract as the spender, and type(uint256).max as allowance and deadline.
    /// @notice As a precaution, set the allowance back to zero after registering.
    function registerPermit(
        address token,
        address owner,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        require(IERC20(token).allowance(owner, address(this)) == 0, 'Non-zero starting allowance');
        IERC20Permit(token).permit(owner, address(this), 1, type(uint256).max, v, r, s);
        require(IERC20(token).allowance(owner, address(this)) == 1, 'No ERC2612');
        _permits[token] |= ERC2612;
        emit PermitRegistered(token, ERC2612);
    }

    /// @dev Check if permit can be approved
    function registerERC1271(address token) public {
        revert('TODO');
        _permits[token] |= ERC1271;
        emit PermitRegistered(token, ERC1271);
    }

    function isValidSignature(bytes32 hash, bytes memory signature) external view override returns (bytes4) {
        revert('todo');
        return 0x1626ba7e;
    }

    /// @dev Use an Dai-style permit to register if `token` implements it.
    /// The permit should have this contract as the spender, and type(uint256).max as deadline.
    /// @notice As a precaution, set the allowance back to zero after registering.
    function registerDaiPermit(
        address token,
        address owner,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) private {
        require(IERC20(token).allowance(owner, address(this)) == 0, 'Non-zero starting allowance');
        uint256 nonce = IERC20Permit(token).nonces(owner);
        IERC20PermitAllowed(token).permit(
            owner,
            address(this),
            nonce,
            /* expiry= */
            type(uint256).max,
            /* allowed= */
            true,
            v,
            r,
            s
        );
        require(IERC20(token).allowance(owner, address(this)) == type(uint256).max, 'No DAI permit');
        _permits[token] |= DAI;
        emit PermitRegistered(token, DAI);
    }
}
