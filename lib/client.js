const net = require('net');
const logger = require('./logger.js');

module.exports = class Client {
  constructor(host, port) {
    this.host = host;
    this.port = port;

    this.socket = new net.Socket();

    this.socket.on('data', (data) => {
      logger.debug(data);
    });

    this.socket.on('close', (data) => {
      logger.debug('closed');
    });

    this.socket.on('error', (error) => {
      logger.debug(error);
    });

    this.open();
  }

  open() {
    this.socket.connect(this.port, this.host, () => {
      logger.debug('connected');
    });
  }

  close() {
    this.socket.destroy();
  }
}
