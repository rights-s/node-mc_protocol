const net = require('net');
const logger = require('./lib/logger.js');
// const Frame3eClient = require('./lib/frame3e_client.js');

class McProtocolClient {
  constructor(host, port) {
    this._host = host;
    this._port = port;
    this._isOpened = false;
    this.socket = new net.Socket();

    logger.debug(3);
    this.socket.on('data', (data) => {
      logger.debug(data);
    });

    this.socket.on('connect', () => {
      logger.debug('connected');
      this._isOpened = true;
    });

    this.socket.on('close', (data) => {
      logger.debug('closed');
    });

    this.socket.on('error', (error) => {
      logger.debug(error);
    });
  }

  async open(host, port) {
    if (host) this._host = host;
    if (port) this._port = port;

    return new Promise(resolve => {
      this.socket.connect(this._port, this._host, () => {
        resolve(true);
      });
    });
  }

  close() {
    this.socket.destroy();
    this._isOpened = false;
  }

  isOpened() {
    return this._isOpened;
  }

  async getWord(address, count) {
    logger.debug(`get words: ${address}`);
    logger.debug(0xff);

    return new Promise(resolve => {
      resolve(10);
    });
  }

  async setWord(address, values=[0]) {
    logger.debug(`set words: ${address} - ${values}`);
  }
}

module.exports = McProtocolClient;

//a.getWord('D2000');
//a.setWord('D2000', [10, 10, 30]);


let c = async () => {
  let mcProtocolClient  = new McProtocolClient('192.168.1.210', '3000');
  await mcProtocolClient.open();
  let d0 = await mcProtocolClient.getWord('D0', 1);
  logger.debug(d0);
  mcProtocolClient.close();
};

c();

// logger.debug(a.isOpened());

/*
 setTimeout(() => {
  a.close();

  setTimeout(() => {
    a.open();
  }, 1000);
}, 1000);
*/
