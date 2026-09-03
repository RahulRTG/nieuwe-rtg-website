/* Elke route die de server aanbiedt -- uit de ROUTER, niet uit de bron.

   WAT HIER STOND, EN WAAROM HET WEG IS

   De kop van dit bestand begon met: "uit de BRON gelezen. Waarom uit de bron en
   niet uit een draaiende server: express geeft zijn routetabel niet betrouwbaar
   prijs zodra er routers en mounts in het spel zijn." Dat was waar voor express,
   en het is niet waar voor deze server: web/routing.js loopt zijn eigen mounts na
   en scripts/routekaart.js drukt de volledige kaart af (app._routes()).

   Die ene achterhaalde zin heeft veel gekost. Een regex over server/**.js ziet
   niet wat via `app.use('/api/foundation', router)` of een voorvoegsel-hulpje
   hangt, en de bewakers achter zo'n route al helemaal niet. Gemeten: deze functie
   gaf 2934 routes waar de router er 4191 heeft. De vier bewijsproeven (rol,
   idempotentie, invoer, staat) leunen alle vier op deze lijst en misten daardoor
   alle vier EXACT dezelfde 1257 routes -- waaronder alle 281 van de RTFoundation.
   Vier gaten, een oorzaak, en die oorzaak was deze scanner.

   DE NIEUWE VERDELING VAN TAKEN

     de ROUTER bepaalt WAT er bestaat        (pad, methode, bewakers)
     de BRON voegt toe WAAR het staat        (bestand, regel)

   En dat tweede kan MISLUKKEN zonder dat er iets verdwijnt. Een route waarvan de
   bron niet te vinden is, krijgt `bestand: null` en blijft gewoon in de lijst.
   Precies dat was de fout: de vindbaarheid van een route in de brontekst besliste
   over zijn BESTAAN, en wat niet bestaat wordt ook niet beproefd.

   BEWAKERS KOMEN NU UIT DE ROUTER. Een route is daar een laag per middleware;
   de laatste is de handler, de rest zijn bewakers (de afleiding staat in
   server/kern/routedekking.js). `bewakersBekend: false` betekent dat de router er
   niets over kon zeggen -- niet dat er geen bewaker is. 578 routes van dit huis
   hebben werkelijk geen bewakerslaag omdat ze in de handler een capability-token
   controleren (foundation/onderwijs); die krijgen een leeg lijstje EN
   bewakersBekend: true, want dat is een meting en geen leemte.

   Afnemers, en die horen dezelfde lijst te zien: scripts/onbetreden.js,
   scripts/kaart.js, scripts/bewijsmatrix.js, de vier *proef-route.js-scripts en
   de trede "de dwaler" in scripts/ladder/beveiliging.js. Zou elk zijn eigen
   scanner hebben, dan lopen ze uiteen -- de dubbele-waarheid-fout die in deze
   codebase al vaker duur was (LAT.md regel 4). Dat er ondanks deze module nog
   drie privé-scanners bestaan (beproeving.js, tot-crash.js, schakelbaar.js) is
   bekende schuld; keuringsregel 49 houdt bij dat er geen vierde bij komt. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
/* Wat voor SOORT deur elke bewaker is. Eén kaart voor het hele huis; zie de kop
   van dat bestand voor waarom dat er zeven soorten zijn en niet één. */
const bewakerskaart = require('./bewakers.js');

const WORTEL = path.join(__dirname, '..', '..');

function loopMap(map, filter, doe) {
  for (const naam of fs.readdirSync(map)) {
    const p = path.join(map, naam);
    let st; try { st = fs.statSync(p); } catch (e) { continue; }
    if (st.isDirectory()) {
      if (/^(node_modules|\.git|data|dist)$/.test(naam)) continue;
      loopMap(p, filter, doe);
    } else if (filter.test(naam)) doe(p);
  }
}

/* ---- WAT ER BESTAAT: de routekaart uit de levende router ----
   In een kindproces, want het start de app. Eenmaal per proces bewaard: twee
   afnemers vragen hem twee keer (bewijsmatrix.js) en dat hoeft niet twee keer
   een server te kosten. */
let _kaart = null;
function haalKaart() {
  return execFileSync(process.execPath,
    [path.join(WORTEL, 'scripts', 'routekaart.js'), '--json'],
    { cwd: WORTEL, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: '', RTG_DATA_DIR: '' } });
}
function routekaart() {
  if (_kaart) return _kaart;
  let uit;
  try {
    try {
      uit = haalKaart();
    } catch (e) {
      /* EEN BEZETTE POORT IS GEEN BEVINDING. Het kind kiest zelf een vrije
         poort, maar tussen loslaten en luisteren past een andere server -- en
         in de CI staan er tientallen naast elkaar. Precies EEN keer opnieuw,
         en alleen hierop: elke andere fout gaat ongewijzigd naar boven, want
         herhalen tot het lukt is hoe een echte storing onzichtbaar wordt. */
      if (!/EADDRINUSE/.test(String(e.stderr || '') + String(e.message || ''))) throw e;
      uit = haalKaart();
    }
  } catch (e) {
    /* DE REDEN MEE NAAR BOVEN. Hier stond stderr op 'ignore', en toen dit
       kindproces een keer omviel tijdens de volle suite las de toets alleen
       "Command failed: node ... routekaart.js --json". Dat is geen bevinding
       maar een raadsel: je weet niet of de app niet startte, of de poort bezet
       was, of het geheugen op was. Een meter die zakt hoort te zeggen waarom
       (LAT.md regel 3), en dat kost hier een pipe en vier regels. */
    const fout = new Error('de routekaart kon niet worden opgehaald: ' + e.message +
      (e.status != null ? ' (afsluitcode ' + e.status + ')' : '') +
      (e.signal ? ' (signaal ' + e.signal + ')' : '') +
      '\n--- stderr van het kindproces ---\n' +
      (String(e.stderr || '').trim().slice(-4000) || '(leeg -- het kind heeft niets gezegd)'));
    fout.oorzaak = e;
    throw fout;
  }
  _kaart = JSON.parse(uit);
  if (!Array.isArray(_kaart.routes) || _kaart.routes.length < 100) {
    /* Een halve kaart is erger dan geen kaart: dan meten vier proeven een
       deelverzameling en noemen dat een ronde (LAT.md regel 3). */
    throw new Error('de routekaart gaf maar ' + ((_kaart.routes || []).length) +
      ' paden terug; dat is geen kaart. Draai `node scripts/routekaart.js` met de hand.');
  }
  return _kaart;
}

