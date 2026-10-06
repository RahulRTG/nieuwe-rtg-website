'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { naAntwoord } = require('../server/lib/antwoord-einde');

test('veel naverwerkers delen een finish-listener en behouden hun volgorde', () => {
  const res = new EventEmitter();
  const gezien = [];
  for (let i = 0; i < 50; i++) assert.equal(naAntwoord(res, () => gezien.push(i)), true);
  assert.equal(res.listenerCount('finish'), 1, 'een fysieke finish-listener');
  res.emit('finish');
  assert.deepEqual(gezien, Array.from({ length: 50 }, (_, i) => i));
  assert.equal(res.listenerCount('finish'), 0, 'de eenmalige listener is opgeruimd');
});

test('een lichte response-double met alleen on gebruikt dezelfde centrale haak', () => {
  const luisteraars = [];
  const res = { on(naam, fn) { if (naam === 'finish') luisteraars.push(fn); } };
  let uitgevoerd = 0;
  assert.equal(naAntwoord(res, () => { uitgevoerd += 1; }), true);
  assert.equal(naAntwoord(res, () => { uitgevoerd += 1; }), true);
  assert.equal(luisteraars.length, 1);
  luisteraars[0]();
  luisteraars[0]();
  assert.equal(uitgevoerd, 2, 'ook een on-listener rondt de rij maar eenmaal af');
});

test('serverlagen hangen niet opnieuw ieder rechtstreeks aan finish', () => {
  const wortel = path.join(__dirname, '..', 'server');
  const uitzonder = path.join(wortel, 'lib', 'antwoord-einde.js');
  const fout = [];
  const loop = map => {
    for (const naam of fs.readdirSync(map)) {
      const pad = path.join(map, naam);
      const st = fs.statSync(pad);
      if (st.isDirectory()) loop(pad);
      else if (pad.endsWith('.js') && pad !== uitzonder &&
        /res\.on\(['"]finish['"]/.test(fs.readFileSync(pad, 'utf8'))) fout.push(pad);
    }
  };
  loop(wortel);
  assert.deepEqual(fout, [], 'rechtstreekse finish-listeners: ' + fout.join(', '));
});
