/* DE VERIFICATIE WORDT BIJ DE INLOG ECHT VASTGELEGD -- laag 2 van de Trust
   Fabric, aan de kant waar hij aan de server hangt.

   WAAROM DEZE TOETS BESTAAT, en dat is een les uit deze ronde zelf. De aanroep
   in routes/auth/inlog.js staat in een try/catch: de inlog mag niet stukgaan
   omdat een meter hapert. Maar een try/catch om iets heen dat er niet is, ziet
   er precies hetzelfde uit als een try/catch om iets dat werkt -- de inlog
   slaagt in beide gevallen en niemand merkt dat de laag stilstaat. Zonder deze
   toets was "de sessie weet nu hoe hard hij is geverifieerd" een bewering
   zonder bron, en dat is precies waar VERTROUWEN.md par. 3.1 over gaat.

   Hij kijkt daarom in de OPSLAG en niet naar het antwoord: dat de sessie het
   weet, is niet aan de buitenkant te zien.

   EN ER ZIJN ZES DEUREN, NIET EEN. Toets 4 loopt ze allemaal langs, want de
   scheve stand die daar zat was erger dan hij eruitzag: alleen de wachtwoord-
   inlog schreef iets weg, dus las laag 3 voor een PASSKEY-sessie "van deze
   sessie is niet vastgelegd hoe hij is geverifieerd" en vroeg bij elke zware
   handeling een tweede bevestiging. De hardste manier die dit huis kent, kreeg
   daarmee de meeste wrijving -- en de zachtste (een wachtwoord) de minste. Een
   beveiliging die precies verkeerd om beloont, wordt uitgezet.

   ZES MUTATIES, ZES KEER RAAK, en een zevende die met opzet bleef staan:

     de passkey-deur zwijgt weer                    -> 5
     een typefout in de manier ('paskey')           -> 5
     de SSO-deur noteert 'wachtwoord'               -> 5  (zie daar waarom)
     de technische deur zwijgt                      -> 4
     het apparaat telt niet meer mee                -> 2
     registreren noteert niets                      -> 4
     de taal uit de apparaataanduiding halen        -> geen enkele, en terecht:
       de useragent alleen verschilt in die toetsen al, dus dit hoort niets te
       breken. Zonder zo'n controle bewijst een rij "RAAK" alleen dat een
       bestand gevoelig is voor veranderen, niet dat de toetsen op gedrag kijken.

   Draai los: node --experimental-sqlite --test test/vertrouweninlog.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const V = require('../server/kern/vertrouwen/verificatie');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vertrouwen-'));
let srv, base;

const api = (pad, body) => fetch(base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* DE OPSLAG RECHTSTREEKS LEZEN, en niet via een deur. Dat de sessie weet hoe
   hard hij is geverifieerd, is aan de buitenkant niet te zien -- daar is deze
   laag juist voor. Een endpoint openzetten om het te kunnen toetsen, zou de
   toets betalen met een deur die niemand nodig heeft. Deze opstelling draait op
   sqlite (server/db/sqlite.js): elke collectie een rij in de kv-tabel. */
const { DatabaseSync } = require('node:sqlite');
const bak = () => {
  const kv = new DatabaseSync(path.join(TMP, 'store.db'), { readOnly: true });
  try {
    const rij = kv.prepare('SELECT val FROM kv WHERE key = ?').get('vertrouwen');
    return rij ? JSON.parse(rij.val) : {};
  } finally { kv.close(); }
};

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base; });
test.after(async () => { await stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. een inlog legt vast HOE en WANNEER er is geverifieerd', async () => {
  const r = await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  assert.equal(r.status, 200, 'de inlog zelf werkt: ' + JSON.stringify(r.body).slice(0, 120));
  assert.ok(r.body.token);

  const v = V.lees(bak(), r.body.token);
  assert.ok(v, 'de sessie staat in het verificatieregister -- zonder deze regel staat laag 2 stil');
  assert.equal(v.hoe, 'wachtwoord');
  assert.equal(v.sterkte, 'gewoon', 'een wachtwoord is niet slecht, het is minder hard dan een passkey');
  assert.equal(v.vers, true, 'net gebeurd');
  assert.equal(v.apparaatNieuw, true, 'de eerste inlog vanaf dit apparaat');
});

