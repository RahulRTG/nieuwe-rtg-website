/* DE VIJF ZWARE RECHTEN OPENEN NU ECHT IETS (kern/command/toegang.js).

   Eerst legden geef() en breekGlas() alleen vast wie wat vroeg; geen van de vijf
   handelingen vroeg het na. Nu staat er per handeling een poort, en deze toets
   houdt per recht dezelfde vier dingen vast:
   - zonder het recht: 403, en het zegt welk recht en hoe je het krijgt;
   - met het recht (gegeven door een collega op naam, of de nooddeur): door;
   - na intrekken of verval: weer 403;
   - de gedeelde kantoorcode krijgt het nooit, ook niet via de nooddeur.

   Verval wordt gesimuleerd door `tot` terug te zetten: de huisklok wordt eenmaal
   bij het laden gelezen, en een tweede proces per recht maakt deze toets traag
   zonder iets extra te bewijzen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakCommand } = require('../server/kern/command');
const maakInzage = require('../server/kern/afdelingen/inzage');

const A = 'mw-a', B = 'mw-b', GEDEELD = 'kantoor (gedeelde code)';

function wereld() {
  const db = { data: {} };
  const c = maakCommand({ db, save() {}, crypto, kern: {} });
  return { db, c, t: c.toegang };
}
const geweigerd = (r, recht) => {
  assert.equal(r && r.status, 403, 'niet geweigerd: ' + JSON.stringify(r).slice(0, 200));
  assert.equal(r.recht, recht, 'de weigering noemt het recht niet');
  assert.match(r.error, /recht\/geef|nooddeur/, 'de weigering zegt niet hoe het wel kan');
};
const verloop = (t, id) => { const x = t.open().find(r => r.id === id); x.tot = new Date(Date.now() - 1000).toISOString(); };

/* Elke handeling als functie van de actor; `voor` maakt de wereld klaar. */
const HANDELINGEN = {
  'beleid-spoed': {
    doe: (w, door) => w.c.beleid.zet('risico.autoGrens', 25, door, 'spoed na een storing', null, true)
  },
  'agent-ontgrendelen': {
    voor: (w) => { for (let i = 0; i < 10; i++) w.c.toezicht.boek('agent-x', { gelukt: false }); },
    doe: (w, door) => w.c.toezicht.hervat('agent-x', door, 'oorzaak gevonden en hersteld')
  },
  'herstel-forceren': {
    voor: (w) => {
      const v = w.c.beleid.zet('risico.mensGrens', 1, 'mw-c', 'de toets zet alles op een menselijk besluit');
      const k = w.c.beleid.keur(v.voorstel.id, 'mw-d', true, 'akkoord voor de toets');
      assert.ok(!k.error, JSON.stringify(k));
    },
    doe: (w, door) => w.c.transactie.draai('melding-afsluiten', { droog: false, door, menselijkAkkoord: true, reden: 'beoordeeld' })
  },
  'massamutatie': {
    doe: (w, door) => w.c.transactie.draai('melding-afsluiten', { droog: false, door, max: 500, reden: 'opruimen' })
  },
  'kluis-inzage': {
    doe: (w, door) => maakInzage({ AFDELINGEN: { ks: { naam: 'Klantenservice', naamInzage: true } }, accounts: {},
      keyVanCodenaam: async () => null, audit() {} }).naamInzage('ks', 'Amberen Vos', door, w.t.vereist)
  }
};

for (const [recht, h] of Object.entries(HANDELINGEN)) {
  test(recht + ': zonder nee, gegeven ja, ingetrokken nee, verlopen nee', async () => {
    const w = wereld();
    if (h.voor) h.voor(w);
    geweigerd(await h.doe(w, A), recht);

    const g = w.t.geef(recht, A, B, 'een collega geeft het voor deze toets', 10);
    assert.ok(g.recht, JSON.stringify(g));
    const ja = await h.doe(w, A);
    assert.notEqual(ja && ja.status, 403, 'met het recht nog steeds geweigerd: ' + JSON.stringify(ja).slice(0, 200));

    if (h.voor) h.voor(w);
    w.t.trekIn(g.recht.id, B, 'klaar');
    geweigerd(await h.doe(w, A), recht);

    const n = w.t.breekGlas(recht, A, 'storing, de dienstdoende collega is onbereikbaar');
    assert.ok(n.recht, JSON.stringify(n));
    verloop(w.t, n.recht.id);
    geweigerd(await h.doe(w, A), recht);
  });
}

test('de gedeelde code krijgt geen zwaar recht, en een geldig recht op haar naam opent niets', async () => {
  const w = wereld();
  assert.equal(w.t.geef('kluis-inzage', GEDEELD, A, 'probeer het aan de gedeelde code').status, 403);
  assert.equal(w.t.geef('kluis-inzage', A, GEDEELD, 'de gedeelde code geeft').status, 403);
  assert.equal(w.t.breekGlas('kluis-inzage', GEDEELD, 'de gedeelde code breekt het glas').status, 403);
  /* Ook als er toch een rij staat (een oude, of met de hand gezet): de poort zelf weigert. */
  w.db.data.commandRechten = w.db.data.commandRechten || [];
  w.t.geef('kluis-inzage', A, B, 'een geldig recht voor A');
  const rij = w.t.open()[0]; rij.aan = GEDEELD;
  geweigerd(await HANDELINGEN['kluis-inzage'].doe(w, GEDEELD), 'kluis-inzage');
});

test('een menselijk akkoord zonder recht weigert alleen waar de routering erom vraagt', () => {
  const w = wereld();
  const r = w.c.transactie.draai('melding-afsluiten', { droog: false, door: A, menselijkAkkoord: true, reden: 'beoordeeld' });
  assert.notEqual(r.status, 403, 'op een automatische routering hield het akkoord zonder recht hem tegen: ' + JSON.stringify(r).slice(0, 200));
});

test('een ontbrekende rechtenlaag houdt de kluis dicht', async () => {
  const r = await maakInzage({ AFDELINGEN: { ks: { naam: 'Klantenservice', naamInzage: true } }, accounts: {},
    keyVanCodenaam: async () => null, audit() {} }).naamInzage('ks', 'Amberen Vos', A);
  assert.equal(r.status, 503);
});
