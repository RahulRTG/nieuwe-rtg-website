/* ============================================================================
   VOLTOOIPROEF: RTG VONK (link:vonk, /apps/vonk.html) -- daten op codenaam.

   De belofte van het scherm: een volwassen lid met een door RTG gezien
   paspoort maakt een profiel, krijgt een eindige dagselectie van mensen die
   wederzijds bij zijn wensen passen, en pas als BEIDE interesse tonen is er een
   vonk: een chatlijn en een tafel rond het midden. Beiden betalen vooraf, de
   zaak bevestigt de tafel, en wie over de schreef gaat wordt geblokkeerd en
   gemeld. Elke stap over de routes die vonk.html zelf aanroept
   (/api/vonk/profiel, /selectie, /like, /edge, /bericht, /mijn, /betaal,
   /blokkeer), met de toestandsrevisie die het scherm meestuurt.

   DE LEDEN ZIJN ECHT GEKEURD. Een medewerker op naam keurt identiteit en
   selfie (gezicht bevestigd), zoals test/vonk.test.js; de wallet wordt over de
   simulatiebank opgeladen met een gebonden toestel, zoals ./pay.js. Geen vlag
   in een poort: 18+, KYC en het walletplafond draaien ongewijzigd mee.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const { nieuwLid, inloggen, eigenaarSessie, gebondenToestel, KANTOORWERELD } = require('../voltooiwereld');
const simulatiebank = require('../../../server/betaal/synthetisch');

/* Opladen over de simulatiebank met een herhaalsleutel die "betaald" geeft --
   dezelfde afleiding als ./pay.js (actor `pay:<codenaam>`). */
const bank = simulatiebank({ crypto, env: {}, echteRail: null });
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
function betaaldeSleutel(codenaam, merk) {
  for (let i = 0; i < 10000; i++) {
    const idem = 'voltooi-vonk-' + merk + '-' + i;
    const id = 'BW-' + sha('pay:' + codenaam + '|pay-oplaad:' + codenaam + ':' + idem).slice(0, 20).toUpperCase();
    if (bank.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) === 'betaald') return idem;
  }
  throw new Error('geen herhaalsleutel gevonden die "betaald" geeft');
}

const PROFIEL = '/api/vonk/profiel';
const SELECTIE = '/api/vonk/selectie';
const LIKE = '/api/vonk/like';
const EDGE = '/api/vonk/edge';
const BERICHT = '/api/vonk/bericht';
const MIJN = '/api/vonk/mijn';
const BETAAL = '/api/vonk/betaal';
const BLOKKEER = '/api/vonk/blokkeer';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const geen5xx = (r) => r && r.status > 0 && r.status < 500;

/* Een lid dat Vonk mag openen: identiteit en selfie ingestuurd, een medewerker
   op naam keurt goed met het gezicht bevestigd en de geboortedatum van het
   document overgenomen. */
async function vonkLid(w, merk, K) {
  const lid = await nieuwLid(w, merk);
  await w.post('/api/verify/upload', { image: PNG }, lid.token);
  await w.post('/api/verify/selfie', { image: PNG }, lid.token);
  const rij = ((await w.post('/api/office/verifications', {}, K)).data || {}).pending || [];
  const mijn = rij.find((x) => x.email === lid.email);
  if (!mijn) throw new Error('het lid staat niet in de verificatiewachtrij');
  const b = await w.post('/api/office/verify', { userId: mijn.userId || mijn.id, decision: 'approve', faceMatch: true,
    geslacht: 'v', geboortedatum: '1985-05-05' }, K);
  if (b.status !== 200) throw new Error('de keuring lukte niet (' + b.status + ')');
  lid.token = await inloggen(w, lid);
  return lid;
}

const PROFIEL_LIJF = (stad, lat, lng, extra) => ({ over: 'Zee, boeken en lange diners.', stad, lat, lng,
  leeftijdMin: 25, leeftijdMax: 70, maxKm: 150, interesses: ['sushi', extra] });

