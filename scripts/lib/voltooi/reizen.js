/* ============================================================================
   VOLTOOIPROEF: REIZEN & VEILIG (link:reizen, /apps/reizen-veilig.html) -- TravelOS.

   De belofte, in de woorden van server/kern/veiligheid/moment.js: een tijdelijke
   Live Circle rond een reis of afspraak. Het lid kiest zelf wie meekijkt en tot
   wanneer; een BEDRIJF krijgt hooguit voortgang en aankomsttijd en nooit een
   exacte plek; pauzeren en stoppen werken direct, en na een stop levert de kern
   niets meer uit.

   DE TWEEDE ACTOR is de zaak die het lid als ontvanger koos: de manager van
   KIKUNOI uit de zaaiset, op /api/supplier/veiligheid/aankomsten. Dat is de
   plek waar de belofte aankomt. Het lid kiest de ontvanger zelf en bevestigt de
   handeling zelf (LIFE.md: wat een tweede persoon bereikt, zet een mens in
   gang) -- de proef doet precies wat het formulier van het scherm stuurt.

   WAT DEZE KETEN MET OPZET NIET BEWEERT. Een CONTACT als ontvanger (met exacte
   plek) vraagt twee leden die verbonden zijn; dat loopt over de sociale laag en
   zit hier niet in. En de eindtijd wordt niet afgewacht: dat het moment na
   `tot` vanzelf ophoudt, is hier niet gemeten (RTG_KLOK zou dat kunnen).
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const MIJN = '/api/veiligheid/moment';
const MAAK = '/api/veiligheid/moment/maak';
const STATUS = '/api/veiligheid/moment/status';
const PAUZE = '/api/veiligheid/moment/pauze';
const STOP = '/api/veiligheid/moment/stop';
const ZAAKZIET = '/api/supplier/veiligheid/aankomsten';
const ZAAK = 'KIKUNOI';

const merk = () => Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const momenten = (r) => (r && r.data && Array.isArray(r.data.momenten)) ? r.data.momenten : [];
const aankomsten = (r) => (r && r.data && Array.isArray(r.data.aankomsten)) ? r.data.aankomsten : [];
const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function zaakSessie(w) {
  const rooster = await w.post('/api/supplier/roster', { code: ZAAK });
  const man = (rooster.data && rooster.data.staff || []).find((x) => x.role === 'manager');
  if (!man) throw new Error('de zaaiset heeft geen manager voor ' + ZAAK);
  const r = await w.post('/api/supplier/login', { code: ZAAK, staffId: man.id, pin: '1234' });
  if (r.status !== 200 || !r.data || !r.data.token) throw new Error('de zaak kon niet inloggen (' + r.status + ')');
  return r.data.token;
}

function formulier(titel, niveau) {
  /* Zoals #rvMomentForm in public/apps/reizen-veilig.js het stuurt. */
  return { titel, doel: 'Diner', minuten: 120, ontvangers: [{ soort: 'bedrijf', id: ZAAK, niveau: niveau || 'voortgang' }] };
}

