/* SCHEIDING -- kan sessie A bij de gegevens van B?

   Dit is de test die hoort bij de meest voorkomende beveiligingsfout in een
   API met veel routes: authenticatie zonder autorisatie. De server weet WIE je
   bent (het token klopt), maar controleert niet of het record dat je noemt ook
   VAN jou is. Wie dan een referentie van een ander raadt of afkijkt, opent zijn
   dossier. In de vakliteratuur heet dat IDOR / broken object level authorization
   en het staat al jaren bovenaan de OWASP API-lijst.

   De test doet het in twee lagen, want geen van beide is in zijn eentje genoeg:

   1. LEVEND BEWIJS. Twee echte leden op een echte server. A maakt records aan,
      B probeert er met zijn eigen geldige token bij te komen -- lezen zowel als
      wijzigen. Elk antwoord moet een weigering zijn OF een leeg resultaat; wat
      NOOIT mag is dat B de inhoud van A terugkrijgt.

   2. STRUCTUURBEWIJS. Levende tests dekken de routes die je toevallig kiest;
      er zijn er ruim 1900. Daarom loopt de tweede helft over ALLE routebestanden
      en zoekt handlers die een id uit het verzoek pakken zonder ergens in
      diezelfde handler de sessie te noemen. Dat is geen bewijs van een gat --
      het is een lijst van plekken waar de scheiding niet uit de code af te
      lezen valt, en die lijst hoort leeg te zijn.

   Draai los: node --experimental-sqlite --test test/scheiding.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 4500 + Math.floor(Math.random() * 80);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-scheiding-'));
const WORTEL = path.join(__dirname, '..');
const SERVER = path.join(WORTEL, 'server', 'server.js');

let kind, tokenA = null, tokenB = null;

function post(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
}
const wacht = (ms) => new Promise(r => setTimeout(r, ms));

test('server starten en twee losse leden aanmaken', async () => {
  kind = spawn(process.execPath, ['--experimental-sqlite', SERVER], {
    env: { ...process.env, NODE_ENV: 'test', PORT: String(PORT), RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_DEMO: '0' },
    stdio: 'ignore'
  });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(BASE + '/api/health')).ok) break; } catch (e) {}
    await wacht(200);
  }
  const maak = async (naam, mail) => {
    const r = await post('/api/auth/register', {
      name: naam, email: mail, phone: '0600000000', password: 'geheim12345',
      geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
    });
    assert.equal(r.status, 200, naam + ' moet kunnen registreren');
    const d = await r.json();
    assert.ok(d.token, naam + ' krijgt een token');
    return d.token;
  };
  tokenA = await maak('Anna Aardenburg', 'a@scheiding.test');
  tokenB = await maak('Bram Bergsma', 'b@scheiding.test');
  assert.notEqual(tokenA, tokenB);
});

test('B komt met zijn eigen geldige token niet bij de records van A', async () => {
  /* A legt in een paar verschillende hoeken van het systeem iets neer. Het gaat
     niet om de features zelf, maar om de vorm: elk van deze endpoints krijgt
     straks een referentie MEE uit het verzoek, en moet die tegen de sessie
     afzetten. */
  const refs = [];

  // 1. een cv (staat onder de codenaam van A)
  const cv = await post('/api/cv/save', { cv: { headline: 'Geheim van Anna', skills: ['zeilen'] } }, tokenA);
  if (cv.ok) refs.push({ wat: 'cv' });

  // 2. een bestelling bij een demo-zaak: levert een ref op die B zou kunnen raden
  const zaken = await (await fetch(BASE + '/api/suppliers')).json();
  const zaak = (zaken.suppliers || zaken || [])[0];
  let orderRef = null;
  if (zaak && zaak.code) {
    const o = await post('/api/order', { supplierCode: zaak.code, items: [{ name: 'iets', price: 10, qty: 1 }] }, tokenA);
    if (o.ok) { const d = await o.json(); orderRef = d.ref || (d.order && d.order.ref); }
  }

  /* Nu B. Voor elk endpoint geldt dezelfde eis: het antwoord mag geen gegevens
     van A bevatten. Een 4xx is goed, een lege lijst is ook goed -- alleen de
     inhoud van A teruggeven is fout. */
  const eigenStaat = await post('/api/state', {}, tokenB);
  assert.equal(eigenStaat.status, 200, 'B kan wel gewoon zijn eigen staat opvragen');
  const bStaat = JSON.stringify(await eigenStaat.json());
  assert.ok(!/Geheim van Anna/.test(bStaat), 'het cv van A staat niet in de staat van B');
  assert.ok(!/Anna Aardenburg/.test(bStaat), 'de echte naam van A staat nergens in het antwoord van B');
  if (orderRef) assert.ok(!bStaat.includes(orderRef), 'de bestelling van A staat niet in de staat van B');

  if (orderRef) {
    // B noemt de referentie van A expliciet, op de plekken die een ref aannemen
    for (const pad of ['/api/order/annuleer', '/api/betaalverzoek', '/api/factuur']) {
      const r = await post(pad, { ref: orderRef }, tokenB);
      if (r.status === 404 && !(await r.clone().text()).length) continue; // route bestaat niet
      const tekst = await r.text();
      assert.ok(r.status >= 400 || !/Anna|Aardenburg/.test(tekst),
        pad + ' geeft B geen toegang tot de bestelling van A (status ' + r.status + ')');
    }
  }

  // 3. de identiteitskluis: nergens in een leden-antwoord hoort een echte naam
  const zoek = await post('/api/salon/feed', {}, tokenB);
  if (zoek.ok) assert.ok(!/Aardenburg/.test(await zoek.text()), 'de Salon toont codenamen, geen achternamen');
});

