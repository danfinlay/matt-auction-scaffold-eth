const { expect } = require("chai");
const { ethers } = require("hardhat");
const { types, primaryType } = require('../scripts/bid-types');
const BigNumber = ethers.BigNumber;

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
    const bid = BigNumber.from(best[0].bid.currencyTokenAmount);
    expect(bid).to.equal(1);
  });

});

describe("MattAuction", function () {
  it("should verify a signature correctly", async function () {
    const mattAuction = await deployMatt();

    const message = {
      bidderAddress: account.address,
      currencyTokenAddress: sampleTokenAddress,
      currencyTokenAmount: '0x100',
    };
    const { bidderAddress, currencyTokenAddress, currencyTokenAmount } = message;
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
      bidderAddress: account.address,
      currencyTokenAddress: sampleTokenAddress,
      currencyTokenAmount: '0x100',
    };
    const { bidderAddress, currencyTokenAddress, currencyTokenAmount } = message;
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
      bidderAddress: account.address,
      currencyTokenAddress: sampleTokenAddress,
      currencyTokenAmount: BigNumber.from(bidNumbers[i]).toHexString(),
    };
    const { bidderAddress, currencyTokenAddress, currencyTokenAmount } = message;
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

async function asyncFilter (arr, predicate) {
	const results = await Promise.all(arr.map(predicate));

	return arr.filter((_v, index) => results[index]);
}

const sumReducer = (previousValue, currentValue) => {
  return previousValue.add(currentValue);
}

function createSumReducer (price) {
  return function (previousValue, currentValue) {

    const current = BigNumber.from(currentValue.bid.currencyTokenAmount);
    if (current.gte(price)) {
      return previousValue.add(current);
    }

    return previousValue;
  }
}

async function chooseBestBids (bids, mattAuction) {
const verifiedBids = await asyncFilter(bids, async (bid) => {
    return await mattAuction.verifyBid(bid);
  })

  const sortedBids = verifiedBids.sort((a, b) => {
    const bidA = BigNumber.from(a.bid.currencyTokenAmount);
    const bidB = BigNumber.from(b.bid.currencyTokenAmount);
    return bidA.lt(bidB);
  });

  let topRev = BigNumber.from(0);
  let winningBid = BigNumber.from(0);
  for (let i = 1; i < sortedBids.length; i++) {
    const price = BigNumber.from(sortedBids[i].bid.currencyTokenAmount);
    const totalRev = sortedBids.reduce(createSumReducer(price), BigNumber.from(0));

    if (totalRev.gt(topRev)) {
      topRev = totalRev;
      winningBid = price;
    };
  }

  const topBids = sortedBids.filter(n => {
    const value = BigNumber.from(n.bid.currencyTokenAmount);
    return value.gte(winningBid);
  });

  return topBids;
}

async function deployMatt () {
  const MattAuction = await ethers.getContractFactory("MattAuction");
  const mattAuction = await MattAuction.deploy(sampleIpfsHash, sampleTokenAddress);
  return mattAuction.deployed();
}
