const validate = (connectionString) => {
  const regexp = /^[^:]+[:][^@]+[@][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}$/s;

  return connectionString.match(regexp);
};

module.exports = validate;
