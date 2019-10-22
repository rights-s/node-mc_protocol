const net = require('net');
const logger = require('./lib/logger.js');

class McProtocolClient {
  constructor(host, port, options = {}) {
    this._host = host;
    this._port = port;
    this._pcNo = options['pcNo'] || 0xff;
    this._networkNo = options['networkNo'] || 0x00;
    this._unitIoNo = options['unitIoNo'] || [0xff, 0x03];
    this._unitStationNo = options['unitStationNo'] || 0x00;
    this._protocolFrame = options['protocolFrame'] || '3E'; // Only 3E Frame
    this._plcModel = options['plcModel'] || 'Q'; // Q or iQ-R

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
      logger.info(`PLC Model: ${this._plcModel}, Frame: ${this._protocolFrame}`);
      this._isOpened = true;
    });

    this.socket.on('close', (data) => {
      logger.info("Event: closed");
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
    logger.debug(`get words: ${deviceName} - ${count} count`);

    let buffer = new Buffer.from(this._buildGetWordsMessage(deviceName, count));
    logger.debug(`>> ${buffer.toString('hex').toUpperCase()}`);

    this.socket.write(buffer);

    return new Promise(async (resolve, reject) => {
      setTimeout(() => {
        reject(new Error("timeout"));
      }, 2000);

      this.receivedSuccessCallback = (values) => {
        resolve(values);
      };

      this.receivedFailureCallback = (code) => {
        reject(new Error(`Code: ${code}`));
      };
    });
  }

  async getWord(address) {
    let value = await this.getWords(address, 1);
    return value[0];
  }

  async setWords(deviceName, values=[]) {
    logger.debug(`set words: ${deviceName} - ${values}`);

    let buffer = new Buffer.from(this._buildSetWordsMessage(deviceName, values));
    logger.debug(`>> ${buffer.toString('hex').toUpperCase()}`);

    this.socket.write(buffer);

    return new Promise(async (resolve, reject) => {
      setTimeout(() => {
        reject(new Error("timeout"));
      }, 2000);

      this.receivedSuccessCallback = (values) => {
        resolve(values);
      };

      this.receivedFailureCallback = (code) => {
        reject(new Error(`Code: ${code}`));
      };
    });
  }

  async setWord(deviceName, value) {
    return this.setWords(deviceName, [value]);
  }

  async timeout(msec) {
    return new Promise((_, reject) => setTimeout(reject, msec));
  }

  // ワードアドレス読込メッセージ
  _buildGetWordsMessage(deviceName, count) {
    let m1 = this._buildMonitoringTimerMessage();
    let m2 = this._buildGetWordsRequestDataMessage(deviceName, count);

    let message = [].concat(
      this._buildSubHeaderMessage(),
      this._buildAccessRouteMessage(),
      this._buildDataLengthMessage(m1, m2),
      m1,
      m2,
    );

    return message;
  }

  // ワードアドレス書込メッセージ
  _buildSetWordsMessage(deviceName, values) {
    let m1 = this._buildMonitoringTimerMessage();
    let m2 = this._buildSetWordsRequestDataMessage(deviceName, values);

    let message = [].concat(
      this._buildSubHeaderMessage(),
      this._buildAccessRouteMessage(),
      this._buildDataLengthMessage(m1, m2),
      m1,
      m2,
    );

    return message;
  }

  // メッセージ - サブヘッダ
  _buildSubHeaderMessage() {
    // | 要求電文  |
    // | 0x50 0x00 |
    return [0x50, 0x00];
  }

  // メッセージ - アクセス経路
  _buildAccessRouteMessage() {
    // | ネットワーク番号 | PC番号 | 要求先ユニットI/O番号 | 要求先ユニット局番号 |
    // | 0x00             | 0xff   | 0xff 0x03             | 0x00                 |

    let networkNo     = [this._networkNo];      // ネットワーク番号      アクセス先のネットワークNo.を指定します。
    let pcNo          = [this._pcNo];           // PC番号                アクセス先のネットワークユニットの局番を指定します。
    let unitIoNo      = this._unitIoNo;         // 要求先ユニットI/O番号 マルチドロップ接続局にアクセスする場合に，マルチドロップ接続元ユニットの先頭入 出力番号を指定します。
                                                // マルチCPUシステム，二重化システムのCPUユニットを指定します。
    let unitStationNo = [this._unitStationNo];  // 要求先ユニット局番号  マルチドロップ接続局にアクセスする場合に，アクセス先ユニットの局番を指定します。

    return [].concat(networkNo, pcNo, unitIoNo, unitStationNo);
  }

  // メッセージ - 要求データ長
  _buildDataLengthMessage(m1, m2) {
    // | 要求データ長 |
    // | 0x0c 0x00    | (12 byte)
    let buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(m1.length + m2.length, 0);

    return Array.prototype.slice.call(buffer, 0);
  }

  // メッセージ - 監視タイマ
  _buildMonitoringTimerMessage() {
    // | 監視タイマー |
    // | 0x10, 0x00   | (16 x 250ms = 4s)

    // 読出しおよび書込みの処理を完了するまでの待ち時間を設定します。
    // 接続局のE71がアクセス先へ処理を要求してから応答が返るまでの待ち時間を設定します。
    // 0000H(0): 無限待ち(処理が完了するまで待ち続けます。)
    // 0001H~FFFFH(1~65535): 待ち時間(単位: 250ms)

    return [0x10, 0x00];
  }

  // メッセージ - ワードアドレス読込 要求データ
  _buildGetWordsRequestDataMessage(deviceName, count) {
    // | デバイス番号   | デバイスコード |
    // | 0x64 0x00 0x00 | 0xa8           |

    // デバイス番号 3byte
    // 内部リレー (M)1234の場合(デバイス番号が10進数のデバイスの場合)
    // バイナリコード時は，デバイス番号を16進数に変換します。"1234"(10進) => "4D2"(16進)

    let messages = [].concat(
      this._buildGetWordsCommand(),
      this._buildGetWordsSubCommand(),
      this._buildRequestDataDeviceCodeMessage(deviceName),
      this._buildRequestDataDeviceCountMessage(count),
    );

    return messages
  }

  // メッセージ - ワード読込コマンド
  _buildGetWordsCommand() {
    return [0x01, 0x04];
  }

  // メッセージ - ワード読込サブコマンド
  _buildGetWordsSubCommand() {
    if (this._plcModel == 'Q') {
      return [0x00, 0x00];

    } else if (this._plcModel == 'iQ-R') {
      return [0x02, 0x00];

    }
  }

  // メッセージ - ワードアドレス書込 要求データ
  _buildSetWordsRequestDataMessage(deviceName, values) {
    // | デバイス番号   | デバイスコード |
    // | 0x64 0x00 0x00 | 0xa8           |

    // デバイス番号 3byte
    // 内部リレー (M)1234の場合(デバイス番号が10進数のデバイスの場合)
    // バイナリコード時は，デバイス番号を16進数に変換します。"1234"(10進) => "4D2"(16進)

    let command     = [0x01, 0x14];
    let subCommand  = [0x00, 0x00]; // TODO: iQ-Rシリーズは0002かもしれない

    let _values = [];
    values.forEach((value) => {
      let buffer = Buffer.alloc(2);
      // TODO: 負の値動作確認
      buffer.writeInt16LE(value, 0);
      _values = _values.concat(Array.prototype.slice.call(buffer, 0));
    });

    let messages = [].concat(
      command,
      subCommand,
      this._buildRequestDataDeviceCodeMessage(deviceName),
      this._buildRequestDataDeviceCountMessage(values.length),
      _values,
    );

    return messages
  }

  // メッセージ - ワード書込コマンド
  _buildSetWordsCommand() {
    return [0x01, 0x14];
  }

  // メッセージ - ワード書込サブコマンド
  _buildSetWordsSubCommand() {
    if (this._plcModel == 'Q') {
      return [0x00, 0x00];

    } else if (this._plcModel == 'iQ-R') {
      return [0x02, 0x00];

    }
  }

  // メッセージ - デバイスコード
  _buildRequestDataDeviceCodeMessage(deviceName) {
    // レジスタ判定
    if (deviceName.match(/(^D)(\d+$)/)) {
      // Dレジスタ
      let result        = deviceName.match(/(^D)(\d+$)/);
      let registerName  = result[1];
      let registerNo    = parseInt(result[2]);

      let deviceNoBuffer = Buffer.alloc(this._lengthOfDeviceNo());
      deviceNoBuffer.writeUInt16LE(registerNo, 0);
      let deviceNoBufferArray = Array.prototype.slice.call(deviceNoBuffer, 0);

      let deviceCodeBuffer = Buffer.alloc(this._lengthOfDeviceCode());
      deviceCodeBuffer.writeUIntLE(0xa8, 0);
      let deviceCodeBufferArray = Array.prototype.slice.call(deviceCodeBuffer, 0);

      return [].concat(deviceNoBufferArray, deviceCodeBufferArray);

    } else {
      // TODO: 未対応
    }
  }

  // デバイス番号バイト数
  _lengthOfDeviceNo() {
    if (this._plcModel == 'Q') {
      return 3;

    } else if (this._plcModel == 'iQ-R') {
      return 4;

    }
  }

  // デバイスコードバイト数
  _lengthOfDeviceCode() {
    if (this._plcModel == 'Q') {
      return 1;

    } else if (this._plcModel == 'iQ-R') {
      return 2;

    }
  }

  // メッセージ - デバイス点数
  _buildRequestDataDeviceCountMessage(count) {
    let buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(count, 0);

    return Array.prototype.slice.call(buffer, 0);
  }
}

module.exports = McProtocolClient;

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

  /*
  let d = async() => {
    let d2 = await mcProtocolClient.getWords('D1000', 20).catch((e) => { logger.error(e); });
    logger.debug(d2);

    setTimeout(() => {
      d();
    });
  };
  d();
  */

  // mcProtocolClient.close();
};

c();
