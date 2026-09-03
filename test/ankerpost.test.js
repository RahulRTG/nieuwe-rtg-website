/* DE ANKERPOST (server/lib/ankerpost.js) -- de bestemming van het ankerblok.

   Het besluit erachter: een tweede machine binnen RTG. Wat deze toets bewaakt
   is niet dat de post werkt (dat hangt aan een machine die hier niet staat)
   maar dat hij NOOIT doet alsof. Drie manieren waarop een anker een sier wordt:
   hij wijst naar dezelfde schijf, hij zwijgt als er geen bestemming is, of hij
   maakt van iets dat terugkomt stilzwijgend een waarheid.

   Draai los: node --test test/ankerpost.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakAnkerpost, keurBestemming } = require('../server/lib/ankerpost');

const dienst = {
  blok: () => ({ at: '2026-09-03T10:00:00.000Z', punten: { inzageLog: { nr: 3, hash: 'aa' } }, zegel: 'zz' }),
  reken: (eerder) => ({ ok: true, gerekendMet: eerder.zegel })
};
const post = (env, haal) => maakAnkerpost({ ankerdienst: dienst, omgeving: env, haal });

test('1. dezelfde schijf is geen bestemming', () => {
  for (const url of ['file:///var/anker.json', '/var/anker.json', 'https://localhost/anker',
    'http://127.0.0.1:3000/anker', 'https://iets.localhost/anker']) {
    const u = keurBestemming(url);
    assert.equal(u.ok, false, url + ' werd geaccepteerd als ankerbestemming');
    assert.ok(u.reden.length > 30, url + ': de weigering legt niets uit');
  }
});

test('2. geen bestemming is "niet in bedrijf", en dat blijft zo klinken', async () => {
  const p = post({});
  const s = p.stand();
  assert.equal(s.inBedrijf, false);
  assert.match(s.reden, /RTG_ANKERPOST_URL/);
  const uit = await p.post();
  assert.equal(uit.ok, false);
  assert.equal(uit.inBedrijf, false, 'zonder bestemming meldt de post zich toch als in bedrijf');
});

test('3. onversleuteld gaat alleen met een uitgesproken keuze', () => {
  assert.equal(keurBestemming('http://anker.intern/').ok, false);
  process.env.RTG_ANKERPOST_ONVEILIG = '1';
  try { assert.equal(keurBestemming('http://anker.intern/').ok, true); }
  finally { delete process.env.RTG_ANKERPOST_ONVEILIG; }
});

test('4. de post stuurt het blok vooruit, en alleen bijschrijven', async () => {
  const gezien = [];
  const p = post({ RTG_ANKERPOST_URL: 'https://anker.rtg.intern/', RTG_ANKERPOST_SLEUTEL: 'geheim' },
    async (url, opt) => { gezien.push({ url, method: opt.method, auth: opt.headers.authorization });
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) }; });
  const uit = await p.post();
  assert.equal(uit.ok, true);
  assert.equal(gezien[0].method, 'POST');
  assert.equal(gezien[0].auth, 'Bearer geheim');
  assert.match(gezien[0].url, /anker$/);
  assert.ok(uit.blok && uit.blok.zegel, 'het weggebrachte blok komt niet terug in het antwoord');
});

test('5. wat terugkomt is invoer en geen waarheid', async () => {
  /* Iets dat niet op een blok lijkt, is een BEVINDING over de tweede machine --
     geen aanleiding om hier iets te repareren. */
  const p = post({ RTG_ANKERPOST_URL: 'https://anker.rtg.intern/' },
    async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ blok: { zomaar: 'iets' } }) }));
  const uit = await p.afrekenen();
  assert.equal(uit.afgerekend, false);
  assert.match(uit.reden, /geen ankerblok|praat anders/);

  const g = post({ RTG_ANKERPOST_URL: 'https://anker.rtg.intern/' },
    async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ blok: dienst.blok() }) }));
  const goed = await g.afrekenen();
  assert.equal(goed.afgerekend, true);
  assert.equal(goed.gerekendMet, 'zz', 'het teruggehaalde blok ging niet ongewijzigd naar de ankerdienst');
});

test('6. een machine die niet antwoordt is een storing en geen "in orde"', async () => {
  const p = post({ RTG_ANKERPOST_URL: 'https://anker.rtg.intern/' },
    async () => { throw new Error('geen verbinding'); });
  const uit = await p.post();
  assert.equal(uit.ok, false);
  assert.match(uit.reden, /niet te bereiken/);
  const stuk = post({ RTG_ANKERPOST_URL: 'https://anker.rtg.intern/' },
    async () => ({ ok: false, status: 503, text: async () => '' }));
  assert.equal((await stuk.post()).ok, false);
});

test('7. de grens staat in elke stand, en niet alleen in een document', () => {
  const s = post({ RTG_ANKERPOST_URL: 'https://anker.rtg.intern/' }).stand();
  assert.equal(s.inBedrijf, true);
  assert.match(s.grens, /beide machines|buiten dit huis/i,
    'de stand zwijgt over wat een tweede machine BINNEN RTG niet bewijst');
});

test('8. de post schrijft nooit in een journaal', () => {
  const bron = require('fs').readFileSync(require('path').join(__dirname, '..', 'server', 'lib', 'ankerpost.js'), 'utf8');
  const { zonderCommentaar } = require('../scripts/lib/bron');
  assert.doesNotMatch(zonderCommentaar(bron), /db\.data|\.push\(/,
    'de post raakt de journalen aan; dan repareert het anker de keten die het moest controleren');
});
