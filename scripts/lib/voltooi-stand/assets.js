/* ============================================================================
   VOLTOOIPROEF: ASSETS (tab:assets) -- RTG Shared Assets, de stand Assets in
   de ledenapp, bereikt langs de navigatieroute /apps/app.html#tab=assets.

   EEN KOOP IS EEN AANVRAAG (eigenaarsbesluit 19 oktober 2026). Deze proef vond
   eerder dat /api/asset/koop tickets gaf zonder iets af te schrijven, en dat
   herroepen "de koopsom staat in uw tegoed" meldde terwijl er niets terugkwam.
   Nu: aanvragen, een mens van RTG OP NAAM keurt, betalen via de betaalwaarheid
   (hier de simulatiebank), en pas een BEVESTIGDE betaling geeft tickets,
   precies een keer (server/kern/assets/aanvraag.js).
   De afloop van de bank kiest deze proef via de sleutel, zoals ./betalen.js.
   WAAROM DIT NIET IN scripts/lib/voltooi/ STAAT: zie ./gezin.js.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const { geverifieerdLid, nieuwLid, eigenaarSessie, KANTOORWERELD } = require('../voltooiwereld');
const simulatiebank = require('../../../server/betaal/synthetisch');

const KOOP = '/api/asset/koop';
const AANVRAGEN = '/api/asset/aanvragen';
const BETAAL = '/api/asset/aanvraag/betaal';
const MIJN = '/api/asset/mijn';
const HERROEP = '/api/asset/herroep';
const BESLIS = '/api/office/asset/aanvraag/beslis';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;
const bank = simulatiebank({ crypto, env: {}, echteRail: null });
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
/* Een betaalpoging-sleutel waarvoor de simulatiebank deze afloop kiest:
   actor `asset:<sleutel>`, idem `asset-koop:<aanvraag>:<poging>`. */
function poging(key, id, afloop) {
  for (let i = 0; i < 5000; i++) {
    const s = id + '-' + i;
    if (bank.scenarioVan({ idempotentieSleutel: 'waarheid:BW-' + sha('asset:' + key + '|asset-koop:' + id + ':' + s).slice(0, 20).toUpperCase() }) === afloop) return s;
  }
  throw new Error('geen sleutel voor ' + afloop);
}

