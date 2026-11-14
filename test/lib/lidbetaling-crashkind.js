/* Echte SQLite/Pay/Trust/punten-opzet met een lokale provider en UI-doubles.
   De kill valt DIRECT na de lokale betaalcommit, voor factuur/keuken/seinen.
   Save-observatoren geven iedere aanroep ongewijzigd door. Een tweede SQLite-
   verbinding en daarna een nieuw proces controleren de opgeslagen toestand. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const [soort, fase, tegoedArg] = process.argv.slice(2);
const tegoedCenten = Number(tegoedArg) || 0, zelfCenten = 2000 - tegoedCenten;
assert.ok(['order', 'rit'].includes(soort));
assert.ok(['heen', 'terug'].includes(fase));
const dbm = require('../../server/db');
const { db } = dbm;
const ref = 'RTG-PROEF-' + soort.toUpperCase(), idem = soort + ':' + ref;
const zaakIdem = 'zaakbetaling:ALFA:' + idem;
const oplaadIdem = 'oplaad:ALFA:' + idem + ':autolaad';
const eventId = 'evt-autolaad-' + soort;
const zaak = { code: 'PROEF', name: 'Proefzaak', type: 'taxi', settings: {} };
if (fase === 'heen') {
  const onderwerp = {
    ref, customerKey: 'k:ALFA', customerCodename: 'ALFA', customerTier: 'business',
    supplierCode: zaak.code, supplierName: zaak.name, status: 'wacht-op-betaling', paid: false,
    at: new Date().toISOString(), total: 20, quote: 20,
    type: 'taxi', from: 'A', to: 'B', passengers: 1,
    items: [{ name: 'Proef', price: 20, qty: 1 }]
  };
  db.data = {
    suppliers: [zaak], orders: soort === 'order' ? [onderwerp] : [],
    rides: soort === 'rit' ? [onderwerp] : [], boekingen: [],
    punten: { 'k:ALFA': { saldo: 0, tegoedCenten, historie: [] } },
    paySaldi: {}, payBoekingen: [], vreemd: { waarde: 1 }
  };
  dbm.save();
} else dbm.load();

const lezer = new DatabaseSync(path.join(process.env.RTG_DATA_DIR, 'store.db'), { readOnly: true });
const kluis = require('../../server/kluis');
const lees = key => {
  const rij = lezer.prepare('SELECT val FROM kv WHERE key=? AND deleted=0').get(key);
  return rij ? JSON.parse(kluis.ontsleutel(rij.val)) : null;
};
const saves = [], commits = [];
let meet = false, vreemdeScans = 0, providerAanroepen = 0, nevenwerk = 0;
Object.defineProperty(db.data.vreemd, 'toJSON', {
  value() { vreemdeScans++; return { waarde: this.waarde }; }
});
function eigenaarSave(eigenaar) {
  const noteer = (methode, sleutels) => {
    if (meet) saves.push({
      eigenaar, methode, sleutels: sleutels === undefined ? null : [...sleutels],
      duurzaam: dbm.inBundel({ duurzaam: true })
    });
  };
  const save = Object.assign((...args) => {
    noteer('save', args[0]);
    return dbm.save(...args);
  }, dbm.save);
  for (const methode of ['sleutels', 'bestaande']) save[methode] = sleutels => {
    noteer(methode, sleutels);
    if (meet && fase === 'heen' && eigenaar === 'lid') {
      assert.equal(dbm.inBundel(), false, 'de lokale opslag is geen nog open betaalbundel');
    }
    const uit = dbm.save[methode](sleutels);
    if (meet && fase === 'heen' && eigenaar === 'lid') {
      assert.equal(methode, 'bestaande');
      assert.deepEqual(sleutels, [soort === 'order' ? 'orders' : 'rides', 'punten']);
      assert.equal(nevenwerk, 0, 'geen handler-nevenwerk voor de lokale betaalcommit');
      const resultaat = { grens: 'direct-na-lid-save', providerAanroepen, nevenwerk,
        saves, commits, vast: vast() };
      // Synchroon schrijven: een stdout-callback zou de handler laten doorgaan.
      fs.writeSync(1, JSON.stringify(resultaat) + '\n');
      process.kill(process.pid, 'SIGKILL');
    }
    return uit;
  };
  return save;
}

const betaal = {
  AANBIEDER: 'simulatie',
  async maakBetaling(o) {
    providerAanroepen++;
    assert.equal(fase, 'heen', 'een replay mag de provider nooit opnieuw starten');
    assert.equal(o.bedrag, 2000);
    return {
      id: 'pi_' + soort, status: 'succeeded', aanbieder: 'stripe',
      bedrag: o.bedrag, valuta: 'eur', referentie: o.referentie
    };
  },
  async haalBetaling() {
    throw new Error('de definitief betaalde proef vraagt geen providerherstel');
  }
};
const { trustPlane } = require('../../server/opzet/trust-bewijs')({
  db, save: eigenaarSave('trust'), betaal, vindReservering: () => null
});
const { betaalWaarheid } = require('../../server/opzet/betaalketen')({
  db, save: eigenaarSave('waarheid'), crypto, betaal,
  nu: () => new Date().toISOString(), log: null, env: process.env
});
const { pay } = require('../../server/kern/pay')({
  db, save: eigenaarSave('pay'), bijeen: dbm.bijeen,
  economischeBoekingEenmaal: dbm.economischeBoekingEenmaal,
  payBoekingenVoegToe: dbm.payBoekingenVoegToe,
  betaalWaarheid, crypto, betaal, schoon: x => String(x || ''),
  vrijgave: require('../../scripts/lib/proefvrijgave').proefVrijgave(),
  keyVanCodenaam: c => c === 'ALFA' ? { key: 'k:ALFA' } : null,
  sseToCustomer() {}, betaaldienstKosten: () => 0,
  betaalOpdrachten: {
    registreerTeruggang() {}, maak: () => ({ id: 'p' }), dienIn: async () => ({})
  }
});
const punten = require('../../server/kern/ervaring/leden/punten')({
  db, save: eigenaarSave('punten'), nu: () => new Date().toISOString()
});
const lid = require('../../server/kern/lidacties')({
  db, save: eigenaarSave('lid'), crypto, pay,
  schoon: x => String(x || ''),
  findSupplier: code => db.data.suppliers.find(s => s.code === code),
  fooiUit: () => 0, ...punten, ledenvoordeelVoor: () => 0,
  liveCodename: () => 'ALFA',
  facturatie: { boekMetCodenaam() { nevenwerk++; } },
  keuken: { boekVerkoopAf() { nevenwerk++; } },
  notifySupplier() { nevenwerk++; }, sseToSupplier() { nevenwerk++; },
  sseToOffice() { nevenwerk++; }, pushLive() { nevenwerk++; }
});
const betaalLid = () => lid[soort === 'order' ? 'betaalOrderVoor' : 'betaalRitVoor'](
  { key: 'k:ALFA', tier: 'business' }, { ref });
const waarheid = () => Object.values(lees('betaalWaarheid') || {})[0];
const melding = () => {
  const w = waarheid();
  return betaalWaarheid.providerMelding({
    eventId, gebeurtenis: 'payment_intent.succeeded', aanbieder: 'stripe',
    providerId: w.providerId, status: 'succeeded', referentie: w.id,
    bedrag: 2000, valuta: 'eur'
  });
};
function financieel() {
  const w = waarheid();
  assert.ok(w && w.status === 'BEVESTIGD' && w.afgehandeldAt,
    'waarheid en afhandeling staan op schijf');
  const saldi = lees('paySaldi'), boekingen = lees('payBoekingen');
  assert.equal(saldi['lid:ALFA'], tegoedCenten);
  assert.equal(saldi['partner:PROEF'], 2000);
  assert.equal(saldi['extern:oplaad'], -2000);
  assert.equal(saldi['extern:treasury'] || 0, 0 - tegoedCenten);
  assert.equal(Object.values(saldi).reduce((a, b) => a + b, 0), 0);
  assert.equal(boekingen.filter(b => b.soort === 'oplaad' && b.ref === w.id).length, 1);
  assert.equal(boekingen.filter(b => b.ref === ref && b.centen === zelfCenten).length, 1);
  assert.equal(lees('punten')['k:ALFA'].tegoedCenten, 0,
    'verrekend puntentegoed staat in dezelfde duurzame betaalcommit');
  const ontvangsten = lees('payIdem'), afdrukken = lees('payIdemAfdruk');
  for (const k of [zaakIdem, oplaadIdem]) {
    assert.equal(ontvangsten[k].ok, true, 'financiële ontvangst: ' + k);
    assert.equal(typeof afdrukken[k], 'string', 'inhoudsafdruk: ' + k);
  }
  const trust = lees('trustEvidence');
  assert.ok(Object.values(trust.v3.evidence).some(e => e.subjectRef.id === w.id),
    'echt betaalbewijs staat op schijf');
  const sleutel = require('../../server/db/economische-identiteit')
    .maakSleutel('pay-oplaad', [w.id]);
  const economisch = lezer.prepare(
    'SELECT sleutel,afdruk,antwoord FROM economische_boekingen WHERE sleutel=?'
  ).get(sleutel);
  assert.ok(economisch, 'economische opladingssleutel staat naast de grootboekmutatie');
  return { w, saldi, boekingen, ontvangsten, afdrukken, trust, economisch: { ...economisch } };
}
function vast() {
  const geld = financieel();
  const onderwerp = lees(soort === 'order' ? 'orders' : 'rides').find(x => x.ref === ref);
  const puntenstand = lees('punten')['k:ALFA'];
  assert.equal(onderwerp.paid, true);
  assert.ok(Number.isFinite(Date.parse(onderwerp.paidAt)));
  assert.equal(onderwerp.status, soort === 'order' ? 'nieuw' : 'aangevraagd');
  assert.equal(onderwerp.payBetaaldCenten, zelfCenten);
  assert.equal(onderwerp.payBijgelegdCenten, tegoedCenten);
  assert.equal(onderwerp.puntenKorting || 0, tegoedCenten / 100);
  if (soort === 'order') assert.equal(onderwerp.betaaldMet, 'app');
  assert.equal(puntenstand.saldo, Math.floor(zelfCenten / 1000));
  assert.equal(puntenstand.historie.length, tegoedCenten ? 2 : 1);
  return { ...geld, onderwerp, puntenstand };
}

const sqlite = require('../../server/db/sqlite'), echteSave = sqlite.saveSqlite;
const proto = DatabaseSync.prototype;
const echteExec = proto.exec, echtePrepare = proto.prepare;
let fullCommits = 0;
proto.exec = function(sql) {
  const mode = sql === 'COMMIT'
    ? echtePrepare.call(this, 'PRAGMA synchronous').get().synchronous : null;
  const uit = echteExec.call(this, sql);
  if (mode === 2 && this !== lezer) fullCommits++;
  return uit;
};
sqlite.saveSqlite = Object.assign(function(force, sleutels, audit, duurzaam) {
  const fullVoor = fullCommits;
  const uit = echteSave(force, sleutels, audit, duurzaam);
  if (meet && duurzaam && db.data.payIdem?.[zaakIdem]) {
    // Vóór de handler zijn nevenwerk uitvoert: geen latere save kan dit repareren.
    financieel();
    commits.push({
      sleutels: sleutels === undefined ? null : [...sleutels],
      fullCommits: fullCommits - fullVoor, duurzaam: uit.duurzaam
    });
  }
  return uit;
}, echteSave);

(async () => {
  meet = true;
  if (fase === 'heen') {
    await betaalLid();
    throw new Error('de lokale betaalcommit heeft geen echte kill veroorzaakt');
  }
  const voor = vast(), inboxVoor = lees('betaalWaarheidMeldingen') || {};
  const uit = await betaalLid();
  const herhaald = await pay.betaalZaak({
    codenaam: 'ALFA', supplierCode: zaak.code, centen: zelfCenten, bijlageCenten: tegoedCenten,
    soort: soort === 'order' ? 'bestelling' : 'rit', ref, idem
  });
  const naHerhaling = vast();
  await melding(); await melding();
  await betaalWaarheid.ronde({ tot: Date.now() + 10 * 3600e3 });
  const inboxNa = lees('betaalWaarheidMeldingen');
  assert.equal(inboxNa[eventId].betalingId, waarheid().id);
  assert.ok(inboxNa[eventId].verwerktAt, 'de later ontvangen webhook is verwerkt');
  const resultaat = { providerAanroepen, nevenwerk, lidStatus: uit.status,
    payHerhaald: herhaald.herhaald, voor, naHerhaling, naWebhooks: vast(), inboxVoor, inboxNa };
  lezer.close();
  fs.writeSync(1, JSON.stringify(resultaat) + '\n');
})().catch(e => { console.error(e.stack); process.exitCode = 1; });

