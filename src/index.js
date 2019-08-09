const Logger = require('js-logger');
const path = require('path');
const args = require('yargs').argv;
const SSH2Promise = require('ssh2-promise');

const validateConnectionString = require('./validateConnectionString');

const parseConnectionString = require('./parseConnectionString');
const parseGetCommand = require('./parseGetCommand');

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

const conn = new SSH2Promise(connectionInfo);

const setupShell = connection => connection.shell();

const setShellModeToStandart = (shell) => {
  shell.removeAllListeners();

  shell.on('data', (data) => {
    process.stdout.write(`${data}`);
  });

  shell.on('close', () => {
    Logger.info('Stream :: close');
    conn.end();
    process.exit();
  });
};

const getFile = async (shell, command) => {
  const filename = parseGetCommand(command).fileName;

  process.stdin.pause();
  shell.removeAllListeners();

  shell.on('data', async (directoryResponse) => {
    const directory = directoryResponse.toString().split(/\r?\n|\r/)[0];
    if (directory[0] !== '/') {
      return;
    }

    const sftp = await conn.sftp();

    const moveFrom = `${directory}/${filename}`;
    const moveTo = `${__dirname}/../uploaded/${filename}`;

    Logger.info(`Upload file from ${moveFrom} to ${path.resolve(moveTo)}`);

    try {
      await sftp.fastGet(moveFrom, moveTo);
      Logger.info('Succesfully uploaded');
    } catch (err) {
      Logger.info(err);
    }

    setShellModeToStandart(shell);
    process.stdin.resume();
  });

  shell.write('pwd\n');
};

(async () => {
  await conn.connect();

  Logger.info('Client :: ready');
  const shell = await setupShell(conn);

  setShellModeToStandart(shell);

  process.stdin.on('data', async (command) => {
    const commandType = commandTypeResolver(command);

    switch (commandType) {
      case commandTypes.GET_FILE:
        await getFile(shell, command);
        break;
      case commandTypes.SIMPLE:
        shell.write(command);
        break;
      default:
        throw new Error('Unexepected command');
    }
  });
})();
