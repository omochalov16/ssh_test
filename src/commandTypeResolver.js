const commandTypes = require('./commandTypes');

const identify = (command) => {
  let commandString = command;
  if (typeof command !== 'string') commandString = command.toString();

  const getCommandRegexp = /^(get)[ ].+$/s;
  if (commandString.match(getCommandRegexp)) return commandTypes.GET_FILE;
  return commandTypes.SIMPLE;
};

module.exports = identify;
