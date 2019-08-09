const parse = (getCommand) => {
  const result = {};

  let commandString = getCommand;
  if (typeof getCommand !== 'string') commandString = getCommand.toString();

  result.path = commandString.slice(commandString.indexOf(' ') + 1, commandString.length - 1);
  return result;
};

module.exports = parse;
