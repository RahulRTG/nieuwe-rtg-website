/* RTG Gereedschap: de rekenmotor (puur, geen eval) en de klok-kern
   (wekkers en timers op de server; de veegfunctie wordt hier direct
   aangeroepen, dus de test wacht nergens op).
   Draai los: node --experimental-sqlite --test test/gereedschap.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { reken } = require('../public/shared/rekenkern');
const { maakKlok } = require('../server/kern/klok');

test('1. de rekenmotor: volgorde, haakjes, procent, komma en eerlijke fouten', () => {
  assert.equal(reken('2+3x4').waarde, 14, 'keer gaat voor plus');
  assert.equal(reken('(2+3)x4').waarde, 20);
  assert.equal(reken('200+10%').waarde, 220, 'procent slaat op het linkerdeel, zoals op een zakrekenmachine');
  assert.equal(reken('200-10%').waarde, 180);
  assert.equal(reken('21%x200').waarde, 42, 'los procent is gewoon delen door honderd');
  assert.equal(reken('1,5+1.5').waarde, 3, 'komma en punt zijn allebei goed');
  assert.equal(reken('-5+8').waarde, 3, 'een leidend minteken mag');
  assert.equal(reken('0,1+0,2').waarde, 0.3, 'geen zwevendekomma-ruis naar de gebruiker');
  assert.ok(reken('100/0').fout, 'delen door nul is een nette fout');
  assert.ok(reken('(2+3').fout, 'een open haakje is een nette fout');
  assert.ok(reken('2+abc').fout, 'vreemde tekens zijn een nette fout');
  assert.ok(reken('').fout);
});

test('2. de klok-kern: wekkers en timers gaan af op de server, precies een keer', () => {
  const db = { data: {} };
  const seintjes = [];
  const klok = maakKlok({ db, save: () => {}, crypto, schoon: (s, n) => String(s).slice(0, n),
    sseToCustomer: (key, ev, d) => seintjes.push({ key, ev, d }), sendPushToUser: null });

  // een losse wekker op dit moment: de veeg laat hem afgaan en zet hem uit
  const nu = new Date();
  const hhmm = String(nu.getHours()).padStart(2, '0') + ':' + String(nu.getMinutes()).padStart(2, '0');
  const w = klok.klokWekker('lidA', { tijd: hhmm, label: 'Proef' });
  assert.ok(w.id);
  assert.ok(klok.klokWekker('lidA', { tijd: '25:00' }).error, 'een onmogelijke tijd is een nette fout');
  klok.klokVeeg();
  assert.equal(seintjes.length, 1, 'de wekker gaat af');
  assert.equal(seintjes[0].d.kind, 'wekker');
  klok.klokVeeg();
  assert.equal(seintjes.length, 1, 'en maar EEN keer: een losse wekker herhaalt niet');
  assert.equal(klok.klokLijst('lidA').wekkers[0].aan, false, 'de losse wekker staat daarna uit');

  // een vaste wekker (elke dag) blijft aan, maar gaat vandaag niet nog eens af
  const w2 = klok.klokWekker('lidA', { tijd: hhmm, dagen: [0, 1, 2, 3, 4, 5, 6], label: 'Vast' });
  klok.klokVeeg();
  assert.equal(seintjes.length, 2);
  klok.klokVeeg();
  assert.equal(seintjes.length, 2, 'zelfde minuut, zelfde dag: niet dubbel');
  assert.equal(klok.klokLijst('lidA').wekkers.find(x => x.id === w2.id).aan, true, 'de vaste wekker blijft aan');

  // een timer: de server rekent het einde uit; verlopen = afgelopen + seintje
  assert.ok(klok.klokTimer('lidA', { duurS: 2 }).error, 'korter dan 5 seconden is geen timer');
  const t = klok.klokTimer('lidA', { duurS: 60, label: 'Thee' });
  assert.ok(t.id);
  db.data.klok['lid:lidA'].timers[0].eindOp = new Date(Date.now() - 1000).toISOString(); // de tijd verzetten, niet wachten
  klok.klokVeeg();
  assert.equal(seintjes.length, 3);
  assert.equal(seintjes[2].d.kind, 'timer');
  const lijst = klok.klokLijst('lidA');
  assert.equal(lijst.timers[0].af, true);
  assert.equal(lijst.timers[0].overS, 0);
  klok.klokVeeg();
  assert.equal(seintjes.length, 3, 'een afgelopen timer blijft stil');
});
