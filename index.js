const logger = require('./lib/logger.js');
const Frame3eClient = require('./lib/frame3e_client.js');

class McProtocol {
  constructor(host, port) {
    logger.debug(`${host}:${port} connecting...`);

    this.client = new Frame3eClient(host, port);
  }

  getWord(address, count) {
    logger.debug(`get words: ${address}`);
  }

  setWord(address, values=[0]) {
    logger.debug(`set words: ${address} - ${values}`);
  }

  open() {
    this.client.open();
  }

  close() {
    this.client.close();
  }
}

module.exports = McProtocol;

let a = new McProtocol('192.168.1.210', '3000');
a.getWord('D2000');
a.setWord('D2000', [10, 10, 30]);

setTimeout(() => {
  a.close();

  setTimeout(() => {
    a.open();
  }, 1000);
}, 1000);

