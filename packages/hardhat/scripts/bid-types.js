const types = {
  Bid: [
    { name: 'nft', type: 'uint256' },
    { name: 'bidderAddress', type: 'address' },
    { name: 'currencyTokenAddress', type: 'address' },
    { name: 'currencyTokenAmount', type: 'uint256' },
  ],
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ],
};

const typedMessage = {
  types,
  primaryType: 'Bid',
  domain: {
    name: 'MattAuction',
    version: '1',
  },
};

module.exports = typedMessage;
