const GET_COMMAND_REGEXP = /^(get)[ ].+$/s;
const PUT_COMMAND_REGEXP = /^(put)[ ].+$/s;

const commandTypes = require('./commandTypes');

const identify = (command) => {
  let commandString = command;
  if (typeof command !== 'string') commandString = command.toString();

  switch (true) {
    case !!commandString.match(GET_COMMAND_REGEXP):
      return commandTypes.GET_FILE;
    case !!commandString.match(PUT_COMMAND_REGEXP):
      return commandTypes.PUT_FILE;
    default:
      return commandTypes.SIMPLE;
  }
};

module.exports = identify;