test('2. hetzelfde apparaat is de tweede keer niet meer nieuw', async () => {
  const kop = { 'Content-Type': 'application/json', 'user-agent': 'ToetsBrowser/1.0', 'accept-language': 'nl' };
  const inlog = () => fetch(base + '/api/auth/login', { method: 'POST', headers: kop,
    body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) }).then(r => r.json());

  const een = await inlog();
  assert.equal(V.lees(bak(), een.token).apparaatNieuw, true, 'deze useragent is hier nog niet gezien');
  const twee = await inlog();
  assert.equal(V.lees(bak(), twee.token).apparaatNieuw, false, 'en daarna kent hij hem');

  const anders = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { ...kop, 'user-agent': 'EenHeelAndereBrowser/9' },
    body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) }).then(r => r.json());
  assert.equal(V.lees(bak(), anders.token).apparaatNieuw, true, 'een ander apparaat wel');
});

test('3. er staat niets herleidbaars in de opslag', async () => {
  const kop = { 'Content-Type': 'application/json', 'user-agent': 'GeheimeBrowser/42', 'accept-language': 'nl' };
  const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: kop,
    body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) }).then(x => x.json());

  const ruw = JSON.stringify(bak());
  assert.equal(ruw.includes('GeheimeBrowser'), false, 'geen useragent in de opslag');
  assert.equal(ruw.includes(r.token), false, 'en ook het sessietoken zelf niet -- alleen een hash ervan');
  assert.equal(ruw.includes('roellie'), false, 'en geen e-mailadres');
  /* Wat er WEL staat is een manier en een tijdstip, en dat is precies genoeg. */
  assert.match(ruw, /"hoe":"wachtwoord"/);
});

