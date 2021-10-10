pragma solidity ^0.8.4;

//import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ECRecovery.sol";
//learn more: https://docs.openzeppelin.com/contracts/3.x/erc721

// Just for debugging, TODO: Remove for prod
import "hardhat/console.sol";

// GET LISTED ON OPENSEA: https://testnets.opensea.io/get-listed/step-two

contract MattAuction is ERC721, Ownable, ECRecovery {

  using Counters for Counters.Counter;
  Counters.Counter private _tokenIds;
  string nftHash;

  constructor(string memory _nftHash) public ERC721("MattAuction", "MATT") {
    nftHash = _nftHash;
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
      uint256 nft;
      address bidderAddress;
      address currencyTokenAddress;
      uint256 currencyTokenAmount;
  }

  struct SignedBid {
      Bid bid;
      bytes sig;
  }

  struct Auction {
      uint endTime;
      address owner;
      address currencyTokenAddress;
      bool open;
  }

  mapping (bytes32 => Auction) auctions;

  function startAuction (bytes32 nftData, uint endTime, address token, address owner) public {
     auctions[nftData] = Auction(endTime, owner, token, true);
  }

  function endAuction (bytes32 nftData, SignedBid[] calldata signedBids) public {
      Auction memory auction = auctions[nftData];

      // Enforce only the auction owner can end it
      assert(msg.sender == auction.owner);

      // Assume the lowest (price-setting) bid is first (enforce in the loop)
      uint256 price = signedBids[0].bid.currencyTokenAmount;

      for (uint i=0; i < signedBids.length; i++) {
          SignedBid memory signed = signedBids[i];

          // Enforce all bids are above or equal to the first (low) bid price:
          assert(signed.bid.currencyTokenAmount >= price);

          // Ensure the bid meant to be in the auction's currency.
          // This data was redundant to sign, but improves end-user legibility.
          assert(signed.bid.currencyTokenAddress == auction.currencyTokenAddress);

          // Verify signature
          assert(verifyBidSignature(signed.bid.nft, signed.bid.bidderAddress, signed.bid.currencyTokenAddress, signed.bid.currencyTokenAmount, signed.sig));

          // Transfer payment
          IERC20(auction.currencyTokenAddress).transferFrom(signed.bid.currencyTokenAddress, auction.owner, price);

          mintItem(signed.bid.bidderAddress);
      }

      auction.open = false;
      auctions[nftData] = auction;
  }

  bytes32 constant PACKET_TYPEHASH = keccak256(
    "Bid(uint256 nft,address bidderAddress,address currencyTokenAddress,uint256 currencyTokenAmount)"
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
    uint256 nft,
    address bidderAddress,
    address currencyTokenAddress,
    uint256 currencyTokenAmount
  ) public pure returns (bytes32) {
    return keccak256(abi.encode(
      PACKET_TYPEHASH,
      nft,
      bidderAddress,
      currencyTokenAddress,
      currencyTokenAmount
    ));
  }

  function getTypedDataHash(uint256 nft,address bidderAddress,address currencyTokenAddress,uint256 currencyTokenAmount) public view returns (bytes32) {
    getEIP712DomainHash('MattAuction','1',block.chainid,address(this));

    bytes32 digest = keccak256(abi.encodePacked(
      "\x19\x01",
      getEIP712DomainHash('MattAuction','1',block.chainid,address(this)),
      getPacketHash(nft,bidderAddress,currencyTokenAddress,currencyTokenAmount)
    ));
    return digest;
  }

  function verifyBidSignature(uint256 nft,address bidderAddress,address currencyTokenAddress,uint256 currencyTokenAmount,bytes memory offchainSignature) public view returns (bool) {
      bytes32 sigHash = getTypedDataHash(nft,bidderAddress,currencyTokenAddress,currencyTokenAmount);

      address recoveredSignatureSigner = recover(sigHash,offchainSignature);

      // require(bidderAddress == recoveredSignatureSigner, 'Invalid signature');

      require(bidderAddress == recoveredSignatureSigner, "Signature recovery failed");
      //DO SOME FUN STUFF HERE
      return true;
  }
}

