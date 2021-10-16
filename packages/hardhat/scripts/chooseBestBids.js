const { ethers } = require("hardhat");
const BigNumber = ethers.BigNumber;

async function asyncFilter (arr, predicate) {
	const results = await Promise.all(arr.map(predicate));

	return arr.filter((_v, index) => results[index]);
}

const sumReducer = (previousValue, currentValue) => {
  return previousValue.add(currentValue);
}

function createSumReducer (price) {
  return function (previousValue, currentValue) {

    const current = BigNumber.from(currentValue.bid.amount);
    if (current.gte(price)) {
      return previousValue.add(current);
    }

    return previousValue;
  }
}

module.exports = async function chooseBestBids (bids, mattAuction) {
const verifiedBids = await asyncFilter(bids, async (bid) => {
    return await mattAuction.verifyBid(bid);
  })

  const sortedBids = verifiedBids.sort((a, b) => {
    const bidA = BigNumber.from(a.bid.amount);
    const bidB = BigNumber.from(b.bid.amount);
    return bidA.lt(bidB);
  });

  let topRev = BigNumber.from(0);
  let winningBid = BigNumber.from(0);
  for (let i = 1; i < sortedBids.length; i++) {
    const price = BigNumber.from(sortedBids[i].bid.amount);
    const totalRev = sortedBids.reduce(createSumReducer(price), BigNumber.from(0));

    if (totalRev.gt(topRev)) {
      topRev = totalRev;
      winningBid = price;
    };
  }

  const topBids = sortedBids.filter(n => {
    const value = BigNumber.from(n.bid.amount);
    return value.gte(winningBid);
  });

  return topBids;
}
