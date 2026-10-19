/* ============================================================================
   VOLTOOIPROEF: RTG NAVIGATIE (link:navigatie, /apps/navigatie.html).

   De belofte, in de woorden van routes/navigatie.js: het huiseigen
   navigatiesysteem. De route komt uit het eigen wegennet (A*), de bestemmingen
   uit de eigen leveranciers en lagen, en onderweg meldt een lid met een tik
   wat hij ziet -- terug het netwerk in, op codenaam. Geen externe kaartdienst.

   EERLIJKHEID IS DEEL VAN DE BELOFTE. In Nederland weigert de motor zolang het
   NWB niet is ingelezen, en de kaartcatalogus zegt dat er geen gebiedsindex is
   in plaats van een lege lijst als "niets" te verkopen. Beide zijn hier een
   schakel: een navigatie die daar een route verzint, stuurt iemand de sloot in.

   WAT HIER BLIJVEND IS, is de melding (kern/flits.js, dezelfde laag als RTG
   Flits). Een kaart kiezen (/api/nav/gebied/kies) kan in deze wereld niet:
   zonder ingelezen gebiedsindex kent de catalogus geen enkel gebied. Dat staat
   onder `grens` en wordt niet nagebootst.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { nieuwLid, inloggen, KANTOORWERELD } = require('../voltooiwereld');
const { rdNaarWgs } = require('../../../server/kern/navigatie/nwb-geo');
const { INDEX } = require('../../../test/navigatie-index-fixture');

const STATUS = '/api/nav/status';
const BESTEMMINGEN = '/api/nav/bestemmingen';
const ROUTE = '/api/nav/route';
const POI = '/api/nav/poi';
const MELD = '/api/nav/meld';
const KAART = '/api/nav/kaart';
const GEBIEDEN = '/api/nav/gebieden';
const KIES = '/api/nav/gebied/kies';
const WEG = '/api/nav/gebied/weg';
const PAKKET = '/api/nav/gebied/pakket';
const WORTEL = path.join(__dirname, '..', '..', '..');

/* EEN KLEIN NWB IN HET ECHTE FORMAAT: een GeoPackage met de tabel Wegvakken,
   de lijnen als GeoPackage-WKB in Rijksdriehoekscoordinaten (EPSG:28992),
   precies wat scripts/navigatie-nederland.js uit de Rijkswaterstaatbron leest.
   Een raster van drie bij drie knopen, 400 meter uit elkaar, midden in
   Amsterdam. Het wordt ingelezen langs DIE importweg (--bron), niet in de
   opslag gezet: zo bewijst de stap ook dat de import een echt bestand leest. */
