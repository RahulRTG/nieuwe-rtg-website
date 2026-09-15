/* DE WERKVLOER KIJKT NAAR DE ONDERNEMING -- en vooral: wat zij daarbij NIET
   ziet.

   ONDERNEMEN.md par. 1 mat het gat: `zaakZietOnderneming` stond op nul, dus de
   ondernemerslus liep een kant op de verkeerde richting -- het bedrijfsobject
   kende de zaak en de zaak kende het bedrijfsobject niet. De brug staat er nu;
   deze toets bewaakt de grenzen die eromheen horen.

   DE DRAGENDE TOETSEN ZIJN 3 EN 4, en ze meten twee verschillende dingen.
   Toets 3 zegt dat de goede weg WERKT (een gewone medewerker ziet zijn
   onderneming). Toets 4 zegt dat hij versmald is. Een laag die niets teruggeeft
   haalt 4 moeiteloos en is stuk; een laag die alles teruggeeft haalt 3 en lekt.
   Ze horen dus allebei te bestaan, en de proefpersoon is met opzet de MINST
   bevoegde mens die hier binnenkomt: Nora is `staff` bij KIKUNOI en geen
   manager.

   TOETS 5 IS DE EENRICHTINGSPROEF, MET EEN BESTURINGSPROEF ERIN. De brug mag de
   onderneming niets teruggeven, en dat is te meten in plaats van te beloven: het
   beeld op de LEDENkant is voor en na de zaakkant-aanroep byte voor byte gelijk.

   DIE TOETS WAS EERST WAARDELOOS, EN DAT IS MET EEN MUTATIE GEVONDEN. Hij
   vergelijkt een PROJECTIE, dus hij ziet alleen schrijfacties die in die
   projectie opduiken -- laat de zaakkant `o.naam` overschrijven en de toets
   blijft groen, want ondernemingNaam() leest na het koppelen de naam van de
   ZAAK en kijkt niet meer naar het veld eronder. Een zwart-doosvergelijking is
   dus precies zo scherp als het venster waardoor zij kijkt. Er staat nu een
   besturingsproef achteraan: de toets verandert de onderneming ZELF langs een
   gewone ledenroute en eist dat het beeld dan WEL beweegt. Zonder die helft is
   "er is niets veranderd" niet te onderscheiden van "ik zou het niet zien".

   TOETS 6 IS EEN BRONTOETS, en die staat er om dezelfde reden als
   test/aicontext-allowlist.test.js: het gevaar is niet het veld dat er vandaag
   in staat maar het veld dat er MORGEN bij komt. Bij `{ ...beeld }` gevolgd door
   `delete` passeert elk nieuw veld van ondernemingBeeld() vanzelf deze grens.
   De richting moet dus in de code staan en niet in het commentaar.

   HIJ DRAAGT OOK DE HELFT VAN DE EENRICHTING DIE TOETS 5 NIET KAN ZIEN. Ook
   met de besturingsproef erin blijft toets 5 een zwarte doos, en een
   schrijfactie die NERGENS in een projectie opduikt (`o.naam` overschrijven
   terwijl de naam na het koppelen van de zaak komt) glipt er langs -- nagetrokken
   met een mutatie, en de toets bleef groen. Zo'n schrijfactie verandert vandaag
   niets zichtbaars en is morgen een tweede waarheid. Vandaar dat de BRON hier
   zegt dat deze module niet schrijft: geen toekenning aan het ondernemingsobject
   of aan het beeld, en de fabriek krijgt geen `save` en geen `db` mee, zodat
   persisteren er structureel niet in kan. Zwarte doos en bron zijn hier geen
   keuze maar twee helften (dezelfde vorm als bewering D in STAGE.md par. 6).

   Draai los: node --test test/onderneming-zaakkant.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const ROUTE = '/api/supplier/onderneming';

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ozk-')); }
async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const op = (child, TMP) => {
  try { child.kill('SIGKILL'); } catch (e) { /* al weg */ }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* niets */ }
};