async function loop(w, stap) {
  const lid = await nieuwLid(w, 'rvl');
  const A = lid.token;
  let Z = await zaakSessie(w);
  const ziet = async (titel) => aankomsten(await w.post(ZAAKZIET, {}, Z)).filter((x) => x.titel === titel);
  const DINER = 'Diner bij Kikunoi ' + merk();
  let id = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een Live Circle zonder ontvanger wordt geweigerd, met de reden erbij', async () => {
    const r = await w.post(MAAK, { titel: DINER, minuten: 60, ontvangers: [] }, A);
    return { klopt: r.status === 400 && /ontvanger|persoon|bedrijf/i.test(String(r.data && r.data.error)), ziet: r.status + ': ' + String(r.data && r.data.error) };
  });

  await stap('voltooibaar', 'het lid deelt zijn reis met de zaak, en vraagt exacte plek: de zaak krijgt hooguit voortgang', async () => {
    const r = await w.post(MAAK, formulier(DINER, 'locatie'), A);
    id = r.data && r.data.moment && r.data.moment.id;
    const ontv = r.data && r.data.moment && r.data.moment.ontvangers[0];
    return { klopt: r.status === 200 && !!id && !!ontv && ontv.niveau === 'voortgang', ziet: 'maak ' + r.status + ', niveau voor de zaak: ' + (ontv && ontv.niveau) };
  });

  await stap('voltooibaar', 'de zaak ziet de aankomst, op codenaam en zonder plek', async () => {
    const z = await ziet(DINER);
    const a = z[0];
    return { klopt: z.length === 1 && a.status === 'gepland' && !('plek' in a) && !!a.eigenaar && !String(a.eigenaar).includes('@'),
      ziet: z.length + ' aankomst, status ' + (a && a.status) + ', eigenaar ' + (a && a.eigenaar) + ', plek ' + (a && 'plek' in a ? 'MEEGESTUURD' : 'niet meegestuurd') };
  });

  await stap('voltooibaar', 'het lid zet "onderweg" met een aankomsttijd; de zaak ziet het', async () => {
    const r = await w.post(STATUS, { id, status: 'onderweg', eta: '19:45' }, A);
    const a = (await ziet(DINER))[0];
    return { klopt: r.status === 200 && !!a && a.status === 'onderweg' && a.eta === '19:45', ziet: 'zaak ziet ' + (a && a.status) + ' ' + (a && a.eta) };
  });

  await stap('voltooibaar', 'pauze: de zaak ziet niets meer; hervatten: weer wel', async () => {
    const p = await w.post(PAUZE, { id, aan: true }, A);
    const tijdens = (await ziet(DINER)).length;
    const h = await w.post(PAUZE, { id, aan: false }, A);
    const na = (await ziet(DINER)).length;
    return { klopt: p.status === 200 && h.status === 200 && tijdens === 0 && na === 1, ziet: 'tijdens pauze ' + tijdens + ', na hervatten ' + na };
  });

  await stap('voltooibaar', 'stop: de zaak ziet niets meer, en het lid ook niet', async () => {
    const s = await w.post(STOP, { id }, A);
    const z = (await ziet(DINER)).length;
    const l = momenten(await w.post(MIJN, {}, A)).filter((m) => m.id === id).length;
    return { klopt: s.status === 200 && z === 0 && l === 0, ziet: 'stop ' + s.status + ', zaak ' + z + ', lid ' + l };
  });

  /* ---------------- persistent ---------------- */
  const TREIN = 'Trein naar Kyoto ' + merk();
  const m2 = await w.post(MAAK, formulier(TREIN), A);
  const id2 = m2.data && m2.data.moment && m2.data.moment.id;
  await w.post(STATUS, { id: id2, status: 'vertraagd', eta: '21:10' }, A);
  const voor = JSON.stringify(momenten(await w.post(MIJN, {}, A)));
  await w.herstart();

  await stap('persistent', 'na een nette herstart staat het lopende moment er nog, met dezelfde stand', async () => {
    const na = JSON.stringify(momenten(await w.post(MIJN, {}, A)));
    return { klopt: voor !== '[]' && na === voor, ziet: 'momenten ' + (na === voor ? 'byte voor byte gelijk' : 'ANDERS') };
  });
  await stap('persistent', 'een nieuwe sessie van het lid en een nieuwe sessie van de zaak zien hetzelfde', async () => {
    const C = await inloggen(w, lid);
    Z = await zaakSessie(w);
    const l = momenten(await w.post(MIJN, {}, C)).find((m) => m.id === id2);
    const a = (await ziet(TREIN))[0];
    return { klopt: !!l && l.status === 'vertraagd' && !!a && a.status === 'vertraagd' && a.eta === '21:10',
      ziet: 'lid: ' + (l && l.status) + ', zaak: ' + (a && a.status) + ' ' + (a && a.eta) };
  });
  await stap('persistent', 'het moment staat in de opslag zelf (store.db, gelezen buiten de server om), het gestopte ook', async () => {
    const v = w.collectie('veilig') || {};
    const lijst = Array.isArray(v.momenten) ? v.momenten : [];
    const loopt = lijst.filter((m) => m.id === id2 && m.status === 'vertraagd').length;
    const gestopt = lijst.filter((m) => m.id === id && m.status === 'gestopt').length;
    return { klopt: loopt === 1 && gestopt === 1, ziet: loopt + ' lopend, ' + gestopt + ' gestopt in de kv-opslag' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbelklik op Pauze: een stand, en de zaak ziet niets', async () => {
    const [a, b] = await Promise.all([w.post(PAUZE, { id: id2, aan: true }, A), w.post(PAUZE, { id: id2, aan: true }, A)]);
    const l = momenten(await w.post(MIJN, {}, A)).find((m) => m.id === id2);
    const z = (await ziet(TREIN)).length;
    await w.post(PAUZE, { id: id2, aan: false }, A);
    return { klopt: a.status === 200 && b.status === 200 && !!l && l.gepauzeerd === true && z === 0, ziet: a.status + '/' + b.status + ', gepauzeerd=' + (l && l.gepauzeerd) + ', zaak ziet ' + z };
  });

  const DUBBEL = 'Taxi naar huis ' + merk();
  await stap('herstelbaar', 'dubbelklik op Deel live: hetzelfde formulier twee keer is een Live Circle, niet twee', async () => {
    const [a, b] = await Promise.all([w.post(MAAK, formulier(DUBBEL), A), w.post(MAAK, formulier(DUBBEL), A)]);
    const l = momenten(await w.post(MIJN, {}, A)).filter((m) => m.titel === DUBBEL).length;
    const z = (await ziet(DUBBEL)).length;
    return { klopt: geen5xx(a) && geen5xx(b) && l === 1 && z === 1, ziet: a.status + '/' + b.status + ', lid heeft er ' + l + ', zaak ziet er ' + z };
  });

  await stap('herstelbaar', 'een afgebroken stop en daarna opnieuw: gestopt, en de zaak ziet niets', async () => {
    const half = await w.afgebroken(STOP, { id: id2 }, A);
    const opnieuw = await w.post(STOP, { id: id2 }, A);
    const z = (await ziet(TREIN)).length;
    return { klopt: geen5xx(opnieuw) && opnieuw.status === 200 && z === 0,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', zaak ziet ' + z };
  });

  const CRASH = 'Vlucht naar Osaka ' + merk();
  await stap('herstelbaar', 'een crash direct na het delen: de zaak ziet de aankomst nog', async () => {
    const r = await w.post(MAAK, formulier(CRASH), A);
    await w.crash();
    Z = await zaakSessie(w);
    const z = (await ziet(CRASH)).length;
    return { klopt: r.status === 200 && z === 1, ziet: 'maak ' + r.status + ', na SIGKILL ziet de zaak ' + z };
  });

  await stap('herstelbaar', 'een crash direct na stop: gestopt blijft gestopt, de zaak ziet niets', async () => {
    const id3 = (momenten(await w.post(MIJN, {}, A)).find((m) => m.titel === CRASH) || {}).id;
    const r = await w.post(STOP, { id: id3 }, A);
    await w.crash();
    Z = await zaakSessie(w);
    const z = (await ziet(CRASH)).length;
    return { klopt: r.status === 200 && z === 0, ziet: 'stop ' + r.status + ', na SIGKILL ziet de zaak ' + z };
  });
}