test('B kan het inzagejournaal van A niet opvragen', async () => {
  /* Het journaal is bij uitstek een record waar per persoon op gefilterd moet
     worden: het staat vol met "wie keek naar wie". Zou je hier een id kunnen
     meegeven, dan was de privacy-voorziening zelf het lek. De route neemt dan
     ook geen id aan -- hij kijkt alleen naar de sessie. */
  const r = await post('/api/privacy/inzage', { userId: 1, id: 1, overId: 1 }, tokenB);
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(Array.isArray(d.inzage), 'B krijgt een lijst');
  assert.equal(d.inzage.length, 0, 'en die is leeg: er is niemand in het dossier van B geweest');
  assert.ok(!JSON.stringify(d).includes('Aardenburg'), 'zeker geen regel van A');
});

test('zonder token komt niemand ergens binnen', async () => {
  for (const pad of ['/api/state', '/api/privacy/export', '/api/privacy/inzage', '/api/cv/get']) {
    const r = await post(pad, {}, null);
    assert.ok(r.status === 401 || r.status === 403, pad + ' eist een sessie (kreeg ' + r.status + ')');
  }
});

test.after(async () => {
  if (kind) kind.kill();
  await wacht(200);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* ---------- laag 2: het structuurbewijs over alle routebestanden ---------- */

test('elke routehandler die een id uit het verzoek pakt, noemt ook de sessie', () => {
  const bestanden = [];
  (function loop(dir) {
    for (const naam of fs.readdirSync(dir)) {
      const p = path.join(dir, naam);
      const s = fs.statSync(p);
      if (s.isDirectory()) loop(p);
      else if (naam.endsWith('.js')) bestanden.push(p);
    }
  })(path.join(WORTEL, 'server', 'routes'));
  assert.ok(bestanden.length > 50, 'er zijn routebestanden gevonden');

  /* Wat "de sessie noemen" in deze codebase betekent, is breder dan letterlijk
     req.session -- en dat moet de scan weten, anders meet hij zijn eigen
     onwetendheid. Identiteit komt hier op drie manieren binnen:

       1. een poortwachter in de registratie: auth, supplierAuth, officeAuth,
          techAuth, boardroomAuth, huisAuth, baasAuth. Die zet req.session /
          req.supplier / req.techUser en weigert zonder geldig token.
       2. rechtstreeks in de body: req.session.key, req.techUser, req.supplier...
       3. via een afleider die de request meekrijgt: cn(req), lidKey(req),
          wie(req), id(req), mij(req) -- tientallen van die kleine helpers, en
          allemaal met hetzelfde doel: uit DEZE request halen wie je bent.

     De eis is dat er van elk minstens één is: een poortwachter EN een plek waar
     de handler die identiteit ook echt gebruikt. Een poortwachter alleen zegt
     "je bent ingelogd", niet "dit record is van jou" -- en dat verschil is nu
     juist waar deze test over gaat.

     En er is een onderscheid dat de scan MOET maken, anders meet hij het
     verkeerde. Achter officeAuth / techAuth / boardroomAuth zit RTG-personeel
     op RECORDS VAN RTG ZELF: een ontwerp in het Atelier, een kamer in het
     RTF-kantoor, een schakelaar. Daar is maar één eigenaar (het bedrijf), dus
     de poortwachter IS de autorisatie -- er valt geen tweede partij te
     beschermen. Achter auth (een van miljoenen leden) en supplierAuth (een van
     duizenden zaken) zitten juist wél partijen die elkaars gegevens niet mogen
     zien. Daar, en alleen daar, is "poortwachter zonder eigenaarscontrole" een
     echt gat. De scan is dus streng op die twee en laat de kantoorroutes met
     rust -- niet uit gemak, maar omdat het daar een andere vraag is. */
  /* scimAuth hoort in deze rij: hij weigert met 401 zonder geldige SCIM-sleutel
     en zet req.scimOrg, waarna elke bewerking door binnenOrg() gaat (zie
     server/scim/index.js). Dat is dezelfde soort poort als de andere hier --
     alleen is de sleutel van een klant in plaats van een sessie van een lid. */
  const POORT = /,\s*(auth|supplierAuth|officeAuth|techAuth|boardroomAuth|huisAuth|baasAuth|eigenaarAlleen|scimAuth)\s*[,)]|\.\.\.lid\b/;
  /* Niet elke poort staat in de registratie. Een flink deel van het huis
     controleert in de handler zelf -- rtfSociaal(req, res), profiel(req, res),
     appSessie(req), rtf.verifieerProfiel(code, token) -- en stuurt bij twijfel
     meteen een 401 of 403 terug. Dat is dezelfde controle, een regel lager.

     In plaats van al die helpernamen op te sommen (een lijst die veroudert
     zodra iemand een nieuwe schrijft) herkennen we de VORM: de handler weigert
     ergens met 401/403. Dat kan hij alleen als hij iets heeft gecontroleerd. */
  const POORT_IN_BODY = /res\.status\(\s*40[13]\s*\)|(rtfSociaal|appSessie|profiel|eisAccount)\s*\(\s*req/;
  /* SCIM is bij uitstek veelpartij: elke klant heeft een eigen sleutel en mag
     alleen bij zijn eigen mensen. Daarom staat scimAuth hier OOK -- zo eist de
     test verderop dat de handler req.scimOrg echt gebruikt, en is een SCIM-route
     die de organisatie vergeet net zo goed een fout als een member-route die de
     sessie vergeet. */
  const VEELPARTIJ = /,\s*(auth|supplierAuth|huisAuth|scimAuth)\s*[,)]/;
  /* req.<iets> dat een poortwachter zelf heeft gezet telt ook: huisAuth zet
     req.werkplekCode, de zaak-poort zet req.actor. En een helper mag naast de
     request ook het antwoord meekrijgen -- eisAccount(req, res) is net zo goed
     een afleiding uit DEZE request als cn(req). */
  const GEBRUIKT = /req\.(session|techUser|supplier|staff|user|eigenaar|account|werkplekCode|actor|scimOrg)\b|\b[a-zA-Z_$][a-zA-Z0-9_$]*\(req[,)]/;
  const VRAAGID = /req\.(body|params|query)\.(id|ref|userId|memberId|key|code|codenaam)\b/;
  /* ---- de beoordeelde uitzonderingen ----
     Wat hierna nog opduikt is stuk voor stuk nagelopen en valt in twee soorten.
     Elke regel staat er met de reden erbij, want een uitzonderingenlijst zonder
     reden is gewoon een uitgezette test. Komt er een NIEUWE handler bij, dan
     valt die buiten deze lijst en klapt de test -- precies de bedoeling: iemand
     moet er dan naar kijken en hem hier bewust bijzetten of het gat dichten.

       (a) DE CODE IS DE SLEUTEL. Geen sessie, by design: een klascode met een
           leraar-token, een partnercode, een clubcode. De houder van de code
           is de bevoegde; er is geen account om tegen af te zetten.
       (b) OPENBARE INHOUD ACHTER EEN INLOG. Het id wijst een reisadvertentie,
           een boerderij, een reisgids of een boarding pass aan -- dingen die
           iedereen met een pas mag zien. Er is geen tweede eigenaar, dus er is
           niets te scheiden; de poortwachter is genoeg. */
  const GEDULD = {
    // (a) de code is de sleutel
    'server/routes/lesmaker.js POST /api/les/leraar': 'klaslokaal: leraarToken is de sleutel, geen account',
    'server/routes/lesmaker.js POST /api/les/volgende': 'klaslokaal: leraarToken is de sleutel',
    'server/routes/lesmaker.js POST /api/les/sluit': 'klaslokaal: leraarToken is de sleutel',
    'server/routes/lesmaker.js POST /api/les/mee': 'klas-PDA: klascode + naam, kinderen zonder account',
    'server/routes/lesmaker.js POST /api/les/kijk': 'klas-PDA: deelnemerToken is de sleutel',
    'server/routes/lesmaker.js POST /api/les/antwoord': 'klas-PDA: deelnemerToken is de sleutel',
    'server/routes/member/kopen/bezorg.js POST /api/partner': 'partnercode opzoeken: openbaar partnerprofiel',
    'server/routes/member/partnerkanaal.js POST /api/book': 'partnerkanaal: boeken zonder RTG-account, de reis-id is openbaar',
    'server/routes/rtfkantoor.js POST /api/rtf/club/portaal': 'clubportaal: de clubcode is de sleutel van het eigen dossier',
    'server/routes/rtfkantoor.js POST /api/rtf/club/bericht': 'clubportaal: de clubcode is de sleutel',
    'server/routes/rtfkantoor.js POST /api/rtf/partner/raad': 'stadsraad-portaal: de partnercode is de sleutel',
    'server/routes/supplier/toegang.js POST /api/supplier/roster': 'openbaar rooster van een zaak op zaakcode',
    'server/routes/supplier/werving/sollicitaties.js POST /api/supplier/apply': 'solliciteren kan zonder account: de vacaturecode is openbaar',
    // (b) openbare inhoud achter een inlog
    'server/routes/luchthaven.js POST /api/supplier/lucht/pass': 'boarding pass die de gast zelf toont aan de balie',
    'server/routes/member/winkel-bieb.js POST /api/foodcourt/tijden': 'vrije tijdsloten van een restaurant: openbare beschikbaarheid',
    'server/routes/member/winkel-bieb.js POST /api/mall/land': 'catalogus van een boerderij: openbaar aanbod',
    'server/routes/member/winkel-bieb.js POST /api/mall/reis/lees': 'reisgids lezen: openbare bibliotheekinhoud',
    'server/routes/thuis.js POST /api/thuis/detail': 'detail van een advertentie: openbaar aanbod',
    'server/routes/thuis.js POST /api/thuis/reviews': 'reviews bij een advertentie: openbaar',
    /* (c) de terugkeer van een identiteitsprovider. Hier IS er per definitie nog
       geen sessie: de provider stuurt de browser van de bezoeker hierheen met
       een code, en pas daarna wordt er ingelogd. De poort is de `state`: die is
       versleuteld en ondertekend met de kluissleutel (server/sso/staat.js), dus
       niemand anders kan er een maken of hem wijzigen. Uit die state komt de
       koppeling, de nonce en de PKCE-verifier; klopt hij niet, dan gebeurt er
       niets. Een auth-middleware ervoor zetten zou inloggen onmogelijk maken. */
    'server/routes/sso.js GET /api/sso/terug': 'terugkeer van de identiteitsprovider: de versleutelde state IS de poort'
  };
  const verdacht = [];

  for (const p of bestanden) {
    const rel = path.relative(WORTEL, p);
    const regels = fs.readFileSync(p, 'utf8').split('\n');
    let start = -1, blok = [];
    for (let i = 0; i < regels.length; i++) {
      const r = regels[i];
      if (/app\.(get|post|put|delete|patch)\s*\(/.test(r)) {
        if (start >= 0) keur(rel, start, blok);
        start = i; blok = [r];
      } else if (start >= 0) {
        blok.push(r);
        if (blok.length > 60) { keur(rel, start, blok); start = -1; blok = []; }
      }
    }
    if (start >= 0) keur(rel, start, blok);
  }

  function keur(rel, regel, blok) {
    const tekst = blok.join('\n');
    if (!VRAAGID.test(tekst)) return;        // geen id uit het verzoek: niets te scheiden
    /* De sleutel is het ROUTEPAD, niet het regelnummer. Dat was het wel, en dat
       brak toen er hierboven regels bijkwamen: de nummers schoven op en de test
       viel op iets wat niemand had aangeraakt. Erger is de andere
       kant -- er kan een ANDERE handler op zo'n nummer schuiven, en die wordt
       dan stilletjes vrijgepleit door een uitzondering die niet voor hem
       bedoeld was. Een pad schuift niet op. */
    const route = (blok[0].match(/app\.(get|post|put|delete|patch)\s*\(\s*'([^']+)'/) || []);
    const plek = route[2] ? rel + ' ' + route[1].toUpperCase() + ' ' + route[2] : rel + ':' + (regel + 1);
    if (GEDULD[plek]) return;                 // beoordeeld en verantwoord, zie GEDULD
    if (POORT_IN_BODY.test(tekst)) return;    // de poort staat in de handler zelf
    if (!POORT.test(blok[0])) { verdacht.push(plek + ' (geen poortwachter)'); return; }
    // achter een kantoorpoort is er maar één eigenaar: niets te scheiden
    if (!VEELPARTIJ.test(blok[0])) return;
    if (!GEBRUIKT.test(tekst)) verdacht.push(plek + ' (identiteit niet gebruikt)');
  }

  assert.deepEqual(verdacht, [],
    'deze handlers lezen een id uit het verzoek zonder poortwachter en/of zonder de ' +
    'identiteit uit die request te gebruiken; dan staat er niets tussen sessie A en ' +
    'record B:\n  ' + verdacht.join('\n  '));
});
