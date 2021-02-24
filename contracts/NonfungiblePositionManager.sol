// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import './interfaces/INonfungiblePositionManager.sol';
import './interfaces/external/IERC721TokenReceiver.sol';
import './RouterPositions.sol';

abstract contract NonfungiblePositionManager is INonfungiblePositionManager, RouterPositions {
    /// @inheritdoc IERC721Metadata
    string public constant override name = 'Uniswap V3 Positions';
    /// @inheritdoc IERC721Metadata
    string public constant override symbol = 'UNI-V3-P';

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceID) external pure override returns (bool) {
        return interfaceID == 0xffffffff || interfaceID == 0x80ac58cd;
    }

    /// @inheritdoc IERC721Metadata
    function tokenURI(uint256 _tokenId) external view override returns (string memory) {
        Position storage position = positions[_tokenId];
        // todo: json encode the position info into name, description, image uri
        // could even query the pool to encode fees outstanding, value in token0/token1, etc.
        // this could be quite large, and probably should be in an external library since this is never called on-chain
        return string(abi.encode('data:application/json,'));
    }

    /// @inheritdoc IERC721
    mapping(address => uint256) public override balanceOf;

    /// @inheritdoc IERC721
    mapping(address => mapping(address => bool)) public override isApprovedForAll;

    struct Position {
        // the owner of the position
        address owner;
        // a single operator that is authorized to work with this position
        address operator;
        // details about the uniswap position
        // the pool of the position
        address pool;
        // the tick range of the position
        int24 tickLower;
        int24 tickUpper;
        // the liquidity of the position
        uint128 liquidity;
        // the fee growth of the aggregate position as of the last action on the individual position
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
        // how many uncollected fees are held by this contract owed to the position, as of the last computation
        uint128 feesOwed0;
        uint128 feesOwed1;
    }

    /// @inheritdoc INonfungiblePositionManager
    mapping(uint256 => Position) public override positions;

    /// @inheritdoc IERC721
    function ownerOf(uint256 _tokenId) public view override returns (address owner) {
        owner = positions[_tokenId].owner;
        require(owner != address(0), 'Invalid ID');
    }

    /// @inheritdoc IERC721
    function approve(address _approved, uint256 _tokenId) external override {
        Position storage position = positions[_tokenId];
        require(position.owner == msg.sender, 'Not owner');
        position.operator = _approved;
        emit Approval(msg.sender, _approved, _tokenId);
    }

    /// @inheritdoc IERC721
    function getApproved(uint256 _tokenId) public view override returns (address) {
        return positions[_tokenId].operator;
    }

    /// @inheritdoc IERC721
    function setApprovalForAll(address _operator, bool _approved) external override {
        isApprovedForAll[msg.sender][_operator] = _approved;
        emit ApprovalForAll(msg.sender, _operator, _approved);
    }

    modifier isAuthorized(uint256 _tokenId) {
        address owner = ownerOf(_tokenId);
        require(
            msg.sender == owner || isApprovedForAll[owner][msg.sender] || msg.sender == getApproved(_tokenId),
            'Not authorized'
        );
        _;
    }

    function _transferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) private isAuthorized(_tokenId) {
        require(positions[_tokenId].owner == _from, 'Invalid _from');
        require(_to != address(0), 'Invalid _to');
        positions[_tokenId].owner = _to;
        emit Transfer(_from, _to, _tokenId);
    }

    function _safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory data
    ) private {
        _transferFrom(_from, _to, _tokenId);

        require(
            IERC721TokenReceiver(_to).onERC721Received(msg.sender, _from, _tokenId, data) ==
                IERC721TokenReceiver.onERC721Received.selector,
            'Unsafe transfer'
        );
    }

    /// @inheritdoc IERC721
    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes calldata data
    ) external override {
        _safeTransferFrom(_from, _to, _tokenId, data);
    }

    /// @inheritdoc IERC721
    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) external override {
        _safeTransferFrom(_from, _to, _tokenId, '');
    }

    /// @inheritdoc IERC721
    function transferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) external override isAuthorized(_tokenId) {
        _transferFrom(_from, _to, _tokenId);
    }
}
