/* ============================================================================
   VOLTOOIPROEF: GAME NIGHT (link:spelavond, /apps/spelscherm.html) -- een
   potje op het gedeelde scherm aan tafel.

   De belofte van het scherm: een speler geeft een eenmalige schermcode uit, de
   televisie koppelt daarmee en toont vanaf dan het potje zoals het loopt --
   alleen wat publiek is, nooit een ledenidentiteit en nooit een geheime kaart.
   De televisie draagt geen ledenaccount; zijn toegang is een eigen, gehashte
   schermsessie die alleen in een POST-lijf reist (kern/spellen/projectie.js).
   Het scherm zelf roept /api/projectie/koppel en /api/projectie/kijk aan; de
   code komt van een speler langs /api/member/spel/projectie-open, en het potje
   loopt langs /api/member/spel/nieuw, /antwoord en /zet.

   Het spel is schaak tussen twee verbonden leden: twee spelers, een publiek
   bord, en een zet die je op het scherm terugziet.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, verbind } = require('../voltooiwereld');

const KOPPEL = '/api/projectie/koppel';
const KIJK = '/api/projectie/kijk';
const NIEUW = '/api/member/spel/nieuw';
const ANTWOORD = '/api/member/spel/antwoord';
const ZET = '/api/member/spel/zet';
const STAAT = '/api/member/spel/staat';
const OPEN = '/api/member/spel/projectie-open';
const SLUIT = '/api/member/spel/projectie-sluit';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;
let teller = 0;
const idem = (merk) => 'spelavond-' + merk + '-' + String(++teller).padStart(12, '0');

async function loop(w, stap) {
  const merk = 'sa' + Date.now().toString(36);
  const A = await nieuwLid(w, 'saa');
  const B = await nieuwLid(w, 'sab');
  const C = await nieuwLid(w, 'sac');
  const v = await verbind(w, A, B);
  let id = null, code = null, scherm = null;

  const kijk = (tok) => w.post(KIJK, { token: tok || scherm });
  const bord = async (tok) => { const r = await kijk(tok); return r.status === 200 ? r.data.staat.bord : null; };
  const zet = (tok, van, naar) => w.post(ZET, { id, zet: { van, naar } }, tok);

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'A nodigt B uit voor een potje schaak; B zegt ja en het potje loopt', async () => {
    const n = await w.post(NIEUW, { soort: 'schaak', vrienden: [v.b.key], wereld: 'rtg' }, A.token);
    id = n.data && n.data.id;
    const a = await w.post(ANTWOORD, { id, akkoord: true }, B.token);
    const s = await w.post(STAAT, { id }, A.token);
    return { klopt: n.status === 200 && a.status === 200 && a.data.gestart === true && s.status === 200 && s.data.potje.status === 'bezig',
      ziet: 'nieuw ' + n.status + ', antwoord ' + a.status + ' (gestart=' + (a.data && a.data.gestart) + '), staat ' + (s.data && s.data.potje && s.data.potje.status) };
  });

  await stap('voltooibaar', 'een speler geeft een eenmalige schermcode; de televisie koppelt en toont het bord met de twee spelers', async () => {
    const o = await w.post(OPEN, { id, idem: idem(merk) }, A.token);
    code = o.data && o.data.code;
    const k = await w.post(KOPPEL, { code });
    scherm = k.data && k.data.token;
    const r = await kijk();
    return { klopt: o.status === 200 && /^GAME\./.test(code || '') && k.status === 200 && /^SCREEN\./.test(scherm || '') && r.status === 200 &&
      r.data.spel === 'schaak' && (r.data.spelers || []).length === 2 && /^RNBQKBNR/.test(r.data.staat.bord),
      ziet: 'code ' + o.status + ', koppelen ' + k.status + ', scherm ' + r.status + ' met ' + ((r.data && r.data.spelers) || []).length + ' spelers' };
  });

  await stap('voltooibaar', 'A zet e2-e4 en B e7-e5: de televisie toont na elke zet het nieuwe bord en wie er aan zet is', async () => {
    const z1 = await zet(A.token, 52, 36);
    const na1 = (await kijk()).data || {};
    const z2 = await zet(B.token, 12, 28);
    const na2 = (await kijk()).data || {};
    return { klopt: z1.status === 200 && na1.staat.aanZet === 'z' && na1.staat.bord[36] === 'p' && z2.status === 200 &&
      na2.staat.aanZet === 'w' && JSON.stringify(na2.staat.laatste) === '[12,28]' && na2.beurt === 0,
      ziet: 'zet A ' + z1.status + ' (aan zet ' + (na1.staat && na1.staat.aanZet) + '), zet B ' + z2.status + ' (laatste ' + JSON.stringify(na2.staat && na2.staat.laatste) + ')' };
  });

  await stap('voltooibaar', 'de code is eenmalig, en een nieuwe code van een speler sluit het oude scherm meteen', async () => {
    const tweede = await w.post(KOPPEL, { code });
    const o = await w.post(OPEN, { id, idem: idem(merk) }, B.token);
    const oud = await kijk();
    const k = await w.post(KOPPEL, { code: o.data && o.data.code });
    const nieuw = k.data && k.data.token;
    const r = await kijk(nieuw);
    if (r.status === 200) scherm = nieuw;
    return { klopt: tweede.status === 404 && o.status === 200 && o.data.geroteerd === true && oud.status === 404 && k.status === 200 && r.status === 200,
      ziet: 'zelfde code nog eens ' + tweede.status + ', nieuwe code ' + o.status + ' (geroteerd=' + (o.data && o.data.geroteerd) + '), oud scherm ' + oud.status + ', nieuw scherm ' + r.status };
  });

  await stap('voltooibaar', 'bevoegdheid: zonder sessie geen schermcode en geen zet (401), en een verzonnen schermsessie toont niets', async () => {
    const o = await w.post(OPEN, { id, idem: idem(merk) });
    const z = await w.post(ZET, { id, zet: { van: 51, naar: 35 } });
    const r = await kijk('SCREEN.' + 'A'.repeat(32));
    return { klopt: o.status === 401 && z.status === 401 && r.status === 404 && !JSON.stringify(r.data || {}).includes('RNBQ'),
      ziet: 'code ' + o.status + ', zet ' + z.status + ', verzonnen scherm ' + r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'bevoegdheid: wie niet meespeelt geeft geen schermcode uit, ziet de staat niet en zet niet', async () => {
    const o = await w.post(OPEN, { id, idem: idem(merk) }, C.token);
    const s = await w.post(STAAT, { id }, C.token);
    const z = await zet(C.token, 51, 35);
    const r = await kijk();
    return { klopt: o.status === 404 && s.status === 404 && (z.status === 404 || z.status === 403) && r.status === 200 && r.data.staat.aanZet === 'w',
      ziet: 'code door C ' + o.status + ', staat ' + s.status + ', zet ' + z.status + ', scherm nog ' + r.status };
  });

  await stap('voltooibaar', 'bevoegdheid: de schermsessie is geen ledensessie en een ledensessie geen schermsessie', async () => {
    const alsLid = await w.post(STAAT, { id }, scherm);
    const alsScherm = await kijk(A.token);
    const r = (await kijk()).data || {};
    return { klopt: alsLid.status === 401 && alsScherm.status === 404 && !JSON.stringify(r).includes(v.a.key) && !JSON.stringify(r).includes(v.b.key),
      ziet: 'schermsessie als lid ' + alsLid.status + ', ledensessie als scherm ' + alsScherm.status + ', geen ledensleutel in het beeld' };
  });

  /* ---------------- persistent ---------------- */
  const voor = await bord();
  await w.herstart();

  await stap('persistent', 'na een nette herstart toont dezelfde televisie, zonder opnieuw koppelen, hetzelfde bord', async () => {
    const na = await bord();
    return { klopt: !!voor && na === voor, ziet: na === voor ? 'gelijk: ' + na : 'ANDERS: ' + na };
  });

  await stap('persistent', 'A logt opnieuw in (een ander toestel), ziet hetzelfde potje en zet verder; het scherm volgt', async () => {
    const tok = await inloggen(w, A);
    const s = await w.post(STAAT, { id }, tok);
    const z = await zet(tok, 51, 35);
    const r = (await kijk()).data || {};
    return { klopt: s.status === 200 && s.data.potje.staat.bord === voor && z.status === 200 && JSON.stringify(r.staat && r.staat.laatste) === '[51,35]',
      ziet: 'staat ' + s.status + ', zet ' + z.status + ', scherm laatste ' + JSON.stringify(r.staat && r.staat.laatste) };
  });

  await stap('persistent', 'het potje en de schermkoppeling staan in de opslag, en daar alleen als hash: nooit de code of de schermsessie zelf', async () => {
    const potje = w.vindInOpslag(id);
    const kaal = w.vindInOpslag(scherm.slice(7)).length + w.vindInOpslag(code.slice(5)).length;
    return { klopt: potje.length >= 1 && kaal === 0, ziet: 'potje in ' + potje.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') + '; kale credentials in de opslag: ' + kaal };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op een zet: een zet, en het scherm toont hem een keer', async () => {
    const [a, b] = await w.dubbel(ZET, { id, zet: { van: 11, naar: 27 } }, B.token);
    const r = (await kijk()).data || {};
    const s = (await w.post(STAAT, { id }, B.token)).data || {};
    return { klopt: (a.status === 200) !== (b.status === 200) && geen5xx(a) && geen5xx(b) && r.staat.aanZet === 'w' && r.staat.bord === s.potje.staat.bord && r.staat.bord[27] === 'P',
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', aan zet ' + (r.staat && r.staat.aanZet) };
  });

  await stap('herstelbaar', 'een dubbele tik op "schermcode": een code, en de herhaling geeft het geheim niet nog eens', async () => {
    const sleutel = idem(merk);
    const [a, b] = await w.dubbel(OPEN, { id, idem: sleutel }, A.token);
    const codes = [a, b].map((x) => x.data && x.data.code).filter(Boolean);
    const k = await w.post(KOPPEL, { code: codes[0] });
    if (k.status === 200) scherm = k.data.token;
    return { klopt: codes.length === 1 && geen5xx(a) && geen5xx(b) && k.status === 200,
      ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + codes.length + ' code(s) getoond, koppelen ' + k.status };
  });

  await stap('herstelbaar', 'het koppelen breekt af: de code is dan op, het scherm zegt dat in woorden, en een nieuwe code koppelt wel', async () => {
    const o = await w.post(OPEN, { id, idem: idem(merk) }, A.token);
    const half = await w.afgebroken(KOPPEL, { code: o.data && o.data.code });
    const opnieuw = await w.post(KOPPEL, { code: o.data && o.data.code });
    const o2 = await w.post(OPEN, { id, idem: idem(merk) }, A.token);
    const k = await w.post(KOPPEL, { code: o2.data && o2.data.code });
    if (k.status === 200) scherm = k.data.token;
    const r = await kijk();
    const zin = (opnieuw.data && opnieuw.data.error) || '';
    return { klopt: (opnieuw.status === 200 || (opnieuw.status === 404 && /schermcode/.test(zin))) && k.status === 200 && r.status === 200,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), dezelfde code opnieuw ' + opnieuw.status + (zin ? ' (' + zin + ')' : '') + ', nieuwe code ' + k.status };
  });

  await stap('herstelbaar', 'een crash direct na een zet: de zet staat er, en dezelfde televisie toont hem zonder opnieuw te koppelen', async () => {
    const z = await zet(A.token, 62, 45);
    await w.crash();
    const r = (await kijk()).data || {};
    const x = await w.post(SLUIT, { id }, A.token);
    const dicht = await kijk();
    return { klopt: z.status === 200 && JSON.stringify(r.staat && r.staat.laatste) === '[62,45]' && x.status === 200 && dicht.status === 404,
      ziet: 'zet ' + z.status + ', na SIGKILL scherm laatste ' + JSON.stringify(r.staat && r.staat.laatste) + '; sluiten ' + x.status + ', scherm daarna ' + dicht.status };
  });
}

module.exports = {
  functie: 'link:spelavond',
  ingang: '/apps/spelscherm.html',
  persona: 'lid',
  belofte: 'een speler koppelt met een eenmalige code een televisie aan het potje, en die toont vanaf dan elke zet -- alleen wat publiek is, met een eigen schermsessie die geen ledensessie is; ook na een herstart, een dubbeltik, een afgebroken koppeling en een crash',
  grens: 'De proef loopt de routes van het scherm en van de spelers, niet het scherm zelf en geen browser. Het spel is schaak; geheime kaarten (30 Seconden) bewijst test/spelprojectie.test.js. De televisie heeft met opzet geen ledenaccount (kern/spellen/projectie.js); zijn toegang is een gehashte schermsessie. Geen Redis of PostgreSQL.',
  loop
};
