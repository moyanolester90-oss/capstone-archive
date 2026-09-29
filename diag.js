const http = require('http');
const port = 3001;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('System is reachable!\n');
});

server.on('error', (e) => {
  console.error('DIAGNOSTIC ERROR:', e.message);
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${port} is ALREADY IN USE by another program.`);
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log('=========================================');
  console.log(`DIAGNOSTIC SERVER RUNNING AT:`);
  console.log(`http://localhost:${port}/`);
  console.log('=========================================');
  console.log('If you can see "System is reachable!" in Edge,');
  console.log('then the network and port are OK.');
  console.log('Press Ctrl+C to stop this test.');
});
