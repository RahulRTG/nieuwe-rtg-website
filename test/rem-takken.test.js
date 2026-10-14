/* DE SNELHEIDSREM (server/rem.js): standaarden en opruimen, aanvulling op
   test/rem.test.js.

   De rem staat voor elke API-route. Twee dingen worden hier gezien die de
   bestaande toets niet raakt: wat de rem doet ZONDER opties (de stand waarin
   hij het vaakst wordt aangeroepen) en of de bakken per sleutel ooit weer
   opgeruimd worden -- zonder opruimer groeit het geheugen met elk IP-adres dat
   ooit langskwam, en dat is zelf een aanvalsvlak.

   Wat hier niet mag sneuvelen:
   1. zonder opties: 300 per minuut per IP, de 301e krijgt 429 met een
      Nederlandse melding; een limiet van 0 betekent "niets door" en niet de
      standaard;
   2. de opruimer haalt een bak pas weg na twee vensters stilte, en een bak
      die nog binnen het venster telt blijft staan (anders reset een aanvaller
      zijn teller door even te wachten).

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `opts.limit != null ? opts.limit : 300` vervangen door `opts.limit || 300`
     -> "1. zonder opties" ZAKT (RAAK): limiet 0 wordt 300
   - in de opruimer `windowMs * 2` vervangen door `0`
     -> "2. de opruimer" ZAKT (RAAK)

   Draai: node --test test/rem-takken.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const rem = require('../server/rem');

function res() {
  const r = { code: 200, lijf: null, status(c) { r.code = c; return r; }, json(x) { r.lijf = x; return r; } };
  return r;
}

test('1. zonder opties: 300 per minuut per IP, en limiet 0 laat niets door', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'] });
  const mw = rem();
  let door = 0;
  for (let i = 0; i < 300; i++) mw({ ip: '10.0.0.1' }, res(), () => door++);
  assert.equal(door, 300);
  const r = res();
  mw({ ip: '10.0.0.1' }, r, () => door++);
  assert.equal(r.code, 429);
  assert.match(r.lijf.error, /te veel verzoeken/);
  assert.equal(door, 300);
  const nul = rem({ limit: 0 });
  const r0 = res();
  nul({ ip: '10.0.0.2' }, r0, () => door++);
  assert.equal(r0.code, 429, 'limiet 0 is dicht, niet de standaard');
  const leeg = rem(null);
  leeg({ ip: '10.0.0.3' }, res(), () => door++);
  assert.equal(door, 301);
});

test('2. de opruimer haalt een bak pas na twee stille vensters weg', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'] });
  const mw = rem({ windowMs: 1000, limit: 2 });
  mw({ ip: 'oud' }, res(), () => {});
  t.mock.timers.tick(1000);
  mw({ ip: 'vers' }, res(), () => {});
  mw({ ip: 'vers' }, res(), () => {});
  t.mock.timers.tick(1000);
  assert.ok(mw.bakken.has('oud'), 'na een venster nog niet weg');
  t.mock.timers.tick(1000);
  assert.equal(mw.bakken.has('oud'), false, 'na meer dan twee vensters wel');
  assert.ok(mw.bakken.has('vers'));
  t.mock.timers.tick(1000);
  assert.equal(mw.bakken.size, 0, 'geen geheugen dat eeuwig groeit');
});
