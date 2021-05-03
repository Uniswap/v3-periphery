// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/drafts/IERC20Permit.sol';

import '../interfaces/external/IERC1271.sol';
import '../interfaces/external/IERC20PermitAllowed.sol';
import '../base/Multicall.sol';

contract PermitRegistry is Multicall, IERC1271 {
    event PermitRegistered(address indexed token, uint8 indexed permitType);
    event DomainRegistered(address indexed token, string indexed name, string indexed version);

    uint8 public constant NONE = 0;
    uint8 public constant DAI = 1;
    uint8 public constant ERC2612 = 2;
    uint8 public constant ERC1271 = 4;

    mapping(address => uint8) private _permits;
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
    function registerDomain(
        address token,
        string memory name,
        string memory version
    ) public {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }

        bytes32 domain =
            keccak256(
                abi.encode(
                    keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
                    keccak256(bytes(name)),
                    keccak256(bytes(version)),
                    chainId,
                    token
                )
            );

        require(domain == IERC20Permit(token).DOMAIN_SEPARATOR(), 'Mismatched domains');
        _domainComponents[token] = DomainComponents({name: name, version: version});
        emit DomainRegistered(token, name, version);
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
        _permits[token] &= ERC2612;
        emit PermitRegistered(token, ERC2612);
    }

    /// @dev Check if permit can be approved
    function registerERC1271(address token) public {
        revert('TODO');
        _permits[token] &= ERC1271;
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
        _permits[token] &= DAI;
        emit PermitRegistered(token, DAI);
    }
}
