/* LOGHYGIENE -- lekt er een naam, e-mailadres of token via de logs?

   Een systeem kan zijn database keurig versleutelen en toch alle identiteiten
   weggeven, omdat ze in platte tekst in de logs staan. Logs gaan naar plekken
   waar de kluis niet geldt: een logverzamelaar, een terminal, een collega die
   meekijkt, een backup van /var/log. En logs worden zelden opgeschoond.

   Deze test bewaakt drie dingen die makkelijk stukgaan zonder dat je het merkt:

     1. de verzoeklog schrijft alleen pad/methode/status/duur -- geen
        querystring (waar bij SSE een sessietoken in staat), geen body,
        geen headers;
     2. de foutafhandelaar geeft de client nooit een interne foutmelding of
        stack terug, alleen een nette zin en een id om mee te bellen;
     3. de serverbroncode logt nergens rechtstreeks een echte naam of e-mail.

   Draai los: node --test test/loghygiene.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { middleware, foutMiddleware, log } = require('../server/log');

const WORTEL = path.join(__dirname, '..');

/* Een nep-response die precies genoeg doet voor de middleware, en onthoudt
   welke headers en welke 'finish'-luisteraar er zijn gezet. */
function nepRes() {
  const r = {
    headers: {}, code: 200, body: null, klaar: null,
    set(k, v) { this.headers[k] = v; return this; },
    status(c) { this.code = c; return this; },
    json(o) { this.body = o; return this; },
    on(evt, fn) { if (evt === 'finish') this.klaar = fn; }
  };
  return r;
}

// de logregels opvangen in plaats van ze naar de terminal te schrijven
function vang(werk) {
  const uit = [];
  const echt = { out: process.stdout.write, err: process.stderr.write };
  process.stdout.write = (s) => { uit.push(String(s)); return true; };
  process.stderr.write = (s) => { uit.push(String(s)); return true; };
  try { werk(); } finally { process.stdout.write = echt.out; process.stderr.write = echt.err; }
  return uit.join('');
}

test('de verzoeklog schrijft geen querystring, body of headers', () => {
  const req = {
    headers: { authorization: 'Bearer GEHEIM-TOKEN-123', cookie: 'sessie=GEHEIM' },
    method: 'GET',
    // req.path is bij Express het pad ZONDER querystring; originalUrl heeft hem wel
    path: '/api/live',
    originalUrl: '/api/live?token=GEHEIM-TOKEN-123&email=anna@voorbeeld.nl',
    body: { email: 'anna@voorbeeld.nl', wachtwoord: 'geheim123', naam: 'Anna Aardenburg' },
    get: () => null
  };
  const res = nepRes();
  const tekst = vang(() => {
    middleware()(req, res, () => {});
    res.klaar();                    // doe alsof het antwoord klaar is
  });

  assert.ok(tekst.includes('/api/live'), 'het pad staat er wel in (daar is een log voor)');
  assert.ok(!tekst.includes('GEHEIM-TOKEN-123'), 'geen sessietoken in de log');
  assert.ok(!tekst.includes('anna@voorbeeld.nl'), 'geen e-mailadres in de log');
  assert.ok(!tekst.includes('Aardenburg'), 'geen echte naam in de log');
  assert.ok(!tekst.includes('geheim123'), 'geen wachtwoord in de log');
  assert.ok(!/token=/.test(tekst), 'geen querystring in de log');
});

test('de foutafhandelaar geeft de client geen stack en geen interne melding', () => {
  const err = new Error('SELECT * FROM users WHERE email = anna@voorbeeld.nl mislukt');
  const req = { id: 'abc123', path: '/api/iets' };
  const res = nepRes();
  vang(() => foutMiddleware()(err, req, res, () => {}));

  assert.equal(res.code, 500);
  const antwoord = JSON.stringify(res.body);
  assert.ok(!/anna@voorbeeld/.test(antwoord), 'geen e-mailadres naar de client');
  assert.ok(!/SELECT/.test(antwoord), 'geen query naar de client');
  assert.ok(!/stack|at /.test(antwoord), 'geen stack naar de client');
  assert.equal(res.body.id, 'abc123', 'wel een id, zodat de eigenaar de logregel kan opzoeken');
});

