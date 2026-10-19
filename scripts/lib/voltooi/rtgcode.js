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

   EEN STAP BLIJFT MET OPZET OPEN zolang de code niet persoonlijk is: elke
   ledencode is `pas|RTG` (rtgcode.js vraagt { soort: 'pas', code: 'RTG' }), dus
   een kassa die hem leest weet alleen DAT het een RTG-pas is, niet van wie.
   Of hij persoonlijk moet worden, en hoe zonder de codenaam leesbaar in een
   QR te zetten (het lijf is base64, geen geheim), is een besluit van de
   eigenaar en niet van deze proef.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { nieuwLid, inloggen } = require('../voltooiwereld');

const DYN = '/api/code/dyn';
const SCAN = '/api/code/scan';
/* Precies wat de stand vraagt (rtgcode.js, ververs()). */
const PAS = { soort: 'pas', code: 'RTG' };

async function loop(w, stap) {
  const A = await nieuwLid(w, 'rca');
  const B = await nieuwLid(w, 'rcb');
  const maak = (tok, extra) => w.post(DYN, Object.assign({}, PAS, extra || {}), tok || A.token);
  const scan = (token, tok) => w.post(SCAN, { token }, tok || A.token);
  let lang = null;

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

  await stap('voltooibaar', 'de code is PERSOONLIJK, zoals het scherm belooft: de codes van twee leden zeggen bij het scannen van wie ze zijn', async () => {
    const a = await scan((await maak()).data.token);
    const b = await scan((await maak(B.token)).data.token, B.token);
    const zelfde = a.data && b.data && a.data.soort === b.data.soort && a.data.code === b.data.code;
    return { klopt: !zelfde,
      ziet: zelfde ? 'beide codes lezen als ' + a.data.soort + ' · ' + a.data.code + ': niet te onderscheiden (besluit van de eigenaar, zie de kop)' : 'verschillend' };
  });

  /* ---------------- persistent ---------------- */
  lang = (await maak(null, { ttlMs: 300000 })).data.token;
  await w.herstart();
  await stap('persistent', 'een code die voor een nette herstart werd getoond, klopt erna nog: de sleutel bleef dezelfde', async () => {
    const s = await scan(lang);
    return { klopt: s.status === 200 && s.data.ok === true, ziet: 'na SIGTERM: ' + s.status };
  });

  await stap('persistent', 'de sleutel staat in de datamap (dyncode.key, alleen voor de eigenaar leesbaar) en niet in de opslag van het lid', async () => {
    const pad = path.join(w.datamap, 'dyncode.key');
    const st = fs.existsSync(pad) ? fs.statSync(pad) : null;
    const lek = w.vindInOpslag(lang).length;
    return { klopt: !!st && (st.mode & 0o077) === 0 && lek === 0,
      ziet: st ? 'dyncode.key ' + st.size + ' bytes, rechten ' + (st.mode & 0o777).toString(8) + '; code ' + lek + ' keer in de opslag' : 'geen dyncode.key' };
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

  await stap('herstelbaar', 'een afgebroken verversing laat niets half achter: de volgende code klopt gewoon', async () => {
    const half = await w.afgebroken(DYN, PAS, A.token);
    const r = await maak();
    const s = await scan(r.data.token);
    return { klopt: r.status === 200 && s.status === 200,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), daarna ' + r.status + ', scan ' + s.status };
  });

  await stap('herstelbaar', 'een code van vlak voor een crash klopt erna nog: geen nieuwe sleutel na een stroomstoring', async () => {
    const t = (await maak(null, { ttlMs: 300000 })).data.token;
    await w.crash();
    const s = await scan(t);
    const ouder = await scan(lang);
    return { klopt: s.status === 200 && ouder.status === 200, ziet: 'na SIGKILL: verse ' + s.status + ', van voor de herstart ' + ouder.status };
  });
}

module.exports = {
  functie: 'link:rtgcode',
  ingang: '/apps/geld.html#rtgcode',
  persona: 'lid',
  belofte: 'een lid toont een levende, ondertekende code die alleen de RTG-app maakt en leest en die na een halve minuut vervalt; een valse, gewone of verlopen code wordt geweigerd, een ander lid leest er niets van het lid uit, en de code overleeft een herstart en een crash -- en hij is persoonlijk, zoals het scherm belooft',
  grens: 'De camera en de QR-decoder zijn hier niet beproefd, en ook niet wat een kassa na het scannen doet (afrekenen, inchecken): dat zijn andere routes. De proef loopt /api/code/dyn en /api/code/scan, niet de stand zelf.',
  loop
};
