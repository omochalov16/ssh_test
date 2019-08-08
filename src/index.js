const { Client } = require('ssh2');
const Logger = require('js-logger');
const args = require('yargs').argv;

const validateConnectionString = require('./validateConnectionString');
const parseConnectionString = require('./parseConnectionString');

const commandTypeResolver = require('./commandTypeResolver');
const commandTypes = require('./commandTypes');

const connectionString = args._[0];
if (!connectionString || !validateConnectionString(connectionString)) {
  throw new Error(`Connection string has incorrect format, 
                             expected: user:password@host,
                             got: ${connectionString}`);
}

const connectionInfo = parseConnectionString(connectionString);
connectionInfo.port = args.P || 22;

Logger.useDefaults();

const conn = new Client();

conn.on('ready', () => {
  Logger.info('Client :: ready');

  conn.shell((err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      Logger.info('Stream :: close');
      conn.end();
      process.exit();
    });

    stream.on('data', (data) => {
      Logger.info(`${data}`);
    });

    process.stdin.on('data', (command) => {
      const commandType = commandTypeResolver(command);

      switch (commandType) {
        case commandTypes.GET_FILE:
          break;
        case commandTypes.SIMPLE:
          stream.write(command);
          break;
        default:
          throw new Error('Unexepected command');
      }
    });
  });
});

conn.connect(connectionInfo);
