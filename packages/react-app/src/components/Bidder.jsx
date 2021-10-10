import { Skeleton, Typography } from "antd";
import React from "react";
import { useThemeSwitcher } from "react-css-theme-switcher";
import Chart from "react-google-charts";

/*
  ~ What it does? ~

 Allows placing bids on a MATT auction

  ~ How can I use? ~

  <MattBidder
    bids={bidders}
    fontSize={fontSize}
  />

*/

const { Text } = Typography;

const sumReducer = (previousValue, currentValue) => previousValue + currentValue;

export default function MattBidder (props) {
  console.log('rendering mattbidder with props', props);

  const bidders = {};
  for (var i = 0; i < 30; i++) {
    const name = Math.random();
    const rand = Math.round(name * 10);
    bidders[name] = rand;
  }

  const bidData = generateBidData(bidders);
  let topRev = 0;
  let winningBid = 0;
  for (let i = 1; i < bidData.length; i++) {
    const totalRev = bidData[i].reduce(sumReducer);
    if (totalRev > topRev) {
      topRev = totalRev;
      winningBid = bidData[i][0];
    };
  }

  const { currentTheme } = useThemeSwitcher();

  return (
    <div className="mattBidder" style={{
      display: 'flex',
      flexDirection: 'column',
    }}>
      <p>In a MATT auction, the seller decides how many editions to mint when closing the auction.</p>
      <p>Your bid represents the most you are willing to pay to get an edition.</p>
      <p>You are guaranteed to not pay more than any other winner.</p>
      <Chart
          width={'500px'}
          height={'300px'}
          chartType="AreaChart"
          loader={<div>Loading Chart</div>}
          data={bidData}
          options={{
              isStacked: true,
              height: 300,
              legend: 'none',
              vAxis: { minValue: 0, title: 'Total Artist Revenue' },
              hAxis: { minValue: 0, title: 'Price Per Item' },
          }}
          rootProps={{ 'data-testid': '2' }}
      />
      <p>The current winning price is ${winningBid}, which will net the artist ${topRev}</p>
    </div>
  );
}

function generateBidData (bidders) {

  const unsortedBidArr = Object.keys(bidders).map((b) => {
    return { addr:b, bid:bidders[b] }
  });
  const sortedBidArr = unsortedBidArr.sort((a, b) => {
    return a.bid < b.bid;
  });

  const bidderNames = sortedBidArr.map(b => b.addr);

  const ret = [[...bidderNames]];

  sortedBidArr.forEach((bidder) => {
    const bid = bidder.bid;
    const bids = sortedBidArr.map((bidder) => {
      if (bidder.bid >= bid) return bid;
      return 0;
    });
    ret.push(bids);
  });

  console.log("Bidder data", ret);
  return ret;
}


