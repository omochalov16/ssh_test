const parse = (connectionString) => {
  const result = {};

  result.user = connectionString.slice(0, connectionString.indexOf(':'));
  result.password = connectionString.slice(connectionString.indexOf(':') + 1, connectionString.indexOf('@'));
  result.host = connectionString.slice(connectionString.indexOf('@') + 1, connectionString.length);

  return result;
};

module.exports = parse;
