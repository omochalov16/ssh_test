const DEFAULT_LOCAL_HOST = '127.0.0.1';

const parse = (tunnelString) => {
  const result = {};

  const tunnelStringParts = tunnelString.trim().split(':');
  if (tunnelStringParts.length === 3) tunnelStringParts.unshift(DEFAULT_LOCAL_HOST);

  [result.localHost, result.localPort, result.dstHost, result.dstPort] = tunnelStringParts;
  result.keepAlive = true;

  return result;
};

module.exports = parse;
