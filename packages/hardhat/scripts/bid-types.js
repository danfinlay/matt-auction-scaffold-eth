const types = {
  Bid: [
    { name: 'bidder', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
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
