const { expect } = require("chai");
const { ethers } = require("hardhat");
const BigNumber = ethers.BigNumber;
const { types, primaryType } = require('../scripts/bid-types');
const chooseBestBids = require('../scripts/chooseBestBids');

const Keyring = require('eth-simple-keyring');
const sigUtil = require('eth-sig-util');

const account = {
  address: '0x708ef7f37f853314b40539a102c18141b491f790',
  privateKey: '0xa20d33a11f56d2ff8e1248ae07b494887f1274aac5a0e2e47683bf4ae43679f3',
};
const keyring = new Keyring([account.privateKey]);

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

describe("MattAuction endAuction", function () {

  it("should end with one bid", async function () {
    const mattAuction = await deployMatt();

    const message = {
      bidder: account.address,
      token: sampleTokenAddress,
      amount: '0x100',
    };
    const { bidder, token, amount } = message;
    expect(mattAuction.address).to.be.properAddress;

    const typedMessage = createTypedMessage(mattAuction, message);

    const typedMessageParams = {
      data: typedMessage,
      version: 'V4',
    }

    const msgHash = sigUtil.TypedDataUtils.sign(typedMessage);

    const signature = sigUtil.signTypedMessage(keyring.wallets[0].privateKey, typedMessageParams, 'V4');

    const signedBid = {
      bid: message,
      sig: signature,
    };

    const verified = await mattAuction.verifyBid(signedBid);
    expect(verified).to.equal(true);

    await mattAuction.endAuction(
      '0x1',
      [signedBid],
    );

    const saleIsOpen = await mattAuction.isSaleOpen();
    expect(saleIsOpen).to.equal(false);
  });

  it('Should allow ending an auction with many bids, and mint NFTs to those bidders.', async () => {
    const mattAuction = await deployMatt();

    const message = {
      bidder: account.address,
      token: sampleTokenAddress,
      amount: '0x100',
    };
    const { bidder, token, amount } = message;
    expect(mattAuction.address).to.be.properAddress;

    const typedMessage = createTypedMessage(mattAuction, message);

    const typedMessageParams = {
      data: typedMessage,
      version: 'V4',
    }

    const msgHash = sigUtil.TypedDataUtils.sign(typedMessage);

    const signedBids = await createBids([50, 99], mattAuction);
    const bestBids = await chooseBestBids(signedBids, mattAuction);

    await mattAuction.endAuction(
      '0x1',
      signedBids,
    );

    const saleIsOpen = await mattAuction.isSaleOpen();
    expect(saleIsOpen).to.equal(false);

  });

  it('Should only allow owner to end auctions');
  it('Should allocate NFTs to the winners');
  it('Should charge all bidders the same.');
  it('Should not charge a bid that is under the chosen price');

});

async function createAccounts(num = 10) {
  const keyring = new Keyring();
  await keyring.addAccounts(num);

  return keyring;
}

async function createBids (bidNumbers, mattAuction) {
  const bids = [];
  const accounts = await createAccounts(bidNumbers.length);

  for (let i = 0; i < bidNumbers.length; i++) {
    const message = {
      bidder: account.address,
      token: sampleTokenAddress,
      amount: BigNumber.from(bidNumbers[i]).toHexString(),
    };
    const { bidder, token, amount } = message;
    const typedMessage = createTypedMessage(mattAuction, message);

    const typedMessageParams = {
      data: typedMessage,
      version: 'V4',
    }

    const signature = sigUtil.signTypedMessage(keyring.wallets[0].privateKey, typedMessageParams, 'V4');

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
