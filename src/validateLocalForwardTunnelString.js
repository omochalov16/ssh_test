const CONNECTION_STRING_REGEXP = /^([0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[:])?[0-9]{1,6}[:][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[:][0-9]{1,6}$/s;

const validate = tunnelString => tunnelString.trim().match(CONNECTION_STRING_REGEXP);

module.exports = validate;
