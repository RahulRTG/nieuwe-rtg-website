/* KINDPROCES VOOR DE CRASHPROEVEN VAN test/geld-motorsleutel.test.js.

   Een crash is hier een echte `kill -9` van dit proces, op een gekozen naad,
   en de herstart is een nieuw proces op dezelfde SQLite-map. Geen nagebootste
   uitzondering: alleen zo blijft er op schijf precies staan wat er na een
   stroomstoring staat.

   Twee proeven, elk in twee fasen (`heen` crasht, `terug` herstart):

   motor-stuur  RTG_MOTOR_GELD=motor. Lid ALFA stuurt 25 euro naar BETA met
                idem `klik-1`; de kill valt zodra de motor de boeking heeft
                BEVESTIGD en de JS-spiegel hem toepast, dus voordat saldo en
                idem-sleutel in de JS-opslag vastliggen. Na de herstart herhaalt
                de client HETZELFDE verzoek met DEZELFDE sleutel -- precies waar
                idem-sleutels voor bestaan.

   js-webhook   Het JS-grootboek (geen motor). Een oplading wacht, de webhook
                `succeeded` komt binnen, en de kill valt nadat het geld is
                bijgeschreven maar voordat de betaalwaarheid vastlegt dat ze is
                afgehandeld. Na de herstart herhaalt de aanbieder de webhook.

   Elke fase schrijft EEN regel JSON naar stdout; de toets leest alleen die. */
'use strict';
const path = require('path');
const [proef, fase] = process.argv.slice(2);
const SERVER = path.join(__dirname, '..', '..', 'server');
const dbm = require(path.join(SERVER, 'db'));
dbm.load();
const { db } = dbm;
const crypto = require('crypto');
const meld = o => process.stdout.write(JSON.stringify(o) + '\n');
let gewapend = false;
const kill = () => process.kill(process.pid, 'SIGKILL');

const voegToe = require(path.join(SERVER, 'kern/pay/loshistorie'))(db);
const payBoekingenVoegToe = (rij) => {
  if (gewapend && (proef === 'motor-stuur' || proef === 'motor-dekking') && rij.soort === 'p2p') kill();
  return voegToe(rij);
};
/* De betaalwaarheid krijgt een eigen save: zodra hij een AFGEHANDELDE
   betaling wil vastleggen (het geld staat dan al bij), valt de kill. */
const bwSave = (...a) => {
  if (gewapend && proef === 'js-webhook' &&
      Object.values(db.data.betaalWaarheid || {}).some(w => w && w.afgehandeldAt)) kill();
  return dbm.save(...a);
};
let providerStatus = proef === 'motor-dekking' ? 'succeeded' : 'processing';
let providerAanroepen = 0;
const betaal = {
  maakBetaling: async (o) => { providerAanroepen++; return { id: 'pi_ABC', status: providerStatus, aanbieder: 'stripe',
    bedrag: o.bedrag, valuta: 'eur', referentie: o.referentie }; },
  haalBetaling: async () => ({ id: 'pi_ABC', status: 'succeeded', aanbieder: 'stripe', bedrag: 2500, valuta: 'eur' })
};
const betaalWaarheid = require(path.join(SERVER, 'kern/betaalwaarheid'))({ d: () => db.data, save: bwSave, crypto, betaal, log: null });
const { pay } = require(path.join(SERVER, 'kern/pay'))({ betaalWaarheid, db, save: dbm.save, bijeen: dbm.bijeen,
  economischeBoekingEenmaal: dbm.economischeBoekingEenmaal, payBoekingenVoegToe, crypto, betaal,
  keyVanCodenaam: (c) => (['ALFA', 'BETA'].includes(c) ? { key: 'k:' + c } : null), sseToCustomer: () => {},
  schoon: (x) => String(x || ''), betaaldienstKosten: () => 0,
  betaalOpdrachten: { registreerTeruggang() {}, maak: () => ({ id: 'p' }), dienIn: async () => ({}) } });

const motorSaldi = async () =>
  (await (await fetch(process.env.RTG_MOTOR_GELD_URL + '/api/motor/saldi', { method: 'POST', body: '{}' })).json());