async function loop(w, stap) {
  const K = await eigenaarSessie(w);
  const A = await vonkLid(w, 'vka', K);
  const B = await vonkLid(w, 'vkb', K);
  const C = await vonkLid(w, 'vkc', K);
  let bNaam = null, cNaam = null, mid = null;
  const merk = 'vk' + Date.now().toString(36);

  const mijn = async (tok) => ((await w.post(MIJN, {}, tok)).data || {}).matches || [];
  const rev = async (tok, id) => ((await w.post(EDGE, id ? { id } : {}, tok)).data || {}).stateRevision;
  const stuur = async (tok, tekst, extra) => w.post(BERICHT, Object.assign({ id: mid, tekst, stateRevision: await rev(tok, mid) }, extra || {}), tok);
  const tel = (lijst, tekst) => ((lijst[0] && lijst[0].berichten) || []).filter((b) => b.tekst === tekst).length;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een lid zonder door RTG gezien paspoort staat voor een dichte deur, met de reden erbij', async () => {
    const los = await nieuwLid(w, 'vkx');
    const r = await w.post(PROFIEL, { over: 'hoi' }, los.token);
    return { klopt: r.status === 403 && !!(r.data && r.data.error), ziet: r.status + ' -- ' + (r.data && r.data.error) };
  });

  await stap('voltooibaar', 'twee gekeurde leden maken een profiel; de dagselectie van A is eindig en toont B met wat ze delen', async () => {
    const a = await w.post(PROFIEL, PROFIEL_LIJF('Sant Antoni', 38.98, 1.30, 'zeilen'), A.token);
    const b = await w.post(PROFIEL, PROFIEL_LIJF('Cala Jondal', 38.88, 1.37, 'jazz'), B.token);
    const c = await w.post(PROFIEL, PROFIEL_LIJF('Santa Eulalia', 38.98, 1.53, 'golf'), C.token);
    const s = await w.post(SELECTIE, {}, A.token);
    const mensen = (s.data && s.data.mensen) || [];
    const kand = mensen.filter((m) => (m.gemeen || []).includes('sushi'));
    return { klopt: a.status === 200 && b.status === 200 && c.status === 200 && s.status === 200 && mensen.length <= 6 && kand.length >= 2 &&
      kand.every((m) => !('geslacht' in m)) && a.data.profiel.stad === 'Sant Antoni',
      ziet: 'profielen ' + [a, b, c].map((x) => x.status).join('/') + ', selectie ' + mensen.length + ' mensen, ' + kand.length + ' met sushi gemeen' };
  });

  await stap('voltooibaar', 'een kant interesse is nog geen vonk; als ook de ander wil, is er een match met een tafel rond het midden', async () => {
    /* Herken de zelf aangemaakte deelnemers aan hun openbare profielstad,
       niet aan de daglot-volgorde. Een proeflike op C verwijdert C uit A's
       selectie en maakt de latere blokkeerproef onmogelijk vóór de crash. */
    const sA = ((await w.post(SELECTIE, {}, A.token)).data || {}).mensen || [];
    const sB = ((await w.post(SELECTIE, {}, B.token)).data || {}).mensen || [];
    const herken = (lijst, stad) => {
      const kandidaten = lijst.filter((m) => m.stad === stad && (m.gemeen || []).includes('sushi'));
      if (kandidaten.length !== 1) throw new Error('Vonk-fixture: verwacht precies één deelnemer uit ' + stad + ', gevonden ' + kandidaten.length);
      return kandidaten[0].codenaam;
    };
    bNaam = herken(sA, 'Cala Jondal');
    cNaam = herken(sA, 'Santa Eulalia');
    const aNaam = herken(sB, 'Sant Antoni');
    const l1 = await w.post(LIKE, { codenaam: bNaam }, A.token);
    const match = await w.post(LIKE, { codenaam: aNaam }, B.token);
    mid = match && match.data.id;
    const bijA = await mijn(A.token);
    return { klopt: !!l1 && l1.status === 200 && l1.data.match === false && match.status === 200 && match.data.match === true && !!match.data.tafel && !!match.data.tafel.supplierName &&
      bijA.length === 1 && bijA[0].status === 'wacht-op-betaling',
      ziet: 'eerste like ' + (l1 && l1.status) + ' (match=' + (l1 && l1.data && l1.data.match) + '), wederzijds: ' + (match ? 'match met tafel bij ' + match.data.tafel.supplierName : 'GEEN match') };
  });

  await stap('voltooibaar', 'de chatlijn is open: A schrijft, en B leest het bericht in zijn match', async () => {
    const c = await stuur(A.token, 'Zin in ' + merk);
    const bijB = await mijn(B.token);
    return { klopt: c.status === 200 && tel(bijB, 'Zin in ' + merk) === 1, ziet: 'bericht ' + c.status + ', B ziet ' + tel(bijB, 'Zin in ' + merk) + ' bericht' };
  });

  await stap('voltooibaar', 'beiden betalen vooraf; daarna is er alleen een aanvraag, en pas de zaak bevestigt de tafel', async () => {
    const opgeladen = [];
    for (const L of [A, B]) {
      const t = await gebondenToestel(w, L.token);
      const o = await w.post('/api/pay/overzicht', {}, L.token, await t.bewijs('POST', '/api/pay/overzicht'));
      const idem = betaaldeSleutel(o.data && o.data.codenaam, merk);
      opgeladen.push((await w.post('/api/pay/oplaad', { centen: 2000, idem }, L.token, await t.bewijs('POST', '/api/pay/oplaad'))).status);
    }
    const m = (await mijn(A.token))[0];
    const b1 = await w.post(BETAAL, { id: mid, stateRevision: await rev(A.token, mid) }, A.token);
    const b2 = await w.post(BETAAL, { id: mid, stateRevision: await rev(B.token, mid) }, B.token);
    const na = (await mijn(A.token))[0] || {};
    const ref = na.reservering && na.reservering.reference;
    const roster = (await w.post('/api/supplier/roster', { code: m.tafel.supplierCode })).data || {};
    const manager = (roster.staff || []).find((s) => s.role === 'manager');
    const zaak = ((await w.post('/api/supplier/login', { code: m.tafel.supplierCode, staffId: manager && manager.id, pin: '1234' })).data || {}).token;
    const besluit = await w.post('/api/supplier/reservering/beslis', { id: ref, action: 'bevestig' }, zaak);
    const eind = (await mijn(B.token))[0] || {};
    return { klopt: opgeladen.join() === '200,200' && b1.status === 200 && b2.status === 200 && na.status === 'reservering-aangevraagd' && !!ref && besluit.status === 200 && eind.status === 'bevestigd',
      ziet: 'opgeladen ' + opgeladen.join('/') + ', betaal ' + b1.status + '/' + b2.status + ' (' + ((b1.data && b1.data.error) || (b2.data && b2.data.error) || 'ok') + '), na betalen ' + na.status + ', zaak ' + besluit.status + ', bij B ' + eind.status };
  });

  await stap('voltooibaar', 'bevoegdheid: zonder sessie geen selectie, geen match en geen bericht (401)', async () => {
    const a = await w.post(SELECTIE, {});
    const b = await w.post(MIJN, {});
    const c = await w.post(BERICHT, { id: mid, tekst: 'anoniem' });
    return { klopt: a.status === 401 && b.status === 401 && c.status === 401, ziet: 'selectie ' + a.status + ', mijn ' + b.status + ', bericht ' + c.status };
  });

  await stap('voltooibaar', 'bevoegdheid: een derde gekeurd lid komt de chat van A en B niet in en ziet hun match niet', async () => {
    const r = await w.post(BERICHT, { id: mid, tekst: 'Indringer ' + merk }, C.token);
    const e = await w.post(EDGE, { id: mid }, C.token);
    const bijC = await mijn(C.token);
    const bijB = await mijn(B.token);
    return { klopt: (r.status === 404 || r.status === 409) && !bijC.some((m) => m.id === mid) && tel(bijB, 'Indringer ' + merk) === 0 &&
      !JSON.stringify(e.data || {}).includes(merk),
      ziet: 'bericht door C ' + r.status + ' (' + (r.data && r.data.error) + '), C ziet ' + bijC.length + ' matches' };
  });

  await stap('voltooibaar', 'bevoegdheid: een gratis account heeft geen Vonk, ook niet met een geldige sessie', async () => {
    const g = await nieuwLid(w, 'vkg', 'guest');
    const s = await w.post(SELECTIE, {}, g.token);
    const p = await w.post(PROFIEL, PROFIEL_LIJF('Ibiza', 38.9, 1.4, 'sushi'), g.token);
    return { klopt: s.status === 403 && p.status === 403, ziet: 'selectie ' + s.status + ', profiel ' + p.status + ' (' + (s.data && s.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  const vorm = (l) => JSON.stringify(l.map((m) => [m.id, m.status, m.tafel && m.tafel.supplierCode, (m.berichten || []).map((b) => b.tekst)]));
  const voorA = vorm(await mijn(A.token));
  await w.herstart();

  await stap('persistent', 'na een nette herstart staat de match er nog: bevestigd, met tafel en chat', async () => {
    const na = vorm(await mijn(A.token));
    return { klopt: voorA.includes('bevestigd') && na === voorA, ziet: na === voorA ? 'gelijk: ' + na.slice(0, 100) : 'ANDERS: ' + na.slice(0, 100) };
  });

  await stap('persistent', 'B logt opnieuw in (een ander toestel) en ziet dezelfde match en hetzelfde bericht', async () => {
    const tok = await inloggen(w, B);
    const l = await mijn(tok);
    return { klopt: l.length === 1 && l[0].id === mid && l[0].status === 'bevestigd' && tel(l, 'Zin in ' + merk) === 1,
      ziet: l.length + ' match, status ' + (l[0] && l[0].status) + ', ' + tel(l, 'Zin in ' + merk) + ' bericht' };
  });

  await stap('persistent', 'de match en het bericht staan in de opslag zelf (gelezen buiten de server om)', async () => {
    const m = w.vindInOpslag(mid);
    const b = w.vindInOpslag('Zin in ' + merk);
    return { klopt: m.length >= 1 && b.length >= 1, ziet: 'match in ' + m.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') + '; bericht in ' + b.length + ' plek(ken)' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "versturen": een bericht bij B, niet twee', async () => {
    const r = await rev(A.token, mid);
    const [a, b] = await w.dubbel(BERICHT, { id: mid, tekst: 'Dubbel ' + merk, idem: 'vonk-bericht-dubbel-' + merk, stateRevision: r }, A.token);
    const n = tel(await mijn(B.token), 'Dubbel ' + merk);
    const bewust = await stuur(A.token, 'Dubbel ' + merk, { idem: 'vonk-bericht-bewust-' + merk });
    const n2 = tel(await mijn(B.token), 'Dubbel ' + merk);
    return { klopt: (a.status === 200 || b.status === 200) && geen5xx(a) && geen5xx(b) && n === 1 && bewust.status === 200 && n2 === 2,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' bericht(en) bij B; bewust nog een: ' + n2 };
  });

  await stap('herstelbaar', 'een afgebroken verzoek, daarna opnieuw: een bericht bij B', async () => {
    const r = await rev(A.token, mid);
    const lijf = { id: mid, tekst: 'Half ' + merk, idem: 'vonk-bericht-half-' + merk, stateRevision: r };
    const half = await w.afgebroken(BERICHT, lijf, A.token);
    const opnieuw = await w.post(BERICHT, lijf, A.token);
    const n = tel(await mijn(B.token), 'Half ' + merk);
    return { klopt: geen5xx(opnieuw) && n === 1, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' bericht(en) bij B' };
  });

  await stap('herstelbaar', 'een crash direct na een bericht, en het toestel probeert opnieuw: het staat er een keer', async () => {
    const extra = { idem: 'vonk-bericht-stroom-' + merk };
    const c = await stuur(A.token, 'Stroom ' + merk, extra);
    await w.crash();
    const opnieuw = await stuur(A.token, 'Stroom ' + merk, extra);
    const n = tel(await mijn(B.token), 'Stroom ' + merk);
    return { klopt: c.status === 200 && opnieuw.status === 200 && n === 1, ziet: 'bericht ' + c.status + ', na SIGKILL opnieuw ' + opnieuw.status + ', ' + n + ' bij B' };
  });

  await stap('herstelbaar', 'een crash direct na blokkeren en melden: C blijft uit de selectie en de melding ligt bij het kantoor', async () => {
    const sA = ((await w.post(SELECTIE, {}, A.token)).data || {}).mensen || [];
    if (!sA.some((m) => m.codenaam === cNaam)) throw new Error('Vonk-fixture: de nog niet gelikete C ontbreekt vóór blokkeren');
    const blok = await w.post(BLOKKEER, { codenaam: cNaam, meld: 'ongepast ' + merk }, A.token);
    await w.crash();
    const na = ((await w.post(SELECTIE, {}, A.token)).data || {}).mensen || [];
    const KT = await eigenaarSessie(w);
    const ml = ((await w.post('/api/office/vonk/meldingen', {}, KT)).data || {}).meldingen || [];
    return { klopt: !!cNaam && blok.status === 200 && !na.some((m) => m.codenaam === cNaam) && ml.some((x) => x.reden === 'ongepast ' + merk),
      ziet: 'blokkeer ' + blok.status + ', na SIGKILL ' + (na.some((m) => m.codenaam === cNaam) ? 'C NOG in de selectie' : 'C weg') + ', ' + ml.filter((x) => x.reden === 'ongepast ' + merk).length + ' melding bij kantoor' };
  });
}

module.exports = {
  functie: 'link:vonk',
  ingang: '/apps/vonk.html',
  persona: 'lid',
  omgeving: Object.assign({ RTG_SIMULATIEBANK: '1' }, KANTOORWERELD),
  belofte: 'een gekeurd volwassen lid krijgt een eindige selectie van wederzijds passende mensen, en pas bij wederzijdse interesse een chat en een tafel; beiden betalen vooraf, de zaak bevestigt, blokkeren en melden werken -- en niets gaat verloren of dubbel bij een herstart, een dubbeltik of een crash',
  grens: 'De proef loopt de routes van het scherm, niet het scherm; de profielfoto, bellen en video (Connection) worden niet gelopen. De keuring van identiteit en selfie is een pixel die een medewerker op naam goedkeurt. Opladen gaat over de simulatiebank. De zaak bevestigt met zijn demo-PIN. Geen Redis of PostgreSQL.',
  loop
};
