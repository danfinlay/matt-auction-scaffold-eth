import { Skeleton, Typography } from "antd";
import React, { useEffect, useState } from "react";
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

const initialBidders = generateRandomBidders();

export default function MattBidder (props) {
  console.log('rendering mattbidder with props', props);

  const [ bidders, setBidders ] = useState(initialBidders);
  const [ draftBid, setDraftBid ] = useState(0);

  const bidData = generateBidData(bidders);
  let topRev = 0;
  let winningBid = 0;
  let winnerCount = 0;
  for (let i = 1; i < bidData.length; i++) {
    const totalRev = bidData[i].reduce(sumReducer);
    console.log(`The sum of ${JSON.stringify(bidData[i])} is ${totalRev}`);
    if (totalRev > topRev) {
      topRev = totalRev;
      winningBid = bidData[i][0];
      winnerCount = bidData[i].filter(n => n >= winningBid).length;
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
      <p>The current winning price is ${winningBid}, which will produce {winnerCount} editions and net the artist ${topRev}</p>
      <div className="bidPlacing">
        <input type="number" min="0" onChange={(event) => setDraftBid(parseFloat(event.target.value))}/>
        <input
          type="button"
          value="Place Bid"
          onClick={() => {
            const newBidders = {...bidders}
            newBidders[`user${Math.random()}`] = draftBid;
            setBidders(newBidders);
          }}
        />
      </div>
      <div>
        <input
          type="button"
          value="Reset Bids"
          onClick={() => {
            setBidders(initialBidders);            
          }}
        />
        <input
          type="button"
          value="Randomize Bids"
          onClick={() => {
            setBidders(generateRandomBidders());
          }}
        />
      </div>
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

  const ret = [['Price Per Item', ...bidderNames]];

  sortedBidArr.forEach((bidder, i) => {

    // Enter their actual price
    const bid = bidder.bid;
    const bids = [bid, ...sortedBidArr.map((bidder) => {
      if (bidder.bid >= bid) return bid;
      return 0;
    })];
    ret.push(bids);
  });

  console.log("Bidder data", ret);
  return ret;
}

function generateRandomBidders () {
  const bidders = {};
  // Initialize sample bidders
  for (var i = 0; i < 30; i++) {
    const name = Math.random();
    const rand = Math.round(name * 10);
    bidders[name] = rand;
  }
  return bidders;
}
