/* ============================================================================
   VOLTOOIPROEF: WEBSITE-MAKER (link:sitemaker, /apps/sitemaker.html).

   De belofte van het scherm: een lid bouwt een eigen website, zet hem online op
   een adres in het RTG-web, en bepaalt zelf wanneer een wijziging naar buiten
   gaat -- bewaren verandert het concept, publiceren verandert het web. Een
   misser heeft een weg terug (versies), en uit de lucht halen kan altijd.

   De ontvanger is echt: een ander lid opent het adres in de RTG-browser
   (/api/browser/open, de route van /apps/browser.html) en ziet wat er
   werkelijk online staat. Dat is dezelfde lezer als voor elke bezoeker.
   ========================================================================== */
'use strict';
const { nieuwLid } = require('../voltooiwereld');

const SJABLONEN = '/api/site/sjablonen';
const MIJN = '/api/site/mijn';
const HAAL = '/api/site/haal';
const BEWAAR = '/api/site/bewaar';
const PUBLICEER = '/api/site/publiceer';
const LIVE = '/api/site/live';
const OFFLINE = '/api/site/offline';
const VERSIES = '/api/site/versies';
const HERSTEL = '/api/site/herstel';
const BLADER = '/api/browser/open';

const ontwerp = (titel, kop, extra) => Object.assign({ titel, thema: 'licht', accent: '#7F1634',
  blokken: [{ id: 'b1', type: 'hero', kop, sub: 'Een eigen plek', knop: 'Contact' }] }, extra || {});

