const commandTypes = require('./commandTypes');

const identify = (command) => {
  let commandString = command;
  if (typeof command !== 'string') commandString = command.toString();

  const getCommandRegexp = /^(get)[ ].+$/s;
  const putCommandRegexp = /^(put)[ ].+$/s;
  switch (true) {
    case !!commandString.match(getCommandRegexp):
      return commandTypes.GET_FILE;
    case !!commandString.match(putCommandRegexp):
      return commandTypes.PUT_FILE;
    default:
      return commandTypes.SIMPLE;
  }
};

module.exports = identify;
