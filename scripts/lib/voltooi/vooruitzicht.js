/* ============================================================================
   VOLTOOIPROEF: HET VOORUITZICHT (link:vooruitzicht, /apps/living-os.html) --
   de cockpit van LivingOS.

   De belofte, in de woorden van het scherm: "Dit scherm begint bewust leeg.
   Een reis, bedrag, datum, rustscore of providerstatus verschijnt pas wanneer
   een echte bron die informatie geeft. Een scenario is herkenbaar als scenario
   en verandert geen operationele status." Het lid legt een intentie vast,
   verkent een route (ook de hypothetische verstoring) en geeft de
   voorbereiding vrij -- boeken en betalen blijven dicht. Over de routes die
   living-os.html zelf aanroept: /api/instant-reality en /event, en de acht
   bronnen die het scherm ernaast leest.

   DEZE PROEF VOND EEN LEUGEN. Een lid kon zelf `provider.confirmed` sturen,
   en het scherm toonde dan "BEVESTIGD" zonder provider; vrijgeven zette de
   financiën op "geverifieerd", en de partner las "Vier gasten · oktober"
   ongeacht wat er stond. Gerepareerd in server/kern/instant-reality.js; de
   stappen hieronder houden dat dicht.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const WERELD = '/api/instant-reality';
const EVENT = '/api/instant-reality/event';
const PARTNER = '/api/instant-reality/partner';
const BRONNEN = [['/api/member/bureau/overzicht', {}], ['/api/member/bureau/tower', {}], ['/api/member/bureau/zaken', {}],
  ['/api/member/bureau/delegatie', {}], ['/api/geld/cockpit', {}], ['/api/reis/wereld', {}],
  ['/api/agenda/bereik', { van: '2026-10-19', tot: '2027-01-17' }], ['/api/veiligheid/moment', {}]];

const geen5xx = (r) => r && r.status > 0 && r.status < 500;
/* Een providerstatus die niemand heeft gegeven: bevestigd of geverifieerd. */
const verzonnen = (u) => Object.values((u && u.providers) || {}).some((s) => s === 'confirmed' || s === 'verified');

