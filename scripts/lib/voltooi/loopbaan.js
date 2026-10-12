/* ============================================================================
   VOLTOOIPROEF: MIJN LOOPBAAN (link:loopbaan, /apps/loopbaan.html) -- WorkOS.

   De belofte, in de woorden van server/kern/carriereledger/: de loopbaan van een
   mens als chronologische reeks, per regel bewijsbaar. Het lid schrijft zelf
   (herkomst `zelf`), een ledger WIST niets (intrekken is een nieuwe regel, de
   oude blijft leesbaar), en een deelcode laat een buitenstaander precies EEN
   regel lezen zonder account -- tot het lid hem stopt.

   DE TWEEDE ACTOR is die buitenstaander: een sponsor of een loket zonder
   RTG-account, op /api/carriere/regel/toon. Dat is geen route van het scherm
   zelf maar wel de plek waar de belofte aankomt, en daarom de ontvanger.

   WAT DEZE KETEN MET OPZET NIET BEWEERT. Bevestigen door een ANDER (een
   medewerker van RTG of een club) loopt over kantoor- en zaakroutes en zit hier
   niet in; `gezien` en `bevestigd` worden dus niet bewezen, alleen `zelf`.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const MIJN = '/api/carriere/ledger/mijn';
const ZET = '/api/carriere/ledger/zet';
const INTREK = '/api/carriere/ledger/intrek';
const DEEL = '/api/carriere/ledger/deel';
const DELEN = '/api/carriere/ledger/delen';
const STOP = '/api/carriere/ledger/stopdelen';
const TOON = '/api/carriere/regel/toon';

const feiten = (r) => (r && r.data && Array.isArray(r.data.feiten)) ? r.data.feiten : [];
const vindFeit = (r, wat) => feiten(r).find((f) => f.wat === wat) || null;
const geen5xx = (r) => r && r.status > 0 && r.status < 500;
const merk = () => Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

async function loop(w, stap) {
  const lid = await nieuwLid(w, 'lpb');
  const A = lid.token;
  const DIPLOMA = 'Diploma hotelschool ' + merk();
  let feitId = null, code = null, deelId = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een nieuw lid begint met een leeg ledger, en de zeven kapitalen staan er zonder totaal', async () => {
    const m = await w.post(MIJN, {}, A);
    const k = m.data && m.data.kapitalen ? Object.keys(m.data.kapitalen).length : 0;
    return { klopt: m.status === 200 && feiten(m).length === 0 && k === 7 && !('totaal' in (m.data || {})),
      ziet: feiten(m).length + ' feiten, ' + k + ' kapitalen' };
  });

  await stap('voltooibaar', 'een feit met een bedrag wordt geweigerd, met de reden erbij', async () => {
    const r = await w.post(ZET, { kapitaal: 'financieel', wat: 'Contract met een club', op: '2021-03-01', bedragCenten: 500000 }, A);
    return { klopt: r.status === 400 && /NOOIT\.bedrag/.test(String(r.data && r.data.error)) && feiten(await w.post(MIJN, {}, A)).length === 0,
      ziet: r.status + ': ' + String(r.data && r.data.error).slice(0, 80) };
  });

  await stap('voltooibaar', 'het lid schrijft een feit op; het staat in de reeks met de dag waarop het gebeurde', async () => {
    const r = await w.post(ZET, { kapitaal: 'vermogen', wat: DIPLOMA, op: '2020-06-30', toelichting: 'met lof' }, A);
    const f = vindFeit(await w.post(MIJN, {}, A), DIPLOMA);
    feitId = f && f.id;
    return { klopt: r.status === 200 && !!f && f.op === '2020-06-30' && f.kapitaal === 'vermogen' && !f.ingetrokken,
      ziet: f ? f.kapitaal + ', ' + f.op + ', ingetrokken=' + f.ingetrokken : 'geen feit' };
  });

  await stap('voltooibaar', 'het lid deelt die ene regel; een buitenstaander zonder account leest precies die regel en het voorbehoud', async () => {
    const d = await w.post(DEEL, { id: feitId, dagen: 7, voor: 'een sponsor' }, A);
    code = d.data && d.data.code;
    const t = await w.post(TOON, { code });
    const ok = t.status === 200 && t.data && t.data.feit && t.data.feit.wat === DIPLOMA &&
      Array.isArray(t.data.voorbehoud) && t.data.voorbehoud.length > 0 && !('feiten' in t.data);
    const lijst = await w.post(DELEN, {}, A);
    const rij = (lijst.data && lijst.data.delen || []).find((x) => x.feit === feitId);
    deelId = rij && rij.id;
    return { klopt: d.status === 200 && !!code && ok && !!rij && rij.gebruik >= 1,
      ziet: 'deel ' + d.status + ', ontvanger ' + t.status + ' ziet "' + (t.data && t.data.feit && t.data.feit.wat) + '", gebruikt ' + (rij && rij.gebruik) + 'x' };
  });

  await stap('voltooibaar', 'het lid stopt het delen; de buitenstaander krijgt niets meer', async () => {
    const s = await w.post(STOP, { id: deelId }, A);
    const t = await w.post(TOON, { code });
    return { klopt: s.status === 200 && t.status === 404 && !(t.data && t.data.feit), ziet: 'stop ' + s.status + ', ontvanger daarna ' + t.status };
  });

  await stap('voltooibaar', 'intrekken vraagt een reden, en de regel blijft leesbaar als ingetrokken', async () => {
    const zonder = await w.post(INTREK, { id: feitId }, A);
    const met = await w.post(INTREK, { id: feitId, reden: 'verkeerde opleiding gekozen' }, A);
    const f = vindFeit(await w.post(MIJN, {}, A), DIPLOMA);
    return { klopt: zonder.status === 400 && met.status === 200 && !!f && f.ingetrokken === true,
      ziet: 'zonder reden ' + zonder.status + ', met reden ' + met.status + '; regel ' + (f ? 'staat er, ingetrokken=' + f.ingetrokken : 'WEG') };
  });

  /* ---------------- persistent ---------------- */
  const BLIJFT = 'Rol in voorstelling ' + merk();
  await w.post(ZET, { kapitaal: 'netwerk', wat: BLIJFT, op: '2022-11-12' }, A);
  const voor = JSON.stringify(feiten(await w.post(MIJN, {}, A)));
  await w.herstart();

  await stap('persistent', 'na een nette herstart is de reeks byte voor byte dezelfde, intrekking inbegrepen', async () => {
    const na = JSON.stringify(feiten(await w.post(MIJN, {}, A)));
    return { klopt: voor !== '[]' && na === voor, ziet: 'reeks ' + (na === voor ? 'gelijk' : 'ANDERS') + ' (' + JSON.parse(na).length + ' feiten)' };
  });
  await stap('persistent', 'een nieuwe sessie (een andere browser) leest dezelfde reeks', async () => {
    const C = await inloggen(w, lid);
    const na = JSON.stringify(feiten(await w.post(MIJN, {}, C)));
    return { klopt: na === voor, ziet: 'reeks ' + (na === voor ? 'gelijk' : 'ANDERS') };
  });
  await stap('persistent', 'de regels staan in de opslag zelf (store.db, gelezen buiten de server om)', async () => {
    const bak = w.collectie('carriereLedger') || {};
    const reeksen = Object.values(bak).map((x) => (x && Array.isArray(x.regels) ? x.regels : []))
      .filter((rs) => rs.some((r) => r && r.wat === BLIJFT));
    const intr = reeksen[0] ? reeksen[0].filter((r) => r && r.soort === 'intrekking').length : 0;
    return { klopt: reeksen.length === 1 && intr === 1, ziet: reeksen.length + ' reeks met deze regel, ' + intr + ' intrekking erin' };
  });

  /* ---------------- herstelbaar ---------------- */
  const DUBBEL = 'Prijs van de jury ' + merk();
  await stap('herstelbaar', 'dubbelklik: hetzelfde feit twee keer wordt een regel, en de tweede keer zegt waarom', async () => {
    const a = await w.post(ZET, { kapitaal: 'reputatie', wat: DUBBEL, op: '2023-05-05' }, A);
    const b = await w.post(ZET, { kapitaal: 'reputatie', wat: DUBBEL, op: '2023-05-05' }, A);
    const n = feiten(await w.post(MIJN, {}, A)).filter((f) => f.wat === DUBBEL).length;
    const tweede = b.status === 200 || (b.status === 409 && !!(b.data && b.data.error));
    return { klopt: a.status === 200 && tweede && n === 1, ziet: 'eerste ' + a.status + ', tweede ' + b.status + ', ' + n + ' regel(s)' };
  });

  const HALF = 'Opdracht voor een label ' + merk();
  await stap('herstelbaar', 'een afgebroken verzoek en daarna opnieuw: precies een regel', async () => {
    const half = await w.afgebroken(ZET, { kapitaal: 'netwerk', wat: HALF, op: '2024-01-15' }, A);
    const opnieuw = await w.post(ZET, { kapitaal: 'netwerk', wat: HALF, op: '2024-01-15' }, A);
    const n = feiten(await w.post(MIJN, {}, A)).filter((f) => f.wat === HALF).length;
    return { klopt: geen5xx(opnieuw) && [200, 409].includes(opnieuw.status) && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' regel(s)' };
  });

  const CRASH = 'Titel bij een wedstrijd ' + merk();
  await stap('herstelbaar', 'een crash direct na het opschrijven: wat er stond, staat er nog', async () => {
    const r = await w.post(ZET, { kapitaal: 'vermogen', wat: CRASH, op: '2024-02-02' }, A);
    await w.crash();
    const f = vindFeit(await w.post(MIJN, {}, A), CRASH);
    return { klopt: r.status === 200 && !!f, ziet: 'zet ' + r.status + ', na SIGKILL ' + (f ? 'staat hij er' : 'WEG') };
  });

  await stap('herstelbaar', 'een crash direct na het intrekken: ingetrokken blijft ingetrokken', async () => {
    const f0 = vindFeit(await w.post(MIJN, {}, A), CRASH);
    const r = await w.post(INTREK, { id: f0 && f0.id, reden: 'dubbel opgeschreven' }, A);
    await w.crash();
    const f = vindFeit(await w.post(MIJN, {}, A), CRASH);
    return { klopt: r.status === 200 && !!f && f.ingetrokken === true, ziet: 'intrek ' + r.status + ', na SIGKILL ingetrokken=' + (f && f.ingetrokken) };
  });
}

