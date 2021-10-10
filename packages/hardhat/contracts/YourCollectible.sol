pragma solidity ^0.8.0;
//SPDX-License-Identifier: MIT

//import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
//learn more: https://docs.openzeppelin.com/contracts/3.x/erc721

// GET LISTED ON OPENSEA: https://testnets.opensea.io/get-listed/step-two

contract MattAuction is ERC721, Ownable {

  using Counters for Counters.Counter;
  Counters.Counter private _tokenIds;
  string nftHash;

  constructor(string _nftHash) public ERC721("MattAuction", "MATT") {
    nftHash = _nftHash;
  }

  function _baseURI() internal view virtual override returns (string memory) {
      return "ipfs://";
  }

  function mintItem(address to, string memory tokenURI)
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
          ? string(abi.encodePacked(baseURI, tokenId.toString()))
          : '';
  }
}
