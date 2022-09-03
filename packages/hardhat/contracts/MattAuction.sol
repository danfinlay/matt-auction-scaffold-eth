pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./types.sol";
//learn more: https://docs.openzeppelin.com/contracts/3.x/erc721

// import "hardhat/console.sol";
// Just for debugging, TODO: Remove for prod

// GET LISTED ON OPENSEA: https://testnets.opensea.io/get-listed/step-two

contract MattAuction is ERC721, Ownable, EIP712Decoder {

  IERC20 token;
  bytes32 immutable domainHash;

  bool saleIsOpen = true;
  function isSaleOpen() external view returns (bool) {
    return saleIsOpen;
  }

  using Counters for Counters.Counter;
  Counters.Counter private _tokenIds;
  string nftHash;
  address _token;

  constructor(string memory _nftHash, address _currencyToken) ERC721("MattAuction", "MATT") {
    domainHash = getEIP712DomainHash('MattAuction','1',block.chainid,address(this));
    nftHash = _nftHash;
    _token = _currencyToken;
    token = IERC20(_token);
  }

  function _baseURI() internal view virtual override returns (string memory) {
      return "ipfs://";
  }

  function mintItem(address to)
      public
      onlyOwner
      returns (uint256)
  {
      _tokenIds.increment();

      uint256 id = _tokenIds.current();
      _mint(to, id);

      return id;
  }

    /**
   * @dev See {IERC721Metadata-tokenURI}.
   */
  function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
      require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");

      string memory baseURI = _baseURI();
      return bytes(baseURI).length > 0
          ? string(abi.encodePacked(baseURI, nftHash))
          : '';
  }

  struct SignedBid {
    Bid bid;
    bytes sig;
  }

  event TransferFromFailed(address buyer);
  function endAuction (uint256 price, SignedBid[] calldata signedBids) public onlyOwner {
    require(saleIsOpen, "This contract has already conducted its one sale.");

    for (uint i=0; i < signedBids.length; i++) {
      SignedBid calldata signed = signedBids[i];

      // Skip invalid bids.
      // Sure, we could throw errors, but why waste gas?
      if (
        // Under-priced bids
        signed.bid.amount < price ||
        // Bids in the wrong currency
        signed.bid.token != _token ||
        // Bids that are not signed correctly
        !verifyBid(signed)) {
        continue;
      }

      bool success = token.transferFrom(
        signed.bid.bidder,
        owner(),
        price
      );

      if (success) {
        mintItem(signed.bid.bidder);
      } else {
        emit TransferFromFailed(signed.bid.bidder);
      }

    }

    saleIsOpen = false;
  }

  // EIP712 Signature Related Code:
  function getEIP712DomainHash(string memory contractName, string memory version, uint256 chainId, address verifyingContract) public pure returns (bytes32) {
    return keccak256(abi.encode(
      EIP712DOMAIN_TYPEHASH,
      keccak256(bytes(contractName)),
      keccak256(bytes(version)),
      chainId,
      verifyingContract
    ));
  }

  function getBidTypedDataHash(Bid calldata bid) public view returns (bytes32) {
    bytes32 packetHash = GET_BID_PACKETHASH(bid);
    bytes32 digest = keccak256(abi.encodePacked(
      "\x19\x01",
      domainHash,
      packetHash
    ));
    return digest;
  }

  function verifyBid(SignedBid calldata signedBid) public view returns (bool) {
    bytes32 sigHash = getBidTypedDataHash(signedBid.bid);

    address recoveredSignatureSigner = recover(sigHash, signedBid.sig);

    require(signedBid.bid.bidder == recoveredSignatureSigner, 'Invalid signature');
    return true;
  }
}

