const net = require('net');
const logger = require('./lib/logger.js');
const MessageBuilder = require('./lib/message_builder.js');

class McProtocolClient {
  constructor(host, port, options = {}) {
    this._host = host;
    this._port = port;
    this._isBusy = false;

    this._options = {
      pcNo: options['pcNo'] || 0xff,
      networkNo: options['networkNo'] || 0x00,
      unitIoNo: options['unitIoNo'] || [0xff, 0x03],
      unitStationNo: options['unitStationNo'] || 0x00,
      protocolFrame: options['protocolFrame'] || '3E', // Only 3E Frame
      plcModel: options['plcModel'] || 'Q', // Q or iQ-R
    };

    this._isOpened = false;
    this.socket = new net.Socket();
    this.receivedSuccessCallback = null;
    this.receivedFailureCallback = null;

    this.socket.on('data', (_data) => {
      logger.info("Event: received");

      if (!this.receivedSuccessCallback) return;

      // サブヘッダ | 通信経路                 | 応答データ長 | 終了コード | 応答データ...
      // 0xd0 0x00  | 0x00 0xff 0xff 0x03 0x00 | 0x04 0x00    | 0x00 0x00  | 0x0a 0x00 ...

      let subHeader = _data.readInt16LE(0, 2);
      let accessRoute = _data.readInt16LE(2, 5);
      let dataLength = _data.readInt16LE(7, 2);
      let returnCode = _data.readInt16LE(9, 2);

      logger.debug(`<< ${_data.toString('hex').toUpperCase()}`);

      if (returnCode != 0) {
        return this.receivedFailureCallback('0x' + returnCode.toString(16));
      }

      let data = [];

      for (let i = 11; i <= _data.length - 1; i += 2) {
        data.push(_data.readInt16LE(i, 2));
      }

      this.receivedSuccessCallback(data);
    });

    this.socket.on('connect', () => {
      logger.info('Event: connected');
      logger.info(`PLC Model: ${this._options['plcModel']}, Frame: ${this._options['protocolFrame']}`);
      this._isOpened = true;
      this._isBusy = false;
    });

    this.socket.on('close', (data) => {
      logger.info("Event: closed");
      this._isBusy = false;
    });

    this.socket.on('error', (error) => {
      logger.error(error);
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

  async getWords(deviceName, count) {
    return new Promise(async (resolve, reject) => {
      let func = () => {
        this._isBusy = true;

        logger.debug(`get words: ${deviceName} - ${count} count`);

        let messageBuilder = new MessageBuilder(this._options);

        let buffer = new Buffer.from(messageBuilder.getWordsMessage(deviceName, count));
        logger.debug(`>> ${buffer.toString('hex').toUpperCase()}`);

        this.socket.write(buffer);

        setTimeout(() => {
          this._isBusy = false;
          reject(new Error("timeout"));
        }, 2000);

        this.receivedSuccessCallback = (values) => {
          this._isBusy = false;
          resolve(values);
        };

        this.receivedFailureCallback = (code) => {
          this._isBusy = false;
          reject(new Error(`Code: ${code}`));
        };
      };

      let id = setInterval(() => {
        if (this._isBusy) return;
        clearInterval(id);
        func();
      }, 10);
    });
  }

  async getWord(address) {
    let value = await this.getWords(address, 1);
    return value[0];
  }

  async setWords(deviceName, values=[]) {
    return new Promise(async (resolve, reject) => {
      let func = () => {
        this._isBusy = true;

        logger.debug(`set words: ${deviceName} - ${values}`);

        let messageBuilder = new MessageBuilder(this._options);

        let buffer = new Buffer.from(messageBuilder.setWordsMessage(deviceName, values));
        logger.debug(`>> ${buffer.toString('hex').toUpperCase()}`);

        this.socket.write(buffer);

        setTimeout(() => {
          this._isBusy = false;
          reject(new Error("timeout"));
        }, 2000);

        this.receivedSuccessCallback = (values) => {
          this._isBusy = false;
          resolve(values);
        };

        this.receivedFailureCallback = (code) => {
          this._isBusy = false;
          reject(new Error(`Code: ${code}`));
        };
      };

      let id = setInterval(() => {
        if (this._isBusy) return;
        clearInterval(id);
        func();
      }, 10);
    });
  }

  async setWord(deviceName, value) {
    return this.setWords(deviceName, [value]);
  }

  async _timeout(msec) {
    return new Promise((_, reject) => setTimeout(reject, msec));
  }
}

module.exports = McProtocolClient;

/* Sample
let c = async () => {
  let options = {
    // plcModel: 'iQ-R',
  };

  let mcProtocolClient = new McProtocolClient('192.168.1.210', '3000', options);
  await mcProtocolClient.open();

  let d0 = await mcProtocolClient.getWords('D0', 1).catch((e) => { logger.error(e); });
  logger.debug(d0);

  let d1 = await mcProtocolClient.getWords('D0', 14).catch((e) => { logger.error(e); });
  logger.debug(d1);

  let d2 = await mcProtocolClient.getWords('D1000', 20).catch((e) => { logger.error(e); });
  logger.debug(d2);

  let d3 = await mcProtocolClient.setWords('D0', [1]).catch((e) => { logger.error(e); });

  // let d3 = await mcProtocolClient.getWord('A7').catch((e) => {
  //   logger.error(e);
  // });

  let d = async() => {
    let d2 = await mcProtocolClient.getWords('D1000', 20).catch((e) => { logger.error(e); });
    logger.debug(d2);

    setTimeout(() => {
      d();
    });
  };
  d();

  // mcProtocolClient.close();
};

c();
*/