/* EEN ONDERNEMING DIE ECHT AAN KIKUNOI HANGT, gebouwd langs de gewone routes en
   niet door in de opslag te grijpen. Dat is het verschil tussen een toets die
   bewijst dat de KETEN werkt en een toets die bewijst dat een functie werkt op
   gegevens die niemand langs de deur heeft gekregen.

   De weg is: de zaak nodigt een MANAGER uit -> een vers lid meldt zich aan met
   die kassacode en is daarmee manager EN gekoppeld aan zijn RTG-account -> dat
   lid maakt een onderneming en koppelt haar aan de zaak. Pas dan mag hij; de
   ledenroute eist een manager-rij in het personeelsregister. */
async function koppelOnderneming(base) {
  const stamp = Date.now();
  const login = 'baas' + stamp + '@e.test';
  const wachtwoord = 'geheim123';
  const reg = await api(base, '/api/auth/register', { name: 'Baas ' + stamp, email: login,
    phone: '06' + String(stamp).slice(-8), password: wachtwoord, geboortedatum: '1985-01-01', tier: 'rtg' });
  assert.ok(reg.body.token, 'het verse lid is geregistreerd: ' + JSON.stringify(reg.body).slice(0, 200));
  const M = reg.body.token;

  const zaak = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  assert.ok(zaak, 'het bedrijfsaccount is ingelogd');

  const inv = await api(base, '/api/supplier/staff/invite', { name: 'Baas ' + stamp, role: 'manager', func: 'Directie' }, zaak);
  assert.equal(inv.status, 200, 'de zaak kan een manager uitnodigen: ' + JSON.stringify(inv.body).slice(0, 200));
  const kassacode = inv.body.invite && inv.body.invite.kassacode;
  assert.ok(kassacode, 'de uitnodiging draagt een kassacode');

  const join = await api(base, '/api/supplier/staff/join', { bedrijf: inv.body.bedrijf, kassacode, login, password: wachtwoord });
  assert.equal(join.status, 200, 'het lid meldt zich aan bij de zaak: ' + JSON.stringify(join.body).slice(0, 200));
  assert.equal(join.body.role, 'manager', 'en komt binnen als manager');

  const nieuw = await api(base, '/api/onderneming/nieuw', { naam: 'Lus BV ' + stamp }, M);
  const id = nieuw.body.onderneming && nieuw.body.onderneming.id;
  assert.ok(id, 'de onderneming is gemaakt: ' + JSON.stringify(nieuw.body).slice(0, 200));

  const kop = await api(base, '/api/onderneming/koppel', { id, code: join.body.code }, M);
  assert.equal(kop.status, 200, 'de manager koppelt zijn onderneming aan zijn zaak: ' +
    JSON.stringify(kop.body).slice(0, 200));

  /* Nora: gewoon personeel bij dezelfde zaak, met een eigen RTG-inlog. Zij is
     de mens waarop de versmalling wordt gemeten. */
  const nora = (await api(base, '/api/supplier/mijn/login', { login: 'nora@rtg.example', password: 'werk' })).body.token;
  assert.ok(nora, 'Nora is ingelogd met haar persoonlijke account');
  return { M, zaak, nora, id, code: join.body.code };
}

test('1. de route hangt en antwoordt op een leveranciersessie', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const zaak = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
    const r = await api(base, ROUTE, {}, zaak);
    /* 200 en niet 500: de kernnaam moet op montagemoment bestaan. Precies daar
       ging de eerste deur van ONDERNEMEN.md par. 7 onderuit -- een destructuring
       bevroor de naam als `undefined` en geen enkele unittoets zag het. */
    assert.equal(r.status, 200, 'de route antwoordt: ' + JSON.stringify(r.body).slice(0, 200));
    assert.equal(r.body.ok, true);
  } finally { op(child, TMP); }
});

