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
const { nieuwLid, inloggen, KANTOORWERELD } = require('../voltooiwereld');

const STATUS = '/api/nav/status';
const BESTEMMINGEN = '/api/nav/bestemmingen';
const ROUTE = '/api/nav/route';
const POI = '/api/nav/poi';
const MELD = '/api/nav/meld';
const KAART = '/api/nav/kaart';
const GEBIEDEN = '/api/nav/gebieden';

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
  const opPlek = (lijst, p) => lijst.filter((m) => Math.abs(m.lat - p.lat) < 1e-6 && Math.abs(m.lng - p.lng) < 1e-6);
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

  await stap('voltooibaar', 'het lid meldt een object op de weg; de melding staat op de kaart onder zijn codenaam', async () => {
    const m = await w.post(MELD, plek(0), T);
    const rond = opPlek(await meldingenRond(plek(0)), plek(0));
    return { klopt: m.status === 200 && m.data.melding.soort === 'object' && rond.length === 1 && !!m.data.melding.door,
      ziet: 'melden ' + m.status + ' door ' + (m.data && m.data.melding && m.data.melding.door) + ', ' + rond.length + ' melding op die plek' };
  });

  await stap('voltooibaar', 'een ander lid ziet de melding, met alleen de codenaam -- geen naam en geen e-mailadres van de melder', async () => {
    const zichtB = opPlek(await meldingenRond(plek(0), B.token), plek(0));
    const tekst = JSON.stringify(zichtB) + JSON.stringify(w.collectie('flitsMeldingen') || []);
    return { klopt: zichtB.length === 1 && !tekst.includes('Voltooilid') && !tekst.includes(A.email) && !tekst.includes(A.token),
      ziet: 'B ziet ' + zichtB.length + ' melding' + (tekst.includes('Voltooilid') || tekst.includes(A.email) ? ', MET NAAM OF ADRES' : ', zonder naam of adres, ook niet in de opslag') };
  });

  await stap('voltooibaar', 'een gratis account (gast) krijgt een dichte deur met de reden', async () => {
    const G = await nieuwLid(w, 'nvg', 'guest');
    const r = await w.post(ROUTE, { van: HIER, naar: zaak }, G.token);
    return { klopt: r.status === 403 && /voor leden/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
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
        (opnieuw.data && opnieuw.data.bevestigd ? ' (als bevestiging)' : '') + ', ' + n.length + ' melding' };
  });

  await stap('herstelbaar', 'een crash direct na een melding: hij staat er na de herstart, en opnieuw melden maakt er geen tweede van', async () => {
    await pauze();
    const m = await w.post(MELD, plek(5), T);
    await w.crash();
    const na = opPlek(await meldingenRond(plek(5)), plek(5));
    const opnieuw = await w.post(MELD, plek(5), T);
    const daarna = opPlek(await meldingenRond(plek(5)), plek(5));
    return { klopt: m.status === 200 && na.length === 1 && opnieuw.status === 200 && opnieuw.data.bevestigd === true && daarna.length === 1,
      ziet: 'melden ' + m.status + ', na SIGKILL ' + na.length + ' melding; opnieuw ' + opnieuw.status + (opnieuw.data && opnieuw.data.bevestigd ? ' als bevestiging' : '') + ', nu ' + daarna.length };
  });
}

module.exports = {
  functie: 'link:navigatie',
  ingang: '/apps/navigatie.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid zoekt een bestemming uit de eigen bronnen, krijgt een route van het eigen wegennet -- of een eerlijke weigering waar dat net er niet is -- en meldt onderweg wat hij ziet, terug het netwerk in op codenaam, ook na een herstart, een dubbele tik, een afgebroken verzoek en een crash',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf, en rekent op het demonstratienet rond Ibiza; het Nederlandse wegennet (NWB) is in deze wereld niet ingeladen. Een kaart kiezen en naar het toestel halen (/api/nav/gebied/kies, /weg, /pakket) is niet gelopen: zonder ingelezen gebiedsindex kent de catalogus geen gebied. Live verkeer en partnersignalen zijn er niet. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
