import React from "react";
import Jazzicon from "react-jazzicon";
import { toChecksumAddress } from "ethereumjs-util";

export default function Blockie (props) {
  const addr = props.address || props.seed;
  if (!addr || typeof addr.toLowerCase !== "function") {
    return <span />;
  }
  // eslint-disable-next-line react/jsx-props-no-spreading
  return <Jazzicon {...props} seed={jsNumberForAddress(addr.toLowerCase())} diameter={25} />
}

function jsNumberForAddress(lowCaseAddr) {
  const address = toChecksumAddress(lowCaseAddr);
  const addr = address.slice(2, 10);
  const seed = parseInt(addr, 16);
  return seed;
}
