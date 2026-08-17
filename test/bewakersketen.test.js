/* DE BEWAKERSKETEN: elke deur van een domein draagt het slot van dat domein.

   Draai los: node --experimental-sqlite --test test/bewakersketen.test.js

   WAT DIT BEWAAKT, EN WAAROM HET PAS SINDS VANDAAG KAN

   Een route is in deze router een LAAG PER MIDDLEWARE (server/web/routing.js);
   de laatste is de handler, alles daarvoor is een bewaker. Tot voor kort waren
   die lagen naamloos -- de foutwikkel omhulde elke functie in een anonieme arrow
   en gooide `fn.name` weg -- en dus was uit de router niet te lezen WELKE bewaker
   voor een route hangt. Wie het wilde weten, raadde het uit de brontekst met een
   regex, en die ziet niet wat achter een mount of een voorvoegsel-hulpje hangt.

   Sinds server/lib/foutisolatie.js de naam doorgeeft, staat de hele keten er per
   route. Daarmee is een vraag beantwoordbaar die niemand kon stellen: draagt
   ELKE route van een domein ook echt het slot van dat domein?

   HET ANTWOORD, GEMETEN OP 17 AUGUSTUS 2026: 1833 routes over zes domeinen, met
   elf uitzonderingen die allemaal een naam en een reden hebben. Dat is de vorm
   van een bruikbare invariant -- bijna altijd waar, weinig uitzonderingen,
   allemaal te benoemen. De twaalfde is een bevinding.

   WAT DIT NIET IS. Geen bewijs dat een route veilig is: een bewaker die er staat
   kan verkeerd staan, en of hij ook werkelijk weigert is de rolproef
   (ROLPROEF.json). Dit is de laag eronder -- is het slot er uberhaupt. Precies
   het soort vraag waarop "dat zal wel" jarenlang het antwoord was.

   EN WAT ER BEWUST NIET IN STAAT. /api/rtf/ (206 routes, 18% draagt rtfPoort of
   auth) en /api/gast/ (30 routes, 53% draagt gastAuth) zijn GEEN invariant: daar
   hangt de bewaking op een andere manier. Een regel met tweehonderd
   uitzonderingen is geen regel, en hem toch opschrijven zou de lijst tot ruis
   maken. Dat die twee domeinen anders werken is informatie, geen verzuim -- en
   het is meteen de plek waar de volgende ronde begint.

   MUTATIES (LAT.md regel 2), alle drie gedaan, alle drie zag ik de JUISTE toets
   zakken:
     - officeAuth weghalen bij een office-route          -> toets 1 zakt met die route bij naam
     - een uitzondering uit de lijst halen               -> toets 1 zakt op die ene
     - een uitzondering laten staan die zijn bewaker WEL heeft -> toets 2 zakt
*/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync } = require('child_process');
const routedekking = require('../server/kern/routedekking');

const WORTEL = path.join(__dirname, '..');

/* De zes invarianten. Per domein het slot dat erop hoort te zitten; meerdere
   namen betekent "een van deze volstaat" (de boardroom is een zwaardere office,
   en een staff-route mag ook door de zaak zelf bewaakt worden). */
const INVARIANTEN = [
  { voorvoegsel: '/api/office/', bewakers: ['officeAuth', 'boardroomAuth'],
    wat: 'het kantoor' },
  { voorvoegsel: '/api/supplier/', bewakers: ['supplierAuth'],
    wat: 'de zaak' },
  { voorvoegsel: '/api/techniek/', bewakers: ['techAuth'],
    wat: 'het techniekbord' },
  { voorvoegsel: '/api/staff/', bewakers: ['staffAuth', 'supplierAuth'],
    wat: 'het personeel' },
  { voorvoegsel: '/api/member/', bewakers: ['auth'],
    wat: 'het lid' },
  { voorvoegsel: '/api/scim/', bewakers: ['scimAuth'],
    wat: 'de IdP van een klant' }
];

/* DE UITZONDERINGEN, elk met een NAGETROKKEN reden. Deze lijst MAG ALLEEN
   KRIMPEN -- zelfde afspraak als de schuldlijst in BEREIK.json. Een reden als
   "historisch zo gegroeid" hoort er niet in te staan; wie er een toevoegt zonder
   te weten waarom, schrijft de volgende blinde vlek op. */
const UITZONDERINGEN = new Map([
  ['POST /api/office/login',
    'de inlog zelf: deze route MAAKT de kantoorsessie, dus kan hij hem niet eisen. ' +
    'Begrensd met de gedeelde snelheidsrem op mislukte pogingen'],
  ['GET /api/office/doc',
    'querytoken: een downloadlink draagt geen Authorization-kop. De handler doet ' +
    'officeQueryMag(req.query.token) en geeft anders 401 (routes/office/werk.js)'],
  ['GET /api/office/stream',
    'querytoken: EventSource kan geen Authorization-kop meesturen. Zelfde ' +
    'officeQueryMag-controle in de handler (routes/office/toegang.js)'],
  ['POST /api/supplier/login',
    'de inlog zelf: deze route MAAKT de zaak-sessie, dus kan hij hem niet eisen'],
  ['POST /api/supplier/mijn/login',
    'de personeelsinlog op een gedeeld apparaat (naam plus pincode); ook deze route ' +
    'maakt de sessie die hij anders zou moeten eisen'],
  ['GET /api/supplier/stream',
    'EventSource kan geen Authorization-kop meesturen; zelfde querytoken-vorm als de ' +
    'office-stream hierboven'],
  ['POST /api/supplier/apply',
    'solliciteren bij een zaak kan per definitie niet achter de inlog van die ' +
    'zaak (routes/supplier/werving/sollicitaties.js)'],
  ['POST /api/supplier/staff/join',
    'een nieuwe medewerker meldt zich met bedrijfsnaam plus kassacode; hij HEEFT ' +
    'de zaak-inlog nog niet. Begrensd met tooManyTries op het IP-adres ' +
    '(routes/supplier/werving/personeel.js)'],
  ['POST /api/supplier/roster',
    'het "wie ben jij"-scherm voor de personeelsinlog: op kassacode de namenlijst. ' +
    'Geen bewakerslaag maar wel een eigen snelheidsrem (rosterMag op het IP) in ' +
    'de handler (routes/supplier/toegang.js)'],
  ['POST /api/supplier/menu/get',
    'de menukaart wordt door een LID gelezen om te bestellen, niet door de zaak. ' +
    'Draagt daarom auth en niet supplierAuth -- een route in de zaak-ruimte die ' +
    'aan de gastenkant hoort (routes/supplier/menukaart.js)'],
  ['POST /api/techniek/inloggen',
    'de inlog zelf: deze route maakt de techniekbord-sessie. Alleen de eigenaar komt ' +
    'erdoorheen, en dat wordt in de handler tegen het eigenaarsaccount gecontroleerd']
]);

