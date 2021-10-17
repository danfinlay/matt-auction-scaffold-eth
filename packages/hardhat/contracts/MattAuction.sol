pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ECRecovery.sol";
//learn more: https://docs.openzeppelin.com/contracts/3.x/erc721

// import "hardhat/console.sol";
// Just for debugging, TODO: Remove for prod

// GET LISTED ON OPENSEA: https://testnets.opensea.io/get-listed/step-two

contract MattAuction is ERC721, Ownable, ECRecovery {

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

  struct Bid {
      address bidder;
      address token;
      uint256 amount;
  }

  struct SignedBid {
      Bid bid;
      bytes sig;
  }

  struct Set {
    bytes[] values;
    mapping (bytes => bool) is_in;
  }

  event TransferFromFailed(address buyer);
  function endAuction (uint256 price, SignedBid[] calldata signedBids) public onlyOwner {
    require(saleIsOpen, "This contract has already conducted its one sale.");

    for (uint i=0; i < signedBids.length; i++) {
      SignedBid memory signed = signedBids[i];

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

  bytes32 constant PACKET_TYPEHASH = keccak256(
    "Bid(address bidder,address token,uint256 amount)"
  );

  bytes32 constant EIP712DOMAIN_TYPEHASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
  );

  function getDomainTypehash() public pure returns (bytes32) {
      return EIP712DOMAIN_TYPEHASH;
  }

  function getEIP712DomainHash(string memory contractName, string memory version, uint256 chainId, address verifyingContract) public pure returns (bytes32) {
    return keccak256(abi.encode(
      EIP712DOMAIN_TYPEHASH,
      keccak256(bytes(contractName)),
      keccak256(bytes(version)),
      chainId,
      verifyingContract
    ));
  }

  function getPacketTypehash()  public pure returns (bytes32) {
    return PACKET_TYPEHASH;
  }

  function getPacketHash(
    address bidder,
    address tokenAddr,
    uint256 amount
  ) public pure returns (bytes32) {
    return keccak256(abi.encode(
      PACKET_TYPEHASH,
      bidder,
      tokenAddr,
      amount
    ));
  }

  function getTypedDataHash(address bidder,address tokenAddr,uint256 amount) public view returns (bytes32) {
    bytes32 packetHash = getPacketHash(bidder,tokenAddr,amount);
    bytes32 digest = keccak256(abi.encodePacked(
      "\x19\x01",
      domainHash,
      packetHash
    ));
    return digest;
  }

  function verifyBid(SignedBid memory signedBid) public view returns (bool) {
    bytes32 sigHash = getTypedDataHash(
      signedBid.bid.bidder,
      signedBid.bid.token,
      signedBid.bid.amount
    );

    address recoveredSignatureSigner = recover(sigHash, signedBid.sig);

    require(signedBid.bid.bidder == recoveredSignatureSigner, 'Invalid signature');
    return true;
  }
}

