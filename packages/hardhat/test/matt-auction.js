const { expect } = require("chai");
const { ethers } = require("hardhat");
const BigNumber = ethers.BigNumber;
const { types, primaryType } = require('../scripts/bid-types');
const chooseBestBids = require('../scripts/chooseBestBids');

const Keyring = require('eth-simple-keyring');
const sigUtil = require('eth-sig-util');

const sampleIpfsHash = 'QmcbMZW8hcd46AfUsJUxQYTanHYDpeUq3pBuX5nihPEKD9'; // "hello, world!"
const sampleTokenAddress = '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826';

describe('chooseBestBids', function () {

  it('should choose the best bids with 1', async () => {
    const mattAuction = await deployMatt();
    const bids = await createBids([1], mattAuction);
    const best = await chooseBestBids(bids, mattAuction);
    const bid = BigNumber.from(best[0].bid.amount);
    expect(bid).to.equal(1);
  });


  it('should choose the best bids with 1, 50, 99', async () => {
    const mattAuction = await deployMatt();
    const bids = await createBids([1, 50, 99], mattAuction);
    const best = await chooseBestBids(bids, mattAuction);
    expect(best.length).to.equal(2);
    const bid = BigNumber.from(best[0].bid.amount);
    expect(bid).to.equal(50);
  });

});

describe("MattAuction", function () {
  it("verifyBid should verify a bid", async () => {
    const mattAuction = await deployMatt();
    const bids = await createBids([1], mattAuction);
    const verified = await mattAuction.verifyBid(bids[0]);
    expect(verified).to.equal(true);
  });

  it("endAuction should end with one bid", async function () {
    const mattAuction = await deployMatt();
    const bids = await createBids(['0x100'], mattAuction);
    await mattAuction.endAuction(
      '0x1',
      bids,
    );

    const saleIsOpen = await mattAuction.isSaleOpen();
    expect(saleIsOpen).to.equal(false);
  });

  it("should endAuction with many bids", async () => {
    const mattAuction = await deployMatt();
    const bids = await createBids([0, 10, 50, 99], mattAuction);
    const bestBids = await chooseBestBids(bids, mattAuction);
    expect(bestBids.length).to.equal(2);

    await mattAuction.endAuction(
      '0x1',
      bestBids,
    );

    const saleIsOpen = await mattAuction.isSaleOpen();
    expect(saleIsOpen).to.equal(false);
  });

  it('Should allow ending an auction with many bids, and mint NFTs to those bidders.', async () => {
    const mattAuction = await deployMatt();
    const bids = await createBids([0, 10, 50, 99], mattAuction);
    const bestBids = await chooseBestBids(bids, mattAuction);
    expect(bestBids.length).to.equal(2);

    const balance = await mattAuction.balanceOf(bestBids[0].bid.bidder);
    expect(balance.toString()).to.equal('0');

    await mattAuction.endAuction(
      '0x1',
      bestBids,
    );

    const saleIsOpen = await mattAuction.isSaleOpen();
    expect(saleIsOpen).to.equal(false);

    for (let i = 0; i < bestBids.length; i++) {
      const balance = await mattAuction.balanceOf(bestBids[i].bid.bidder);
      expect(balance.toString()).to.equal('1');
      const uri = await mattAuction.tokenURI(1);
      expect(uri).to.equal('ipfs://' + sampleIpfsHash);
    }
  });

  it('Should only allow owner to end auctions');
  it('Should not allocate NFTs to people who did not grant an allowance');
  it('Should charge all bidders the same.');
  it('Should not charge a bid that is under the chosen price');

});

async function createAccounts(num = 10) {
  const accounts = [];

  for (let i = 0; i < num; i++) {
    const keyring = new Keyring();
    await keyring.addAccounts(1);
    accounts.push(keyring);
  }

  return accounts;
}

async function createBids (bidNumbers, mattAuction) {
  const bids = [];
  const accounts = await createAccounts(bidNumbers.length);

  for (let i = 0; i < bidNumbers.length; i++) {
    const [address] = await accounts[i].getAccounts()
    const message = {
      bidder: address,
      token: sampleTokenAddress,
      amount: BigNumber.from(bidNumbers[i]).toHexString(),
    };
    const { bidder, token, amount } = message;
    const typedMessage = createTypedMessage(mattAuction, message);

    const typedMessageParams = {
      data: typedMessage,
      version: 'V4',
    }

    const signature = sigUtil.signTypedMessage(accounts[i].wallets[0].privateKey, typedMessageParams, 'V4');

    const signedBid = {
      bid: message,
      sig: signature,
    };

    bids.push(signedBid);
  }

  return bids;
}

async function deployMatt () {
  const MattAuction = await ethers.getContractFactory("MattAuction");
  const mattAuction = await MattAuction.deploy(sampleIpfsHash, sampleTokenAddress);
  return mattAuction.deployed();
}

function createTypedMessage (mattAuction, message) {
  const chainId = mattAuction.deployTransaction.chainId;
  return {
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
}
