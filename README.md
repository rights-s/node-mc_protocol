# node-mc_protocol
Node.js McProtocol Library

## Install & Usage

```
npm install node-mc_protocol --save
```

```
let McProtocolClient = require('node-mc_protocol');

let ipAddr  = '192.168.1.210'; // <PLC IPADDRESS>
let port    = '3000';          // <PLC PORT>
let options = {
  pcNo: 0xff,                  // <McProtocol PC No.> default: 0xff
  networkNo: 0x00,             // <McProtocol Network No.> default: 0x00
  unitIoNo: [0xff, 0x03],      // <McProtocol Unit Io No.> default: [0xff, 0x03]
  unitStationNo: 0x00,         // <McProtocol Unit Station No.> default: 0x00
  protocolFrame: '3E',         // <McProtocol Frame> only: 3E(Frame)
  plcModel: 'Q',               // <PLC Model> [Q or iQ-R] default: Q
};

let mcProtocolClient = new McProtocolClient(ipAddr, port, options); // initialize client.

let sampleFunc = async () => {
  await mcProtocolClient.open(); // connection to plc.

  // Devices read (only D register)
  let values = await mcProtocolClient.getWords('D100', 5).catch((e) => { console.log(e); });
  // => [1, 0, 2, 100, 3]

  let value = await mcProtocolClient.getWord('D100').catch((e) => { console.log(e); });
  // => 1

  // Devices write (only D register)
  await mcProtocolClient.setWords('D100', [100, 1000, 10000, 0, 2]).catch((e) => { console.log(e); });

  await mcProtocolClient.setWord('D100', 1234).catch((e) => { console.log(e); });
  
  mcProtocolClient.close(); // close client.
};
```