/* ---------------- de kruisproef (bewijs 6, scripts/lib/ledenkruis.js) ----------------
   Zaait iets dat ALLEEN van dit lid is, zodat "een ander zag niets" een uitslag
   is en geen leeg experiment. `merktekens` mogen in geen antwoord aan een ander
   staan; `lezers` moeten na alle pogingen van de anderen byte voor byte gelijk
   terugkomen; `handelingen` doen de anderen eerst, en daarna het lid zelf. */
async function zaai(w) {
  const lid = await nieuwLid(w, 'krvl');
  const TITEL = 'Diner kruisproef ' + merk();
  const m = await w.post(MAAK, formulier(TITEL), lid.token);
  const id = m.data && m.data.moment && m.data.moment.id;
  return { lid, merktekens: [TITEL], lezers: [{ pad: MIJN }],
    handelingen: [{ pad: STATUS, lijf: { id, status: 'onderweg', eta: '19:45' } }, { pad: PAUZE, lijf: { id, aan: true } },
      { pad: STOP, lijf: { id } }, { pad: MAAK, lijf: formulier('Trein kruisproef ' + merk()) }] };
}

module.exports = {
  functie: 'link:reizen',
  /* De zaak KIKUNOI met een manager-PIN is synthetische zaaidata, en die bestaat
     alleen in de Magnaat-testomgeving (server/testomgeving.js: nooit in
     productie). Een zaak langs de echte toelating laten ontstaan is de
     toelatingsproef, niet deze. */
  omgeving: { RTG_MAGNAAT_TEST: '1' },
  ingang: '/apps/reizen-veilig.html',
  persona: 'lid',
  belofte: 'een lid deelt een reis tijdelijk met wie het zelf kiest, een zaak ziet hooguit voortgang en nooit een plek, en pauzeren en stoppen werken meteen -- ook na een herstart of een crash',
  grens: 'De proef loopt over de routes die het scherm aanroept en de leesroute van de zaak, niet door het scherm zelf. Een contact als ontvanger (met exacte plek) zit er niet in, net zo min als het vanzelf verlopen op de eindtijd. De zaak is KIKUNOI uit de zaaiset. Er is geen Redis of PostgreSQL in de wereld.',
  loop,
  zaai
};
