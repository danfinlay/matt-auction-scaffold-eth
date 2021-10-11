pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ECRecovery.sol";
//learn more: https://docs.openzeppelin.com/contracts/3.x/erc721

// Just for debugging, TODO: Remove for prod
// import "hardhat/console.sol";

// GET LISTED ON OPENSEA: https://testnets.opensea.io/get-listed/step-two

contract MattAuction is ERC721, Ownable, ECRecovery {

  bool saleIsOpen = true;
  function isSaleOpen() external returns (bool) {
    return saleIsOpen;
  }

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

  struct Set {
    bytes[] values;
    mapping (bytes => bool) is_in;
  }

  Set revokedBids;

  event BidRevoked(bytes signature);

  function revokeBid(uint256 nft,address bidderAddress,address currencyTokenAddress,uint256 currencyTokenAmount,bytes memory offchainSignature) public {
    bytes32 sigHash = getTypedDataHash(nft,bidderAddress,currencyTokenAddress,currencyTokenAmount);
    address recoveredSignatureSigner = recover(sigHash,offchainSignature);
    require(bidderAddress == recoveredSignatureSigner, "Can only revoke own bids.");

    if (!revokedBids.is_in[offchainSignature]) {
      revokedBids.values.push(offchainSignature);
      revokedBids.is_in[offchainSignature] = true;
      emit BidRevoked(offchainSignature);
    }
  }

  event TransferFromFailed(address buyer);
  function endAuction (bytes32 nftData, uint256 price, address currencyTokenAddress, SignedBid[] calldata signedBids) public onlyOwner {
    require(saleIsOpen, "This contract has already conducted its one sale.");

    for (uint i=0; i < signedBids.length; i++) {
        SignedBid memory signed = signedBids[i];

        // Enforce all bids are above or equal to the first (low) bid price:
        // TODO: Use safe math
        assert(signed.bid.currencyTokenAmount >= price);

        // Ensure the bid meant to be in the auction's currency.
        // This data was redundant to sign, but improves end-user legibility.
        assert(signed.bid.currencyTokenAddress == currencyTokenAddress);

        // Verify signature
        assert(verifyBidSignature(signed.bid.nft, signed.bid.bidderAddress, signed.bid.currencyTokenAddress, signed.bid.currencyTokenAmount, signed.sig));

        // Transfer payment
        (bool success, bytes memory returnData) =
          address(currencyTokenAddress).call( // This creates a low level call to the token
            abi.encodePacked( // This encodes the function to call and the parameters to pass to that function
              IERC20(currencyTokenAddress).transferFrom.selector, // This is the function identifier of the function we want to call
              abi.encode(signed.bid.currencyTokenAddress, msg.sender, price) // This encodes the parameter we want to pass to the function
            )
          );
      if (success) { // transferFrom completed successfully (did not revert)
        mintItem(signed.bid.bidderAddress);
      } else { // transferFrom reverted. However, the complete tx did not revert and we can handle the case here.
        // I will emit an event here to show this
        emit TransferFromFailed(signed.bid.bidderAddress);
      }
    }

    saleIsOpen = false;
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

    bytes32 domainHash = getEIP712DomainHash('MattAuction','1',block.chainid,address(this));
    bytes32 packetHash = getPacketHash(nft,bidderAddress,currencyTokenAddress,currencyTokenAmount);
    bytes32 digest = keccak256(abi.encodePacked(
      "\x19\x01",
      domainHash,
      packetHash
    ));
    return digest;
  }

  function verifyBidSignature(uint256 nft,address bidderAddress,address currencyTokenAddress,uint256 currencyTokenAmount,bytes memory offchainSignature) public view returns (bool) {
    bytes32 sigHash = getTypedDataHash(nft,bidderAddress,currencyTokenAddress,currencyTokenAmount);

    address recoveredSignatureSigner = recover(sigHash,offchainSignature);

    // require(bidderAddress == recoveredSignatureSigner, 'Invalid signature');

    require(bidderAddress == recoveredSignatureSigner, "Signature recovery failed");

    // Do not process revoked bids
    if (!revokedBids.is_in[offchainSignature]) {
      return true;
    }
  }
}

