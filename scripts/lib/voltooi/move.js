/* ============================================================================
   VOLTOOIPROEF: RTG MOVE (link:move, /apps/move.html).

   De belofte, in de woorden van routes/move.js: drie vragen die nergens anders
   te stellen waren -- haal ik het, wat breekt er als iets verschuift, en waar
   moet ik nu naartoe. Alle drie LEZEND: Move schrijft nooit en bewaart niets
   (kern/move/index.js, kop). Wat er te weten valt, komt uit de reiswereld.

   DE REIS ONTSTAAT ZOALS BIJ EEN LID: twee afspraken bij twee zaken op Ibiza,
   aangevraagd en betaald langs de gewone boekroutes (/api/booking/request en
   /pay). Die zijn het werk van een ander scherm en geen schakel van Move; ze
   zijn de grond waarop Move oordeelt. De reistijd komt uit de eigen routemotor
   op het eigen wegennet -- geen externe kaartdienst.

   WAT PERSISTENT EN HERSTELBAAR HIER BETEKENEN. Move bewaart niets, dus "na
   een herstart staat het er nog" gaat over het OORDEEL: over dezelfde reis
   hetzelfde antwoord, in een nieuwe sessie en na een crash. En herstelbaar gaat
   over de belofte dat een vraag niets verzet: een dubbele of afgebroken vraag
   "wat als het uitloopt" laat de reis precies zoals hij was.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, KANTOORWERELD } = require('../voltooiwereld');

const REIS = '/api/move/reis';
const GEVOLG = '/api/move/gevolg';
const VOLGENDE = '/api/move/volgende';

const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const lid = await nieuwLid(w, 'mov');
  let T = lid.token;
  const B = await nieuwLid(w, 'mob');
  const morgen = dag(1);
  /* Twee zaken op Ibiza met een dienst van bekende duur: zonder duur is er geen
     moment waarop je er weg kunt, en dan valt er niets te rekenen. */
  const zaken = ((((await w.post('/api/suppliers', {}, T)).data) || {}).suppliers || [])
    .filter((z) => z.city === 'Ibiza' && (z.services || []).some((s) => s.duurMin > 0 && s.duurMin <= 120));
  if (zaken.length < 3) throw new Error('de testwereld heeft geen drie zaken met een dienst van bekende duur (' + zaken.length + ')');
  const dienst = (z) => z.services.find((s) => s.duurMin > 0 && s.duurMin <= 120);
  const boek = async (z, tijd) => {
    const r = await w.post('/api/booking/request', { supplierCode: z.code, serviceId: dienst(z).id, date: morgen, time: tijd }, T);
    const ref = r.data && r.data.boeking && r.data.boeking.ref;
    if (!ref) throw new Error('de afspraak bij ' + z.code + ' lukte niet (' + r.status + ')');
    const p = await w.post('/api/booking/pay', { ref }, T);
    if (p.status !== 200) throw new Error('de afspraak bij ' + z.code + ' betalen lukte niet (' + p.status + ')');
    return ref;
  };
  const reis = async (tok) => (await w.post(REIS, {}, tok || T));
  let vroeg = null, laat = null, oordeel = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een lid zonder reis hoort dat er niets te overbruggen is, en de knop verzint geen bestemming', async () => {
    const r = await reis();
    const v = await w.post(VOLGENDE, {}, T);
    return { klopt: r.status === 200 && r.data.oordeel === null && r.data.onderdelen === 0 && v.status === 200 &&
      v.data.volgende === null && /verzint geen bestemming/.test(v.data.waarom),
      ziet: 'reis ' + r.status + ' (' + r.data.waarom + '), volgende ' + v.status + ': ' + (v.data && v.data.waarom) };
  });

  await stap('voltooibaar', 'met een afspraak om 10:00 en een om 13:00 bij twee zaken: per overgang een oordeel, met de dekking erbij', async () => {
    vroeg = await boek(zaken[0], '10:00');
    laat = await boek(zaken[1], '13:00');
    const r = await reis();
    const n = (r.data.naden || [])[0] || {};
    oordeel = r.data;
    return { klopt: r.status === 200 && r.data.onderdelen === 2 && r.data.dekking === 100 && ['RUIM', 'KRAP'].includes(r.data.oordeel) &&
      n.van && n.van.kenmerk === vroeg && n.naar.kenmerk === laat && Number.isFinite(n.margeMin) && /eigen wegennet/.test(n.bron || ''),
      ziet: r.status + ', ' + r.data.oordeel + ', dekking ' + r.data.dekking + '%, marge ' + n.margeMin + ' min, bron: ' + n.bron };
  });

  await stap('voltooibaar', 'de volgende beweging is de afspraak van 10:00 -- de eerste in de tijd, met een echte plek', async () => {
    const v = await w.post(VOLGENDE, {}, T);
    const x = v.data && v.data.volgende;
    return { klopt: v.status === 200 && !!x && x.kenmerk === vroeg && Number.isFinite(x.plek.lat) && x.plek.bron === 'zaak',
      ziet: v.status + ', ' + (x ? x.titel + ' om ' + x.nodigAt + ' (' + x.kenmerk + (x.kenmerk === vroeg ? ', de vroege' : ', NIET de vroege') + ')' : 'niets') };
  });

  await stap('voltooibaar', 'loopt de eerste afspraak 90 minuten uit, dan zegt Move wat er breekt -- en voert niets uit', async () => {
    const g = await w.post(GEVOLG, { kenmerk: vroeg, minuten: 90 }, T);
    const regel = (g.data && g.data.regels || [])[0] || {};
    const na = await reis();
    return { klopt: g.status === 200 && g.data.verschuiving.bron === 'opgegeven' && g.data.geraakt === 1 && regel.geraakt === true &&
      ['ONHAALBAAR', 'KRAP'].includes(regel.na) && na.data.oordeel === oordeel.oordeel,
      ziet: g.status + ', geraakt ' + (g.data && g.data.geraakt) + ', ' + regel.voor + ' -> ' + regel.na + '; de reis zelf blijft ' + na.data.oordeel };
  });

  await stap('voltooibaar', 'een verschuiving zonder minuten wordt geweigerd -- Move raadt geen vertraging', async () => {
    const g = await w.post(GEVOLG, { kenmerk: vroeg }, T);
    return { klopt: g.status === 400 && /aantal minuten/.test(g.data.error), ziet: g.status + ' (' + (g.data && g.data.error) + ')' };
  });

  await stap('bevoegd', 'een ander lid ziet een lege reis en kan geen gevolg vragen over een afspraak van dit lid', async () => {
    const r = await reis(B.token);
    const g = await w.post(GEVOLG, { kenmerk: vroeg, minuten: 30 }, B.token);
    return { klopt: r.status === 200 && r.data.onderdelen === 0 && g.status === 404 && !JSON.stringify(g.data).includes(dienst(zaken[0]).name),
      ziet: 'reis van B: ' + r.data.onderdelen + ' onderdelen; gevolg ' + g.status + ' (' + (g.data && g.data.error) + ')' };
  });

  await stap('voltooibaar', 'een gratis account (gast) krijgt een dichte deur met de reden', async () => {
    const G = await nieuwLid(w, 'mog', 'guest');
    const r = await reis(G.token);
    return { klopt: r.status === 403 && /voor leden/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify((await reis()).data);
  await w.herstart();

  await stap('persistent', 'na een nette herstart geeft Move over dezelfde reis hetzelfde oordeel, byte voor byte', async () => {
    const na = JSON.stringify((await reis()).data);
    return { klopt: voor.length > 50 && na === voor, ziet: na === voor ? 'gelijk (' + na.length + ' tekens)' : 'ANDERS: ' + na.slice(0, 100) };
  });

  await stap('persistent', 'een nieuwe sessie (een ander toestel) ziet dezelfde reis en dezelfde volgende beweging', async () => {
    T = await inloggen(w, lid);
    const na = JSON.stringify((await reis()).data);
    const v = await w.post(VOLGENDE, {}, T);
    return { klopt: na === voor && v.data.volgende && v.data.volgende.kenmerk === vroeg,
      ziet: (na === voor ? 'gelijk oordeel' : 'ANDERS') + ', volgende ' + (v.data.volgende && v.data.volgende.kenmerk) };
  });

  await stap('persistent', 'de afspraken waarop Move oordeelt staan in de opslag; Move zelf bewaart er niets van', async () => {
    const a = w.vindInOpslag(vroeg), b = w.vindInOpslag(laat);
    const eigen = w.opslag('store.db', "SELECT key FROM kv WHERE deleted = 0 AND lower(key) LIKE '%move%'");
    return { klopt: a.length >= 1 && b.length >= 1 && eigen.length === 0,
      ziet: 'afspraken in ' + a.concat(b).map((p) => p.sleutel || p.tabel).join(', ') + '; collecties van Move: ' + eigen.length };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "wat als het uitloopt": twee keer hetzelfde antwoord, en de reis is niet verschoven', async () => {
    const [a, b] = await w.dubbel(GEVOLG, { kenmerk: vroeg, minuten: 45 }, T);
    const na = JSON.stringify((await reis()).data);
    return { klopt: a.status === 200 && b.status === 200 && JSON.stringify(a.data) === JSON.stringify(b.data) && na === voor,
      ziet: 'antwoorden ' + a.status + '/' + b.status + (JSON.stringify(a.data) === JSON.stringify(b.data) ? ', gelijk' : ', VERSCHILLEND') + ', reis ' + (na === voor ? 'ongewijzigd' : 'GEWIJZIGD') };
  });

  await stap('herstelbaar', 'een afgebroken vraag en opnieuw: hetzelfde antwoord, en niets verschoven', async () => {
    const half = await w.afgebroken(GEVOLG, { kenmerk: vroeg, minuten: 120 }, T);
    const opnieuw = await w.post(GEVOLG, { kenmerk: vroeg, minuten: 120 }, T);
    const na = JSON.stringify((await reis()).data);
    return { klopt: opnieuw.status === 200 && opnieuw.data.verschuiving.minuten === 120 && na === voor,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', reis ' + (na === voor ? 'ongewijzigd' : 'GEWIJZIGD') };
  });

  await stap('herstelbaar', 'een crash direct na een nieuwe betaalde afspraak: Move telt hem na de herstart mee', async () => {
    const derde = await boek(zaken[2], '16:00');
    await w.crash();
    const r = await reis();
    const ken = (r.data.naden || []).some((n) => n.naar && n.naar.kenmerk === derde);
    return { klopt: r.status === 200 && r.data.onderdelen === 3 && ken, ziet: 'na SIGKILL ' + r.data.onderdelen + ' onderdelen, de nieuwe ' + (ken ? 'in een overgang' : 'NIET GEZIEN') };
  });

  await stap('herstelbaar', 'na de crash blijft het oordeel over de eerste overgang gelijk, en de volgende beweging ook', async () => {
    const r = await reis();
    const n = (r.data.naden || []).find((x) => x.van.kenmerk === vroeg) || {};
    const oud = (oordeel.naden || [])[0] || {};
    const v = await w.post(VOLGENDE, {}, T);
    return { klopt: geen5xx(r) && n.uitkomst === oud.uitkomst && n.margeMin === oud.margeMin && v.data.volgende && v.data.volgende.kenmerk === vroeg,
      ziet: 'eerste overgang ' + n.uitkomst + ' (' + n.margeMin + ' min, was ' + oud.margeMin + '), volgende ' + (v.data.volgende && v.data.volgende.kenmerk) };
  });
}

module.exports = {
  functie: 'link:move',
  ingang: '/apps/move.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid ziet per overgang in zijn reis of hij het haalt, met de dekking erbij, wat er breekt als iets uitloopt, en waar hij nu naartoe moet -- en een vraag verzet niets, ook niet na een herstart, een dubbele tik, een afgebroken verzoek of een crash',
  grens: 'De proef loopt de drie lezende routes van het scherm, niet het scherm zelf. De reis bestaat uit betaalde afspraken op Ibiza (de reistijd op het eigen wegennet); vluchten, verblijven en het reisbureau dragen vandaag geen duur of geen plek en geven daarom NIET_TE_BEPALEN, wat hier niet apart gelopen is. In Nederland weigert de routemotor zolang het NWB niet is ingelezen. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