test('de foutsamenvatting op het techniekbord bevat geen persoonsgegevens uit de context', () => {
  /* Het techniekbord toont storingsgroepen aan de eigenaar. Daar hoort de
     foutmelding in te staan, niet het dossier van de gebruiker die hem trof. */
  log.foutenReset();
  vang(() => log.uitzondering(new Error('betaling mislukt'), {
    p: '/api/betaal', id: 'x1',
    // een aanroeper die er per ongeluk het dossier bij propt
    email: 'anna@voorbeeld.nl', naam: 'Anna Aardenburg'
  }));
  const s = JSON.stringify(log.foutenSamenvatting());
  assert.ok(/betaling mislukt/.test(s), 'de storing zelf staat er wel in');
  assert.ok(!/anna@voorbeeld\.nl/.test(s), 'maar het e-mailadres niet');
  assert.ok(!/Aardenburg/.test(s), 'en de naam ook niet');
  assert.ok(!/stack|\bat /.test(s), 'en geen ruwe stack op het bord');
  log.foutenReset();
});

test('nergens in de serverbroncode gaat een echte naam of e-mail rechtstreeks de log in', () => {
  /* Een tekstscan, geen bewijs -- maar wel de scan die de meest voorkomende
     variant vangt: iemand die tijdens het debuggen even log.info(..., { email })
     schrijft en dat laat staan. De uitzondering is de AI-uitwijk, die de naam
     van de AANBIEDER logt (Claude/lokaal), niet van een mens. */
  const LEK = /(log|console)\.(info|warn|error|debug|log)\s*\([^;]{0,200}?(realNameOf|emailOf|phoneOf|\.enc_name|\.enc_email|req\.body\.(email|password|wachtwoord|name|naam))/;
  const TOEGESTAAN = new Set(['server/ai.js']); // aanbieder.naam = "Claude", geen persoon
  const gevonden = [];

  (function loop(dir) {
    for (const naam of fs.readdirSync(dir)) {
      if (naam === 'data' || naam === 'node_modules') continue;
      const p = path.join(dir, naam);
      if (fs.statSync(p).isDirectory()) { loop(p); continue; }
      if (!naam.endsWith('.js')) continue;
      const rel = path.relative(WORTEL, p);
      if (TOEGESTAAN.has(rel)) continue;
      const regels = fs.readFileSync(p, 'utf8').split('\n');
      regels.forEach((r, i) => { if (LEK.test(r)) gevonden.push(rel + ':' + (i + 1)); });
    }
  })(path.join(WORTEL, 'server'));

  assert.deepEqual(gevonden, [],
    'deze regels loggen persoonsgegevens; log een codenaam of een account-id:\n  ' + gevonden.join('\n  '));
});

test('de Referrer-Policy houdt het SSE-token binnenshuis, en geldt altijd', () => {
  /* EventSource kan geen Authorization-header sturen, dus bij de
     live-verbindingen reist het sessietoken mee als ?token= in de URL. Zonder
     een Referrer-Policy stuurt de browser die hele URL als Referer naar elke
     externe bron -- en dan ligt een geldig token bij een derde partij.
     "strict-origin-when-cross-origin" geeft een vreemde partij hooguit onze
     origin. "no-referrer" en "same-origin" zijn nog strenger en dus ook goed;
     wat NIET mag is een policy die de volledige URL cross-origin meestuurt. */
  const bron = fs.readFileSync(path.join(WORTEL, 'server', 'server.js'), 'utf8');
  const m = /res\.set\('Referrer-Policy',\s*'([^']+)'\)/.exec(bron);
  assert.ok(m, 'er wordt een Referrer-Policy gezet');
  assert.ok(['strict-origin-when-cross-origin', 'same-origin', 'no-referrer', 'strict-origin'].includes(m[1]),
    'de policy lekt de volledige URL niet naar derden, maar is: ' + m[1]);

  // en hij staat buiten een productie-tak: een header die alleen live bestaat,
  // is een header die je nooit hebt getest
  const voor = bron.slice(0, m.index);
  const laatsteBlok = voor.lastIndexOf('app.use(');
  assert.ok(!/if \(PRODUCTION\)/.test(bron.slice(laatsteBlok, m.index)),
    'de header staat niet achter een productie-if, dus hij geldt ook lokaal');
});
