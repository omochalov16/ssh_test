const CONNECTION_STRING_REGEXP = /^[^:]+[:][^@]+[@][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}$/s;

const validate = connectionString => connectionString.match(CONNECTION_STRING_REGEXP);

module.exports = validate;
