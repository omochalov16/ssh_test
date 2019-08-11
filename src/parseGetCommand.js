const NEWLINE_REGEXP = /\r?\n|\r/;

const parse = (getCommand) => {
  const result = {};

  let commandString = getCommand;
  if (typeof getCommand !== 'string') commandString = getCommand.toString();

  result.fileName = commandString.trim().slice(commandString.indexOf(' ') + 1, commandString.length).replace(NEWLINE_REGEXP, '');
  return result;
};

module.exports = parse;