/* ---------------- de kruisproef (bewijs 6, scripts/lib/ledenkruis.js) ----------------
   Zaait iets dat ALLEEN van dit lid is, zodat "een ander zag niets" een uitslag
   is en geen leeg experiment. `merktekens` (vrije tekst die A schreef; een ander
   speelt hem na met een eigen waarde) en `objecten` (ids van A's dingen; die
   blijven staan, dat is de IDOR-proef) mogen in geen antwoord aan een ander
   staan; `lezers` moeten na alle pogingen van de anderen byte voor byte gelijk
   terugkomen; `handelingen` doen de anderen eerst, en daarna het lid zelf.
   `object: true` zegt dat een handeling een object van A raakt (een id uit zijn
   zaai): dan is een 2xx voor ieder ander een inbreuk. */
async function zaai(w) {
  const lid = await nieuwLid(w, 'klpb');
  const WAT = 'Diploma kruisproef ' + merk();
  const TOELICHTING = 'Toelichting kruisproef ' + merk(), VOOR = 'Sponsor kruisproef ' + merk();
  const f = await w.post(ZET, { kapitaal: 'vermogen', wat: WAT, op: '2020-06-30', toelichting: TOELICHTING }, lid.token);
  const feitId = f.data && f.data.regel && f.data.regel.id;
  await w.post(DEEL, { id: feitId, dagen: 7, voor: VOOR }, lid.token);
  const deel = (((await w.post(DELEN, {}, lid.token)).data || {}).delen || [])[0];
  return { lid, merktekens: [WAT, TOELICHTING, VOOR], objecten: [feitId, deel && deel.id], lezers: [{ pad: MIJN }, { pad: DELEN }],
    handelingen: [{ pad: DEEL, object: true, lijf: { id: feitId, dagen: 3, voor: 'een tweede' } },
      { pad: STOP, object: true, lijf: { id: deel && deel.id } },
      { pad: ZET, lijf: { kapitaal: 'netwerk', wat: 'Club kruisproef ' + merk(), op: '2022-11-12' } },
      { pad: INTREK, object: true, lijf: { id: feitId, reden: 'kruisproef' } }] };
}

module.exports = {
  functie: 'link:loopbaan',
  ingang: '/apps/loopbaan.html',
  persona: 'lid',
  belofte: 'een lid schrijft zijn loopbaan zelf op als reeks die niets wist, deelt een regel met een buitenstaander zonder account en stopt dat delen weer -- ook na een herstart of een crash',
  grens: 'De proef loopt over de routes die het scherm aanroept plus de leesroute van de buitenstaander, niet door het scherm zelf. Bevestigen door een ander (kantoor, club) zit er niet in: alleen herkomst `zelf` is beproefd. Er is geen Redis of PostgreSQL in de wereld.',
  loop,
  zaai
};
