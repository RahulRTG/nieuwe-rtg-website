'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { maakPgStoringProxy } = require('./pg-fault-proxy');

test('storingproxy onderbreekt alleen zijn eigen sockets en kan daarna opnieuw verbinden', async () => {
  const connections = new Set();
  const server = net.createServer(s => { connections.add(s); s.on('close', () => connections.delete(s)); s.pipe(s); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'postgresql://test@127.0.0.1:' + server.address().port + '/isolated';
  let a, b;
  const exchange = target => new Promise((resolve, reject) => {
    const u = new URL(target), socket = net.connect(Number(u.port), u.hostname);
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('no echo')); }, 1500);
    socket.on('connect', () => socket.write('isolated probe'));
    socket.once('data', data => { clearTimeout(timer); socket.destroy(); resolve(data.toString()); });
    socket.once('error', e => { clearTimeout(timer); reject(e); });
    socket.once('close', () => { clearTimeout(timer); reject(new Error('closed')); });
  });
  try {
    a = await maakPgStoringProxy(url); b = await maakPgStoringProxy(url);
    assert.equal(await exchange(a.url), 'isolated probe');
    a.verbreek();
    await assert.rejects(exchange(a.url));
    assert.equal(await exchange(b.url), 'isolated probe', 'andere verbinding werd geraakt');
    assert.equal(await exchange(url), 'isolated probe', 'de doelserver werd geraakt');
    a.herstel();
    assert.equal(await exchange(a.url), 'isolated probe');
  } finally {
    if (a) await a.sluit(); if (b) await b.sluit();
    for (const socket of connections) socket.destroy();
    await new Promise(r => server.close(r));
  }
});
