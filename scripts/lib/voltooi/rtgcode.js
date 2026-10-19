/* ============================================================================
   VOLTOOIPROEF: RTG-CODE / BETAALCODE (link:rtgcode, /apps/geld.html#rtgcode).

   De belofte van de stand (apps/geld/rtgcodeb.js): "Onze code is geen gewone
   QR: alleen de RTG-app kan hem maken en lezen, en hij vernieuwt zichzelf. Een
   foto is binnen een halve minuut waardeloos." -- en boven het codevak: "Log
   eerst in als lid; dan verschijnt je PERSOONLIJKE code hier." Routes
   letterlijk uit apps/geld/rtgcode.js en rtgcodeb.js: /api/code/dyn en
   /api/code/scan.

   ER IS GEEN STAAT, en daarom meten persistent en herstelbaar hier iets
   anders dan bij een saldo: de SLEUTEL. Een code die vlak voor een deploy of
   een stroomstoring werd getoond, moet daarna nog kloppen (kern/dyncode.js
   publiceert dyncode.key een keer, nooit half, nooit twee), en een dubbele tik
   of een afgebroken verzoek mag geen code opleveren die de kassa weigert.

   PERSOONLIJK ZONDER NAAM (besluit van de eigenaar, 19 oktober 2026). Elke
   ledencode draagt een ondoorzichtige verwijzing die alleen de server aan de
   codenaam koppelt (kern/betaalcode.js). Een kassa -- hier een echte
   zaakmedewerker, ingelogd met rooster en pincode -- krijgt bij het scannen de
   codenaam en verbruikt de code: eenmalig, want dat is het veilige voor
   betalen. Een ander lid krijgt niets persoonlijks. Daarmee meet persistent
   ook de verwijzing zelf: die staat in de opslag en overleeft een herstart.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { nieuwLid, inloggen, KANTOORWERELD } = require('../voltooiwereld');

const DYN = '/api/code/dyn';
const FOODCOURT = '/api/foodcourt';
const SCAN = '/api/code/scan';
/* Precies wat de stand vraagt (rtgcode.js, ververs()). */
const PAS = { soort: 'pas', code: 'RTG' };

/* Een kassa: de manager van een echte zaak, langs de zaakdeur (zelfde recept
   als ./foodcourt.js). */
async function kassaSessie(w, tok) {
  const zaak = ((((await w.post(FOODCOURT, {}, tok)).data) || {}).restaurants || [])[0];
  if (!zaak) throw new Error('geen zaak om als kassa te gebruiken');
  const rooster = await w.post('/api/supplier/roster', { code: zaak.code });
  const man = ((rooster.data && rooster.data.staff) || []).find((x) => x.role === 'manager');
  if (!man) throw new Error('de zaak ' + zaak.code + ' heeft geen manager in het rooster');
  const z = await w.post('/api/supplier/login', { code: zaak.code, staffId: man.id, pin: '1234' });
  if (!z.data || !z.data.token) throw new Error('de kassa kon niet inloggen (' + z.status + ')');
  return z.data.token;
}