test('2. zonder leveranciersessie komt er niets uit', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const kaal = await api(base, ROUTE, {});
    assert.equal(kaal.status, 401, 'zonder token dicht');
    const lid = (await api(base, '/api/auth/register', { name: 'Vreemde', email: 'v' + Date.now() + '@e.test',
      phone: '0612345678', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' })).body.token;
    const metLid = await api(base, ROUTE, {}, lid);
    assert.equal(metLid.status, 401, 'een LEDENtoken is geen leveranciersessie');
  } finally { op(child, TMP); }
});

test('3. een gewone medewerker ziet de onderneming achter zijn zaak', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const w = await koppelOnderneming(base);
    const r = await api(base, ROUTE, {}, w.nora);
    assert.equal(r.status, 200);
    const o = r.body.onderneming;
    assert.ok(o, 'de medewerker ziet de onderneming: ' + JSON.stringify(r.body).slice(0, 300));
    assert.equal(o.id, w.id, 'en het is dezelfde onderneming die de eigenaar koppelde');
    assert.ok(o.naam, 'met een naam');
    assert.ok(Array.isArray(o.caps), 'met wat deze onderneming mag');
    assert.ok(Array.isArray(o.werkvormen));
  } finally { op(child, TMP); }
});

test('4. en hij ziet NIET wat van de ondernemer is -- met de reden erbij', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const w = await koppelOnderneming(base);
    const r = await api(base, ROUTE, {}, w.nora);
    const o = r.body.onderneming;
    assert.ok(o, 'de tegenproef heeft een gevulde projectie nodig, anders toetst zij niets');

    for (const veld of ['eigenaar', 'kvk', 'feiten', 'volgende', 'ladder', 'plan', 'bestuur', 'intake'])
      assert.equal(Object.prototype.hasOwnProperty.call(o, veld), false,
        'de werkvloer kreeg het veld "' + veld + '" te zien. Dat hoort bij de ONDERNEMER en niet bij ' +
        'zijn ploeg; zie de positieve lijst in kern/onderneming/zaakkant.js.');

    /* De hele projectie wordt nagelopen op wat er per ongeluk in geraakt kan
       zijn: een codenaam of een KvK-nummer verderop in de boom. */
    const plat = JSON.stringify(o);
    assert.equal(/"eigenaar"|"kvk"/.test(plat), false, 'eigenaar of kvk zit ergens dieper in het antwoord: ' + plat.slice(0, 300));

    /* Een leeg vak wordt gevuld met iemands eigen indruk: wat er niet in zit,
       staat in het antwoord zelf. */
    assert.ok(Array.isArray(r.body.nietGedeeld) && r.body.nietGedeeld.length >= 5,
      'het antwoord zegt zelf wat het niet deelt');
    const genoemd = r.body.nietGedeeld.map(x => x.veld);
    for (const veld of ['eigenaar', 'kvk', 'feiten'])
      assert.ok(genoemd.includes(veld), 'nietGedeeld noemt "' + veld + '"');
    for (const rij of r.body.nietGedeeld)
      assert.ok(rij.reden && rij.reden.length > 20,
        'elk weggelaten veld draagt een REDEN; "' + rij.veld + '" heeft er geen bruikbare');
  } finally { op(child, TMP); }
});

test('5. de brug loopt een kant op: de onderneming verandert er niet van', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const w = await koppelOnderneming(base);
    const voor = await api(base, '/api/onderneming/beeld', { id: w.id }, w.M);
    assert.equal(voor.status, 200, JSON.stringify(voor.body).slice(0, 200));

    /* Twee keer, want een schrijfbijwerking die pas bij de tweede aanroep
       zichtbaar wordt, is precies wat een enkele aanroep mist. */
    await api(base, ROUTE, {}, w.nora);
    await api(base, ROUTE, {}, w.zaak);

    const na = await api(base, '/api/onderneming/beeld', { id: w.id }, w.M);
    assert.equal(JSON.stringify(na.body), JSON.stringify(voor.body),
      'de zaakkant heeft iets aan de onderneming veranderd. De brug hoort te LEZEN; twee lijsten die ' +
      'elkaar bijwerken hebben geen waarheid meer (kern/mobiliteit/appbrug.js).');

    /* DE BESTURINGSPROEF. Zonder deze helft bewijst het bovenstaande niets: een
       vergelijking op een projectie die toevallig niets doorlaat, staat altijd
       groen. Hier verandert de ONDERNEMER zelf iets langs een gewone route, en
       dan hoort hetzelfde venster het wel te zien. */
    const kvk = await api(base, '/api/onderneming/ingeschreven', { id: w.id, kvk: '81234567' }, w.M);
    assert.equal(kvk.status, 200, 'de besturingsproef kon de onderneming niet veranderen: ' +
      JSON.stringify(kvk.body).slice(0, 200));
    const anders = await api(base, '/api/onderneming/beeld', { id: w.id }, w.M);
    assert.notEqual(JSON.stringify(anders.body), JSON.stringify(voor.body),
      'het beeld bewoog niet terwijl de onderneming aantoonbaar veranderde. Dan is de vergelijking ' +
      'hierboven geen instrument maar een groene lamp.');
  } finally { op(child, TMP); }
});

