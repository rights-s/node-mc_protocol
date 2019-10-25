const logger = require('./logger.js');

module.exports = class MessageBuilder {
  constructor(options) {
    this._options = options;
  }

  getWordsMessage(deviceName, count) {
    return this._buildGetWordsMessage(deviceName, count);
  }

  setWordsMessage(deviceName, values) {
    return this._buildSetWordsMessage(deviceName, values);
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

    let networkNo     = [this._options['networkNo']];     // ネットワーク番号      アクセス先のネットワークNo.を指定します。
    let pcNo          = [this._options['pcNo']];          // PC番号                アクセス先のネットワークユニットの局番を指定します。
    let unitIoNo      = this._options['unitIoNo'];        // 要求先ユニットI/O番号 マルチドロップ接続局にアクセスする場合に，マルチドロップ接続元ユニットの先頭入 出力番号を指定します。
                                                          // マルチCPUシステム，二重化システムのCPUユニットを指定します。
    let unitStationNo = [this._options['unitStationNo']]; // 要求先ユニット局番号  マルチドロップ接続局にアクセスする場合に，アクセス先ユニットの局番を指定します。

    return [].concat(networkNo, pcNo, unitIoNo, unitStationNo);
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

  // メッセージ - 要求データ長
  _buildDataLengthMessage(m1, m2) {
    // | 要求データ長 |
    // | 0x0c 0x00    | (12 byte)
    let buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(m1.length + m2.length, 0);

    return Array.prototype.slice.call(buffer, 0);
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
      if (this._lengthOfDeviceNo() == 3) {
        deviceNoBuffer.writeUInt16LE(registerNo, 0);
      } else if (this._lengthOfDeviceNo() == 4) {
        deviceNoBuffer.writeUInt32LE(registerNo, 0);
      }
      let deviceNoBufferArray = Array.prototype.slice.call(deviceNoBuffer, 0);

      let deviceCodeBuffer = Buffer.alloc(this._lengthOfDeviceCode());
      if (this._lengthOfDeviceCode() == 1) {
        deviceCodeBuffer.writeUInt8(0xa8, 0);

      } else if (this._lengthOfDeviceCode() == 2) {
        deviceCodeBuffer.writeUInt16LE(0xa8, 0);

      }
      let deviceCodeBufferArray = Array.prototype.slice.call(deviceCodeBuffer, 0);

      return [].concat(deviceNoBufferArray, deviceCodeBufferArray);

    } else {
      // TODO: 未対応
    }
  }

  // デバイス番号バイト数
  _lengthOfDeviceNo() {
    if (this._options['plcModel'] == 'Q') {
      return 3;

    } else if (this._options['plcModel'] == 'iQ-R') {
      return 4;

    }
  }

  // デバイスコードバイト数
  _lengthOfDeviceCode() {
    if (this._options['plcModel'] == 'Q') {
      return 1;

    } else if (this._options['plcModel'] == 'iQ-R') {
      return 2;

    }
  }

  // メッセージ - デバイス点数
  _buildRequestDataDeviceCountMessage(count) {
    let buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(count, 0);

    return Array.prototype.slice.call(buffer, 0);
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
    if (this._options['plcModel'] == 'Q') {
      return [0x00, 0x00];

    } else if (this._options['plcModel'] == 'iQ-R') {
      return [0x02, 0x00];

    }
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

  // メッセージ - ワードアドレス書込 要求データ
  _buildSetWordsRequestDataMessage(deviceName, values) {
    // | デバイス番号   | デバイスコード |
    // | 0x64 0x00 0x00 | 0xa8           |

    // デバイス番号 3byte
    // 内部リレー (M)1234の場合(デバイス番号が10進数のデバイスの場合)
    // バイナリコード時は，デバイス番号を16進数に変換します。"1234"(10進) => "4D2"(16進)

    let _values = [];
    values.forEach((value) => {
      let buffer = Buffer.alloc(2);
      buffer.writeInt16LE(value, 0);
      _values = _values.concat(Array.prototype.slice.call(buffer, 0));
    });

    let messages = [].concat(
      this._buildSetWordsCommand(),
      this._buildSetWordsSubCommand(),
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
    if (this._options['plcModel'] == 'Q') {
      return [0x00, 0x00];

    } else if (this._options['plcModel'] == 'iQ-R') {
      return [0x02, 0x00];

    }
  }

}
