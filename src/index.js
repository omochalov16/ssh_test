const args = require('yargs').argv;
const SSH2Promise = require('ssh2-promise');
const ioHook = require('iohook');
const tunnel = require('tunnel-ssh');
const { resolve: resolvePath } = require('path');
const { pathExists } = require('fs-extra');
const { useDefaults: loggerUseDefaults, info } = require('js-logger');


const validateConnectionString = require('./validateConnectionString');
const validateLocalForwardTunnelString = require('./validateLocalForwardTunnelString');

const parseConnectionString = require('./parseConnectionString');
const parseLocalForwardTunnelString = require('./parseLocalForwardTunnelString');
const parseGetCommand = require('./parseGetCommand');
const parsePutCommand = require('./parsePutCommand');

const commandTypeResolver = require('./commandTypeResolver');
const commandTypes = require('./commandTypes');

const KEYCODE_D = 35;
const KEYCODE_BACKSPACE = 14;
const KEYCODE_NEWLINE = 28;
const KEYCODE_C = 46;

const FIRST_SYSTEM_RAWCODE = 65000;

const CHARCODE_BACKSPACE = 127;
const CHARCODE_CTRL_H = 8;
const CHARCODE_CTRL_C = '\x03';

const NEWLINE_REGEXP = /\r?\n|\r/;

const DEFAULT_PORT = 22;

const connectionString = args._[0];
if (!connectionString || !validateConnectionString(connectionString)) {
  throw new Error(`Connection string has incorrect format, 
                             expected: user:password@host [-P port],
                             got: ${connectionString}`);
}

const connectionInfo = parseConnectionString(connectionString);
connectionInfo.port = args.P || DEFAULT_PORT;

let localForwardTunnelServer;
const localForwardTunnelString = args.L || '';
if (localForwardTunnelString.length) {
  if (!validateLocalForwardTunnelString(localForwardTunnelString)) {
    throw new Error(`Tunnel string has incorrect format,
                              expected: localAddress:localport:localAddress:localPort,
                              got: ${localForwardTunnelString}`);
  }

  let localForwardTunnelInfo = parseLocalForwardTunnelString(localForwardTunnelString);
  localForwardTunnelInfo = { ...localForwardTunnelInfo, ...connectionInfo };

  localForwardTunnelServer = tunnel(localForwardTunnelInfo, (err) => {
    if (err) throw (err);
  });

  localForwardTunnelServer.on('error', (err) => {
    throw (err);
  });
}

loggerUseDefaults();

const conn = new SSH2Promise(connectionInfo);

const setupShell = connection => connection.shell();

const setShellModeToStandart = (shell) => {
  shell.removeAllListeners();

  shell.on('data', (data) => {
    process.stdout.write(`${data}`);
  });

  shell.on('close', () => {
    info('Stream :: close');
    if (localForwardTunnelServer) localForwardTunnelServer.close();
    process.exit();
  });
};

const getCurrentDirectory = async shell => new Promise((res) => {
  shell.removeAllListeners();
  shell.on('data', (directoryResponse) => {
    const answerParts = directoryResponse.toString().split(NEWLINE_REGEXP);

    answerParts.forEach((part) => {
      if (part[0] === '/') {
        setShellModeToStandart(shell);
        res(part);
      }
    });
  });

  shell.write('pwd\n');
});

const getFile = async (shell, command) => {
  const filename = parseGetCommand(command).fileName;

  process.stdin.setRawMode(false);
  process.stdin.pause();

  const directory = await getCurrentDirectory(shell);

  const sftp = await conn.sftp();

  const pathToLocalFile = `${directory}/${filename}`;
  const pathToRemoteFile = `${__dirname}/../uploaded/${filename}`;

  info(`Upload file from ${pathToLocalFile} to ${resolvePath(pathToRemoteFile)}`);

  try {
    await sftp.fastGet(pathToLocalFile, pathToRemoteFile);
    info('Successfully uploaded');
  } catch (err) {
    info(err);
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
};

const putFile = async (shell, command) => {
  const pathToLocalFile = parsePutCommand(command).path;
  const isFileExist = await pathExists(pathToLocalFile);

  if (!isFileExist) {
    info('File not exist');
    return;
  }

  process.stdin.setRawMode(false);
  process.stdin.pause();

  const directory = await getCurrentDirectory(shell);

  const sftp = await conn.sftp();

  const pathToRemoteFile = `${directory}/${pathToLocalFile.split('/').pop()}`;

  info(`Download file from ${pathToLocalFile} to ${pathToRemoteFile}`);

  try {
    await sftp.fastPut(pathToLocalFile, pathToRemoteFile);
    info('Successfully downloaded');
  } catch (err) {
    info(err);
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
};

const sendCtrlC = shell => new Promise((res) => {
  process.stdin.pause();
  shell.write(CHARCODE_CTRL_C);
  setTimeout(() => {
    process.stdin.resume();
    res();
  }, 500);
});

const resolveKeyBoardModeByCachedCommand = (cachedCommand) => {
  if (cachedCommand.trimLeft().startsWith('get') || cachedCommand.trimLeft().startsWith('put')) {
    process.stdin.setRawMode(false);
  } else (process.stdin.setRawMode(true));
};

const isBackspaceCharacter = char => char === String.fromCharCode(CHARCODE_BACKSPACE)
                                     || char === String.fromCharCode(CHARCODE_CTRL_H);


const isBackspaceCharacterFromKeyEvent = keyEvent => keyEvent.keycode === KEYCODE_BACKSPACE
                                     || (keyEvent.keycode === KEYCODE_D && keyEvent.ctrlKey);

const isEndLineCharacter = char => char.match(NEWLINE_REGEXP) || char === CHARCODE_CTRL_C;

const isEndLineCharacterFromKeyEvent = keyEvent => keyEvent.keycode === KEYCODE_NEWLINE
                                     || (keyEvent.ctrlKey && keyEvent.keycode === KEYCODE_C);

let cachedCommand = '';
(async () => {
  await conn.connect();

  info('Client :: ready');
  const shell = await setupShell(conn);

  setShellModeToStandart(shell);
  process.stdin.setRawMode(true);

  ioHook.on('keydown', (keyEvent) => {
    resolveKeyBoardModeByCachedCommand(cachedCommand);

    if (isBackspaceCharacterFromKeyEvent(keyEvent)) {
      cachedCommand = cachedCommand.slice(0, cachedCommand.length - 1);
    }

    if (!isEndLineCharacterFromKeyEvent(keyEvent) && keyEvent.rawcode < FIRST_SYSTEM_RAWCODE) {
      cachedCommand += String.fromCharCode(keyEvent.rawcode);
    }
  });

  ioHook.start(false);

  process.stdin.on('data', async (data) => {
    const stringData = data.toString();

    if (process.stdin.isRaw && !isEndLineCharacter(stringData[0])) {
      shell.write(data);
      return;
    }

    if (process.stdin.isRaw && isBackspaceCharacter(stringData[0])) {
      shell.write(data);
      return;
    }

    const commandType = commandTypeResolver(cachedCommand);

    switch (commandType) {
      case commandTypes.GET_FILE:
        await sendCtrlC(shell);
        await getFile(shell, cachedCommand);
        break;
      case commandTypes.PUT_FILE:
        await sendCtrlC(shell);
        await putFile(shell, cachedCommand);
        break;
      case commandTypes.SIMPLE:
        shell.write(data);
        break;
      default:
        throw new Error('Unexepected command');
    }

    cachedCommand = '';
  });

  process.on('exit', () => { ioHook.unload(); ioHook.stop(); });
})();
