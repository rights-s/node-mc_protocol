const net = require('net');
const logger = require('./logger.js');

module.exports = class Client {
  constructor(host, port) {
    this._host = host;
    this._port = port;
    this._isOpened = false;
    this.socket = new net.Socket();

    this.socket.on('data', (data) => {
      logger.debug(data);
    });

    this.socket.on('connect', () => {
      logger.debug('opened');
      this._isOpened = true;
    });

    this.socket.on('close', (data) => {
      logger.debug('closed');
      this._isOpened = false;
    });

    this.socket.on('error', (error) => {
      logger.debug(error);
    });
  }

  async open(host, port) {
    if (host) this._host = host;
    if (port) this._port = port;

    this.socket.connect(this._port, this._host, () => {
      logger.debug('connected');
      return true;
    });
  }

  close() {
    this.socket.destroy();
  }

  isOpened() {
    return this._isOpened;
  }
}
