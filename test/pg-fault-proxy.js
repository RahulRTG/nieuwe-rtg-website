'use strict';
const net = require('node:net');

// Storing uitsluitend op de verbinding van de aanroeper. Geen processen
// zoeken, geen signalen op de host en geen gedeelde container pauzeren.
async function maakPgStoringProxy(databaseUrl) {
  const doel = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(doel.protocol)) throw new Error('PostgreSQL-URL vereist');
  const sockets = new Set();
  let onderbroken = false;
  const server = net.createServer(client => {
    if (onderbroken) { client.destroy(); return; }
    const upstream = net.connect({ host: doel.hostname, port: Number(doel.port || 5432) });
    sockets.add(client); sockets.add(upstream);
    const sluit = () => { sockets.delete(client); sockets.delete(upstream); client.destroy(); upstream.destroy(); };
    client.on('error', sluit); upstream.on('error', sluit);
    client.on('close', sluit); upstream.on('close', sluit);
    client.pipe(upstream); upstream.pipe(client);
  });
  await new Promise((ja, nee) => { server.once('error', nee); server.listen(0, '127.0.0.1', ja); });
  const url = new URL(doel); url.hostname = '127.0.0.1'; url.port = String(server.address().port);
  return {
    url: url.toString(),
    verbreek() { onderbroken = true; for (const s of sockets) s.destroy(); sockets.clear(); },
    herstel() { onderbroken = false; },
    async sluit() { onderbroken = true; for (const s of sockets) s.destroy(); sockets.clear(); await new Promise(r => server.close(r)); }
  };
}
module.exports = { maakPgStoringProxy };