async function loop(w, stap) {
  const merk = 'lo' + Date.now().toString(36);
  const A = await nieuwLid(w, 'loa');
  const B = await nieuwLid(w, 'lob');
  let u = null, n = 0;
  const lees = async (tok) => ((await w.post(WERELD, {}, tok || A.token)).data) || {};
  /* Zoals het scherm: de versie die het kent en een sleutel per gebeurtenis. */
  const stuur = async (type, extra, tok) => {
    const r = await w.post(EVENT, Object.assign({ type, version: u.version, key: type + '-' + merk + '-' + (++n) }, extra || {}), tok || A.token);
    if (r.data && r.data.universe) u = r.data.universe;
    return r;
  };
  const vorm = (x) => JSON.stringify({ id: x.id, version: x.version, intent: x.intent, world: x.world, state: x.state, providers: x.providers,
    events: (x.events || []).map((e) => e.type + '@' + e.version) });

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'het lid opent het vooruitzicht: leeg, een concept, en geen providerstatus die niemand gaf', async () => {
    const r = await w.post(WERELD, {}, A.token);
    u = r.data;
    return { klopt: r.status === 200 && !!u.id && u.intent === '' && u.state === 'draft' && !verzonnen(u),
      ziet: r.status + ', ' + u.id + ', intentie "' + u.intent + '", stand ' + u.state + ', providers ' + JSON.stringify(u.providers) };
  });

  await stap('voltooibaar', 'het lid legt een intentie vast; de bron draagt de letterlijke tekst en een nieuwe versie', async () => {
    const v0 = u.version;
    const r = await stuur('intent.delta', { value: 'Rustige week in Kyoto ' + merk });
    const terug = await lees();
    return { klopt: r.status === 200 && terug.intent === 'Rustige week in Kyoto ' + merk && terug.version === v0 + 1 &&
      (terug.events || []).some((e) => e.type === 'intent.delta'),
      ziet: r.status + ', versie ' + v0 + ' -> ' + terug.version + ', intentie "' + terug.intent + '"' };
  });

  await stap('voltooibaar', 'het lid verkent de hypothetische verstoring: de wereld wisselt, de providerstatus niet', async () => {
    const voor = JSON.stringify(u.providers);
    const r = await stuur('world.selected', { value: 'disruption' });
    return { klopt: r.status === 200 && u.world === 'disruption' && JSON.stringify(u.providers) === voor && u.state === 'draft',
      ziet: r.status + ', wereld ' + u.world + ', providers ' + (JSON.stringify(u.providers) === voor ? 'ongewijzigd' : 'GEWIJZIGD: ' + JSON.stringify(u.providers)) };
  });

  await stap('voltooibaar', 'het lid geeft de voorbereiding vrij: de stand is voorbereid, en geld of provider is daarmee niet bevestigd', async () => {
    const r = await stuur('preparation.authorized');
    return { klopt: r.status === 200 && u.state === 'prepared' && !verzonnen(u),
      ziet: r.status + ', stand ' + u.state + ', providers ' + JSON.stringify(u.providers) };
  });

  await stap('voltooibaar', 'het lid kan een providerbevestiging of vertraging niet zelf melden: 403 in woorden, en er verandert niets', async () => {
    const voor = vorm(await lees());
    const a = await w.post(EVENT, { type: 'provider.confirmed', provider: 'hotel', version: u.version, key: 'zelf-' + merk }, A.token);
    const b = await w.post(EVENT, { type: 'arrival.delayed', value: '23:00-23:30', version: u.version, key: 'zelf2-' + merk }, A.token);
    const na = await lees();
    return { klopt: a.status === 403 && b.status === 403 && /provider/.test((a.data && a.data.error) || '') && vorm(na) === voor && !verzonnen(na),
      ziet: 'bevestigen ' + a.status + ', vertraging ' + b.status + ' (' + (a.data && a.data.error) + '), stand ' + (vorm(na) === voor ? 'ongewijzigd' : 'GEWIJZIGD') };
  });

  await stap('voltooibaar', 'de acht bronnen naast het vooruitzicht antwoorden elk met gegevens of met een weigering in woorden, nooit kaal', async () => {
    const uit = [];
    for (const [pad, lijf] of BRONNEN) uit.push(await w.post(pad, lijf, A.token));
    const ok = uit.filter((r) => r.status === 200).length;
    const nette = uit.every((r) => r.status === 200 || (r.status >= 400 && r.status < 500 && r.data && typeof r.data.error === 'string'));
    return { klopt: nette && ok >= 4, ziet: ok + ' van ' + uit.length + ' bronnen gaven gegevens; de rest: ' + uit.filter((r) => r.status !== 200).map((r) => r.status + ' ' + (r.data && r.data.error || '').slice(0, 40)).join('; ') };
  });

  await stap('voltooibaar', 'bevoegdheid: zonder sessie geen vooruitzicht en geen gebeurtenis (401)', async () => {
    const a = await w.post(WERELD, {});
    const b = await w.post(EVENT, { type: 'intent.delta', value: 'anoniem', version: 1 });
    return { klopt: a.status === 401 && b.status === 401, ziet: 'lezen ' + a.status + ', schrijven ' + b.status };
  });

  await stap('voltooibaar', 'bevoegdheid: een ander lid heeft een eigen vooruitzicht, ziet de intentie van A niet en wijzigt die niet', async () => {
    const vanB = await lees(B.token);
    const r = await w.post(EVENT, { type: 'intent.delta', value: 'Van B ' + merk, version: vanB.version, key: 'b-' + merk }, B.token);
    const bijA = await lees();
    return { klopt: vanB.id !== u.id && vanB.intent === '' && r.status === 200 && bijA.intent === 'Rustige week in Kyoto ' + merk &&
      !JSON.stringify(vanB).includes('Kyoto'),
      ziet: 'B heeft ' + vanB.id + ' (intentie "' + vanB.intent + '"), A houdt "' + bijA.intent + '"' };
  });

  await stap('voltooibaar', 'bevoegdheid: de partnerweergave draagt geen intentie, geen toestemmingen en geen verzonnen samenvatting', async () => {
    const p = (await w.post(PARTNER, {}, A.token)).data || {};
    return { klopt: p.intent === undefined && p.permissions === undefined && !JSON.stringify(p).includes('Kyoto') && !/gasten|oktober/.test(p.intentSummary || '') && p.paymentGuarantee === false,
      ziet: 'samenvatting "' + p.intentSummary + '", betaalgarantie ' + p.paymentGuarantee };
  });

  /* ---------------- persistent ---------------- */
  const voor = vorm(await lees());
  await w.herstart();

  await stap('persistent', 'na een nette herstart staat hetzelfde vooruitzicht er: intentie, wereld, stand, versie en gebeurtenissen', async () => {
    const na = vorm(await lees());
    return { klopt: na === voor, ziet: na === voor ? 'gelijk (' + na.length + ' tekens)' : 'ANDERS: ' + na.slice(0, 120) };
  });

  await stap('persistent', 'een nieuwe sessie (een ander toestel) leest hetzelfde vooruitzicht', async () => {
    const tok = await inloggen(w, A);
    const na = vorm(await lees(tok));
    return { klopt: na === voor, ziet: na === voor ? 'nieuwe sessie leest hetzelfde' : 'ANDERS' };
  });

  await stap('persistent', 'de intentie staat in de opslag zelf (gelezen buiten de server om)', async () => {
    const plek = w.vindInOpslag('Rustige week in Kyoto ' + merk);
    return { klopt: plek.length >= 1, ziet: 'in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op een routekeuze: een gebeurtenis en een versie erbij, niet twee', async () => {
    u = await lees();
    const v0 = u.version;
    const lijf = { type: 'world.selected', value: 'ideal', version: v0, key: 'dubbel-' + merk };
    const [a, b] = await w.dubbel(EVENT, lijf, A.token);
    const na = await lees();
    return { klopt: geen5xx(a) && geen5xx(b) && (a.status === 200 || b.status === 200) && na.version === v0 + 1 && na.world === 'ideal' &&
      (na.events || []).filter((e) => e.type === 'world.selected' && e.version === v0 + 1).length === 1,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', versie ' + v0 + ' -> ' + na.version };
  });

  await stap('herstelbaar', 'een afgebroken verzoek, daarna opnieuw met dezelfde sleutel: een keer gewijzigd', async () => {
    u = await lees();
    const v0 = u.version;
    const lijf = { type: 'intent.delta', value: 'Kyoto met moeder ' + merk, version: v0, key: 'half-' + merk };
    const half = await w.afgebroken(EVENT, lijf, A.token);
    const opnieuw = await w.post(EVENT, lijf, A.token);
    const na = await lees();
    return { klopt: geen5xx(opnieuw) && na.version === v0 + 1 && na.intent === 'Kyoto met moeder ' + merk,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + (opnieuw.data && opnieuw.data.replayed ? ' (herhaling)' : '') + ', versie ' + v0 + ' -> ' + na.version };
  });

  await stap('herstelbaar', 'een crash direct na een wijziging: hij staat er, en dezelfde sleutel opnieuw is een herhaling', async () => {
    u = await lees();
    const v0 = u.version;
    const lijf = { type: 'world.selected', value: 'likely', version: v0, key: 'stroom-' + merk };
    const r = await w.post(EVENT, lijf, A.token);
    await w.crash();
    const opnieuw = await w.post(EVENT, lijf, A.token);
    const na = await lees();
    return { klopt: r.status === 200 && opnieuw.status === 200 && opnieuw.data.replayed === true && na.version === v0 + 1 && na.world === 'likely',
      ziet: 'wijzig ' + r.status + ', na SIGKILL opnieuw ' + opnieuw.status + (opnieuw.data && opnieuw.data.replayed ? ' (herhaling)' : '') + ', versie ' + v0 + ' -> ' + na.version };
  });

  await stap('herstelbaar', 'een tweede toestel met een verouderde versie overschrijft niets: 409 met de actuele stand', async () => {
    const nu = await lees();
    const r = await w.post(EVENT, { type: 'intent.delta', value: 'Oud toestel ' + merk, version: nu.version - 1, key: 'oud-' + merk }, A.token);
    const na = await lees();
    return { klopt: r.status === 409 && r.data.universe && r.data.universe.version === nu.version && na.intent === nu.intent,
      ziet: r.status + ' (' + (r.data && r.data.error) + '), intentie blijft "' + na.intent + '"' };
  });
}

module.exports = {
  functie: 'link:vooruitzicht',
  ingang: '/apps/living-os.html',
  persona: 'lid',
  belofte: 'een lid legt een intentie vast, verkent routes en geeft de voorbereiding vrij, en het vooruitzicht toont uitsluitend wat een bron gaf -- geen providerstatus die niemand bevestigde -- ook na een herstart, een dubbeltik, een afgebroken verzoek en een crash',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. Er bestaat nog geen providerroute: een bevestiging of vertraging van een provider is daarom niet te lopen en is voor het lid dicht. Het Privekantoor (vier van de acht bronnen) hoort bij de Lifestyle Pass en weigert een RTG-lid in woorden. Rahul (/api/fluister) en het besluit in het Privekantoor worden niet gelopen. Geen Redis of PostgreSQL.',
  loop
};
