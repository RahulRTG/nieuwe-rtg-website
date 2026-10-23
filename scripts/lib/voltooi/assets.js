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
   De koppeling van een stand zonder eigen adres: zie de kop van ./gezin.js.
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

  /* Wat de simulatiebank met de terugbetaling van DIT ticket doet, staat vast in
     de sleutels (kern/betaalwaarheid/terug.js, server/betaal/synthetisch-naslag.js):
     'betaald' bevestigt meteen, de rest bevestigt niet of weigert. De proef rekent
     dat vooraf uit en eist dat het scherm per ticket precies dat zegt. */
  const terugAfloop = (ticketId) => {
    const betaling = 'BW-' + sha('asset:' + key + '|asset-koop:' + A.id + ':' + poging(key, A.id, 'betaald')).slice(0, 20).toUpperCase();
    return bank.scenarioVan({ idempotentieSleutel: 'terug|terug:' + betaling + ':' + sha('idem:' + sha('herroep-' + ticketId)).slice(0, 24) });
  };
  await stap('voltooibaar', 'herroepen na betaling zegt per ticket wat de bank deed: terugbetaald alleen als zij bevestigde, anders loopt het en verdwijnt het ticket niet', async () => {
    /* Bevestigde eerst: een terugbetaling die de bank weigert, zet de hele betaling
       bij RTG ter controle (kern/betaalwaarheid/terug.js), en dan start een
       volgende terugbetaling op die betaling terecht niet. */
    const ids = (await aanvraag(A.id)).ticketIds.slice().sort((x, y) => (terugAfloop(x) !== 'betaald') - (terugAfloop(y) !== 'betaald'));
    const uit = []; let vrij = true, terug = 0;
    for (const id of ids) {
      const afloop = terugAfloop(id);
      const h = await w.post(HERROEP, { ticketId: id }, L.token);
      const tekst = String((h.data && (h.data.let || h.data.error)) || '');
      const gemeld = /is terugbetaald/.test(tekst) && h.data.terug > 0;
      const moet = afloop === 'betaald' && vrij;
      uit.push({ goed: geen5xx(h) && !/in uw tegoed/.test(tekst) && (moet ? gemeld : (!gemeld || afloop === 'betaald') && (gemeld || h.data.terug === undefined)), r: afloop + ' -> ' + h.status + ' "' + tekst + '"' });
      if (gemeld) terug++;
      if (afloop !== 'betaald') vrij = false;
    }
    const pos = (await mijn()).find((p) => p.assetId === object.id) || {};
    return { klopt: uit.length === 2 && uit.every((x) => x.goed) && (pos.tickets || 0) + (pos.herroepLoopt || 0) === 2 - terug,
      ziet: uit.map((x) => x.r).join('; ') + '; daarna tickets ' + (pos.tickets || 0) + ', terugbetaling loopt ' + (pos.herroepLoopt || 0) };
  });

  await stap('bevoegd', 'bevoegdheid: zonder sessie geen aanvraag, geen lijst en geen betaling (401)', async () => {
    const r = [await w.post(KOOP, { assetId: object.id, smaak: 'access', aantal: 1 }), await w.post(AANVRAGEN, {}), await w.post(BETAAL, { id: B.id })];
    return { klopt: r.every((x) => x.status === 401), ziet: r.map((x) => x.status).join('/') };
  });

  await stap('bevoegd', 'bevoegdheid: een ander lid ziet de aanvraag niet en betaalt of sluit hem niet', async () => {
    const l = ((await w.post(AANVRAGEN, {}, X.token)).data || {}).aanvragen || [];
    const b = await w.post(BETAAL, { id: B.id, idem: 'x-' + merk }, X.token);
    const h = await w.post(HERROEP, { id: B.id }, X.token);
    return { klopt: !l.some((x) => x.id === B.id) && b.status === 404 && h.status === 404, ziet: 'ziet ' + l.length + ', betaal ' + b.status + ', sluit ' + h.status };
  });

  await stap('bevoegd', 'bevoegdheid: het lid keurt zichzelf niet, de gedeelde kantoorcode keurt niet, en een gratis account vraagt niet aan', async () => {
    const C = ((await w.post(KOOP, { assetId: object.id, smaak: 'access', aantal: 1, idem: 'zelf-' + merk }, L.token)).data || {}).aanvraag;
    const zelf = await w.post(BESLIS, { id: C.id, besluit: 'goedgekeurd' }, L.token);
    const gedeeld = await w.post(BESLIS, { id: C.id, besluit: 'goedgekeurd' }, code);
    const gratis = await w.post(KOOP, { assetId: object.id, smaak: 'access', aantal: 1 }, G.token);
    return { klopt: zelf.status === 401 && gedeeld.status === 403 && gratis.status === 403 && (await aanvraag(C.id)).status === 'aangevraagd',
      ziet: 'zelf ' + zelf.status + ', gedeelde code ' + gedeeld.status + ', gratis ' + gratis.status };
  });

  /* ---------------- persistent ---------------- */
  const stand = async () => JSON.stringify((await mijn()).map((p) => [p.assetId, p.tickets, p.herroepLoopt || 0]));
  const voor = await stand();
  await w.herstart();
  await stap('persistent', 'na een nette herstart is de positie (tickets en lopende terugbetalingen) dezelfde en heet de aanvraag nog betaald', async () => {
    const na = await stand(), a = await aanvraag(A.id);
    return { klopt: na === voor && a && a.status === 'betaald' && a.ticketIds.length === 2, ziet: 'positie ' + voor + ' -> ' + na + ', aanvraag ' + (a && a.status) };
  });
  await stap('persistent', 'de trage betaling is na de herstart nog gewoon in behandeling, niet verdwenen en niet stil betaald', async () => {
    const b = await aanvraag(B.id);
    return { klopt: b && b.status === 'betaling-loopt' && b.ticketIds.length === 0, ziet: 'aanvraag ' + (b && b.status) + ', tickets ' + (b && b.ticketIds.length) };
  });
  await stap('persistent', 'de aanvraag staat in de opslag zelf (gelezen buiten de server om)', async () => {
    const v = w.vindInOpslag(A.id);
    return { klopt: v.length >= 1, ziet: v.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "aanvragen": een aanvraag, niet twee', async () => {
    const [a, b] = await w.dubbel(KOOP, { assetId: object.id, smaak: 'access', aantal: 1, idem: 'dubbel-' + merk }, L.token);
    const n = (((await w.post(AANVRAGEN, {}, L.token)).data || {}).aanvragen || []).filter((x) => x.status === 'aangevraagd').length;
    return { klopt: geen5xx(a) && geen5xx(b) && a.data.aanvraag.id === b.data.aanvraag.id && n === 2, ziet: 'antwoorden ' + a.status + '/' + b.status + ', open aanvragen ' + n + ' (met die van de bevoegdheidsstap)' };
  });
  await stap('herstelbaar', 'een afgebroken betaling, daarna opnieuw met dezelfde sleutel: een betaling, en tickets precies een keer', async () => {
    const D = ((await w.post(KOOP, { assetId: object.id, smaak: 'access', aantal: 1, idem: 'half-' + merk }, L.token)).data || {}).aanvraag;
    await w.post(BESLIS, { id: D.id, besluit: 'goedgekeurd' }, mens);
    const voor = await tickets(object.id), idem = poging(key, D.id, 'betaald');
    const half = await w.afgebroken(BETAAL, { id: D.id, idem }, L.token);
    const r = await w.post(BETAAL, { id: D.id, idem }, L.token);
    const d = await aanvraag(D.id);
    return { klopt: r.status === 200 && d.status === 'betaald' && d.ticketIds.length === 1 && (await tickets(object.id)) === voor + 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + r.status + ', tickets ' + voor + ' -> ' + (await tickets(object.id)) };
  });
  await stap('herstelbaar', 'een crash direct na een bevestigde betaling: de tickets staan er, en nog eens betalen maakt er geen bij', async () => {
    const E = ((await w.post(KOOP, { assetId: object.id, smaak: 'access', aantal: 1, idem: 'stroom-' + merk }, L.token)).data || {}).aanvraag;
    await w.post(BESLIS, { id: E.id, besluit: 'goedgekeurd' }, mens);
    const idem = poging(key, E.id, 'betaald');
    const r = await w.post(BETAAL, { id: E.id, idem }, L.token);
    const voor = await tickets(object.id);
    await w.crash();
    const nog = await w.post(BETAAL, { id: E.id, idem: idem + '-weer' }, L.token);
    const e = await aanvraag(E.id);
    return { klopt: r.status === 200 && e.status === 'betaald' && e.ticketIds.length === 1 && nog.status === 200 && nog.data.herhaald === true && (await tickets(object.id)) === voor,
      ziet: 'betaling ' + r.status + ', na SIGKILL ' + (e && e.status) + ' met ' + (e && e.ticketIds.length) + ' ticket, nog eens ' + nog.status + (nog.data && nog.data.herhaald ? ' (herhaald)' : '') + ', tickets ' + voor + ' -> ' + (await tickets(object.id)) };
  });
}

module.exports = {
  functie: 'tab:assets',
  ingang: '/apps/app.html',
  via: '#tab=assets',
  persona: 'lid',
  omgeving: Object.assign({ RTG_SIMULATIEBANK: '1' }, KANTOORWERELD),
  belofte: 'een betalend lid vraagt tickets in een object aan, een mens van RTG keurt, het lid betaalt en krijgt pas na een bevestigde betaling precies zijn tickets; herroepen zegt alleen wat waar is',
  grens: 'Welke terugbetaling de simulatiebank bevestigt, volgt uit de sleutels; de proef rekent het per ticket vooraf uit, maar welke afloop twee willekeurige tickets krijgen ligt niet vast. Een bevestiging die later via de veegronde komt, staat in test/assets.test.js met een nagemaakte bank. Uitstappen, de wachtlijst, de terugkoop en de servicefee worden niet gelopen. Geen Redis of PostgreSQL.',
  loop
};
