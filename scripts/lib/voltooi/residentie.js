/* ============================================================================
   VOLTOOIPROEF: DE RESIDENCE (link:residentie, /apps/residentie.html).

   De belofte, in de woorden van routes/member/residentie.js en kern/residentie/
   suite.js: het virtuele grandhotel. Een lid heeft een eigen suite (vanaf dag
   een ingericht), richt die zelf in met de Maison-catalogus -- "geen munten,
   geen koop-lussen" --, geeft hem een naam en zet hem open of dicht voor
   bezoek. De gids toont de open suites; een ander lid kan een open suite
   binnenlopen en een gesloten niet.

   TWEE LEDEN. A richt in; B bezoekt. Alles op codenaam. Wat hier blijvend is,
   is de suite (naam, open, meubels); wie er in een zaal staat is een
   momentopname en wordt niet als persistent gemeten.

   HET SCHERM LAADT EEN GEGENEREERDE BUNDEL (/apps/residentie.js). De routes
   hieronder staan in de bundeldelen public/apps/residentie/residentie-04.js
   en -03.js; de koppeling volgt de bundel naar die delen
   (ingangRoutes in scripts/lib/bewijsbron.js).
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const SUITE = '/api/residentie/suite';
const SUITE_ZET = '/api/residentie/suite/zet';
const MEUBEL_ZET = '/api/residentie/meubel/zet';
const MEUBEL_WEG = '/api/residentie/meubel/weg';
const GIDS = '/api/residentie/gids';
const BETREED = '/api/residentie/betreed';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const merk = Date.now().toString(36).slice(-5);
  const A = await nieuwLid(w, 'rsa');
  const B = await nieuwLid(w, 'rsb');
  let T = A.token;
  const suite = async (tok) => ((((await w.post(SUITE, {}, tok || T)).data) || {}).suite) || null;
  const opPlek = (s, soort, x, y) => ((s && s.meubels) || []).filter((m) => m.soort === soort && m.x === x && m.y === y);
  let adres = null, startAantal = 0;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'het lid opent zijn suite: vanaf dag een ingericht, met de catalogus erbij en zonder prijzen', async () => {
    const r = await w.post(SUITE, {}, T);
    const s = r.data && r.data.suite;
    adres = s && s.adres;
    startAantal = s ? s.meubels.length : 0;
    const cat = (r.data && r.data.catalogus) || [];
    return { klopt: r.status === 200 && !!s && startAantal > 0 && /^suite:/.test(adres) && cat.length >= 5 && !JSON.stringify(cat).match(/prijs|munt|euro/i),
      ziet: r.status + ', ' + (s && s.naam) + ', ' + startAantal + ' meubels, catalogus ' + cat.length + ' stuks' };
  });

  await stap('bevoegd', 'een net ingerichte suite begint dicht: niet in de gids van een ander lid, en die komt er niet in', async () => {
    const s = await suite();
    const g = await w.post(GIDS, {}, B.token);
    const inGids = ((g.data && g.data.suites) || []).some((x) => x.adres === adres);
    const b = await w.post(BETREED, { kamer: adres }, B.token);
    return { klopt: !!s && s.open === false && g.status === 200 && !inGids && b.status === 403,
      ziet: 'open ' + (s && s.open) + ', in de gids ' + (inGids ? 'WEL' : 'niet') + ', B ' + b.status };
  });

  await stap('voltooibaar', 'een meubel buiten de suite wordt geweigerd met de reden', async () => {
    const r = await w.post(MEUBEL_ZET, { soort: 'tafel', x: 11, y: 8 }, T);
    return { klopt: r.status === 400 && /past daar niet/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'het lid zet een fauteuil neer en geeft zijn suite een naam; beide staan er', async () => {
    const m = await w.post(MEUBEL_ZET, { soort: 'fauteuil', x: 10, y: 7 }, T);
    const z = await w.post(SUITE_ZET, { naam: 'Suite ' + merk }, T);
    const s = await suite();
    return { klopt: m.status === 200 && z.status === 200 && s.naam === 'Suite ' + merk && s.open === false && opPlek(s, 'fauteuil', 10, 7).length === 1,
      ziet: 'meubel ' + m.status + ', naam ' + z.status + ', ' + s.naam + ', ' + s.meubels.length + ' meubels' };
  });

  await stap('voltooibaar', 'het lid zet zijn suite zelf open voor bezoek', async () => {
    const z = await w.post(SUITE_ZET, { open: true }, T);
    const s = await suite();
    return { klopt: z.status === 200 && s.open === true, ziet: 'open ' + z.status + ', nu open ' + s.open };
  });

  await stap('voltooibaar', 'de gids toont de open suite onder zijn naam, en een ander lid loopt hem binnen', async () => {
    const g = await w.post(GIDS, {}, B.token);
    const inGids = ((g.data && g.data.suites) || []).find((x) => x.adres === adres);
    const b = await w.post(BETREED, { kamer: adres }, B.token);
    return { klopt: g.status === 200 && !!inGids && inGids.naam === 'Suite ' + merk && b.status === 200 && b.data.kamer && b.data.kamer.id === adres && b.data.kamer.eigen === false,
      ziet: 'gids ' + g.status + (inGids ? ' met ' + inGids.naam : ' ZONDER de suite') + ', binnenlopen ' + b.status };
  });

  await stap('bevoegd', 'het lid zet de suite dicht: hij verdwijnt uit de gids en het andere lid komt er niet meer in', async () => {
    const z = await w.post(SUITE_ZET, { open: false }, T);
    const g = await w.post(GIDS, {}, B.token);
    const inGids = ((g.data && g.data.suites) || []).some((x) => x.adres === adres);
    await w.post(BETREED, { kamer: 'lobby' }, B.token);
    const b = await w.post(BETREED, { kamer: adres }, B.token);
    const eigen = await w.post(BETREED, { kamer: adres }, T);
    return { klopt: z.status === 200 && !inGids && b.status === 403 && /gesloten/.test(b.data.error) && eigen.status === 200 && eigen.data.kamer.id === adres && eigen.data.kamer.eigen === true,
      ziet: 'dicht ' + z.status + ', in de gids ' + (inGids ? 'NOG' : 'niet') + ', B ' + b.status + ' (' + (b.data && b.data.error) + '), eigenaar ' + eigen.status };
  });

  await stap('bevoegd', 'wat het andere lid neerzet, landt in zijn eigen suite en nooit in die van dit lid', async () => {
    const voor = JSON.stringify((await suite()).meubels);
    const m = await w.post(MEUBEL_ZET, { soort: 'kruk', x: 9, y: 7 }, B.token);
    const na = JSON.stringify((await suite()).meubels);
    const sB = await suite(B.token);
    return { klopt: m.status === 200 && na === voor && opPlek(sB, 'kruk', 9, 7).length === 1 && sB.adres !== adres,
      ziet: 'B zet ' + m.status + ', suite van A ' + (na === voor ? 'ongewijzigd' : 'GEWIJZIGD') + ', kruk in de suite van B' };
  });

  await stap('voltooibaar', 'een gratis account (gast) krijgt een dichte deur met de reden', async () => {
    const G = await nieuwLid(w, 'rsg', 'guest');
    const r = await w.post(SUITE, {}, G.token);
    return { klopt: r.status === 403 && /voor leden/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify(await suite());
  await w.herstart();

  await stap('persistent', 'na een nette herstart staat de suite er nog: naam, dicht, en elk meubel op zijn plek', async () => {
    const na = JSON.stringify(await suite());
    return { klopt: voor.length > 20 && na === voor, ziet: na === voor ? 'gelijk' : 'ANDERS: ' + na.slice(0, 100) };
  });

  await stap('persistent', 'een nieuwe sessie (een ander toestel) ziet dezelfde suite', async () => {
    T = await inloggen(w, A);
    const na = JSON.stringify(await suite());
    return { klopt: na === voor, ziet: na === voor ? 'gelijk' : 'ANDERS' };
  });

  await stap('persistent', 'de suite staat in de opslag zelf, op codenaam en zonder e-mailadres', async () => {
    const plek = w.vindInOpslag('Suite ' + merk).filter((p) => p.sleutel !== 'audit');
    const adresIn = w.vindInOpslag(A.email).filter((p) => plek.some((q) => q.sleutel === p.sleutel));
    return { klopt: plek.length >= 1 && adresIn.length === 0,
      ziet: 'suite in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') + '; e-mailadres in dezelfde collectie: ' + adresIn.length };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "neerzetten": een bank, niet twee op dezelfde plek', async () => {
    const [a, b] = await w.dubbel(MEUBEL_ZET, { soort: 'bank', x: 4, y: 7 }, T);
    const n = opPlek(await suite(), 'bank', 4, 7).length;
    return { klopt: geen5xx(a) && geen5xx(b) && (a.status === 200 || b.status === 200) && n === 1,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' bank(en) op die plek' };
  });

  await stap('herstelbaar', 'dubbeltik op "weghalen": precies dat ene meubel weg, niet ook het volgende', async () => {
    const s0 = await suite();
    const i = s0.meubels.findIndex((m) => m.soort === 'fauteuil' && m.x === 10 && m.y === 7);
    const [a, b] = await w.dubbel(MEUBEL_WEG, { i }, T);
    const s1 = await suite();
    return { klopt: i >= 0 && geen5xx(a) && geen5xx(b) && s1.meubels.length === s0.meubels.length - 1 && opPlek(s1, 'fauteuil', 10, 7).length === 0,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + s0.meubels.length + ' -> ' + s1.meubels.length + ' meubels' };
  });

  await stap('herstelbaar', 'een afgebroken "neerzetten" en opnieuw: precies een meubel erbij', async () => {
    const voorN = (await suite()).meubels.length;
    const half = await w.afgebroken(MEUBEL_ZET, { soort: 'chaise', x: 6, y: 5 }, T);
    const opnieuw = await w.post(MEUBEL_ZET, { soort: 'chaise', x: 6, y: 5 }, T);
    const s = await suite();
    return { klopt: geen5xx(opnieuw) && opPlek(s, 'chaise', 6, 5).length === 1 && s.meubels.length === voorN + 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + opPlek(s, 'chaise', 6, 5).length + ' chaise' };
  });

  await stap('herstelbaar', 'een crash direct na het weghalen: wat weg heette blijft weg', async () => {
    const s0 = await suite();
    const i = s0.meubels.findIndex((m) => m.soort === 'chaise' && m.x === 6 && m.y === 5);
    const x = await w.post(MEUBEL_WEG, { i }, T);
    await w.crash();
    const s1 = await suite();
    return { klopt: x.status === 200 && opPlek(s1, 'chaise', 6, 5).length === 0 && s1.meubels.length === s0.meubels.length - 1,
      ziet: 'weghalen ' + x.status + ', na SIGKILL ' + s1.meubels.length + ' meubels (was ' + s0.meubels.length + ')' };
  });
}

module.exports = {
  functie: 'link:residentie',
  ingang: '/apps/residentie.html',
  persona: 'lid',
  belofte: 'een lid richt zijn eigen suite in met de Maison-catalogus, geeft hem een naam en zet hem zelf open (hij begint dicht) of weer dicht; de gids toont een open suite en een ander lid kan hem binnenlopen, een gesloten niet -- en de inrichting overleeft een herstart, een dubbele tik, een afgebroken verzoek en een crash',
  grens: 'De proef loopt de routes van het scherm, niet het canvas. Lopen, praten, emotes, spellen en de paarvorming zijn niet gelopen; wie er in een zaal staat is een momentopname en wordt niet als persistent gemeten. Het live seintje over /api/stream is niet gelopen. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