/* ---- WAAR HET STAAT: de bron, als verrijking ----
   Dezelfde uitdrukking als voorheen, maar hij beslist niets meer over bestaan.
   Zes ingangen, van zeker naar onzeker, en de volgorde IS de zekerheid:

     exact          de route staat letterlijk zo in de bron
     samengesteld   het pad is in de bron opgebouwd uit een voorvoegsel dat in
                    HETZELFDE bestand als tekst staat: `app.post(p.pad + '/alias')`
                    naast `{ pad: '/api/member/rtmail' }`. Dan is het volle pad
                    af te leiden en is dit net zo hard als exact.
     staart         een route op een sub-router staat daar met zijn pad binnen de
                    mount: `/les/maak` voor `/api/foundation/les/maak`
     voorvoegsel    een LETTERLIJK voorvoegsel met een variabele staart:
                    `app.post('/api/rtf/spel/' + naam, ...)` in een lus over een
                    actietabel. Het bestand zegt hier zelf, naast de
                    registratie, welk voorvoegsel het claimt -- de hardste
                    voorvoegselclaim die er is, en per methode.
     staartVoorvoegsel  wel een `X + '/alias'`, maar het voorvoegsel staat niet
                    in dit bestand (het komt als parameter binnen). Dan blijft
                    alleen de staart over.
     fabriek        het bestand registreert EEN keer met een opgebouwd pad en
                    roept dat daarna tientallen keren aan; de staart bestaat
                    statisch niet. Het voorvoegsel staat er wel als tekst, dus
                    de vraag wordt omgekeerd: welk bestand claimt dit
                    voorvoegsel en bouwt paden op? Alleen bij precies een.

   De laatste drie accepteren we alleen bij precies EEN treffer -- een verkeerd
   toegewezen bronbestand is erger dan geen bronbestand, want dan wijst een
   melding je naar het verkeerde bestand.

   WAAROM HET VOORVOEGSEL VOOR DE OPGEBOUWDE STAART KOMT, en niet erna. Met de
   omgekeerde volgorde viel /api/rtf/spel/antwoord op de staart `/antwoord` van
   `app.post(p.pad + '/antwoord')` in server/routes/rtmail-vak.js -- een
   bestand dat er niets mee te maken heeft, terwijl server/routes/spellen.js
   het voorvoegsel `/api/rtf/spel/` letterlijk naast zijn registratie draagt.
   Een claim naast de registratie weegt zwaarder dan een staart zonder
   voorvoegsel; wie dat omdraait, wijst precies de route toe die al een keer
   verkeerd is toegewezen (test/routebron.test.js houdt dit vast).

   WAAROM DEZE INGANGEN ERBIJ ZIJN GEKOMEN, in twee rondes die elkaar dekten.

   De eerste ronde begon bij de spellen: `app.post('/api/rtf/spel/' + naam, ...)`
   registreert drieenveertig echte routes waarvan er geen enkele letterlijk in
   de bron staat -- en die vielen alle drieenveertig uit de bron, met
   `bestand: null`. Dat is geen randgeval: het was in een keer de grootste
   blinde vlek van alle vier de bewijsproeven, want zonder bronbestand kan geen
   van hen de handler lezen. Erger nog: zonder een eigen ingang werd
   `'/api/rtf/spel/'` als EXACT pad opgeslagen, dus de blinde vlek droeg ook nog
   een verkeerde regel in de index. Een string die verdergaat met `+` is daarom
   een VOORVOEGSEL en geen pad, en hij komt niet in de exacte index terecht.
   Dezelfde ronde vond de omgekeerde vorm: `app.post(p.pad + '/vak', ...)` in
   een lus over twee poorten (server/routes/rtmail-vak.js), waar het
   VOORVOEGSEL de variabele is en het achtervoegsel de letterlijke tekst.

   De tweede ronde telde na: `scripts/laatspoor.js` kon van 226 schrijfroutes de
   bron niet vinden, en die stonden apart geteld met "niet gekeken is geen in
   orde". De oorzaak was niet dat die routes ergens raar staan: ze staan in een
   LUS over twee of drie voorvoegsels (server/routes/rtmail-*.js schrijft elke
   route een keer en hangt hem op /api/member/rtmail en /api/supplier/rtmail),
   of ze komen uit een fabriek die EEN registratie veertig keer aanroept
   (server/routes/verzorging.js). De uitdrukking hierboven eist een letterlijke
   tekenreeks als eerste argument en zag daar dus NIETS van -- 58 registraties,
   goed voor 226 routes. Dezelfde blinde vlek die keuringsregel 28 had met
   `app.use` op een lijst paden, nu op een `+`.

   Dezelfde discipline bij elke onzekere ingang: het langste stuk dat past, en
   alleen bij precies EEN kandidaat. Dat laatste doet echt werk -- `/Users/:id`
   staat viermaal in de SCIM-laag en `/papieren` tweemaal, en die blijven dus
   met opzet zonder bron in plaats van naar een van de vier te wijzen. */
