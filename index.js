const net = require('net');
const logger = require('./lib/logger.js');

const plcHost = process.env.PLC_HOST;
const plcPort = process.env.PLC_PORT;

logger.debug(`${plcHost}:${plcPort} connecting...`);

var client = new net.Socket();

client.connect(plcPort, plcHost, () => {
  console.log('connected');
});

client.on('data', (data) => {
  console.log(data);
});

client.on('close', (data) => {
  console.log('closed');
});

client.on('error', (error) => {
  console.error(error);
});

console.log(1);
