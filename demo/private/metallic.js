function metallicRatio(index) {
  return (Math.sqrt(index * index + 4) + index) / 2;
}

function goldenRatio() {
  return metallicRatio(1);
}