test('6. BRONTOETS: de projectie is een positieve lijst, geen beeld met velden eraf', () => {
  const p = path.join(__dirname, '..', 'server', 'kern', 'onderneming', 'zaakkant.js');
  const ruw = fs.readFileSync(p, 'utf8');
  /* Eerst het commentaar eruit: deze kop legt de regel UIT en zou zichzelf
     anders als overtreding aanwijzen. Dezelfde fout is in dit huis al een keer
     gemaakt (test/staffgemoed.test.js toets 6). */
  const bron = ruw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  assert.equal(/\.\.\.\s*beeld\b/.test(bron), false,
    'het hele beeld wordt gekopieerd. Dan passeert elk NIEUW veld van ondernemingBeeld() deze grens ' +
    'vanzelf; de richting hoort andersom.');
  assert.equal(/\.\.\.\s*o\b/.test(bron), false, 'het ruwe ondernemingsobject wordt gekopieerd');
  assert.equal(/\bdelete\b/.test(bron), false,
    'er wordt een veld VERWIJDERD uit de projectie. Een positieve lijst hoeft niets weg te halen; wie ' +
    'wel weghaalt, bouwt op een object dat te veel bevatte.');

  /* DEZE MODULE SCHRIJFT NIET, en dat staat hier omdat toets 5 het niet kan
     zien. Een toekenning aan het ondernemingsobject overleeft in db.data ook
     zonder save(): de eerstvolgende save() van iemand anders legt hem vast. */
  assert.equal(/\bo\.[A-Za-z0-9_]+\s*=[^=]/.test(bron), false,
    'er wordt een veld van het ondernemingsobject overschreven. De brug LEEST; wat hier wordt gezet, ' +
    'belandt in db.data en wordt door de eerstvolgende save() van een ander vastgelegd.');
  assert.equal(/\bbeeld\.[A-Za-z0-9_]+\s*=[^=]/.test(bron), false, 'er wordt in het beeld geschreven');
  assert.equal(/\bsave\b|\bdb\.data\b/.test(bron), false,
    'deze module raakt de opslag aan. Hij hoort save en db niet eens MEE te krijgen -- dan kan ' +
    'persisteren er structureel niet in, in plaats van dat het er niet in staat.');

  /* En de tegenproef: hij bouwt werkelijk uit `beeld.<veld>`. Zonder deze regel
     zou een module die helemaal niets teruggeeft alle drie de eisen hierboven
     halen. */
  const velden = [...bron.matchAll(/\bbeeld\.([A-Za-z0-9_]+)/g)].map(m => m[1]);
  assert.ok(new Set(velden).size >= 5,
    'de projectie leest minder dan vijf velden uit het beeld; dan toetst de rest van deze toets niets');
  for (const v of velden)
    assert.equal(['id', 'naam', 'fase', 'ladder', 'rechtsvorm', 'caps', 'geweerd', 'werkvormen'].includes(v), true,
      'de projectie leest het veld "' + v + '" uit het beeld. Staat dat er bewust bij, zet het dan ook ' +
      'in deze lijst EN in de afweging in de kop van zaakkant.js -- een veld dat er stil bij komt, is ' +
      'precies wat deze toets moet tegenhouden.');
});