const RD = { x: 121000, y: 486500, stap: 400 };
const knoopRd = (i, j) => [RD.x + i * RD.stap, RD.y + j * RD.stap];
function lijnGeom(punten) {
  const b = Buffer.alloc(8 + 9 + punten.length * 16);
  b.write('GP', 0, 'latin1'); b[2] = 0; b[3] = 1; b.writeInt32LE(28992, 4);
  b[8] = 1; b.writeUInt32LE(2, 9); b.writeUInt32LE(punten.length, 13);
  punten.forEach(([x, y], k) => { b.writeDoubleLE(x, 17 + k * 16); b.writeDoubleLE(y, 25 + k * 16); });
  return b;
}
function nwbFixture(bestand) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(bestand);
  db.exec('CREATE TABLE Wegvakken(fid INTEGER PRIMARY KEY, WVK_ID INTEGER, JTE_ID_BEG INTEGER, JTE_ID_END INTEGER, RIJRICHTNG TEXT, BST_CODE TEXT, FRC TEXT, WEGBEHSRT TEXT, WEGNR_FRML TEXT, ROUTELTR TEXT, ROUTENR INTEGER, STT_NAAM TEXT, WPSNAAM TEXT, GME_NAAM TEXT, geom BLOB)');
  const zet = db.prepare('INSERT INTO Wegvakken(WVK_ID,JTE_ID_BEG,JTE_ID_END,RIJRICHTNG,BST_CODE,FRC,WEGBEHSRT,WEGNR_FRML,ROUTELTR,ROUTENR,STT_NAAM,WPSNAAM,GME_NAAM,geom) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const id = (i, j) => 1000 + i * 10 + j;
  let wvk = 1;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    if (i < 2) zet.run(wvk++, id(i, j), id(i + 1, j), '', '', '5', 'G', null, null, null, 'Proefgracht ' + j, 'Amsterdam', 'Amsterdam', lijnGeom([knoopRd(i, j), knoopRd(i + 1, j)]));
    if (j < 2) zet.run(wvk++, id(i, j), id(i, j + 1), '', '', '5', 'G', null, null, null, 'Proefstraat ' + i, 'Amsterdam', 'Amsterdam', lijnGeom([knoopRd(i, j), knoopRd(i, j + 1)]));
  }
  db.close();
}
/* De twee importscripts, met een lokaal bestand als bron. */
function importeer(w) {
  const nav = path.join(w.datamap, 'navigatie');
  fs.mkdirSync(nav, { recursive: true });
  const gpkg = w.datamap + '-nwb.gpkg', index = w.datamap + '-index.json';
  nwbFixture(gpkg);
  /* Alleen de Nederlandse gebieden uit de index-fixture. Een aangeboden maar
     niet gebouwd gebied weigert eerlijk (kern/navigatie/gebiednetten.js), en
     het werelddeel Europe uit de fixture ligt ook over Ibiza: dan zou het
     demonstratienet daar stil vallen en meet de proef iets anders. */
  fs.writeFileSync(index, JSON.stringify(Object.assign({}, INDEX,
    { features: INDEX.features.filter((f) => String(f.properties.id).startsWith('europe/netherlands')) })));
  const env = Object.assign({}, process.env, { RTG_DATA_DIR: w.datamap });
  execFileSync(process.execPath, ['scripts/navigatie-nederland.js', '--bron', gpkg, '--uit', path.join(nav, 'nederland.sqlite')], { cwd: WORTEL, env, stdio: 'ignore' });
  execFileSync(process.execPath, ['scripts/navigatie-index.js', '--bron', index, '--uit', path.join(nav, 'gebieden.json')], { cwd: WORTEL, env, stdio: 'ignore' });
  for (const f of [gpkg, index]) try { fs.rmSync(f); } catch (e) { /* weg */ }
}

/* Ibiza, waar het eigen demonstratienet ligt. Elke melding krijgt een eigen
   plek ruim buiten de dedupestraal (300 m) van de andere. */
const HIER = { lat: 38.91, lng: 1.43, land: 'ES' };
const plek = (n) => ({ lat: 38.93 + n * 0.006, lng: 1.40, land: 'ES' });
const geen5xx = (r) => r && r.status > 0 && r.status < 500;
const pauze = () => new Promise((r) => setTimeout(r, 21000)); // kern/flits.js: een tik per twintig seconden per melder