async function loop(w, stap) {
  const A = await nieuwLid(w, 'rca');
  const B = await nieuwLid(w, 'rcb');
  const maak = (tok, extra) => w.post(DYN, Object.assign({}, PAS, extra || {}), tok || A.token);
  const scan = (token, tok) => w.post(SCAN, { token }, tok || A.token);
  let lang = null;
  let K = await kassaSessie(w, A.token);
  const codenaamVan = async (lid) => ((await w.post('/api/member/connections', {}, lid.token)).data || {}).codename;
  const ca = await codenaamVan(A), cb = await codenaamVan(B);

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een lid krijgt een verse, ondertekende code die binnen 45 seconden vervalt, en die code klopt bij het scannen', async () => {
    const r = await maak();
    const s = await scan(r.data && r.data.token);
    return { klopt: r.status === 200 && /^RTG1\./.test(r.data.token) && r.data.ttlMs === 45000 &&
      r.data.exp - Date.now() <= 45000 && s.status === 200 && s.data.ok === true && s.data.soort === 'pas',
      ziet: 'maken ' + r.status + ' (ttl ' + (r.data && r.data.ttlMs) + ' ms), scannen ' + s.status + ' (' + (s.data && s.data.soort) + ')' };
  });

  await stap('voltooibaar', 'een gemanipuleerde code en een gewone QR-inhoud worden geweigerd als geen geldige RTG-code', async () => {
    const r = await maak();
    const t = r.data.token;
    const vals = t.slice(0, -2) + (t.slice(-2) === 'AA' ? 'BB' : 'AA');
    const a = await scan(vals);
    const b = await scan('https://voorbeeld.nl/betaal?bedrag=10');
    return { klopt: a.status === 422 && b.status === 422 && /geen geldige RTG-code/.test(a.data.error),
      ziet: 'vals ' + a.status + ', gewone QR ' + b.status + ' (' + (a.data && a.data.error) + ')' };
  });

  await stap('voltooibaar', 'een verlopen code (een foto van gisteren) wordt geweigerd met de reden', async () => {
    const r = await maak(null, { ttlMs: 1000 });
    await new Promise((res) => setTimeout(res, 2200));
    const s = await scan(r.data.token);
    return { klopt: r.status === 200 && s.status === 410 && /verlopen/.test(s.data.error),
      ziet: 'na 2,2 s: ' + s.status + ' (' + (s.data && s.data.error) + ')' };
  });

  await stap('voltooibaar', 'zonder inlog geen code en geen scan; een lid mag geen tafel- of deurcode van een zaak maken', async () => {
    const zonder = await w.post(DYN, PAS, null);
    const scanZonder = await w.post(SCAN, { token: 'RTG1.x.y' }, null);
    const tafel = await w.post(DYN, { soort: 'tafel', code: 'ZAAK:1' }, A.token);
    return { klopt: zonder.status === 401 && scanZonder.status === 401 && tafel.status === 403 && /mag u niet maken/.test(tafel.data.error),
      ziet: 'zonder inlog ' + zonder.status + '/' + scanZonder.status + ', tafelcode als lid ' + tafel.status };
  });

  await stap('voltooibaar', 'een ANDER lid dat de code scant, leest er niets van het lid uit: geen codenaam, geen account', async () => {
    const r = await maak();
    const s = await scan(r.data.token, B.token);
    const lijf = JSON.stringify(s.data || {});
    const ca = (await w.post('/api/member/connections', {}, A.token)).data || {};
    return { klopt: s.status === 200 && !!ca.codename && !lijf.includes(ca.codename) && !lijf.includes(A.email),
      ziet: 'B scant: ' + s.status + ', ziet ' + lijf.slice(0, 80) };
  });

  await stap('voltooibaar', 'de code is PERSOONLIJK, zoals het scherm belooft: bij de kassa leiden de codes van twee leden naar hun eigen codenaam', async () => {
    const ta = (await maak()).data.token, tb = (await maak(B.token)).data.token;
    const a = await scan(ta, K), b = await scan(tb, K);
    const lijf = Buffer.from(ta.split('.')[1], 'base64url').toString('utf8');
    return { klopt: a.status === 200 && b.status === 200 && a.data.codenaam === ca && b.data.codenaam === cb && a.data.code !== b.data.code &&
      !lijf.includes(ca) && !lijf.includes(A.email),
      ziet: 'kassa leest ' + (a.data && a.data.codenaam) + ' en ' + (b.data && b.data.codenaam) + '; QR-lijf zonder naam: ' + (!lijf.includes(ca)) };
  });

  await stap('voltooibaar', 'een betaalcode is eenmalig: dezelfde code een tweede keer bij de kassa wordt geweigerd met de reden', async () => {
    const t = (await maak()).data.token;
    const eerst = await scan(t, K), nog = await scan(t, K);
    return { klopt: eerst.status === 200 && nog.status === 409 && /al gebruikt/.test(nog.data.error),
      ziet: 'eerste scan ' + eerst.status + ', tweede ' + nog.status + ' (' + (nog.data && nog.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  lang = (await maak(null, { ttlMs: 300000 })).data.token;
  const voorHerstart = (await maak(null, { ttlMs: 300000 })).data.token;
  await w.herstart();
  await stap('persistent', 'een code die voor een nette herstart werd getoond, klopt erna nog: de sleutel bleef dezelfde', async () => {
    const s = await scan(lang);
    return { klopt: s.status === 200 && s.data.ok === true, ziet: 'na SIGTERM: ' + s.status };
  });

  await stap('persistent', 'de sleutel staat in de datamap (0600) en de verwijzing in de opslag, onder de codenaam en zonder account', async () => {
    const pad = path.join(w.datamap, 'dyncode.key');
    const st = fs.existsSync(pad) ? fs.statSync(pad) : null;
    const ref = Buffer.from(lang.split('.')[1], 'base64url').toString('utf8').split('|')[1];
    const rec = (w.collectie('betaalcodes') || {})[ref];
    return { klopt: !!st && (st.mode & 0o077) === 0 && !!rec && rec.codenaam === ca && !rec.gebruikt && !JSON.stringify(rec).includes(A.email),
      ziet: (st ? 'dyncode.key ' + (st.mode & 0o777).toString(8) : 'geen dyncode.key') + '; verwijzing ' + (rec ? 'op schijf voor ' + rec.codenaam : 'NIET op schijf') };
  });

  await stap('persistent', 'een code van voor de herstart wordt erna door de kassa nog gewoon afgerekend', async () => {
    K = await kassaSessie(w, A.token);
    const s2 = await scan(voorHerstart, K);
    return { klopt: s2.status === 200 && s2.data.codenaam === ca, ziet: 'kassa na SIGTERM: ' + s2.status + ', ' + (s2.data && s2.data.codenaam) };
  });

  await stap('persistent', 'na de herstart logt het lid opnieuw in en de code uit de oude sessie klopt ook in de nieuwe', async () => {
    const tok = await inloggen(w, A);
    const s = await scan(lang, tok);
    const vers = await maak(tok);
    return { klopt: s.status === 200 && vers.status === 200, ziet: 'oude code in nieuwe sessie ' + s.status + ', nieuwe code ' + vers.status };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op verversen geeft twee verschillende codes die allebei kloppen', async () => {
    const [x, y] = await w.dubbel(DYN, PAS, A.token);
    const sx = await scan(x.data.token), sy = await scan(y.data.token);
    return { klopt: x.status === 200 && y.status === 200 && x.data.token !== y.data.token && sx.status === 200 && sy.status === 200,
      ziet: 'tikken ' + x.status + '/' + y.status + ', scans ' + sx.status + '/' + sy.status };
  });

  await stap('herstelbaar', 'twee kassa-tikken tegelijk op dezelfde code: een rekent af, de ander hoort dat hij al gebruikt is', async () => {
    const t = (await maak()).data.token;
    const [x, y] = await w.dubbel(SCAN, { token: t }, K);
    const st = [x.status, y.status].sort().join('/');
    return { klopt: st === '200/409', ziet: 'kassa-tikken ' + st };
  });

  await stap('herstelbaar', 'een afgebroken verversing laat niets half achter: de volgende code klopt gewoon', async () => {
    const half = await w.afgebroken(DYN, PAS, A.token);
    const r = await maak();
    const s = await scan(r.data.token);
    return { klopt: r.status === 200 && s.status === 200,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), daarna ' + r.status + ', scan ' + s.status };
  });

  await stap('herstelbaar', 'na een crash klopt een code van vlak ervoor nog, en een al afgerekende code blijft op', async () => {
    const t = (await maak(null, { ttlMs: 300000 })).data.token;
    const betaald = (await maak(null, { ttlMs: 300000 })).data.token;
    const eerst = await scan(betaald, K);
    await w.crash();
    K = await kassaSessie(w, A.token);
    const s = await scan(t);
    const ouder = await scan(lang);
    const nog = await scan(betaald, K);
    return { klopt: s.status === 200 && ouder.status === 200 && eerst.status === 200 && nog.status === 409,
      ziet: 'na SIGKILL: verse ' + s.status + ', van voor de herstart ' + ouder.status + ', al afgerekende code ' + nog.status };
  });
}

module.exports = {
  functie: 'link:rtgcode',
  ingang: '/apps/geld.html#rtgcode',
  persona: 'lid',
  /* de kassa is een synthetische zaak uit de seed van de testomgeving */
  omgeving: KANTOORWERELD,
  belofte: 'een lid toont een levende, persoonlijke code die alleen de RTG-app maakt en leest en die na een halve minuut vervalt; de kassa leest er de codenaam uit en kan hem maar een keer afrekenen, een valse, gewone of verlopen code wordt geweigerd, een ander lid leest er niets van het lid uit, en de code overleeft een herstart en een crash',
  grens: 'De camera en de QR-decoder zijn hier niet beproefd, en ook niet wat een kassa na het scannen doet (afrekenen, inchecken): dat zijn andere routes. De proef loopt /api/code/dyn en /api/code/scan, niet de stand zelf.',
  loop
};