async function loop(w, stap) {
  const merk = 's' + Date.now().toString(36).slice(-5);
  const A = await nieuwLid(w, 'site');
  const B = await nieuwLid(w, 'bezoek');
  const adres = 'voltooi-' + merk;
  const mijn = async (tok) => ((((await w.post(MIJN, {}, tok || A.token)).data) || {}).lijst) || [];
  const bezoek = async () => w.post(BLADER, { adres }, B.token);
  const kopVan = (r) => (((r.data && r.data.site && r.data.site.blokken) || [])[0] || {}).kop;
  let id = null;

  /* ---------------- voltooibaar ---------------- */
  /* De sjablonen komen uit het Atelier en zijn in een verse wereld leeg; de
     etalage hoort dan een lege lijst te geven en geen fout. */
  await stap('voltooibaar', 'het lid opent de maker: de sjablonenetalage antwoordt en hij heeft nog geen site', async () => {
    const s = await w.post(SJABLONEN, {}, A.token);
    const m = await mijn();
    return { klopt: s.status === 200 && Array.isArray(s.data.lijst) && m.length === 0,
      ziet: 'sjablonen ' + (s.data && s.data.lijst && s.data.lijst.length) + ', eigen sites ' + m.length };
  });

  await stap('voltooibaar', 'hij bewaart een ontwerp: het staat als concept in zijn lijst en nog niet op het web', async () => {
    const r = await w.post(BEWAAR, { design: ontwerp('Atelier ' + merk, 'Versie een', { idem: 'site-' + merk }) }, A.token);
    id = r.data && r.data.design && r.data.design.id;
    const m = await mijn();
    const b = await bezoek();
    return { klopt: r.status === 200 && m.length === 1 && m[0].online === false && b.status === 404,
      ziet: 'bewaren ' + r.status + ', ' + m.length + ' site, online ' + (m[0] && m[0].online) + ', bezoeker ' + b.status };
  });

  await stap('voltooibaar', 'hij zet hem online op een eigen adres; een ander lid opent dat adres in de browser', async () => {
    const p = await w.post(PUBLICEER, { id, adres }, A.token);
    const b = await bezoek();
    return { klopt: p.status === 200 && p.data.adres === adres && b.status === 200 && kopVan(b) === 'Versie een',
      ziet: 'publiceren ' + p.status + ' op ' + (p.data && p.data.adres) + ', bezoeker ziet "' + kopVan(b) + '"' };
  });

  await stap('voltooibaar', 'een bewaarde wijziging blijft concept tot hij publiceert; dan ziet de bezoeker haar', async () => {
    const r = await w.post(BEWAAR, { design: ontwerp('Atelier ' + merk, 'Versie twee', { id }) }, A.token);
    const voor = await bezoek();
    const wacht = (await mijn())[0].wacht;
    const l = await w.post(LIVE, { id }, A.token);
    const na = await bezoek();
    return { klopt: r.status === 200 && kopVan(voor) === 'Versie een' && wacht === true && l.status === 200 && kopVan(na) === 'Versie twee',
      ziet: 'na bewaren ziet de bezoeker "' + kopVan(voor) + '" (wacht ' + wacht + '), na publiceren "' + kopVan(na) + '"' };
  });

  await stap('voltooibaar', 'hij zet de vorige versie van het concept terug uit de versiegeschiedenis', async () => {
    const v = await w.post(VERSIES, { id }, A.token);
    const h = await w.post(HERSTEL, { id, i: 0 }, A.token);
    const d = await w.post(HAAL, { id }, A.token);
    const kop = (((d.data && d.data.design && d.data.design.blokken) || [])[0] || {}).kop;
    return { klopt: v.status === 200 && (v.data.lijst || []).length >= 1 && h.status === 200 && kop === 'Versie een',
      ziet: 'versies ' + (v.data && v.data.lijst && v.data.lijst.length) + ', herstel ' + h.status + ', concept "' + kop + '"' };
  });

  await stap('voltooibaar', 'een ander lid haalt, overschrijft, publiceert of haalt deze site niet uit de lucht', async () => {
    const h = await w.post(HAAL, { id }, B.token);
    const o = await w.post(OFFLINE, { id }, B.token);
    const p = await w.post(PUBLICEER, { id, adres: 'gekaapt-' + merk }, B.token);
    const b = await w.post(BEWAAR, { design: ontwerp('Gekaapt', 'Van B', { id }) }, B.token);
    const na = await bezoek();
    const eigen = await mijn(B.token);
    return { klopt: h.status === 404 && o.status === 404 && p.status === 404 && kopVan(na) === 'Versie twee' &&
      !eigen.some((x) => x.id === id) && (await mijn()).length === 1,
      ziet: 'haal ' + h.status + ', offline ' + o.status + ', publiceren ' + p.status + ', bewaren met andermans id maakt een eigen site; online blijft "' + kopVan(na) + '"' };
  });

  await stap('voltooibaar', 'zonder sessie leest of schrijft niemand iets: beide geven 401 met een melding', async () => {
    const l = await w.post(MIJN, {});
    const s = await w.post(BEWAAR, { design: { titel: 'Anoniem' } });
    return { klopt: l.status === 401 && s.status === 401 && !!(l.data && l.data.error) && !!(s.data && s.data.error),
      ziet: 'lezen ' + l.status + ', schrijven ' + s.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat de site online met de gepubliceerde stand', async () => {
    const b = await bezoek();
    return { klopt: b.status === 200 && kopVan(b) === 'Versie twee', ziet: 'bezoeker ' + b.status + ', "' + kopVan(b) + '"' };
  });
  await stap('persistent', 'na opnieuw inloggen vindt hij zijn concept met de teruggezette versie', async () => {
    const tok = (await w.post('/api/auth/login', { login: A.email, password: A.wachtwoord })).data.token;
    const d = await w.post(HAAL, { id }, tok);
    const kop = (((d.data && d.data.design && d.data.design.blokken) || [])[0] || {}).kop;
    return { klopt: d.status === 200 && kop === 'Versie een', ziet: 'concept "' + kop + '"' };
  });
  await stap('persistent', 'een read-only lezer vindt de site in de opslag', async () => {
    const plek = w.vindInOpslag(adres);
    return { klopt: plek.length >= 1, ziet: plek.map((p) => p.bestand + '/' + p.tabel + (p.sleutel ? ':' + p.sleutel : '')).join(', ') || 'nergens' };
  });

  /* ---------------- herstelbaar ---------------- */
  const telTitel = async (t) => (await mijn()).filter((x) => x.titel === t).length;
  await stap('herstelbaar', 'een dubbele tik op "Bewaren" van een nieuw ontwerp maakt een site', async () => {
    const t = 'Dubbel ' + merk;
    const [a, b] = await w.dubbel(BEWAAR, { design: ontwerp(t, 'x', { idem: 'dub-' + merk }) }, A.token);
    const n = await telTitel(t);
    return { klopt: a.status === 200 && b.status === 200 && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + n + ' site' };
  });
  await stap('herstelbaar', 'een afgebroken eerste bewaring, daarna de volgende autosave: een site en niet twee', async () => {
    const t = 'Half ' + merk;
    const half = await w.afgebroken(BEWAAR, { design: ontwerp(t, 'eerste', { idem: 'half-' + merk }) }, A.token);
    const opnieuw = await w.post(BEWAAR, { design: ontwerp(t, 'tweede', { idem: 'half-' + merk }) }, A.token);
    const n = await telTitel(t);
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' site' };
  });
  await stap('herstelbaar', 'een crash direct na het bewaren van een nieuw ontwerp: na de herstart is er een site, en de herhaling bewaart in dezelfde', async () => {
    const t = 'Stroom ' + merk;
    const r = await w.post(BEWAAR, { design: ontwerp(t, 'voor', { idem: 'crash-' + merk }) }, A.token);
    await w.crash();
    const opnieuw = await w.post(BEWAAR, { design: ontwerp(t, 'na', { idem: 'crash-' + merk }) }, A.token);
    const n = await telTitel(t);
    return { klopt: r.status === 200 && opnieuw.status === 200 && opnieuw.data.design.id === r.data.design.id && n === 1,
      ziet: 'na SIGKILL: zelfde site ' + (opnieuw.data && opnieuw.data.design && opnieuw.data.design.id === r.data.design.id) + ', ' + n + ' site' };
  });
  await stap('herstelbaar', 'hij haalt de site uit de lucht, ook als hij dubbel tikt; de bezoeker vindt hem niet meer', async () => {
    const [a, b] = await w.dubbel(OFFLINE, { id }, A.token);
    const na = await bezoek();
    return { klopt: a.status === 200 && b.status === 200 && na.status === 404, ziet: 'tikken ' + a.status + '/' + b.status + ', bezoeker ' + na.status };
  });
}

module.exports = {
  functie: 'link:sitemaker',
  ingang: '/apps/sitemaker.html',
  persona: 'lid',
  belofte: 'een lid bouwt een eigen website, zet hem online op een adres en bepaalt zelf wanneer een wijziging naar buiten gaat, met versies en uit de lucht halen; dat staat na een herstart en een crash, en een ander lid komt er niet aan',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf; de bezoeker kijkt via de route van de RTG-browser. Alleen een persoonlijke site met een blok; de zaakkant (routes/zaakweb.js), foto\'s, AI, geplande publicatie en een eigen domein zijn niet beproefd. Geen Redis of PostgreSQL.',
  loop
};
