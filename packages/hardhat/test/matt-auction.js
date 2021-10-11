const { expect } = require("chai");
const { ethers } = require("hardhat");
const { types, primaryType } = require('../scripts/bid-types');

const Keyring = require('eth-simple-keyring');
const sigUtil = require('eth-sig-util');

const account = {
  address: '0x708ef7f37f853314b40539a102c18141b491f790',
  privateKey: '0xa20d33a11f56d2ff8e1248ae07b494887f1274aac5a0e2e47683bf4ae43679f3',
};
const keyring = new Keyring([account.privateKey]);

const sampleIpfsHash = 'QmcbMZW8hcd46AfUsJUxQYTanHYDpeUq3pBuX5nihPEKD9'; // "hello, world!"

describe("MattAuction", function () {
  it("should verify a signature correctly", async function () {
    const MattAuction = await ethers.getContractFactory("MattAuction");
    const mattAuction = await MattAuction.deploy(sampleIpfsHash);
    await mattAuction.deployed();

    const message = {
      nft: '0x24',
      bidderAddress: account.address,
      currencyTokenAddress: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
      currencyTokenAmount: '0x100',
    };
    const { nft, bidderAddress, currencyTokenAddress, currencyTokenAmount } = message;
    expect(mattAuction.address).to.be.properAddress;
    const chainId = mattAuction.deployTransaction.chainId;

    const typedMessage = {
      types,
      primaryType,
      domain: {
        name: 'MattAuction',
        version: '1',
        chainId,
        verifyingContract: mattAuction.address,
      },
      message,
    };

    const typedMessageParams = {
      data: typedMessage,
      version: 'V3',
    }

    const msgHash = sigUtil.TypedDataUtils.sign(typedMessage);

    const signature = sigUtil.signTypedMessage(keyring.wallets[0].privateKey, typedMessageParams, 'V3');

    const verified = await mattAuction.verifyBidSignature(nft, bidderAddress, currencyTokenAddress, currencyTokenAmount, signature);
    expect(verified).to.equal(true);
  });

  it('Should allow revoking bids');
  it('Should allow ending an auction with many bids, and mint NFTs to those bidders.');
  it('Should only allow owner to end auctions');
});