async function loop(w, stap) {
  const merk = 'as' + Date.now().toString(36);
  const L = await geverifieerdLid(w, 'asl');
  const X = await geverifieerdLid(w, 'asx');
  const G = await nieuwLid(w, 'asg', 'guest');
  const key = ((await w.post('/api/member/connections', {}, L.token)).data || {}).me;
  const mens = (await w.post('/api/account/start', { rol: 'kantoor' }, await eigenaarSessie(w))).data.token;
  const code = (await w.post('/api/office/login', { code: KANTOORWERELD.OFFICE_CODE })).data.token;
  const mijn = async () => ((await w.post(MIJN, {}, L.token)).data || {}).posities || [];
  const tickets = async (id) => (await mijn()).filter((p) => p.assetId === id).reduce((n, p) => n + p.tickets, 0);
  const aanvraag = async (id) => ((((await w.post(AANVRAGEN, {}, L.token)).data || {}).aanvragen) || []).find((x) => x.id === id);
  let object, A, B;

  await stap('voltooibaar', 'het lid ziet de objecten met prijs, beschikbaarheid en het informatiedocument', async () => {
    const a = (await w.post('/api/assets', {}, L.token)).data || {};
    object = (a.assets || [])[0];
    const d = await w.post('/api/asset/document', { assetId: object && object.id }, L.token);
    return { klopt: !!object && object.prijsAccess > 0 && d.status === 200, ziet: (a.assets || []).length + ' objecten, Access ' + (object && object.prijsAccess) + ', document ' + d.status };
  });

  await stap('voltooibaar', 'kopen is aanvragen: er staat een aanvraag, er is geen ticket en niets afgeschreven, en het scherm zegt dat', async () => {
    const k = await w.post(KOOP, { assetId: object.id, smaak: 'access', aantal: 2, idem: 'koop-' + merk }, L.token);
    A = k.data && k.data.aanvraag;
    return { klopt: k.status === 200 && A.status === 'aangevraagd' && /nog niets afgeschreven/.test(k.data.let) && (await tickets(object.id)) === 0,
      ziet: 'koop ' + k.status + ', ' + (A && A.status) + ', tickets ' + (await tickets(object.id)) + ': "' + (k.data && k.data.let) + '"' };
  });

  await stap('voltooibaar', 'een mens van RTG op naam keurt goed; daarna weigert de bank en komt er geen ticket', async () => {
    const g = await w.post(BESLIS, { id: A.id, besluit: 'goedgekeurd' }, mens);
    const n = await w.post(BETAAL, { id: A.id, idem: poging(key, A.id, 'geweigerd') }, L.token);
    return { klopt: g.status === 200 && n.status === 402 && /niet gelukt/.test(n.data.error) && (await tickets(object.id)) === 0,
      ziet: 'besluit ' + g.status + ', betaling ' + n.status + ' "' + (n.data && n.data.error) + '", tickets ' + (await tickets(object.id)) };
  });

  await stap('voltooibaar', 'opnieuw betalen, nu bevestigd: precies de twee gevraagde tickets, en de aanvraag heet betaald', async () => {
    const b = await w.post(BETAAL, { id: A.id, idem: poging(key, A.id, 'betaald') }, L.token);
    return { klopt: b.status === 200 && (await tickets(object.id)) === 2 && (await aanvraag(A.id)).status === 'betaald',
      ziet: 'betaling ' + b.status + ', tickets ' + (await tickets(object.id)) + ', aanvraag ' + ((await aanvraag(A.id)) || {}).status };
  });

  await stap('voltooibaar', 'een trage bank: de betaling wacht op bevestiging en er komt (nog) geen ticket', async () => {
    B = ((await w.post(KOOP, { assetId: object.id, smaak: 'access', aantal: 1, idem: 'traag-' + merk }, L.token)).data || {}).aanvraag;
    await w.post(BESLIS, { id: B.id, besluit: 'goedgekeurd' }, mens);
    const t = await w.post(BETAAL, { id: B.id, idem: poging(key, B.id, 'traag') }, L.token);
    return { klopt: t.status === 402 && t.data.pending === true && (await tickets(object.id)) === 2,
      ziet: 'betaling ' + t.status + ' "' + (t.data && t.data.error) + '", tickets ' + (await tickets(object.id)) };
  });

  await stap('voltooibaar', 'herroepen na betaling noemt niets terugbetaald dat de bank niet bevestigde, en het ticket verdwijnt niet stil', async () => {
    const id = ((await mijn()).find((p) => p.assetId === object.id).herroepbaar[0] || {}).id;
    const h = await w.post(HERROEP, { ticketId: id }, L.token);
    const pos = (await mijn()).find((p) => p.assetId === object.id) || {};
    const tekst = String((h.data && (h.data.let || h.data.error)) || '');
    return { klopt: geen5xx(h) && !/is terugbetaald|in uw tegoed/.test(tekst) && h.data.terug === undefined && pos.tickets + (pos.herroepLoopt || 0) === 2,
      ziet: 'herroep ' + h.status + ' "' + tekst + '", tickets ' + pos.tickets + ', terugbetaling loopt ' + (pos.herroepLoopt || 0) };
  });

  await stap('voltooibaar', 'bevoegdheid: zonder sessie geen aanvraag, geen lijst en geen betaling (401)', async () => {
    const r = [await w.post(KOOP, { assetId: object.id, smaak: 'access', aantal: 1 }), await w.post(AANVRAGEN, {}), await w.post(BETAAL, { id: B.id })];
    return { klopt: r.every((x) => x.status === 401), ziet: r.map((x) => x.status).join('/') };
  });

  await stap('voltooibaar', 'bevoegdheid: een ander lid ziet de aanvraag niet en betaalt of sluit hem niet', async () => {
    const l = ((await w.post(AANVRAGEN, {}, X.token)).data || {}).aanvragen || [];
    const b = await w.post(BETAAL, { id: B.id, idem: 'x-' + merk }, X.token);
    const h = await w.post(HERROEP, { id: B.id }, X.token);
    return { klopt: !l.some((x) => x.id === B.id) && b.status === 404 && h.status === 404, ziet: 'ziet ' + l.length + ', betaal ' + b.status + ', sluit ' + h.status };
  });

  await stap('voltooibaar', 'bevoegdheid: het lid keurt zichzelf niet, de gedeelde kantoorcode keurt niet, en een gratis account vraagt niet aan', async () => {
    const C = ((await w.post(KOOP, { assetId: object.id, smaak: 'access', aantal: 1, idem: 'zelf-' + merk }, L.token)).data || {}).aanvraag;
    const zelf = await w.post(BESLIS, { id: C.id, besluit: 'goedgekeurd' }, L.token);
    const gedeeld = await w.post(BESLIS, { id: C.id, besluit: 'goedgekeurd' }, code);
    const gratis = await w.post(KOOP, { assetId: object.id, smaak: 'access', aantal: 1 }, G.token);
    return { klopt: zelf.status === 401 && gedeeld.status === 403 && gratis.status === 403 && (await aanvraag(C.id)).status === 'aangevraagd',
      ziet: 'zelf ' + zelf.status + ', gedeelde code ' + gedeeld.status + ', gratis ' + gratis.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staan de tickets er nog en heet de aanvraag nog betaald', async () => {
    const t = await tickets(object.id), a = await aanvraag(A.id);
    return { klopt: t >= 1 && a && a.status === 'betaald' && a.ticketIds.length === 2, ziet: 'tickets ' + t + ', aanvraag ' + (a && a.status) };
  });
  await stap('persistent', 'de trage betaling is na de herstart nog gewoon in behandeling, niet verdwenen en niet stil betaald', async () => {
    const b = await aanvraag(B.id);
    return { klopt: b && b.status === 'betaling-loopt' && b.ticketIds.length === 0, ziet: 'aanvraag ' + (b && b.status) + ', tickets ' + (b && b.ticketIds.length) };
  });
  await stap('persistent', 'de aanvraag staat in de opslag zelf (gelezen buiten de server om)', async () => {
    const v = w.vindInOpslag(A.id);
    return { klopt: v.length >= 1, ziet: v.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar: ./assets-herstel.js (om de 10 kB) ---------------- */
  await require('./assets-herstel')(w, stap, { L, object, key, mens, merk, poging, tickets, aanvraag, geen5xx });
}

module.exports = {
  functie: 'tab:assets',
  ingang: '/apps/app.html#tab=assets',
  persona: 'lid',
  omgeving: Object.assign({ RTG_SIMULATIEBANK: '1' }, KANTOORWERELD),
  belofte: 'een betalend lid vraagt tickets in een object aan, een mens van RTG keurt, het lid betaalt en krijgt pas na een bevestigde betaling precies zijn tickets; herroepen zegt alleen wat waar is',
  grens: 'De simulatiebank bevestigt geen terugbetaling (server/betaal/naslag.js kent haar niet als rail), dus herroepen na betaling bewijst hier alleen dat er niets vals wordt gemeld; de bevestigde terugbetaling staat in test/assets.test.js met een nagemaakte bank. Uitstappen, de wachtlijst, de terugkoop en de servicefee worden niet gelopen. Geen Redis of PostgreSQL.',
  loop
};
