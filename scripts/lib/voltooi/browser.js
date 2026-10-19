/* ============================================================================
   VOLTOOIPROEF: RTG BROWSER (link:browser, /apps/browser.html).

   De belofte van het scherm: een lid zoekt en bladert door het RTG-web, opent
   de site van een ander lid, en stuurt via het formulier op die site een
   bericht dat bij de eigenaar aankomt als gesprek -- op codenaam, en alleen
   tussen leden die verbonden zijn. Een formulier is geen achterdeur om
   vreemden te bereiken.

   De site is echt: lid A maakt hem in de Website-maker en zet hem online
   (/api/site/bewaar en /publiceer). A en B worden verbonden langs de Salon
   (verbind() in ../voltooiwereld.js). A leest het bericht in zijn gesprek met
   B (/api/member/dm), zoals de leden-app dat doet.
   ========================================================================== */
'use strict';
const { nieuwLid, verbind } = require('../voltooiwereld');

const GIDS = '/api/browser/gids';
const ZOEK = '/api/browser/zoek';
const OPEN = '/api/browser/open';
const BERICHT = '/api/browser/bericht';

async function loop(w, stap) {
  const merk = 'b' + Date.now().toString(36).slice(-5);
  const A = await nieuwLid(w, 'brwa');
  const B = await nieuwLid(w, 'brwb');
  const adres = 'atelier-' + merk;
  const titel = 'Atelier ' + merk;
  let rel = null;
  /* Hoe vaak staat deze tekst in het gesprek tussen A en B, gelezen door A. */
  const inGesprek = async (tekst) => {
    const r = await w.post('/api/member/dm', { withKey: rel.b.key }, A.token);
    const lijst = (r.data && (r.data.berichten || r.data.messages || r.data.lijst)) || [];
    return lijst.filter((m) => String(m.text || m.tekst || '').includes(tekst)).length;
  };

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een lid zet een site online; een ander lid vindt hem in de gids en via zoeken', async () => {
    const s = await w.post('/api/site/bewaar', { design: { titel, idem: 'site-' + merk, blokken: [{ type: 'hero', kop: 'Welkom ' + merk }] } }, A.token);
    const p = await w.post('/api/site/publiceer', { id: s.data.design.id, adres }, A.token);
    const g = await w.post(GIDS, {}, B.token);
    const z = await w.post(ZOEK, { q: merk }, B.token);
    const inGids = JSON.stringify(g.data || {}).includes(adres), gevonden = JSON.stringify(z.data || {}).includes(adres);
    return { klopt: p.status === 200 && g.status === 200 && inGids && z.status === 200 && gevonden,
      ziet: 'online ' + p.status + ', in de gids ' + inGids + ', via zoeken ' + gevonden };
  });

  await stap('voltooibaar', 'het lid opent de site: hij ziet de inhoud en de codenaam van de maker, nooit een echte naam', async () => {
    const o = await w.post(OPEN, { adres }, B.token);
    const kop = (((o.data && o.data.site && o.data.site.blokken) || [])[0] || {}).kop;
    const codenaam = o.data && o.data.persoon && o.data.persoon.codenaam;
    return { klopt: o.status === 200 && kop === 'Welkom ' + merk && !!codenaam && !JSON.stringify(o.data).includes('Voltooilid'),
      ziet: 'open ' + o.status + ', kop "' + kop + '", maker ' + codenaam };
  });

  await stap('voltooibaar', 'zolang ze niet verbonden zijn, stuurt het formulier niets en zegt het waarom', async () => {
    const r = await w.post(BERICHT, { adres, tekst: 'Mag ik iets vragen ' + merk, soort: 'vraag' }, B.token);
    return { klopt: r.status === 403 && /verbonden/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'na het verbinden komt het formulierbericht aan als gesprek bij de maker', async () => {
    rel = await verbind(w, A, B);
    const r = await w.post(BERICHT, { adres, tekst: 'Offerte voor een lamp ' + merk, soort: 'offerte' }, B.token);
    const n = await inGesprek('Offerte voor een lamp ' + merk);
    return { klopt: r.status === 200 && r.data.via === 'chat' && n === 1, ziet: 'bericht ' + r.status + ' via ' + (r.data && r.data.via) + ', A ziet het ' + n + ' keer' };
  });

  await stap('voltooibaar', 'een vreemde die het adres kent, bereikt de maker niet via het formulier', async () => {
    const C = await nieuwLid(w, 'brwc');
    const o = await w.post(OPEN, { adres }, C.token);
    const r = await w.post(BERICHT, { adres, tekst: 'Ongevraagd ' + merk }, C.token);
    const n = await inGesprek('Ongevraagd ' + merk);
    return { klopt: o.status === 200 && r.status === 403 && n === 0, ziet: 'lezen ' + o.status + ', bericht ' + r.status + ', bij A ' + n };
  });

  await stap('voltooibaar', 'zonder sessie leest of schrijft niemand iets: beide geven 401 met een melding', async () => {
    const l = await w.post(GIDS, {});
    const s = await w.post(BERICHT, { adres: 'x', tekst: 'Anoniem bericht' });
    return { klopt: l.status === 401 && s.status === 401 && !!(l.data && l.data.error) && !!(s.data && s.data.error),
      ziet: 'lezen ' + l.status + ', schrijven ' + s.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat de site er en vindt een bezoeker hem in de gids', async () => {
    const o = await w.post(OPEN, { adres }, B.token);
    const g = await w.post(GIDS, {}, B.token);
    return { klopt: o.status === 200 && JSON.stringify(g.data || {}).includes(adres), ziet: 'open ' + o.status };
  });
  await stap('persistent', 'na opnieuw inloggen leest de maker het formulierbericht nog een keer in zijn gesprek', async () => {
    A.token = (await w.post('/api/auth/login', { login: A.email, password: A.wachtwoord })).data.token;
    const n = await inGesprek('Offerte voor een lamp ' + merk);
    return { klopt: n === 1, ziet: 'A ziet het ' + n + ' keer' };
  });
  await stap('persistent', 'een read-only lezer vindt het bericht in de opslag', async () => {
    const plek = w.vindInOpslag('Offerte voor een lamp ' + merk);
    return { klopt: plek.length >= 1, ziet: plek.map((p) => p.bestand + '/' + p.tabel + (p.sleutel ? ':' + p.sleutel : '')).join(', ') || 'nergens' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "Versturen" geeft een bericht', async () => {
    const t = 'Dubbel ' + merk;
    const [a, b] = await w.dubbel(BERICHT, { adres, tekst: t, soort: 'vraag', idem: 'dub-' + merk }, B.token);
    const n = await inGesprek(t);
    return { klopt: [a, b].every((x) => x.status === 200) && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', bij A ' + n };
  });
  await stap('herstelbaar', 'een afgebroken bericht, daarna opnieuw met dezelfde sleutel: een bericht', async () => {
    const t = 'Half ' + merk;
    const lijf = { adres, tekst: t, soort: 'vraag', idem: 'half-' + merk };
    const half = await w.afgebroken(BERICHT, lijf, B.token);
    const opnieuw = await w.post(BERICHT, lijf, B.token);
    const n = await inGesprek(t);
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', bij A ' + n };
  });
  await stap('herstelbaar', 'een crash direct na het versturen: na de herstart staat het er een keer, en de herhaling hoort dat', async () => {
    const t = 'Stroom ' + merk;
    const lijf = { adres, tekst: t, soort: 'vraag', idem: 'crash-' + merk };
    const r = await w.post(BERICHT, lijf, B.token);
    await w.crash();
    const opnieuw = await w.post(BERICHT, lijf, B.token);
    A.token = (await w.post('/api/auth/login', { login: A.email, password: A.wachtwoord })).data.token;
    const n = await inGesprek(t);
    return { klopt: r.status === 200 && opnieuw.status === 200 && opnieuw.data.herhaald === true && n === 1,
      ziet: 'na SIGKILL ' + opnieuw.status + ' herhaald=' + (opnieuw.data && opnieuw.data.herhaald) + ', bij A ' + n };
  });
}

module.exports = {
  functie: 'link:browser',
  ingang: '/apps/browser.html',
  persona: 'lid',
  belofte: 'een lid vindt en opent de site van een ander lid en stuurt via het formulier een bericht dat precies een keer als gesprek aankomt, alleen tussen verbonden leden; dat staat na een herstart en een crash',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. Alleen de site van een lid; een zaaksite (bericht als klus in de werklijst) heeft in deze testwereld geen online site en is niet beproefd. Vertaling van een site is niet beproefd. Geen Redis of PostgreSQL.',
  loop
};
