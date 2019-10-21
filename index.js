const net = require('net');
const logger = require('./lib/logger.js');
// const Frame3eClient = require('./lib/frame3e_client.js');

class McProtocolClient {
  constructor(host, port) {
    this._host = host;
    this._port = port;
    this._isOpened = false;
    this.socket = new net.Socket();
    this.receivedCallback = null;

    this.socket.on('data', (_data) => {
      logger.debug("received");

      if (!this.receivedCallback) return;

      // サブヘッダ | 通信経路                 | 応答データ長 | 終了コード | 応答データ...
      // 0xd0 0x00  | 0x00 0xff 0xff 0x03 0x00 | 0x04 0x00    | 0x00 0x00  | 0x0a 0x00 ...

      let subHeader = _data.readInt16LE(0, 2);
      let accessRoute = _data.readInt16LE(2, 5);
      let dataLength = _data.readInt16LE(7, 2);
      let returnCode = _data.readInt16LE(9, 2);

      // TODO: 終了コード対応
      if (returnCode != 0) {
      }

      let data = [];

      for (let i = 11; i <= _data.length - 1; i += 2) {
        data.push(_data.readInt16LE(i, 2));
      }

      this.receivedCallback(data);
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

  async getWords(address, count) {
    logger.debug(`get words: ${address} - ${count} count`);

    // 3E
    // let buffer = new Buffer.from([0x50, 0x00, 0x00, 0xff, 0xff, 0x03, 0x00, 0x0c, 0x00, 0x10, 0x00, 0x01, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0xa8, 0x01, 0x00]);
    // logger.debug(buffer);

    let buffer = new Buffer.from(this._build_get_words_message(address, count));
    logger.debug(buffer);

    this.socket.write(buffer);

    return new Promise(async (resolve, reject) => {
      setTimeout(() => {
        reject(new Error("timeout"));
      }, 1000);

      this.receivedCallback = (data) => {
        resolve(data);
      };
    });
  }

  async getWord(address) {
    let value = await this.getWords(address, 1);
    return value[0];
  }

  async setWord(address, values=[0]) {
    logger.debug(`set words: ${address} - ${values}`);
  }

  async timeout(msec) {
    return new Promise((_, reject) => setTimeout(reject, msec));
  }

  _build_get_words_message(deviceName, count) {
    let m1 = this._build_get_words_message_monitoring_timer();
    let m2 = this._build_get_words_message_request_data(deviceName, count);

    let message = [].concat(
      this._build_get_words_message_sub_header(),
      this._build_get_words_message_access_route(),
      this._build_get_words_message_data_length(m1, m2),
      m1,
      m2,
    );

    console.log(message);

    return message;
  }

  _build_get_words_message_sub_header() {
    // | 要求電文  |
    // | 0x50 0x00 |
    return [0x50, 0x00];
  }

  // アクセス経路
  _build_get_words_message_access_route() {
    // | ネットワーク番号 | PC番号 | 要求先ユニットI/O番号 | 要求先ユニット局番号 |
    // | 0x00             | 0xff   | 0xff 0x03             | 0x00                 |

    let network_no      = [0x00];       // ネットワーク番号      アクセス先のネットワークNo.を指定します。
    let pc_no           = [0xff];       // PC番号                アクセス先のネットワークユニットの局番を指定します。
    let unit_io_no      = [0xff, 0x03]; // 要求先ユニットI/O番号 マルチドロップ接続局にアクセスする場合に，マルチドロップ接続元ユニットの先頭入 出力番号を指定します。
                                        // マルチCPUシステム，二重化システムのCPUユニットを指定します。
    let unit_station_no = [0x00];       // 要求先ユニット局番号  マルチドロップ接続局にアクセスする場合に，アクセス先ユニットの局番を指定します。

    return network_no.concat(pc_no, unit_io_no, unit_station_no);
  }

  _build_get_words_message_data_length(m1, m2) {
    // | 要求データ長 |
    // | 0x0c 0x00    | (12 byte)
    let buf = Buffer.alloc(2);
    buf.writeUInt16LE(m1.length + m2.length, 0);
    return Array.prototype.slice.call(buf, 0);
  }

  _build_get_words_message_monitoring_timer() {
    // | 監視タイマー |
    // | 0x10, 0x00   | (16 x 250ms = 4s)

    // 読出しおよび書込みの処理を完了するまでの待ち時間を設定します。
    // 接続局のE71がアクセス先へ処理を要求してから応答が返るまでの待ち時間を設定します。
    // 0000H(0): 無限待ち(処理が完了するまで待ち続けます。)
    // 0001H~FFFFH(1~65535): 待ち時間(単位: 250ms)

    return [0x10, 0x00];
  }

  _build_get_words_message_request_data(device_name, count) {
    // | デバイス番号   | デバイスコード |
    // | 0x64 0x00 0x00 | 0xa8           |

    // デバイス番号 3byte
    // 内部リレー (M)1234の場合(デバイス番号が10進数のデバイスの場合)
    // バイナリコード時は，デバイス番号を16進数に変換します。"1234"(10進) => "4D2"(16進)

    let command     = [0x01, 0x04];
    let sub_command = [0x00, 0x00]; // TODO: iQ-Rシリーズは0002かもしれない

    let messages = [].concat(
      command,
      sub_command,
      this._build_get_words_message_request_data_device_name(device_name),
      this._build_get_words_message_request_data_device_count(count),
    );

    return messages
  }

  _build_get_words_message_request_data_device_name(device_name) {
    // レジスタ判定
    if (device_name.match(/(^D)(\d+$)/)) {
      // Dレジスタ
      let result = device_name.match(/(^D)(\d+$)/);
      let register_name = result[1];
      let register_no   = parseInt(result[2]);

      let buf = Buffer.alloc(3);
      buf.writeUInt16LE(register_no, 0);
      let arr = Array.prototype.slice.call(buf, 0);

      return arr.concat([0xa8]);
    } else {
      // TODO: 未対応
    }
  }

  _build_get_words_message_request_data_device_count(count) {
    let buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(count, 0);

    return Array.prototype.slice.call(buffer, 0);
  }
}

module.exports = McProtocolClient;

//a.getWord('D2000');
//a.setWord('D2000', [10, 10, 30]);
//
//console.log(new Buffer('20'));
//console.log(new Buffer('20', 'hex'));
/*
let buf = Buffer.alloc(2);
buf.writeUInt16LE(2, 0);
let arr = Array.prototype.slice.call(buf, 0);


console.log(buf);
console.log(arr);

logger.debug("D320".match(/(^D)(\d+$)/));
logger.debug("D0".match(/^D\d+$/));
logger.debug("DA0".match(/^D\d+$/));
logger.debug("AD0".match(/^D\d+$/));
logger.debug("DAF".match(/^D\d+$/));
logger.debug("D999999".match(/^D\d+$/));
return;
*/

let c = async () => {
  let mcProtocolClient  = new McProtocolClient('192.168.1.210', '3000');
  await mcProtocolClient.open();
  let d0 = await mcProtocolClient.getWords('D0', 1).catch((e) => { logger.error(e); });
  logger.debug(d0);
  let d1 = await mcProtocolClient.getWords('D0', 14).catch((e) => { logger.error(e); });
  logger.debug(d1);
  let d2 = await mcProtocolClient.getWords('D1000', 959).catch((e) => { logger.error(e); });
  logger.debug(d2);
  let d3 = await mcProtocolClient.getWord('D7').catch((e) => { logger.error(e); });
  logger.debug(d3);
  //mcProtocolClient.close();
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