test('4. elke deur die een sessie uitgeeft, schrijft op waarmee hij is geopend', async () => {
  /* De deuren die met een verzonnen account te bereiken zijn, langs elkaar. De
     passkey en de identiteitsprovider vragen een echte ceremonie en staan
     daarom in toets 5 met wat er WEL van te toetsen valt. */
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 900 + 100);
  const reg = await api('/api/auth/register', { name: 'Zes Deuren', email: 'z' + u + '@x.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  assert.equal(reg.status, 200, JSON.stringify(reg.body).slice(0, 160));

  const naReg = V.lees(bak(), reg.body.token);
  assert.ok(naReg, 'registreren geeft een sessie uit, dus registreren noteert ook');
  assert.equal(naReg.hoe, 'wachtwoord');

  /* DE TECHNISCHE PAGINA, en dat is de zwaarste deur van het huis: een tenant
     vernietigen loopt erlangs. Die sessie kreeg pas een gemeten verificatie NA
     een bevestiging, nooit bij het inloggen zelf. */
  const tech = await api('/api/techniek/inloggen',
    { login: 'roellie.i@gmail.com', wachtwoord: process.env.DEMO_PASS || 'Imran' });
  assert.equal(tech.status, 200, JSON.stringify(tech.body).slice(0, 160));
  const naTech = V.lees(bak(), tech.body.token);
  assert.ok(naTech, 'ook de technieksessie hoort vastgelegd te zijn');
  assert.equal(naTech.hoe, 'wachtwoord');
  assert.equal(naTech.vers, true);
});

test('5. elke deur die een sessie MUNT, schrijft ook op waarmee hij is geopend', () => {
  /* DE STRUCTURELE VARIANT VAN TOETS 4, en hij is er omdat toets 4 de volgende
     deur niet kan zien. De scheve stand die deze ronde werd gerepareerd is
     namelijk niet ontstaan door een fout maar door een TOEVOEGING: er kwam een
     deur bij (de passkey) en die vergat te noteren. Niemand merkte het, want
     alles bleef werken -- alleen las laag 3 daarna "niet vastgelegd" voor de
     hardste manier die dit huis kent.

     Deze toets kijkt daarom naar de BRON: wie `accounts.issueToken(` aanroept,
     munt een sessie, en hoort binnen datzelfde bestand ook `noteerInlog(` aan
     te roepen. Een deur erbij zonder die regel laat deze toets zakken op de
     dag dat hij wordt geschreven, en niet een half jaar later. */
  const wortel = path.join(__dirname, '..', 'server');
  const bestanden = [];
  (function loop(map) {
    for (const naam of fs.readdirSync(map)) {
      const vol = path.join(map, naam);
      if (fs.statSync(vol).isDirectory()) { if (naam !== 'data') loop(vol); }
      else if (naam.endsWith('.js')) bestanden.push(vol);
    }
  })(wortel);

  /* Bewust GEEN uitzonderingenlijst. Zodra hier iets op moet, is de vraag niet
     "hoe krijg ik de toets groen" maar "waarom mag deze deur zwijgen over hoe
     hij is geopend" -- en dat antwoord hoort in een commit te staan. */
  const munters = bestanden.filter(f => /accounts\.issueToken\s*\(/.test(fs.readFileSync(f, 'utf8')));
  assert.ok(munters.length >= 5, 'er horen meerdere deuren te zijn, anders zoekt deze toets verkeerd');
  const stil = munters.filter(f => !/noteerInlog\s*\(/.test(fs.readFileSync(f, 'utf8')))
    .map(f => path.relative(path.join(__dirname, '..'), f));
  assert.deepEqual(stil, [], 'deze bestanden munten een sessie zonder op te schrijven waarmee hij is geopend');

  /* EN DE MANIER MOET BESTAAN. `noteer()` valt bij een onbekende `hoe` terug op
     `sleutel` -- sterkte "geen", oftewel "achter deze deur staat aantoonbaar
     niemand". Een typefout in de naam van een manier degradeert een passkey dus
     stilletjes tot een sleutel zonder mens, en dat is precies de soort fout die
     nooit een foutmelding geeft. */
  const genoemd = new Set();
  for (const f of munters)
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/noteerInlog\s*\([^)]*?'([a-z]+)'\s*\)/g))
      genoemd.add(m[1]);
  assert.ok(genoemd.size >= 3, 'er horen meerdere manieren in gebruik te zijn: ' + [...genoemd]);
  for (const hoe of genoemd) assert.ok(V.MANIEREN[hoe],
    'de deur noteert manier "' + hoe + '", en die staat niet in MANIEREN -- hij telt dan als sleutel zonder mens');

  /* De banden zelf, want daar hangt het hele verschil aan. */
  assert.equal(V.MANIEREN.passkey.sterkte, 'sterk');
  assert.equal(V.MANIEREN.wachtwoord.sterkte, 'gewoon');
  assert.equal(V.MANIEREN.provider.sterkte, 'overgenomen',
    'de klant verifieerde, en hoe hard dat was weten wij niet -- dat is een eigen band en geen "gewoon"');

  /* WELKE DEUR WELKE MANIER NOTEERT, en dit is geen herhaling van de code maar
     de gevaarlijkste regel van deze hele laag.

     Een mutatie liet zien wat er anders doorheen glipt: zet in routes/sso.js
     `wachtwoord` in plaats van `provider`, en een sessie die door de
     identiteitsprovider van de KLANT is geverifieerd gaat door voor een
     verificatie die WIJ hebben gedaan. Sterkte `gewoon` in plaats van
     `overgenomen`, dus laag 3 vraagt niets meer bij een zware handeling. Eén
     woord, geen foutmelding, en de step-up staat uit voor elke SSO-klant.

     Vandaar dat de koppeling hier vastligt met de reden erbij. Wie hem
     verandert, verandert een besluit en niet een regel. */
  const noteert = (bestand) => [...fs.readFileSync(path.join(wortel, bestand), 'utf8')
    .matchAll(/noteerInlog\s*\([^)]*?'([a-z]+)'\s*\)/g)].map(m => m[1]);

  assert.deepEqual(noteert('routes/sso.js'), ['provider'],
    'de SSO-deur verifieert zelf NIETS -- de provider van de klant doet dat, en hoe hard weten wij niet');
  assert.deepEqual(noteert('routes/auth/webauthn.js'), ['passkey'],
    'de passkey-deur is de enige die een hardwaresleutel ziet, en hoort dat ook zo te noteren');
  assert.deepEqual(noteert('routes/aanmeldgesprek.js'), ['sleutelwoorden'],
    'de intake logt in op sleutelwoorden, niet op een wachtwoord');
  for (const b of ['routes/auth/inlog.js', 'routes/auth/account.js', 'routes/techniek/inlog.js'])
    assert.deepEqual(noteert(b), ['wachtwoord'], b + ' controleert zelf een wachtwoord');
});