async function loop(w, stap) {
  const A = await nieuwLid(w, 'nva');
  const B = await nieuwLid(w, 'nvb');
  let T = A.token;
  const meldingenRond = async (p, tok) => ((((await w.post(POI, Object.assign({ lagen: ['flits'] }, p), tok || T)).data) || {}).lagen || {}).flits || [];
  // het beeld geeft de plek op drie decimalen (kern/flits.js), dus binnen een halve eenheid daarvan
  const opPlek = (lijst, p) => lijst.filter((m) => Math.abs(m.lat - p.lat) < 0.0006 && Math.abs(m.lng - p.lng) < 0.0006);
  let zaak = null, route = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'het lid ziet wat de motor hier werkelijk weet: eigen motor, en dat Nederland nog niet is ingeladen', async () => {
    const s = await w.post(STATUS, HIER, T);
    return { klopt: s.status === 200 && s.data.eigenMotor === true && s.data.routeerbaarHier === true &&
      s.data.dekking.actief === false && /nog niet ingeladen/.test(s.data.dekking.reden),
      ziet: s.status + ', ' + s.data.motor + ', routeerbaar hier ' + s.data.routeerbaarHier + ', NL: ' + s.data.dekking.reden };
  });

  await stap('voltooibaar', 'het lid zoekt een bestemming en vindt een zaak uit de eigen leveranciers, met plek en afstand', async () => {
    const r = await w.post(BESTEMMINGEN, { q: 'Brisa', lat: HIER.lat, lng: HIER.lng }, T);
    zaak = ((r.data && r.data.bestemmingen) || []).find((b) => b.soort === 'leverancier');
    return { klopt: r.status === 200 && !!zaak && Number.isFinite(zaak.lat) && Number.isFinite(zaak.afstandM),
      ziet: r.status + ', ' + (zaak ? zaak.naam + ' (' + zaak.code + ') op ' + zaak.afstandM + ' m' : 'NIETS') };
  });

  await stap('voltooibaar', 'de route ernaartoe komt uit het eigen wegennet: bocht voor bocht, met een aankomsttijd per vervoerwijze', async () => {
    const r = await w.post(ROUTE, { van: { lat: HIER.lat, lng: HIER.lng }, naar: { lat: zaak.lat, lng: zaak.lng }, modus: 'auto' }, T);
    route = r.data;
    const stappen = (route && route.stappen) || [];
    return { klopt: r.status === 200 && stappen.length >= 2 && stappen[stappen.length - 1].bocht === 'eind' &&
      Number.isFinite(route.etaMin.auto) && Number.isFinite(route.etaMin.lopen) && !!route.routeId,
      ziet: r.status + ', ' + (route && route.afstandM) + ' m, ' + stappen.length + ' stappen, auto ' + (route && route.etaMin && route.etaMin.auto) + ' min' };
  });

  await stap('voltooibaar', 'een route in Nederland wordt eerlijk geweigerd met de reden, in plaats van verzonnen', async () => {
    const r = await w.post(ROUTE, { van: { lat: 52.37, lng: 4.89 }, naar: { lat: 52.09, lng: 5.12 }, modus: 'auto' }, T);
    return { klopt: r.status === 503 && /nog niet ingeladen/.test(r.data.error) && !r.data.route,
      ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'de kaart rond het lid laat de eigen zaken zien; de kaartcatalogus zegt eerlijk dat er geen index is', async () => {
    const k = await w.post(KAART, { lat: HIER.lat, lng: HIER.lng }, T);
    const g = await w.post(GEBIEDEN, {}, T);
    return { klopt: k.status === 200 && (k.data.plekken || []).some((p) => p.code === zaak.code) &&
      g.status === 200 && g.data.telling.aangeboden === 0 && /geen gebiedsindex/.test(g.data.reden || '') && g.data.opToestel === null,
      ziet: 'kaart ' + k.status + ' met ' + (k.data.plekken || []).length + ' plekken; catalogus: ' + (g.data && g.data.reden) };
  });

  /* Sinds 19 oktober 2026 gaat de melder niet mee in het beeld (kern/flits.js):
     een codenaam met een plek en een tijd is een spoor. In de opslag staat hij
     wel, op codenaam, voor stemmen en vergeten. */
  await stap('voltooibaar', 'het lid meldt een object op de weg; de melding staat op de kaart, zonder de melder, en in de opslag op codenaam', async () => {
    const m = await w.post(MELD, plek(0), T);
    const rond = opPlek(await meldingenRond(plek(0)), plek(0));
    const rij = (w.collectie('flitsMeldingen') || []).find((x) => m.data && m.data.melding && x.id === m.data.melding.id);
    return { klopt: m.status === 200 && m.data.melding.soort === 'object' && rond.length === 1 && !('door' in rond[0]) && !!rij && !!rij.door,
      ziet: 'melden ' + m.status + ', ' + rond.length + ' melding op die plek, melder in het beeld: ' + (rond[0] && 'door' in rond[0] ? 'JA' : 'nee') + ', in de opslag: ' + (rij && rij.door ? 'op codenaam' : 'NIET') };
  });

  await stap('voltooibaar', 'een ander lid ziet de melding zonder melder -- geen codenaam, geen naam en geen e-mailadres', async () => {
    const zichtB = opPlek(await meldingenRond(plek(0), B.token), plek(0));
    const tekst = JSON.stringify(zichtB) + JSON.stringify(w.collectie('flitsMeldingen') || []);
    return { klopt: zichtB.length === 1 && !('door' in zichtB[0]) && !tekst.includes('Voltooilid') && !tekst.includes(A.email) && !tekst.includes(A.token),
      ziet: 'B ziet ' + zichtB.length + ' melding' + (tekst.includes('Voltooilid') || tekst.includes(A.email) ? ', MET NAAM OF ADRES' : ', zonder naam of adres, ook niet in de opslag') };
  });

  await stap('voltooibaar', 'een gratis account (gast) krijgt een dichte deur met de reden', async () => {
    const G = await nieuwLid(w, 'nvg', 'guest');
    const r = await w.post(ROUTE, { van: HIER, naar: zaak }, G.token);
    return { klopt: r.status === 403 && /voor leden/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  /* Tot hier rekende de wereld ZONDER Nederlands wegennet en zonder
     gebiedsindex, en dat zei hij eerlijk. Nu leest RTG beide in langs de eigen
     importweg; de server laadt een net bij het opstarten, dus de herstart
     hieronder is ook het moment waarop het net er is. */
  importeer(w);
  const voorMelding = JSON.stringify(opPlek(await meldingenRond(plek(0)), plek(0)));
  await w.herstart();

  await stap('persistent', 'na een nette herstart staat de melding er nog, gelijk', async () => {
    const na = JSON.stringify(opPlek(await meldingenRond(plek(0)), plek(0)));
    return { klopt: voorMelding.length > 2 && na === voorMelding, ziet: na === voorMelding ? 'gelijk' : 'ANDERS: ' + na.slice(0, 100) };
  });

  await stap('persistent', 'een nieuwe sessie rekent dezelfde route, met hetzelfde kenmerk, en ziet dezelfde melding', async () => {
    T = await inloggen(w, A);
    const r = await w.post(ROUTE, { van: { lat: HIER.lat, lng: HIER.lng }, naar: { lat: zaak.lat, lng: zaak.lng }, modus: 'auto' }, T);
    const m = opPlek(await meldingenRond(plek(0)), plek(0));
    return { klopt: r.status === 200 && r.data.routeId === route.routeId && r.data.afstandM === route.afstandM && m.length === 1,
      ziet: 'route ' + r.status + ' (' + (r.data.routeId === route.routeId ? 'zelfde kenmerk' : 'ANDER kenmerk') + '), ' + m.length + ' melding' };
  });

  await stap('persistent', 'de melding staat in de opslag zelf (gelezen buiten de server om)', async () => {
    const id = JSON.parse(voorMelding)[0];
    const lijst = w.collectie('flitsMeldingen') || [];
    const rij = lijst.find((m) => Math.abs(m.lat - plek(0).lat) < 1e-6 && Math.abs(m.lng - plek(0).lng) < 1e-6);
    return { klopt: !!id && !!rij && rij.soort === 'object' && !JSON.stringify(rij).includes(A.email),
      ziet: lijst.length + ' meldingen in flitsMeldingen, deze ' + (rij ? 'gevonden (door ' + rij.door + ')' : 'NIET gevonden') };
  });

  /* ---------------- voltooibaar, met het Nederlandse net ---------------- */
  const a = rdNaarWgs(...knoopRd(0, 0)), z = rdNaarWgs(...knoopRd(2, 2));
  let gebied = null;
  await stap('voltooibaar', 'na de import van het NWB zegt de motor dat Nederland actief is, met de bron en het aantal wegvakken', async () => {
    const s0 = await w.post(STATUS, { lat: a.lat, lng: a.lng, land: 'NL' }, T);
    const d = s0.data.dekking || {};
    return { klopt: s0.status === 200 && d.actief === true && d.hierActief === true && d.wegvakken === 12 && /Rijkswaterstaat/.test(d.bron || ''),
      ziet: s0.status + ', net ' + s0.data.net + ', actief ' + d.actief + ', ' + d.wegvakken + ' wegvakken, bron ' + d.bron };
  });

  await stap('voltooibaar', 'een route in Amsterdam komt nu uit het NWB: bocht voor bocht over de echte straatnamen', async () => {
    const r = await w.post(ROUTE, { van: a, naar: z, modus: 'auto' }, T);
    const namen = [...new Set(((r.data && r.data.route) || []).map((p) => p._naam).filter(Boolean))];
    return { klopt: r.status === 200 && r.data.afstandM >= 1500 && r.data.afstandM <= 1700 && namen.some((n) => /Proef/.test(n)),
      ziet: r.status + ', ' + (r.data && r.data.afstandM) + ' m over ' + namen.join(', ') };
  });

  await stap('voltooibaar', 'een straat uit het NWB is als bestemming te vinden', async () => {
    const r = await w.post(BESTEMMINGEN, { q: 'Proefgracht', lat: a.lat, lng: a.lng }, T);
    const b = (r.data.bestemmingen || []).filter((x) => x.laag === 'wegennet');
    return { klopt: r.status === 200 && b.length >= 1 && b[0].extra === 'Amsterdam', ziet: r.status + ', ' + b.map((x) => x.naam).join(', ') };
  });

  await stap('voltooibaar', 'de kaartcatalogus kent nu de gebieden van de index; het lid kiest er een, en een ander lid ziet die keuze niet', async () => {
    const g = await w.post(GEBIEDEN, {}, T);
    gebied = (g.data.gebieden || []).find((x) => x.code === 'europe-netherlands');
    const k = await w.post(KIES, { code: gebied && gebied.code }, T);
    const mijn = ((await w.post(GEBIEDEN, {}, T)).data || {}).mijn || [];
    const vanB = ((await w.post(GEBIEDEN, {}, B.token)).data || {}).mijn || [];
    return { klopt: g.status === 200 && g.data.telling.aangeboden === 2 && !!gebied && k.status === 200 && /nog niet gebouwd/.test(k.data.wat) &&
      mijn.includes('europe-netherlands') && vanB.length === 0,
      ziet: g.data.telling.aangeboden + ' aangeboden, kies ' + k.status + ' (' + (k.data && k.data.wat || '').slice(0, 50) + '...), A heeft ' + mijn.join(',') + ', B heeft ' + vanB.length };
  });

  await stap('voltooibaar', 'een kaart die nog niet gebouwd is, valt niet op te halen -- en de keuze blijft staan als verzoek', async () => {
    const p = await w.post(PAKKET, { code: 'europe-netherlands' }, T);
    const mijn = ((await w.post(GEBIEDEN, {}, T)).data || {}).mijn || [];
    return { klopt: p.status === 409 && /nog niet gebouwd/.test(p.data.error) && mijn.includes('europe-netherlands'),
      ziet: p.status + ' (' + (p.data && p.data.error || '').slice(0, 70) + '), keuze ' + (mijn.includes('europe-netherlands') ? 'staat' : 'WEG') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "melden": een melding op de kaart, niet twee', async () => {
    await pauze();
    const [a, b] = await w.dubbel(MELD, plek(3), T);
    const n = opPlek(await meldingenRond(plek(3)), plek(3)).length;
    return { klopt: geen5xx(a) && geen5xx(b) && (a.status === 200 || b.status === 200) && n === 1,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' melding op die plek' };
  });

  await stap('herstelbaar', 'een afgebroken melding en opnieuw: precies een melding op de kaart', async () => {
    await pauze();
    const half = await w.afgebroken(MELD, plek(4), T);
    await pauze();
    const opnieuw = await w.post(MELD, plek(4), T);
    const n = opPlek(await meldingenRond(plek(4)), plek(4));
    return { klopt: opnieuw.status === 200 && n.length === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status +
        (opnieuw.data && opnieuw.data.herhaald ? ' (als herhaling)' : '') + ', ' + n.length + ' melding' };
  });

  await stap('herstelbaar', 'een crash direct na een melding: hij staat er na de herstart, en opnieuw melden is een herhaling en geen tweede of een zelfbevestiging', async () => {
    await pauze();
    const m = await w.post(MELD, plek(5), T);
    await w.crash();
    const na = opPlek(await meldingenRond(plek(5)), plek(5));
    const opnieuw = await w.post(MELD, plek(5), T);
    const daarna = opPlek(await meldingenRond(plek(5)), plek(5));
    return { klopt: m.status === 200 && na.length === 1 && opnieuw.status === 200 && opnieuw.data.herhaald === true && daarna.length === 1,
      ziet: 'melden ' + m.status + ', na SIGKILL ' + na.length + ' melding; opnieuw ' + opnieuw.status + (opnieuw.data && opnieuw.data.herhaald ? ' als herhaling' : '') + ', nu ' + daarna.length };
  });

  await stap('herstelbaar', 'dubbeltik op "kies" voor een tweede kaart: die staat er een keer, en de keuze overleeft de crash hierboven', async () => {
    const [x, y] = await w.dubbel(KIES, { code: 'europe-netherlands-noord-holland' }, T);
    const mijn = ((await w.post(GEBIEDEN, {}, T)).data || {}).mijn || [];
    return { klopt: geen5xx(x) && geen5xx(y) && mijn.filter((c) => c === 'europe-netherlands-noord-holland').length === 1 && mijn.includes('europe-netherlands'),
      ziet: 'antwoorden ' + x.status + '/' + y.status + ', keuzes: ' + mijn.join(', ') };
  });

  await stap('herstelbaar', 'een crash direct na het weghalen van een kaart: die blijft weg, de andere blijft staan', async () => {
    const x = await w.post(WEG, { code: 'europe-netherlands-noord-holland' }, T);
    await w.crash();
    const mijn = ((await w.post(GEBIEDEN, {}, T)).data || {}).mijn || [];
    return { klopt: x.status === 200 && !mijn.includes('europe-netherlands-noord-holland') && mijn.includes('europe-netherlands'),
      ziet: 'weg ' + x.status + ', na SIGKILL: ' + mijn.join(', ') };
  });
}

module.exports = {
  functie: 'link:navigatie',
  ingang: '/apps/navigatie.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid zoekt een bestemming uit de eigen bronnen, krijgt een route van het eigen wegennet -- ook in Nederland zodra het NWB is ingelezen, en anders een eerlijke weigering --, kiest welke kaarten hij wil, en meldt onderweg wat hij ziet, terug het netwerk in op codenaam, ook na een herstart, een dubbele tik, een afgebroken verzoek en een crash',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. Eerst zonder Nederlands wegennet (de eerlijke weigering), daarna met een klein NWB-raster in het echte GeoPackage-formaat en de gebiedsindex-fixture, ingelezen langs de eigen importscripts; dat bewijst de import en de motor, niet de echte Rijkswaterstaat- of Geofabrik-bron. Een kaartpakket bouwen uit OpenStreetMap is een aparte, externe pijplijn: ophalen naar het toestel is daarom alleen als eerlijke weigering gelopen. Live verkeer en partnersignalen zijn er niet. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
