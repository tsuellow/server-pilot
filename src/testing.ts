const incomming: number[] = [1, 2, 3, 4, 56, 6];
const receiving: number[] = [7, 8, 9, 4, 56, 6];

function calculatePositiveDelta(
  incommingChannelIds: number[],
  receptionChannels: number[]
): number[] {
  const delta: number[] = incommingChannelIds.filter(
    (channelIds) => !receptionChannels.includes(channelIds)
  );
  return delta;
}

function calculateNegDelta(
  incommingChannelIds: number[],
  receptionChannels: number[]
): number[] {
  const delta: number[] = receptionChannels.filter(
    (channelIds) => !incommingChannelIds.includes(channelIds)
  );
  return delta;
}

console.log(calculatePositiveDelta(incomming, receiving));
console.log(calculateNegDelta(incomming, receiving));