(async () => {
  if (proef === 'motor-stuur' && fase === 'heen') {
    /* Het startsaldo gaat rechtstreeks in de motor, met een sleutel die zowel
       de oude als de nieuwe motor kent: deze proef meet de p2p-boeking, niet
       het opladen. Daarna neemt de spiegel de stand over. */
    const r = await fetch(process.env.RTG_MOTOR_GELD_URL + '/api/pay/boekguard', { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ van: 'extern:oplaad', naar: 'lid:ALFA', centen: 10000, soort: 'oplaad',
        oms: 'start', ref: 'start', idem: 'pay-tegoed:' + 'b'.repeat(64) }) });
    if (r.status !== 200) throw new Error('startsaldo: ' + r.status);
    await pay.reconcileVanMotor();
    gewapend = true;
    await pay.stuur({ van: 'ALFA', aanCodenaam: 'BETA', centen: 2500, idem: 'klik-1' });
    meld({ fout: 'de kill is niet gevallen' });
    process.exit(3);
  }
  if (proef === 'motor-stuur' && fase === 'terug') {
    await pay.reconcileVanMotor();
    const r = await pay.stuur({ van: 'ALFA', aanCodenaam: 'BETA', centen: 2500, idem: 'klik-1' });
    const s = await motorSaldi();
    meld({ herhaling: { ok: !!r.ok, status: r.status || 200, error: r.error || null },
      motor: { ALFA: s['lid:ALFA'] || 0, BETA: s['lid:BETA'] || 0 },
      spiegel: { ALFA: pay.saldoVan('lid:ALFA'), BETA: pay.saldoVan('lid:BETA') } });
    process.exit(0);
  }
  /* motor-dekking: het lid heeft PRECIES genoeg, de eerste poging boekt
     zonder bijladen, en de kill valt voor de JS-commit. De retry met dezelfde
     idem mag de kaart niet aanraken: het saldo in de spiegel is dan al nul,
     maar de boeking bestaat. */
  if (proef === 'motor-dekking' && fase === 'heen') {
    const r = await fetch(process.env.RTG_MOTOR_GELD_URL + '/api/pay/boekguard', { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ van: 'extern:oplaad', naar: 'lid:ALFA', centen: 2500, soort: 'oplaad',
        oms: 'start', ref: 'start', idem: 'pay-tegoed:' + 'c'.repeat(64) }) });
    if (r.status !== 200) throw new Error('startsaldo: ' + r.status);
    await pay.reconcileVanMotor();
    gewapend = true;
    await pay.stuur({ van: 'ALFA', aanCodenaam: 'BETA', centen: 2500, idem: 'klik-d' });
    meld({ fout: 'de kill is niet gevallen' });
    process.exit(3);
  }
  if (proef === 'motor-dekking' && fase === 'terug') {
    await pay.reconcileVanMotor();
    const voor = Object.keys(db.data.betaalWaarheid || {}).length;
    const r = await pay.stuur({ van: 'ALFA', aanCodenaam: 'BETA', centen: 2500, idem: 'klik-d' });
    const s = await motorSaldi();
    meld({ herhaling: { ok: !!r.ok, status: r.status || 200, error: r.error || null, bijgeladen: r.bijgeladen },
      providerAanroepen, nieuweBetalingen: Object.keys(db.data.betaalWaarheid || {}).length - voor,
      motor: { ALFA: s['lid:ALFA'] || 0, BETA: s['lid:BETA'] || 0 } });
    process.exit(0);
  }
  if (proef === 'js-webhook' && fase === 'heen') {
    const r = await pay.laadOp({ codenaam: 'ALFA', centen: 2500, idem: 'top-1' });
    if (r.status !== 402 || !r.betalingId) throw new Error('de oplading hoorde te wachten: ' + JSON.stringify(r));
    gewapend = true;
    await betaalWaarheid.providerMelding({ eventId: 'evt_1', gebeurtenis: 'payment_intent.succeeded', aanbieder: 'stripe',
      providerId: 'pi_ABC', status: 'succeeded', referentie: r.betalingId, bedrag: 2500, valuta: 'eur' });
    meld({ fout: 'de kill is niet gevallen' });
    process.exit(3);
  }
  if (proef === 'js-webhook' && fase === 'terug') {
    const w = Object.values(db.data.betaalWaarheid || {})[0];
    const naHerstart = pay.saldoVan('lid:ALFA');
    const afgehandeldNaHerstart = !!w.afgehandeldAt;
    await betaalWaarheid.providerMelding({ eventId: 'evt_1', gebeurtenis: 'payment_intent.succeeded', aanbieder: 'stripe',
      providerId: 'pi_ABC', status: 'succeeded', referentie: w.id, bedrag: 2500, valuta: 'eur' });
    await betaalWaarheid.ronde({ tot: Date.now() + 10 * 3600e3 });
    meld({ naHerstart, afgehandeldNaHerstart, naHerhaling: pay.saldoVan('lid:ALFA'),
      afgehandeld: !!Object.values(db.data.betaalWaarheid)[0].afgehandeldAt,
      oplaadregels: (db.data.payBoekingen || []).filter(b => b.soort === 'oplaad').length,
      sluit: pay.sluitcontrole().klopt });
    process.exit(0);
  }
  throw new Error('onbekende proef ' + proef + '/' + fase);
})().catch(e => { meld({ fout: String(e && e.stack || e) }); process.exit(2); });
