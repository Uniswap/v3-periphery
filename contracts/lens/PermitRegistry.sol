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
    /// @notice Each value represents the bit index for which bit in the flags where the information is recorded
    enum PermitFlag {
        SUPPORTS_EIP2612,
        SUPPORTS_DAI_PERMIT,
        SUPPORTS_EIP1271,
        HAS_DOMAIN_OVERRIDE,
        DOMAIN_WITHOUT_VERSION
    }

    /// @notice Emitted when it is registered that a token supports a specific type of permit
    /// @param token The address of the token for which the permit type was registered
    /// @param permitType The address of the token for which the permit type was registered
    event PermitRegistered(address indexed token, PermitFlag indexed permitType);

    /// @notice Emitted when the domain details for a token are registered
    /// @param token The address of the token for which the domain was registered
    /// @param name The name used in the EIP712 domain for the permit signature
    /// @param hasVersion Whether the domain override contains a version
    /// @param version The version used in the EIP712 domain for the permit signature, or empty string if not applicable
    event DomainRegistered(address indexed token, string name, string version, bool hasVersion);

    /// @dev For each token, the bitmap of booleans containing information about the supported permutations of permit
    mapping(address => uint8) private _flags;

    /// @dev The overridden components of the domain
    struct DomainOverride {
        // the name override
        string name;
        // the version override, if applicable
        string version;
    }
    mapping(address => DomainOverride) private _domainOverrides;

    /// @notice Returns all information necessary to construct a permit signature for the given token
    /// @dev This information may be incomplete, and is populated only by using the registration functions
    function get(address token)
        external
        view
        returns (
            uint8,
            string memory,
            string memory
        )
    {
        return (_flags[token], _domainOverrides[token].name, _domainOverrides[token].version);
    }

    /// @dev Returns the current chain ID
    function _chainId() private pure returns (uint256 chainId) {
        assembly {
            chainId := chainid()
        }
    }

    /// @dev Sets the bit representing the given permit flag to 1 in the flags mapping
    function _addFlag(address token, PermitFlag flag) private {
        _flags[token] |= uint8(1) << uint8(flag);
        emit PermitRegistered(token, flag);
    }

    /// @notice Verify if the parameters were used to build a domain separator in a target contract,
    /// and store the domain override if it matches
    function registerDomain(
        address token,
        DomainOverride calldata domainOverride,
        bool hasVersion
    ) public {
        bytes32 domainSeparator =
            keccak256(
                abi.encode(
                    keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
                    keccak256(bytes(domainOverride.name)),
                    keccak256(bytes(domainOverride.version)),
                    _chainId(),
                    token
                )
            );

        require(domainSeparator == IERC20Permit(token).DOMAIN_SEPARATOR(), 'Mismatched domains');
        _domainOverrides[token] = domainOverride;
        _addFlag(token, PermitFlag.HAS_DOMAIN_OVERRIDE);
        if (!hasVersion) _addFlag(token, PermitFlag.DOMAIN_WITHOUT_VERSION);
        emit DomainRegistered(token, domainOverride.name, domainOverride.version, hasVersion);
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
        IERC20Permit(token).permit(
            owner,
            address(this),
            /* value= */
            1,
            /* deadline= */
            type(uint256).max,
            v,
            r,
            s
        );
        require(IERC20(token).allowance(owner, address(this)) == 1, 'Permit did not change allowance');
        _addFlag(token, PermitFlag.SUPPORTS_EIP2612);
    }

    /// @dev Check if permit can be approved
    function registerERC1271(address token) public {
        revert('TODO');
        _addFlag(token, PermitFlag.SUPPORTS_EIP1271);
    }

    /// @dev Exists for checking the permit ERC1271 signature verification
    function isValidSignature(bytes32 hash, bytes memory signature) external view override returns (bytes4) {
        revert('TODO');
        return 0x1626ba7e;
    }

    /// @notice Registers that a token supports a DAI-style permit
    /// @dev Use an Dai-style permit to register if `token` implements it.
    /// The permit should result in setting the allowance of the `owner` to type(uint256).max
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
        require(IERC20(token).allowance(owner, address(this)) == type(uint256).max, 'Permit unsuccessful');
        _addFlag(token, PermitFlag.SUPPORTS_DAI_PERMIT);
    }
}
