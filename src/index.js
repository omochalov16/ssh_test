const Logger = require('js-logger');
const path = require('path');
const args = require('yargs').argv;
const SSH2Promise = require('ssh2-promise');
const fs = require('fs-extra');
const sigint = require('sigint').create();

const validateConnectionString = require('./validateConnectionString');

const parseConnectionString = require('./parseConnectionString');
const parseGetCommand = require('./parseGetCommand');
const parsePutCommand = require('./parsePutCommand');

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
    process.exit();
  });
};

const getCurrentDirectory = async shell => new Promise((res) => {
  shell.removeAllListeners();
  shell.on('data', (directoryResponse) => {
    const directory = directoryResponse.toString().split(/\r?\n|\r/)[0];
    if (directory[0] === '/') {
      setShellModeToStandart(shell);
      res(directory);
    }
  });

  shell.write('pwd\n');
});

const getFile = async (shell, command) => {
  const filename = parseGetCommand(command).fileName;

  process.stdin.pause();

  const directory = await getCurrentDirectory(shell);

  const sftp = await conn.sftp();

  const pathToLocalFile = `${directory}/${filename}`;
  const pathToRemoteFile = `${__dirname}/../uploaded/${filename}`;

  Logger.info(`Upload file from ${pathToLocalFile} to ${path.resolve(pathToRemoteFile)}`);

  try {
    await sftp.fastGet(pathToLocalFile, pathToRemoteFile);
    Logger.info('Successfully uploaded');
  } catch (err) {
    Logger.info(err);
  }

  process.stdin.resume();
};

const putFile = async (shell, command) => {
  const pathToLocalFile = parsePutCommand(command).path;
  const isFileExist = await fs.pathExists(pathToLocalFile);

  if (!isFileExist) {
    Logger.info('File not exist');
    return;
  }

  process.stdin.pause();

  const directory = await getCurrentDirectory(shell);

  const sftp = await conn.sftp();

  const pathToRemoteFile = `${directory}/${pathToLocalFile.split('/').pop()}`;

  Logger.info(`Download file from ${pathToLocalFile} to ${pathToRemoteFile}`);

  try {
    await sftp.fastPut(pathToLocalFile, pathToRemoteFile);
    Logger.info('Successfully downloaded');
  } catch (err) {
    Logger.info(err);
  }

  process.stdin.resume();

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
      case commandTypes.PUT_FILE:
        await putFile(shell, command);
        break;
      case commandTypes.SIMPLE:
        shell.write(command);
        break;
      default:
        throw new Error('Unexepected command');
    }
  });

  sigint.on('keyboard', () => {
    Logger.info('Type "exit" to stop ssh client');
    shell.write('\x03');
  });

  sigint.on('kill', () => {
    shell.write('\x03');
  });
})();