/* De staart wordt met een VOORUITBLIK gevangen en niet opgegeten. Dat is geen
   stijl maar een reparatie: `([^\n]*)` schuift lastIndex naar het regeleinde, dus
   van een bestand met meer registraties op EEN regel werd alleen de eerste
   gezien. server/routes/instant-reality.js is zo'n bestand -- drie routes, een
   regel -- en daar bleven er twee van onvindbaar. */
const ROUTE_RE = /\b(app|router)\.(post|get|put|delete|patch)\(\s*(['"`])([^'"`]+)\3(?=([^\n]*))/g;
/* Een registratie waarvan het pad wordt OPGEBOUWD: `app.post(p.pad + '/alias'`.
   Het linkerdeel mag van alles zijn (een variabele, een veld, een index) zolang
   er geen aanhalingsteken in staat -- dan was het immers de vorm hierboven. */
const SAMEN_RE = /\b(app|router)\.(post|get|put|delete|patch)\(\s*([A-Za-z_$][\w.$\[\]]*)\s*\+\s*(['"`])([^'"`]+)\4(?=([^\n]*))/g;
/* De voorvoegsels die IN dit bestand als tekst staan. Bewust smal: het moet op
   /api beginnen en mag geen sjabloonstuk dragen, anders komt er van alles langs
   dat toevallig met een schuine streep begint. */
const VOORVOEGSEL_RE = /(['"`])(\/api\/[a-z0-9/_:-]*[a-z0-9_:-])\1/gi;
/* Bouwt dit bestand paden op? Een registratie waarvan het eerste argument NIET
   met een aanhalingsteken begint. Dat is precies de vorm die de twee
   uitdrukkingen hierboven niet tot een volledig pad kunnen maken. */
const BOUWT_RE = /\b(app|router)\.(post|get|put|delete|patch)\(\s*[A-Za-z_$]/g;
/* En de spiegelvorm: een LETTERLIJK voorvoegsel met een variabele staart,
   `app.post('/api/member/spel/' + naam, ...)`. Hier zegt het bestand zelf welk
   voorvoegsel het claimt -- dat is de hardste voorvoegselclaim die er is, want
   hij staat naast de registratie en niet ergens anders in het bestand. */
const VOOR_RE = /\b(app|router)\.(post|get|put|delete|patch)\(\s*(['"`])(\/[^'"`]+)\3\s*\+/g;

let _bron = null;
function bronIndex() {
  if (_bron) return _bron;
  const exact = new Map();
  const perStaart = new Map();
  const samengesteld = new Map();
  const perStaartVoorvoegsel = new Map();
  const perVoorvoegsel = new Map();          // 'POST /api/rtf/spel' -> de registratie(s) naast dat letterlijke voorvoegsel
  const perVoorvoegselBestand = new Map();   // '/api/supplier/beauty' -> het bestand dat paden bouwt en dit voorvoegsel noemt
  const zet = (kaart, sleutel, plek) => {
    const lijst = kaart.get(sleutel) || [];
    lijst.push(plek);
    kaart.set(sleutel, lijst);
  };
  loopMap(path.join(WORTEL, 'server'), /\.js$/, f => {
    /* MET HET COMMENTAAR PLATGESLAGEN, en dat is geen netheid maar een
       reparatie. Deze index leest brontekst met uitdrukkingen, en een
       uitdrukking ziet geen verschil tussen code en een voorbeeld in een
       commentaarblok. server/kern/handlerpoorten/buiten.js legt in proza uit dat
       een handvol routes in een lus wordt aangemaakt en citeert daarbij
       `app.post('/api/rtf/spel/' + ...)`. Daarmee claimden twee bestanden
       hetzelfde voorvoegsel, werd de claim dubbelzinnig, en verloren 42
       spelroutes hun bron -- en ze vielen daarna door naar de staartregel, die
       /api/rtf/spel/antwoord toewees aan routes/rtmail-vak.js. Een verkeerd
       toegewezen bronbestand is erger dan geen (zie de kop hierboven).

       De platgeslagen vorm van scripts/lib/bron.js houdt regelnummers EN
       tekenposities heel (elk teken een spatie, elke regelovergang blijft
       staan), dus de melding blijft naar de goede regel wijzen. Zelfde aanpak
       als scripts/schakelbaar.js, waar dezelfde les al was geleerd -- en EEN
       implementatie, niet een tweede regex hier. */
    const tekst = require('./bron').zonderCommentaar(fs.readFileSync(f, 'utf8'), { regelsHeel: true });
    const bestand = path.relative(WORTEL, f).replace(/\\/g, '/');
    const plekOp = (index, viaRouter, staart) => ({
      bestand, regel: tekst.slice(0, index).split('\n').length,
      viaRouter, rauw: (staart || '').trim().slice(0, 160)
    });
    let m;
    ROUTE_RE.lastIndex = 0;
    while ((m = ROUTE_RE.exec(tekst))) {
      const pad = m[4];
      if (!pad.startsWith('/')) continue;
      /* Gaat de string verder met `+`? Dan is dit een voorvoegsel en geen pad:
         `'/api/rtf/spel/'` hoort niet in de exacte index en niet bij de
         staarten. VOOR_RE hieronder neemt de claim op, en plekVan() vindt hem
         via de fabriek-ingang. */
      if ((m[5] || '').trim().startsWith('+')) continue;
      const plek = plekOp(m.index, m[1] === 'router', m[5]);
      const sleutel = m[2].toUpperCase() + ' ' + pad;
      if (!exact.has(sleutel)) exact.set(sleutel, plek);
      zet(perStaart, sleutel, plek);
    }
    /* De opgebouwde paden. Eerst de voorvoegsels van dit bestand ophalen; die
       lijst is meestal leeg en dan valt alles vanzelf terug op de staart. */
    const voorvoegsels = new Set();
    VOORVOEGSEL_RE.lastIndex = 0;
    let v;
    while ((v = VOORVOEGSEL_RE.exec(tekst))) voorvoegsels.add(v[2].replace(/\/$/, ''));
    SAMEN_RE.lastIndex = 0;
    while ((m = SAMEN_RE.exec(tekst))) {
      const staart = m[5];
      if (!staart.startsWith('/')) continue;
      const methode = m[2].toUpperCase();
      const plek = plekOp(m.index, m[1] === 'router', m[6]);
      plek.viaVoorvoegsel = true;
      for (const vv of voorvoegsels) zet(samengesteld, methode + ' ' + vv + staart, plek);
      zet(perStaartVoorvoegsel, methode + ' ' + staart, plek);
    }
    /* DE FABRIEK, en dat is de laatste vorm die overbleef. server/routes/verzorging.js
       schrijft EEN registratie -- `app.post(basis + pad, ...)` -- en roept die daarna
       veertig keer aan met een tail die nergens als tekst naast een app.post staat.
       Statisch is de staart daar niet te vinden; het VOORVOEGSEL wel, want dat staat
       er letterlijk (`maak('/api/supplier/beauty', ...)`). Dus keren we de vraag om:
       welk bestand claimt dit voorvoegsel, en bouwt het paden op? Staat het antwoord
       op precies EEN bestand, dan is dat het bestand -- en anders zwijgen we. */
    VOOR_RE.lastIndex = 0;
    while ((m = VOOR_RE.exec(tekst))) {
      const vv = m[4].replace(/\/+$/, '');
      if (!vv.startsWith('/api/')) continue;
      const plek = plekOp(m.index, m[1] === 'router', '');
      plek.viaVoorvoegsel = true;
      /* Twee kaarten, met opzet. De claim naast de registratie kent zijn
         METHODE en is de hardste die er is; die gaat in perVoorvoegsel en wordt
         vóór de opgebouwde staarten geraadpleegd. Dezelfde plek telt daarnaast
         als bestand dat dit voorvoegsel bouwt, voor de fabriek-ingang -- want
         een bestand dat zijn voorvoegsel naast de registratie noemt EN elders
         als losse tekst, is nog steeds een ondubbelzinnig antwoord op WAAR
         (zie enigBestand). */
      zet(perVoorvoegsel, m[2].toUpperCase() + ' ' + vv, plek);
      zet(perVoorvoegselBestand, vv, plek);
    }
    if (BOUWT_RE.test(tekst)) {
      BOUWT_RE.lastIndex = 0;
      const eerste = BOUWT_RE.exec(tekst);
      const plek = plekOp(eerste ? eerste.index : 0, /router\s*\./.test(eerste ? eerste[0] : ''), '');
      plek.viaVoorvoegsel = true;
      plek.viaFabriek = true;
      for (const vv of voorvoegsels) zet(perVoorvoegselBestand, vv, plek);
    }
  });
  _bron = { exact, perStaart, samengesteld, perStaartVoorvoegsel, perVoorvoegsel, perVoorvoegselBestand };
  return _bron;
}

/* Precies EEN kandidaat, of niets. Twee bestanden die dezelfde staart bouwen
   zeggen samen niets over welk van de twee je zoekt, en dan is stil de
   verkeerde noemen erger dan zwijgen. */
function enige(kaart, sleutel) {
  const k = kaart.get(sleutel);
  return k && k.length === 1 ? k[0] : null;
}

/* Voor de voorvoegselkaart is de vraag een ANDERE: niet "staat er precies een
   registratie" maar "wijst alles naar hetzelfde bestand". Een bestand dat zijn
   voorvoegsel twee keer claimt (een keer naast de registratie, een keer als
   losse tekst) is nog steeds een ondubbelzinnig antwoord op de vraag WAAR. Zou
   je hier op het aantal regels tellen, dan straft de kaart een bestand voor het
   feit dat het duidelijk is -- en dat kostte 42 rtf-spelroutes hun bron. */
function enigBestand(kaart, sleutel) {
  const k = kaart.get(sleutel);
  if (!k || !k.length) return null;
  const namen = new Set(k.map(x => x.bestand));
  if (namen.size !== 1) return null;
  return k.slice().sort((a, b) => a.regel - b.regel)[0];
}

function plekVan(methode, pad) {
  const { exact, perStaart, samengesteld, perStaartVoorvoegsel, perVoorvoegsel, perVoorvoegselBestand } = bronIndex();
  const heel = exact.get(methode + ' ' + pad);
  if (heel) return heel;
  const opgebouwd = enige(samengesteld, methode + ' ' + pad);
  if (opgebouwd) return opgebouwd;
  /* De staart: loop de padgrenzen af van lang naar kort, en neem de eerste
     lengte die precies EEN kandidaat heeft. Lang gaat voor kort, zodat een
     route met een eigen letterlijke registratie nooit door een kortere staart
     van iemand anders wordt ingepikt. */
  const delen = pad.split('/');
  for (let i = 1; i < delen.length; i++) {
    const staart = '/' + delen.slice(i).join('/');
    const kandidaten = perStaart.get(methode + ' ' + staart);
    if (kandidaten && kandidaten.length === 1) return kandidaten[0];
  }
  /* Het letterlijke voorvoegsel naast een registratie, van lang naar kort en
     per methode. Het LANGSTE voorvoegsel dat past beslist; wijst dat op meer
     dan een bestand, dan stopt de wandeling en valt hij niet terug op een
     korter voorvoegsel -- een kortere claim van iemand anders is geen antwoord
     op deze route. Twee claims uit HETZELFDE bestand zijn wel een antwoord
     (enigBestand), want de vraag is WAAR en niet op welke regel. */
  for (let i = delen.length; i >= 3; i--) {
    const vv = delen.slice(0, i).join('/');
    if (vv.split('/').length < 3) break;
    const kandidaten = perVoorvoegsel.get(methode + ' ' + vv);
    if (!kandidaten || !kandidaten.length) continue;
    return enigBestand(perVoorvoegsel, methode + ' ' + vv);
  }
  /* En dezelfde wandeling over de opgebouwde staarten. Pas hier, want dit is
     de onzekerste van de staartvormen: het voorvoegsel is niet gezien.

     MET EEN VERSCHIL ten opzichte van de wandeling hierboven: de LANGSTE
     opgebouwde staart die past, beslist. Is die dubbelzinnig, dan stopt de
     wandeling en valt hij NIET terug op een kortere. `/Users/:id` staat
     viermaal in de SCIM-laag; wie daar doorloopt naar `/:id` en toevallig een
     enkele registratie op die staart vindt, wijst een SCIM-route toe aan een
     bestand dat er niets mee te maken heeft -- en dat leest als een antwoord. */
  for (let i = 1; i < delen.length; i++) {
    const staart = '/' + delen.slice(i).join('/');
    const kandidaten = perStaartVoorvoegsel.get(methode + ' ' + staart);
    if (!kandidaten || !kandidaten.length) continue;
    if (kandidaten.length === 1) return kandidaten[0];
    break;
  }
  /* De fabriek, van lang voorvoegsel naar kort. Hier staat geen methode in de
     sleutel: een fabriek registreert vaak een handvol werkwoorden op hetzelfde
     voorvoegsel, en wie die uit elkaar wil houden moet de bron lezen. Wat dit
     oplevert is het BESTAND, en dat is precies wat de vraag was. */
  for (let i = delen.length; i >= 3; i--) {
    /* Begin bij het VOLLE pad en niet een segment korter. Een fabriek
       registreert vaak ook zijn eigen wortel (`b('', ...)` wordt
       `/api/supplier/beauty`), en dat pad is dan gelijk aan het voorvoegsel.
       Sloeg je die stap over, dan bleven precies de acht wortelroutes van
       server/routes/verzorging.js en zijn buren zonder bron staan. */
    const vv = delen.slice(0, i).join('/');
    if (vv.split('/').length < 3) break;
    const k = enigBestand(perVoorvoegselBestand, vv);
    if (k) return k;
  }
  return null;
}

/* De routes in EEN bronbestand, voor de deltapoort: die vergelijkt de tekst van
   voor en na een wijziging en heeft dus geen boom nodig maar een string. */
function routesInBron(tekst, bestandNaam) {
  const uit = [];
  let m;
  ROUTE_RE.lastIndex = 0;
  while ((m = ROUTE_RE.exec(tekst))) {
    const pad = m[4];
    if (!pad.startsWith('/')) continue;
    uit.push({
      methode: m[2].toUpperCase(),
      pad,
      viaRouter: m[1] === 'router',
      bestand: bestandNaam || '?',
      regel: tekst.slice(0, m.index).split('\n').length,
      rauw: (m[5] || '').trim().slice(0, 160)
    });
  }
  return uit;
}

function alleRoutes() {
  const kaart = routekaart();
  const uit = [];
  for (const r of kaart.routes) {
    for (const methode of (r.methoden || [])) {
      const bew = r.bewakers ? r.bewakers[methode] : null;
      const plek = plekVan(methode, r.pad);
      uit.push({
        methode,
        pad: r.pad,
        bewakers: Array.isArray(bew) ? bew : [],
        // onbekend is geen leeg lijstje: zie de kop
        bewakersBekend: Array.isArray(bew),
        viaRouter: plek ? plek.viaRouter : null,
        bestand: plek ? plek.bestand : null,
        regel: plek ? plek.regel : null,
        /* de plek is de REGISTRATIE (een lus, een fabriek), niet de handler:
           elke ingang die het pad uit een voorvoegsel opbouwt zet `viaVoorvoegsel`
           op de plek, en dat is precies wat "samengesteld" hier betekent */
        samengesteld: plek ? !!plek.viaVoorvoegsel : false,
        rauw: plek ? plek.rauw : ''
      });
    }
  }
  return uit.sort((a, b) => a.pad === b.pad ? a.methode.localeCompare(b.methode) : a.pad.localeCompare(b.pad));
}

/* ---- DE ROL VAN EEN ROUTE, en wat er gebeurt als die niet te bepalen is ----

   Deze functie stond WOORDELIJK VIER KEER: in rolproef-route.js,
   idemproef-route.js, invoerproef-route.js en staatproef-route.js. Vier kopieen
   van "welke rol hoort bij deze route" lopen uiteen zodra er een bewaker bij komt,
   en dan meten vier proeven verschillende verzamelingen zonder dat iets klaagt
   (LAT.md regel 4).

   Hij geeft null als hij het niet weet, en dat is met opzet: met de JUISTE rol
   aankloppen bewijst niets over scheiding, dus gokken is erger dan niet meten.
   Maar het STIL overslaan was de andere fout -- alle vier de proeven deden
   `.filter(r => r.rol)` en daarmee verdwenen 937 routes uit het zicht zonder dat
   er ergens een getal omhoog ging. Een meter zonder invoer hoort te zakken, niet
   te zwijgen (LAT.md regel 3). Daarom hoort bij null altijd een REDEN, en
   verdeelOpRol() hieronder geeft die redenen geteld terug zodat elke proef ze in
   zijn register kan zetten.

   HIJ BESLIST HIER NIET MEER ZELF. De regexjes die hier stonden kenden drie
   namen en zetten 359 routes weg onder "bewaker zonder bekende rol". Die zin
   belooft het verkeerde -- hij leest als "er ontbreekt een token" -- terwijl er
   in werkelijkheid VIJF groepen achter zaten die om vijf verschillende
   reparaties vragen. Bij één ervan (138 routes) was er niets te repareren: die
   waren al te kruisen en werden alleen niet herkend. Bij de andere vier is
   rollen kruisen simpelweg de verkeerde vraag, en ze toch kruisen zou groen
   opleveren dat niets bewijst. Welke soort een deur is, staat nu uitputtend in
   scripts/lib/bewakers.js en wordt daar bewaakt door een toets. Hier alleen nog
   de doorgeefluiken, want vier proeven en twee toetsen roepen deze namen aan. */
function rolVan(bewakers, route) {
  /* HET PAD GAAT MEE, EN DAT WAS EERST NIET ZO. De bewakerskaart kent sinds de
     openbaar-tak een oordeel dat van het PAD afhangt: een route zonder bewaker
     die met een reden op de openbaar-lijst staat, hoort zonder sleutel open te
     gaan en is dus wel degelijk te beproeven. Zolang hier alleen `bewakers`
     binnenkwam, werd die tak nooit bereikt en bleven 45 openbare routes als
     instrumenttekort tellen -- een tak die stil nooit afgaat, is geen tak.

     `route` is optioneel: vier proeven roepen deze functie nog met alleen de
     bewakerslijst aan, en die krijgen het oude antwoord. Dat is geen gat maar
     een kleinere vraag; wie het pad niet meegeeft, kan er ook geen oordeel over
     krijgen. */
  const r = route || {};
  return bewakerskaart.beoordeel({ bewakersBekend: true, bewakers: bewakers || [],
    pad: r.pad, methode: r.methode }).rol;
}

/* De reden waarom een rol niet te bepalen valt. Zie bewakers.js: de reden bepaalt
   de reparatie, en "ongemeten" op een hoop is precies hoe 1257 routes jarenlang
   onzichtbaar bleven. */
function redenZonderRol(r) {
  return bewakerskaart.beoordeel(r).reden ||
    'geen reden -- deze route heeft wel degelijk een rol (' + rolVan(r.bewakers, r) + ')';
}

/* Splitst een routelijst in wat beproefbaar is en wat niet, met de redenen
   geteld. De proeven printen dat en zetten het in hun uitslagbestand; zo staat er
   naast "2934 beproefd" altijd "en 937 niet, en hierom". */
function verdeelOpRol(routes, beschikbareRollen) {
  const metRol = [];
  const zonderRol = [];
  const redenen = new Map();
  /* WELKE ROLLEN HEEFT DIT INSTRUMENT WERKELIJK EEN TOKEN VOOR?

     Zonder deze grens ging het mis, en stil. Sinds de bewakerskaart ook
     EIGENROLLEN kent (boardroom, techniek, scim, werkplekbaas) kwamen 123 routes
     als "met rol" uit deze functie -- terwijl de proeven alleen een token hebben
     voor member, office en supplier. tokenVoor('boardroom') gaf undefined, de
     route werd zonder token aangeroepen, kreeg 401, en dat telde als "geweigerd
     en er bleef niets staan": ROLLBACK bewezen. Natuurlijk bleef er niets staan
     -- er was geen sleutel. Een meting zonder invoer die toch een cijfer geeft
     (LAT.md regel 3).

     Wie geen lijst meegeeft krijgt het oude gedrag, want twee van de vier
     proeven kruisen rollen en hebben deze grens niet nodig: daar is een rol
     waarvoor je GEEN token hebt geen probleem maar juist het geval dat je wilt
     beproeven. */
  const beschikbaar = Array.isArray(beschikbareRollen) ? new Set(beschikbareRollen) : null;
  for (const r of routes) {
    const rol = rolVan(r.bewakers, r);
    if (rol && (!beschikbaar || beschikbaar.has(rol))) {
      /* `methode` EN NIET `method`. Hier stond de enige plek in dit huis waar een
         route halverwege de pijplijn van veldnaam wisselde: alleRoutes() geeft
         `methode`, verdeelOpRol() gaf `method`, en vijf instrumenten vertaalden
         hem bij het wegschrijven weer terug. Een nieuw instrument dat r.methode
         las kreeg `undefined` in zijn register, en dat viel pas op omdat de
         sleutels "undefined /api/bank/advies" gingen heten (LAT.md regel 4). */
      metRol.push({ methode: r.methode, pad: r.pad, rol });
      continue;
    }
    if (rol) {
      const reden = 'rol "' + rol + '", maar dit instrument heeft daar geen token voor; ' +
        'zonder sleutel aankloppen meet niets over deze route';
      zonderRol.push({ methode: r.methode, pad: r.pad, reden });
      redenen.set(reden, (redenen.get(reden) || 0) + 1);
      continue;
    }
    const reden = redenZonderRol(r);
    zonderRol.push({ methode: r.methode, pad: r.pad, reden });
    redenen.set(reden, (redenen.get(reden) || 0) + 1);
  }
  return { metRol, zonderRol,
    redenen: [...redenen].sort((a, b) => b[1] - a[1]).map(([reden, aantal]) => ({ reden, aantal })) };
}

/* Wat elke proef op het scherm zet over de routes zonder rol.

   Een plek, zodat de proeven het niet elk anders formuleren -- maar WEL met een
   eigen kop, want ze doen er niet hetzelfde mee. Voor de rol-, invoer- en
   staatproef is 'geen rol' het einde van de meting (er valt niets te kruisen).
   De idemproef roept ze alsnog aan, met een lege kop, en dan zou 'niet
   beproefbaar' een leugen op het scherm zijn. */
function meldZonderRol(verdeling, kop) {
  if (!verdeling.zonderRol.length) return;
  console.log('  ' + (kop || 'niet beproefbaar (geen rol te bepalen)') + ' : ' + verdeling.zonderRol.length);
  for (const { reden, aantal } of verdeling.redenen) {
    console.log('     ' + String(aantal).padStart(4) + '  ' + reden);
  }
}

/* DE GROTE HENDEL -- WAAR EEN PROEF NOOIT AAN MAG KOMEN.

   De platformbrede schakelkast zet functies aan en uit voor de HELE server. Een
   proef die daar rommel heen stuurt, zet onderweg iets uit en meet daarna een
   platform dat hij zelf half heeft afgebroken -- elke bevinding erna is dan een
   gevolg van de proef en niet van de code.

   Deze lijst stond in scripts/beproeving.js en had de invoerproef net zo hard
   nodig. Twee kopieen van "wat mag je niet omzetten" lopen uiteen, en de eerste
   die achterloopt vergiftigt stil een hele ronde (LAT.md, regel 4).

   ------------------------------------------------------------------------
   WAT ER MIS WAS, EN WAAROM HET NIET OPVIEL

   De lijst noemde zes paden, en alle zes gingen over de BOARDROOM-deur naar de
   schakelkast. De techniek-deur naar diezelfde kast (/api/techniek/functie,
   /api/techniek/zekering) stond er niet op. Dat viel niet op omdat geen enkele
   proef een sleutel had voor die deuren: alles achter boardroomAuth en
   techAuth was onbereikbaar, dus onschadelijk.

   Die sleutel is er nu wel (scripts/lib/proefsleutels.js geeft de proeven de
   eigenaarssessie, zodat 156 routes eindelijk beproefbaar worden), en daarmee
   werd de onvolledigheid van deze lijst opeens gevaarlijk. Vandaar de volgorde
   waarin dat is gebeurd: eerst deze lijst afmaken, dan pas de sleutel uitdelen.

   ELK PAD DRAAGT NU EEN REDEN. Een verbodslijst zonder redenen wordt bij de
   eerste die hem in de weg vindt zitten ingekort, want dan lijkt elk item
   willekeurig. De vier soorten:

     schakelkast   zet functies uit voor het hele platform
     onomkeerbaar  wist, vernietigt of veegt iets weg
     gezag         verlegt wie er ergens bij mag
     stand         verandert een juridische of operationele stand van het huis

   DE BANK-STAND IS DE SCHERPSTE. /api/office/bank/terugstorting is volgens
   CLAUDE.md niet zomaar een schakelaar: die stand IS de juridische positie van
   RTG (gesloten circuit tegenover uitgever van elektronisch geld). Een proef
   die hem omzet, verandert waar dit huis vergunningplichtig is. */
const NIET_AANRAKEN = [
  // -- de schakelkast, langs alle drie zijn deuren --
  { pad: '/api/office/boardroom/alles', soort: 'schakelkast', waarom: 'zet in een keer alles om' },
  { pad: '/api/office/boardroom/fase', soort: 'schakelkast', waarom: 'verschuift de uitrolfase van het hele platform' },
  { pad: '/api/office/boardroom/functie', soort: 'schakelkast', waarom: 'zet een functie uit voor iedereen' },
  { pad: '/api/office/boardroom/functie/zet', soort: 'schakelkast', waarom: 'idem, fijnmazig' },
  { pad: '/api/office/boardroom/schakel', soort: 'schakelkast', waarom: 'dezelfde kast, andere deur -- stond hier niet op' },
  { pad: '/api/office/boardroom/schakel-fijn', soort: 'schakelkast', waarom: 'idem, per pas of land' },
  { pad: '/api/techniek/functie', soort: 'schakelkast', waarom: 'de techniek-deur naar dezelfde kast -- stond hier niet op' },
  { pad: '/api/techniek/zekering', soort: 'schakelkast', waarom: 'de zekeringen van het platform' },
  { pad: '/api/office/leveranciers', soort: 'schakelkast', waarom: 'zet partners in en uit bedrijf' },
  { pad: '/api/office/geld', soort: 'schakelkast', waarom: 'de geldkant van het hele huis' },

  // -- onomkeerbaar --
  { pad: '/api/techniek/bewaren/veeg', soort: 'onomkeerbaar', waarom: 'de bewaarveger; hij wist wat over de termijn is' },
  { pad: '/api/techniek/tenant/vernietig', soort: 'onomkeerbaar', waarom: 'vernietigt de omgeving van een klant' },
  { pad: '/api/techniek/fouten/wis', soort: 'onomkeerbaar', waarom: 'wist het foutenlogboek waarop de proef zelf leunt' },
  { pad: '/api/boardroom/reset', soort: 'onomkeerbaar', waarom: 'zet de boardroom terug naar begin' },
  /* DE PROEF WIST HAAR EIGEN LID, en dat is bij toeval gevonden.

     /api/privacy/delete is het recht op vergetelheid: `wisLid(req.session)`
     haalt alles weg -- reizen, facturen, kluis, mediastore -- en zet de sessie
     op de sleutel `gewist`. Volstrekt juist gedrag, en precies daarom mag de
     proef er niet aankloppen: hij staat op plek 1600 van de 3091 beproefde
     routes, dus de ~1491 ledenroutes DAARNA werden gemeten op een leeggehaald
     lid. Ze gaven netjes antwoord (de proef logt na een 401 opnieuw in), dus
     er ging geen enkele lamp branten -- ze maten alleen iets anders dan
     iedereen dacht.

     Gevonden doordat de wereldcontrole meldde dat het spelpotje weg was. Dat
     was de derde verklaring die ik probeerde: eerst leek /api/member/spel/
     opgeven het (dat was het ook, voor een deel), toen /api/logout (dat gaf
     dezelfde foutzin maar herstelt vanzelf), en pas een sweep over alle 3091
     routes wees deze aan -- als de enige waarna het potje NIET meer terugkwam.

     Dit is de vorm die deze lijst bedoelt: geen deur die te gevaarlijk is voor
     de wereld, maar een die de PROEF zelf onbruikbaar maakt. */
  { pad: '/api/privacy/delete', soort: 'onomkeerbaar',
    waarom: 'wist het lid waarmee de proef zelf meet; alles erna meet een leeg account' },

  // -- gezag --
  { pad: '/api/office/boardroom/toegang', soort: 'gezag', waarom: 'wie er in de kamer van de eigenaar mag' },
  { pad: '/api/techniek/toegang', soort: 'gezag', waarom: 'wie de technische pagina mag openen' },
  { pad: '/api/techniek/eigenaar', soort: 'gezag', waarom: 'wie de eigenaar IS' },
  { pad: '/api/techniek/sso/schakel', soort: 'gezag', waarom: 'zet de inlogfederatie van een klant om' },

  // -- stand --
  { pad: '/api/office/bank/terugstorting', soort: 'stand',
    waarom: 'deze stand IS de juridische positie van RTG (CLAUDE.md, de terugstortstand); omzetten verandert de vergunningplicht' },
  { pad: '/api/techniek/wacht/lastafworp', soort: 'stand', waarom: 'werpt last af: de server gaat bewust minder doen' },
  { pad: '/api/office/techniek/lastafworp', soort: 'stand', waarom: 'dezelfde hendel, andere deur' },
  { pad: '/api/techniek/wacht/quarantaine', soort: 'stand', waarom: 'zet verkeer in quarantaine' },
  { pad: '/api/techniek/moderniseer', soort: 'stand', waarom: 'draait een migratie over de echte gegevens' }
];

/* De platte lijst blijft bestaan: zes instrumenten lezen hem als tekenreeksen.
   Hij wordt AFGELEID en niet apart bijgehouden -- dat is precies de dubbeling
   die deze module bestaat om te voorkomen. */
const SCHAKELPADEN = NIET_AANRAKEN.map(x => x.pad);

/* Waarom mag een proef hier niet aan komen? Voor de uitslagbestanden: een route
   die wordt overgeslagen zonder reden is niet te onderscheiden van een route die
   iemand vergeten is. */
const waaromNietAanraken = (pad) => {
  const t = NIET_AANRAKEN.find(x => String(pad || '').startsWith(x.pad));
  return t ? t.soort + ': ' + t.waarom : null;
};

const isSchakel = (pad) => SCHAKELPADEN.some(p => String(pad || '').startsWith(p));
/* `enigBestand` gaat mee naar buiten, en niet uit gemak: hij DRAAGT de regel die
   de bronverrijking eerlijk houdt -- bij twee bestanden die dezelfde claim doen,
   zwijgen in plaats van de eerste noemen. Dat is precies de faalvorm die je aan
   de uitkomst niet ziet: allebei de bestanden bevatten het voorvoegsel, dus geen
   enkele controle op de TEKST kan zien dat de verkeerde is gekozen. Wie die regel
   wil bewaken, moet hem los kunnen aanroepen (test/routesbron.test.js). */
module.exports = { alleRoutes, routesInBron, WORTEL, loopMap, SCHAKELPADEN, NIET_AANRAKEN, waaromNietAanraken, isSchakel,
  rolVan, redenZonderRol, verdeelOpRol, meldZonderRol, bewakerskaart, enigBestand };