let _routes = null;
function routes() {
  if (_routes) return _routes;
  /* Aan de LEVENDE router vragen, want dat is de hele reden dat deze toets kan
     bestaan. Een broncode-scan ziet de helft van de bewakers niet. */
  const kaart = JSON.parse(execFileSync(process.execPath,
    ['--experimental-sqlite', path.join(WORTEL, 'scripts', 'routekaart.js'), '--json'],
    { cwd: WORTEL, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, PORT: '', RTG_DATA_DIR: '' } }));
  _routes = routedekking.inventaris(kaart.routes).routes;
  assert.ok(_routes.length > 1000, 'de routekaart geeft routes (' + _routes.length + ')');
  return _routes;
}

const sleutel = (r) => r.methode + ' ' + r.pad;
const draagt = (r, namen) => (r.bewakers || []).some(b => namen.includes(b));

test('elke route van een domein draagt het slot van dat domein', () => {
  const alle = routes();
  const kaal = [];
  let gedekt = 0;

  for (const inv of INVARIANTEN) {
    const groep = alle.filter(r => r.pad.startsWith(inv.voorvoegsel));
    /* EEN INVARIANT OVER NUL ROUTES BEWIJST NIETS. Zou een voorvoegsel ooit
       verdwijnen (een domein hernoemd), dan loopt de lus nul keer en blijft deze
       toets groen over een regel die niets meer bewaakt (LAT.md regel 9). */
    assert.ok(groep.length >= 5,
      inv.voorvoegsel + ' levert maar ' + groep.length + ' routes op; ' +
      'is het domein hernoemd? Dan bewaakt deze invariant niets meer.');
    gedekt += groep.length;

    for (const r of groep) {
      if (draagt(r, inv.bewakers)) continue;
      if (UITZONDERINGEN.has(sleutel(r))) continue;
      kaal.push(sleutel(r) + '  [' + (r.bewakers || []).join(', ') + ']  ' +
        'hoort ' + inv.bewakers.join(' of ') + ' te dragen (' + inv.wat + ')');
    }
  }

  /* De bewering staat op de LIJST en niet op een lus erover: een lege lus
     controleert niets. */
  assert.deepEqual(kaal, [],
    kaal.length + ' route(s) in een afgeschermd domein dragen het slot van dat domein niet:\n  ' +
    kaal.join('\n  ') +
    '\n\nZet de bewaker ervoor, of -- als er een echte reden is dat hij daar niet kan staan -- ' +
    'zet de route in UITZONDERINGEN met die reden erbij. Een reden die je niet kunt opschrijven, ' +
    'is geen reden.');

  assert.ok(gedekt > 1500,
    'de invarianten dekken samen ' + gedekt + ' routes; dat hoort er ruim duizend te zijn');
});

test('de uitzonderingenlijst krimpt: geen naam blijft staan die het niet meer nodig heeft', () => {
  const alle = routes();
  const perSleutel = new Map(alle.map(r => [sleutel(r), r]));
  const overbodig = [];
  const verdwenen = [];

  for (const [s, reden] of UITZONDERINGEN) {
    const r = perSleutel.get(s);
    if (!r) { verdwenen.push(s); continue; }
    const inv = INVARIANTEN.find(i => r.pad.startsWith(i.voorvoegsel));
    if (!inv) { verdwenen.push(s + ' (valt onder geen enkele invariant meer)'); continue; }
    if (draagt(r, inv.bewakers)) overbodig.push(s + ' draagt inmiddels ' + inv.bewakers.join('/'));
    assert.ok(reden && reden.length > 20, s + ' heeft geen echte reden opgeschreven');
  }

  assert.deepEqual(overbodig, [],
    'deze uitzonderingen zijn niet meer nodig; haal ze uit UITZONDERINGEN:\n  ' + overbodig.join('\n  '));
  assert.deepEqual(verdwenen, [],
    'deze routes bestaan niet meer; haal ze uit UITZONDERINGEN:\n  ' + verdwenen.join('\n  '));

  /* En de lijst zelf mag niet ongemerkt groeien. Elf is de gemeten stand; een
     twaalfde hoort een bewuste handeling te zijn die in de historie staat. */
  assert.ok(UITZONDERINGEN.size <= 11,
    UITZONDERINGEN.size + ' uitzonderingen terwijl er 11 zijn vastgelegd. Een uitzondering ' +
    'erbij is een besluit: pas dit getal aan in dezelfde commit, zodat het opvalt.');
});
