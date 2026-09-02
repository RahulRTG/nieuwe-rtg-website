#!/usr/bin/env node
/* ============================================================================
   DE WACHT IN DE HANDLER -- wie bewaakt de 612 routes zonder bewakerslaag?

   HET GAT. De router kent per route zijn bewakers, en vier bewijsproeven leunen
   daarop. Voor 612 schrijfroutes is die lijst LEEG: hun autorisatie zit in de
   handler zelf. Dat is geen fout -- een gezinscode plus profieltoken staan in
   het LICHAAM van het verzoek en niet in de kop, en dan kan een middleware er
   niets mee zonder eerst het lijf te lezen. Maar het gevolg is wel dat geen
   enkele statische controle iets over die 612 kan zeggen, en dat de proeven ze
   overslaan met "geen bewakerslaag".

   612 routes waarover niets te zeggen valt, is precies de vorm waarin
   "ongemeten" na verloop van tijd als groen leest.

   WAT DIT SCRIPT DOET, EN VOORAL WAT NIET. Hij leest per route de HANDLER en
   kijkt of daarin een bekende gezagsfunctie wordt aangeroepen VOORDAT er een
   antwoord vertrekt. Dat is geen bewijs dat de controle deugt -- een functie kan
   het verkeerde toetsen, en dit script leest geen betekenis. Het is de vraag
   ervoor: staat er uberhaupt iets, en zo nee, welke routes zijn dat.

   DRIE UITKOMSTEN, en de derde is de reden dat dit bestaat:

     bewaakt      de handler roept een gezagsfunctie aan voor het eerste antwoord
     laat         hij roept er wel een aan, maar pas NA een antwoord -- dan is er
                  een pad waarlangs iets terugkomt zonder controle
     eigenControle de handler roept geen gezagsfunctie aan maar kan zelf weigeren
                  (401/403). De inlogdeuren zijn dit: zij ZIJN de gezagsvraag.
                  Dat er een weigerpad is, zegt niet dat de voorwaarde deugt --
                  zie de kop bij WEIGERT.
     sleutelDoorgegeven de handler toetst zelf niets maar geeft een geloofsbrief
                  uit het lijf (een token, een code, een pin) door aan een
                  domeinfunctie. Deze meter volgt hem daar NIET naartoe: dat de
                  route een geloofsbrief vraagt, is minder dan bewaakt en meer
                  dan niets.
     openbaar     hij staat met een REDEN op de publieke lijst (lib/publiek.js).
                  Een inlogdeur hoort geen gezagsfunctie te hebben: daar kan per
                  definitie nog geen sessie zijn. Zonder deze uitkomst zou de
                  meter 92 bewuste keuzes als gat melden, en dan wordt hij
                  weggeklikt -- precies wat er met de eerste versie gebeurde.
     onbewaakt    geen enkele bekende gezagsfunctie in de handler, en niet
                  openbaar verklaard. DIT is waar de meter voor bestaat.

   EN EEN VIERDE DIE GEEN UITKOMST IS: `nietGelezen`. Sommige routes worden in
   een lus of via een hulpje geregistreerd; dan staat er op die regel geen
   leesbare handler. Die tellen NIET als bewaakt en niet als onbewaakt -- ze
   staan apart, met de reden. Een meter die zijn eigen blinde vlek onder een van
   de twee schuift, meet zichzelf mooi.

   DE GEZAGSFUNCTIES STAAN IN EEN REGISTER met per functie waar hij woont en wat
   hij vaststelt, en de zelfijking controleert dat elke genoemde functie ook
   echt bestaat. Een register dat namen noemt die nergens staan, keurt alles
   goed wat erop lijkt.

   Draai: node scripts/handlerwacht.js            (leesbaar)
          node scripts/handlerwacht.js --json
          npm run handlerwacht:vast               (schrijft HANDLERWACHT.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'HANDLERWACHT.json');

const { alleRoutes } = require('./lib/routes');
const { stempel } = require('./lib/stempel');
/* Wat er met REDEN openbaar is. Uit ./lib/publiek.js, dezelfde lijst die
   keuringsregel 28 gebruikt -- een tweede lijst van wat open mag zijn loopt
   uiteen, en de losse van de twee wordt de ruimere (LAT.md regel 4). */
const { PUBLIEK } = require('./lib/publiek');

/* HET REGISTER VAN GEZAGSFUNCTIES. Per functie: waar hij woont en wat hij
   vaststelt. De reden is geen versiering -- zonder die zin is over een half
   jaar niet te beoordelen of een nieuwe functie hier hoort, en dan groeit deze
   lijst tot hij alles goedkeurt.

   WAT HIER NIET IN HOORT: een functie die alleen iets OPZOEKT. `lesVan()` staat
   er wel in omdat hij de les uit het lijf haalt EN de toegang tot die les
   toetst; een pure opzoeker zonder toets zou een route bewaakt laten lijken
   terwijl er niets wordt gecontroleerd. */
const GEZAG = [
  /* De vorm telt mee, en dat is geen netheid. Namen als `poort`, `sessie` en
     `profiel` zijn in dit huis te algemeen om blind op te matchen: er is ook een
     `poort(req, res, next)` die middleware is en een `profiel` dat een
     gegevensobject heet. Vandaar `argReq`: alleen een aanroep die begint met
     `req` telt als wacht. Zonder die eis keurt deze meter een handler goed
     omdat er toevallig een woord in staat. */
  { naam: 'rtf.verifieerProfiel', argReq: false, waar: 'server/kern/rtf.js',
    stelt: 'gezinscode plus profieltoken uit het lijf: dit is dit profiel van dit gezin' },
  { naam: 'verifieerProfiel', argReq: false, waar: 'server/kern/rtf.js',
    stelt: 'zelfde functie, aangeroepen zonder de rtf-prefix' },
  { naam: 'werkPoort', argReq: false, waar: 'server/bedrijf/',
    stelt: 'de werkruimtesleutel: dit lid hoort bij deze werkruimte en mag deze handeling' },
  { naam: 'profielVan', argReq: false, waar: 'server/foundation.js',
    stelt: 'het profiel binnen het gezin, aan de hand van het token uit het verzoek' },

  /* De (req, res)-familie: ze halen de sessie uit het LIJF, antwoorden zelf met
     403 als het niet klopt, en geven null terug. Vandaar het vaste patroon
     `const x = f(req, res); if (!x) return;` in de handlers hieronder. */
  { naam: 'gezinVan', argReq: true, waar: 'server/foundation.js',
    stelt: 'het gezin achter de code in het lijf' },
  { naam: 'sessieVan', argReq: true, waar: 'server/foundation.js',
    stelt: 'gezin plus profiel: de foundation-sessie uit het lijf' },
  { naam: 'familieVan', argReq: true, waar: 'server/foundation.js',
    stelt: 'zelfde sessie, maar een gast (oppas, opa, familie) wordt geweigerd -- voor privezaken van het gezin' },
  { naam: 'sessie', argReq: true, waar: 'server/foundation/leden-mail.js',
    stelt: 'sessieVan plus de eis dat het geen gast is; lokale naam in de mailmodule' },
  { naam: 'lesVan', argReq: true, waar: 'server/foundation/onderwijs/',
    stelt: 'de les uit het lijf EN of deze sessie er toegang toe heeft' },
  { naam: 'docentCheck', argReq: false, waar: 'server/foundation/onderwijs/',
    stelt: 'of de aanroeper de docent van deze les is' },
  { naam: 'adultCheck', argReq: false, waar: 'server/foundation/',
    stelt: 'of er een volwassene achter deze sessie zit' },
  { naam: 'rtfSociaal', argReq: true, waar: 'server/routes/social.js',
    stelt: 'het gezinsprofiel, met gasten geweigerd -- de sociale kant van de RTFoundation' },
  { naam: 'profiel', argReq: true, waar: 'server/routes/rtfschool.js, server/routes/geloofbieb.js',
    stelt: 'het gezinsprofiel uit code plus token; lokale naam in twee routebestanden' },
  { naam: 'samenSess', argReq: true, waar: 'server/routes/rtfschool.js',
    stelt: 'de sessie voor het samen-deel van RTF School' },

  /* De schoolkant: hier is de sleutel een schooltoken, een personeelstoken of
     een klastoken, en de poort weegt welke van de drie genoeg is. */
  { naam: 'poort', argReq: true, waar: 'server/school/rollen.js',
    stelt: 'school plus personeelstoken of directietoken, met het gevraagde RECHT erbij' },
  { naam: 'klasVan', argReq: true, waar: 'server/school/poorten.js',
    stelt: 'de klas uit het lijf en of dit token er de leraar, een teamlid of de waarnemer van is' },
  { naam: 'personeelVan', argReq: true, waar: 'server/school/poorten.js',
    stelt: 'het schoolpersoneelslid achter het token' },
  { naam: 'gezinSessie', argReq: true, waar: 'server/school/poorten.js',
    stelt: 'de gezinssessie zoals de schoolkant hem kent' },
  { naam: 'schoolVan', argReq: true, waar: 'server/school/',
    stelt: 'de school uit het lijf met de toets of deze sessie erbij hoort' },
  { naam: 'personeelToegang', argReq: false, waar: 'server/school/personeelstoegang.js',
    stelt: 'de toegang van een schoolmedewerker' },

  /* De sessie uit de kop, gelezen door de handler zelf. Deze twee zijn geen
     middleware maar doen wel exact dat: het token uit de Authorization-kop
     omzetten in een sessie, en null geven als die er niet is. */
  { naam: 'doosSleutelOk', argReq: true, waar: 'server/routes/doos.js',
    stelt: 'de gedeelde sleutel van een zaakdoos: dit verzoek komt van de doos zelf' },
  { naam: 'wieScant', argReq: true, waar: 'server/kern/link/wie.js',
    stelt: 'wie er scant: de sessie achter het token in de kop, of niets' },
  { naam: 'appSessie', argReq: true, waar: 'server/kern/link/wie.js',
    stelt: 'dezelfde functie onder de naam die routes/code.js hem geeft' },

  /* De zakelijke kant. */
  { naam: 'lidVan', argReq: true, waar: 'server/bedrijf/',
    stelt: 'het lid van de werkruimte achter de sleutel in het lijf' },
  { naam: 'viaBeheerOfDirectie', argReq: true, waar: 'server/routes/tenant/poort.js',
    stelt: 'of dit verzoek van het beheer of de directie van de werkruimte komt' },
  { naam: 'beheerVan', argReq: false, waar: 'server/kern/office/samen.js',
    stelt: 'de beheerder achter een gedeeld dossier' }
  /* HIER STOND `tenantVan`, EN DIE BESTAAT NIET. Ik had hem opgeschreven bij het
     eerste ontwerp van dit register, op de aanname dat de tenant-routes wel zoiets
     zouden hebben -- ze gebruiken viaBeheerOfDirectie. De zelfijking hieronder
     ving hem: een naam die nergens in server/ staat, keurt alles goed wat erop
     lijkt en meet verder niets. Vandaar dat die controle er is. */
];

/* ROUTES DIE MET REDEN GEEN WACHT HEBBEN, en dat is iets anders dan openbaar.

   Een route op de publieke lijst vraagt geen enkele geloofsbrief. Deze acht
   vragen er wel een -- een uitnodigingscode, een lescode -- maar de controle is
   het bestaan van dat geheim zelf, en dan is er geen gezagsfunctie om aan te
   roepen. Ze staan hier bij naam met de reden, en die reden is gelezen uit de
   code en niet aangenomen.

   WAAROM APART VAN DE PUBLIEKE LIJST. Die lijst wordt door keuringsregel 28
   gelezen om te beslissen of een route open MAG staan. Deze acht daar bijzetten
   zou die regel ruimer maken voor routes die juist wel iets vragen. Twee
   verschillende vragen, twee lijsten -- en dat is precies waarom er hieronder
   ook gemeld wordt dat er al TWEE publieke lijsten bestaan die van elkaar
   afwijken: dat is de fout die deze scheiding voorkomt.

   ELKE REGEL DRAAGT EEN REDEN, en de toets eist dat. Zonder reden groeit deze
   lijst tot hij alles bevat wat ooit rood stond. */
const ZONDER_WACHT = {
  'POST /api/foundation/gezin/maak':
    'een gezin aanmaken kan per definitie niet achter een gezinssessie; er is een rem per IP-adres (8 per half uur)',
  'POST /api/foundation/gezin/uitnodiging/bekijk':
    'de uitnodigingscode uit het lijf IS de geloofsbrief; een onbekende of verlopen code geeft 404 en verklapt niets',
  'POST /api/foundation/gezin/uitnodiging/accepteer':
    'zelfde code, zelfde reden; accepteren verbruikt hem eenmalig',
  'POST /api/foundation/school/personeel/uitnodiging/bekijk':
    'de personeelsuitnodiging uit het lijf is de geloofsbrief, met een rem per IP-adres erop',
  'POST /api/foundation/school/personeel/uitnodiging/accepteer':
    'zelfde uitnodiging; accepteren verbruikt hem eenmalig',
  'POST /api/foundation/les/maak':
    'een les openen is als een kamer openen: wie hem maakt krijgt de docenttoken terug, en zonder lescode komt er niemand binnen',
  'POST /api/foundation/reis/aanvraag':
    'een open aanvraagformulier voor gezinnen zonder foundation-account -- dat is het punt ervan. Sinds deze meting met een rem per IP-adres, want de lijst kapt op duizend en een vloed duwde echte aanvragen eruit',
  'POST /api/foundation/school/school/maak':
    'alleen in NODE_ENV=test; in productie geeft hij 410 en verwijst naar de registratiebalie'
};

/* Antwoorden. Een handler die hier langskomt, heeft iets teruggegeven. */
const ANTWOORD = /\bres\s*\.\s*(json|send|end|sendStatus|redirect|sendFile)\s*\(/;

/* EEN HANDLER DIE ZELF KAN WEIGEREN. De inlogdeuren zijn het duidelijkste
   voorbeeld: /api/login, /api/supplier/login, een uitnodiging accepteren met een
   geheim uit het lijf. Die roepen geen gezagsfunctie aan omdat ze de gezagsvraag
   ZELF zijn -- er is op dat moment nog geen sessie om te toetsen.

   WAT DIT WEL EN NIET ZEGT, en dat hoort er hard bij. Dit is geen bewijs dat de
   controle deugt; het is het bewijs dat er een WEIGERPAD is. Een handler die
   401 of 403 kan antwoorden, heeft ergens een voorwaarde. Of die voorwaarde de
   juiste is, leest dit script niet -- daarvoor bestaan de rolproef en de
   gluurronde, die het aan een echte server vragen.

   Keuringsregel 28 doet hetzelfde, grover: hij neemt genoegen met een 401 of 403
   ergens in de staart van de registratie. Deze meter kijkt in het LIJF van de
   handler en zet de uitkomst apart in plaats van hem onder "heeft een poort" te
   scharen. */
const WEIGERT = /\b(401|403)\b/;

/* Het lijf van een functie, vanaf een gegeven plek. */
function lijfVanaf(tekst, start) {
  let diepte = 0;
  for (let i = start; i < tekst.length; i++) {
    const c = tekst[i];
    if (c === '{') diepte++;
    else if (c === '}') { diepte--; if (diepte === 0) return tekst.slice(start + 1, i); }
  }
  return null;
}

/* Een functie die in DIT bestand is gedefinieerd, op naam. Geeft zijn lijf of
   null. Alleen dit bestand: een naam die elders woont is niet met zekerheid
   dezelfde, en raden is hier erger dan niet weten. */
function lokaleFunctie(code, naam) {
  const re = new RegExp('(?:function\\s+' + naam + '\\s*\\(|(?:const|let|var)\\s+' + naam + '\\s*=\\s*(?:async\\s*)?(?:function\\s*)?\\()');
  const m = re.exec(code);
  if (!m) return null;
  const haak = code.indexOf('{', m.index + m[0].length);
  return haak < 0 ? null : lijfVanaf(code, haak);
}

/* Het lijf van de handler die op deze regel begint.

   TWEE VORMEN, EN DE TWEEDE KOSTTE MIJ EEN VERKEERD GETAL. Een handler staat
   meestal ter plekke: `router.post('/pad', (req, res) => { ... })`. Maar hij kan
   ook als NAAM worden doorgegeven: `router.post('/gezin/uitnodiging/maak', maak);`
   -- en dan staat er op die regel helemaal geen accolade. De eerste versie zocht
   simpelweg de volgende `{` in de tekst en las daarmee het lijf van een WILLEKEURIGE
   functie verderop. Vijf uitnodigingsroutes kwamen zo als "onbewaakt" uit de
   meting terwijl hun echte handler netjes controleert.

   Een meter die het verkeerde bestand leest is erger dan een die niets leest:
   hij geeft een getal. Nu wordt de naam opgezocht in hetzelfde bestand, en lukt
   dat niet, dan is het `nietGelezen`. */
function handlerLijf(code, regel) {
  const regels = code.split('\n');
  if (regel < 1 || regel > regels.length) return null;
  const vanaf = regels.slice(regel - 1).join('\n');
  const regelZelf = regels[regel - 1] || '';
  const naam = /,\s*([A-Za-z_$][\w$]*)\s*\)\s*;?\s*$/.exec(regelZelf);
  if (naam && !/=>|function/.test(regelZelf)) {
    const lijf = lokaleFunctie(code, naam[1]);
    if (lijf !== null) return lijf;
    return null;
  }
  /* DE EERSTE ACCOLADE IS NIET ALTIJD DE HANDLER. Staat er middleware voor met
     een optie-object -- `app.post(pad, express.json({ limit: '1.5mb' }), (req,
     res) => {` -- dan is de eerste `{` die van de opties. De eerste versie las
     daardoor `limit: '1.5mb'` als handlerlijf en meldde de route als onbewaakt,
     terwijl er netjes een wacht in stond. Zoek dus de LAATSTE pijl of
     function-kop op de registratieregel en pak de accolade daarna. */
  const kop = Math.max(regelZelf.lastIndexOf('=>'), regelZelf.lastIndexOf('function'));
  /* EEN PIJL ZONDER ACCOLADES IS OOK EEN HANDLER. `(req, res) => stuur(res,
     lesmaker.leraar(req.body.code, req.body.leraarToken))` heeft geen lijf tussen
     haakjes; de uitdrukking IS het lijf. Zes lesroutes vielen daardoor onder
     "geen leesbare handler" terwijl er gewoon iets te lezen viel. */
  const pijl = regelZelf.lastIndexOf('=>');
  if (pijl >= 0) {
    const na = regelZelf.slice(pijl + 2).trim();
    if (na && na[0] !== '{') return na.replace(/\);?\s*$/, '');
  }
  const start = vanaf.indexOf('{', kop >= 0 ? kop : 0);
  if (start < 0 || start > 400) return null;
  let diepte = 0;
  for (let i = start; i < vanaf.length; i++) {
    const c = vanaf[i];
    if (c === '{') diepte++;
    else if (c === '}') { diepte--; if (diepte === 0) return vanaf.slice(start + 1, i); }
  }
  return null;
}

/* Zoekt de eerste aanroep van een gezagsfunctie en het eerste antwoord, en
   vergelijkt hun plaats. Een wacht NA het eerste antwoord bewaakt dat antwoord
   niet meer.

   EEN NIVEAU INDIRECTIE WORDT GEVOLGD, en niet meer. Een bestand maakt vaak een
   eigen hulpje: `const mijn = (req, res) => { const pv = personeelVan(req, res);
   ... }` en de handlers roepen `mijn(req, res)` aan. Dat is dezelfde wacht met
   een andere naam ervoor; hem niet volgen gaf vijf mailroutes als "onbewaakt"
   terwijl ze achter personeelVan zitten.

   Waarom niet dieper: bij twee niveaus wordt het raden welke functie welke is,
   en een meter die raadt keurt uiteindelijk alles goed. Wie een derde laag
   bouwt, ziet zijn route hier als onbewaakt terugkomen -- dat is de eerlijke
   uitkomst, en de reden staat erbij. */
function weeg(lijf, code) {
  let eerste = null;
  for (const g of GEZAG) {
    const re = new RegExp('\\b' + g.naam.replace('.', '\\.') + '\\s*\\(' + (g.argReq ? '\\s*req\\b' : ''));
    const m = re.exec(lijf);
    if (m && (eerste === null || m.index < eerste.index)) eerste = { index: m.index, naam: g.naam };
  }
  const a = ANTWOORD.exec(lijf);

  /* Een niveau indirectie: een lokaal hulpje dat met (req, res) wordt
     aangeroepen en zelf een gezagsfunctie draait. */
  if (!eerste && code) {
    for (const m of lijf.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(\s*req\s*,\s*res\b/g)) {
      const binnen = lokaleFunctie(code, m[1]);
      if (!binnen) continue;
      const via = weeg(binnen, null);
      if (via.staat === 'bewaakt') { eerste = { index: m.index, naam: m[1] + ' -> ' + via.wacht }; break; }
    }
  }

  if (!eerste) {
    if (WEIGERT.test(lijf)) return { staat: 'eigenControle' };
    /* DE SLEUTEL GAAT MEE HET DOMEIN IN. `stuur(res, lesmaker.leraar(req.body.code,
       req.body.leraarToken))` -- de handler controleert niets, hij geeft een
       geloofsbrief uit het lijf door aan een domeinfunctie die dat wel doet.

       Dit is een EIGEN uitkomst en geen 'bewaakt', want deze meter volgt hem
       daar niet naartoe: of `lesmaker.leraar` het token werkelijk toetst, staat
       hier niet vast. Wat wel vaststaat is dat de route een geloofsbrief
       vraagt. Dat is minder dan bewaakt en meer dan niets, en het hoort als
       zodanig te tellen -- onder 'bewaakt' schuiven zou een aanname als meting
       presenteren. */
    if (/req\.body\.[A-Za-z_$][\w$]*([Tt]oken|[Ss]leutel|[Pp]in|[Cc]ode)\b/.test(lijf))
      return { staat: 'sleutelDoorgegeven' };
    return { staat: 'onbewaakt' };
  }
  if (a && a.index < eerste.index) return { staat: 'laat', wacht: eerste.naam };
  return { staat: 'bewaakt', wacht: eerste.naam };
}

/* De zelfijking: elke genoemde gezagsfunctie moet ergens in de boom bestaan. */
function keurRegister() {
  const klachten = [];
  const zoek = (naam) => {
    const kort = naam.split('.').pop();
    const re = new RegExp('\\b(function\\s+' + kort + '\\b|const\\s+' + kort + '\\s*=|' + kort + '\\s*[:(])');
    const loop = (map) => {
      for (const d of fs.readdirSync(map, { withFileTypes: true })) {
        const p = path.join(map, d.name);
        if (d.isDirectory()) { if (loop(p)) return true; continue; }
        if (!d.name.endsWith('.js')) continue;
        if (re.test(fs.readFileSync(p, 'utf8'))) return true;
      }
      return false;
    };
    return loop(path.join(WORTEL, 'server'));
  };
  /* Een verklaring voor een route die niet meer bestaat, of zonder reden, houdt
     het getal kunstmatig op nul. Zelfde controle als de weesverklaringen in
     scripts/idemschuld.js. */
  const bestaat = new Set(alleRoutes().map(r => r.methode + ' ' + r.pad));
  for (const [sleutel, reden] of Object.entries(ZONDER_WACHT)) {
    if (!reden || reden.length < 30) klachten.push(sleutel + ': verklaard zonder uitgeschreven reden');
    if (!bestaat.has(sleutel)) klachten.push(sleutel + ': verklaard maar bestaat niet (meer) als route');
  }
  for (const g of GEZAG) {
    if (!g.stelt || g.stelt.length < 20) klachten.push(g.naam + ': geen uitgeschreven reden');
    if (!zoek(g.naam)) klachten.push(g.naam + ': staat in het register maar nergens in server/');
  }
  return klachten;
}

/* TWEE LIJSTEN VAN WAT OPENBAAR MAG ZIJN -- inmiddels een bron.

   scripts/poortwacht.js droeg zijn eigen PUBLIEK-map naast die van
   keuringsregel 28. Ze stelden bijna dezelfde vraag en verschilden op twintig
   paden; twee daarvan bestonden niet eens meer als route, en een beloofde een
   rem die op een gelijknamige route van een ander domein stond.

   Ze zijn NIET samengevoegd -- dat zou keuringsregel 28 met achttien paden
   verruimen, en dat is bij een poortregel de gevaarlijke richting. In plaats
   daarvan draagt ./lib/publiek.js ze allebei, uit elkaar gehouden: PUBLIEK
   (welke SCHRIJFroute mag zonder gezagsfunctie -- wat deze meter gebruikt) en
   ALLEEN_ANONIEM (het verschil: wat alleen voor de anonieme klop van de
   poortwacht openbaar heet). Deze meter blijft de strengste van de twee
   gebruiken en meldt het verschil apart, zodat het zichtbaar blijft in plaats
   van weg te vallen in een som.

   Wat hij daarnaast bewaakt: dat poortwacht.js geen DERDE lijst begint. Zodra
   dat bestand weer een eigen `new Map([` met paden krijgt, is dit een klacht en
   niet een verschil. */
function tweedeLijst() {
  try {
    const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'poortwacht.js'), 'utf8');
    if (/const PUBLIEK = new Map\(\[/.test(bron)) return { eigenKopie: true, paden: null };
    if (!/require\('\.\/lib\/publiek'\)/.test(bron)) return null;
    const { POORTWACHT } = require('./lib/publiek');
    return { eigenKopie: false, paden: [...POORTWACHT.keys()] };
  } catch (e) { return null; }
}

function meet() {
  const klachten = keurRegister();
  const tweede = tweedeLijst();
  const verschil = (tweede && tweede.paden) ? {
    alleenInPoortwacht: tweede.paden.filter(p => !PUBLIEK.has(p)),
    alleenInDeKeuring: [...PUBLIEK.keys()].filter(p => !tweede.paden.includes(p))
  } : null;
  if (!tweede) klachten.push('de publieke lijst van scripts/poortwacht.js is niet te lezen');
  else if (tweede.eigenKopie) klachten.push(
    'scripts/poortwacht.js draagt weer een eigen PUBLIEK-map; de openbaar-lijst hoort in scripts/lib/publiek.js te wonen');
  const zonderLaag = alleRoutes().filter(r =>
    r.pad.startsWith('/api/') && r.methode !== 'GET' &&
    r.bewakersBekend && Array.isArray(r.bewakers) && r.bewakers.length === 0);

  const cache = new Map();
  const lees = (b) => {
    if (!cache.has(b)) {
      try { cache.set(b, fs.readFileSync(path.join(WORTEL, b), 'utf8')); }
      catch (e) { cache.set(b, null); }
    }
    return cache.get(b);
  };

  const perRoute = [];
  for (const r of zonderLaag) {
    const sleutel = r.methode + ' ' + r.pad;
    if (!r.bestand) { perRoute.push({ sleutel, staat: 'nietGelezen', reden: 'de bron van deze route is niet gevonden' }); continue; }
    const code = lees(r.bestand);
    if (!code) { perRoute.push({ sleutel, staat: 'nietGelezen', reden: 'het bronbestand is niet te lezen: ' + r.bestand }); continue; }
    const lijf = handlerLijf(code, r.regel);
    if (lijf === null) {
      perRoute.push({ sleutel, staat: 'nietGelezen', bestand: r.bestand + ':' + r.regel,
        reden: 'op deze regel staat geen leesbare handler (lus of hulpje)' });
      continue;
    }
    const uit = weeg(lijf, code);
    /* De publieke lijst wint alleen van 'onbewaakt': een route die WEL een
       gezagsfunctie draait, is bewaakt en niet openbaar -- ook als hij op de
       lijst staat. Andersom zou een verklaring een meting overschrijven. */
    if (uit.staat === 'onbewaakt' && ZONDER_WACHT[sleutel]) {
      perRoute.push({ sleutel, bestand: r.bestand + ':' + r.regel, staat: 'zonderWachtMetReden',
        reden: ZONDER_WACHT[sleutel] });
      continue;
    }
    if ((uit.staat === 'onbewaakt' || uit.staat === 'eigenControle') && PUBLIEK.has(r.pad)) {
      perRoute.push({ sleutel, bestand: r.bestand + ':' + r.regel, staat: 'openbaar',
        reden: PUBLIEK.get(r.pad) });
      continue;
    }
    perRoute.push(Object.assign({ sleutel, bestand: r.bestand + ':' + r.regel }, uit));
  }

  const tel = (s) => perRoute.filter(r => r.staat === s).length;
  const perWacht = {};
  perRoute.filter(r => r.wacht).forEach(r => { perWacht[r.wacht] = (perWacht[r.wacht] || 0) + 1; });

  return {
    stempel: stempel(),
    uitleg: 'Per schrijfroute ZONDER bewakerslaag: roept de handler een bekende gezagsfunctie aan, en ' +
      'gebeurt dat voor het eerste antwoord? Dit is geen oordeel over de controle zelf -- alleen of er ' +
      'een staat. Zie de kop van scripts/handlerwacht.js voor de drie uitkomsten en waarom nietGelezen ' +
      'apart telt.',
    gemeten: {
      zonderBewakerslaag: perRoute.length,
      bewaakt: tel('bewaakt'),
      openbaarMetReden: tel('openbaar'),
      eigenControle: tel('eigenControle'),
      sleutelDoorgegeven: tel('sleutelDoorgegeven'),
      zonderWachtMetReden: tel('zonderWachtMetReden'),
      laat: tel('laat'),
      onbewaakt: tel('onbewaakt'),
      nietGelezen: tel('nietGelezen'),
      gezagsfuncties: GEZAG.length,
      publiekeLijstenVerschillen: verschil
        ? verschil.alleenInPoortwacht.length + verschil.alleenInDeKeuring.length : null
    },
    tweePubliekeLijsten: verschil,
    klachten,
    perWacht: Object.entries(perWacht).sort((a, b) => b[1] - a[1]).map(([naam, aantal]) => ({ naam, aantal })),
    gezag: GEZAG,
    zonderWacht: ZONDER_WACHT,
    perRoute
  };
}

function toon(u) {
  const g = u.gemeten;
  console.log('\n=== DE WACHT IN DE HANDLER ===\n');
  console.log('  schrijfroutes zonder bewakerslaag : ' + g.zonderBewakerslaag);
  console.log('    bewaakt (voor het antwoord)     : ' + g.bewaakt);
  console.log('    openbaar met reden              : ' + g.openbaarMetReden);
  console.log('    eigen controle (kan weigeren)   : ' + g.eigenControle);
  console.log('    sleutel doorgegeven aan domein  : ' + g.sleutelDoorgegeven);
  console.log('    zonder wacht, met reden         : ' + g.zonderWachtMetReden);
  console.log('    wacht NA een antwoord           : ' + g.laat);
  console.log('    ONBEWAAKT                       : ' + g.onbewaakt);
  console.log('    niet gelezen (geen handler)     : ' + g.nietGelezen);
  console.log('\n  WELKE WACHT');
  for (const w of u.perWacht) console.log('    ' + String(w.aantal).padStart(4) + '  ' + w.naam);
  const open = u.perRoute.filter(r => r.staat === 'onbewaakt');
  if (open.length) {
    console.log('\n  ONBEWAAKT (' + open.length + '):');
    for (const r of open.slice(0, 40)) console.log('    ' + r.sleutel.padEnd(52) + (r.bestand || ''));
    if (open.length > 40) console.log('    ... en nog ' + (open.length - 40));
  }
  if (u.tweePubliekeLijsten) {
    const v = u.tweePubliekeLijsten;
    console.log('\n  TWEE VRAGEN, EEN BRON (scripts/lib/publiek.js)');
    console.log('    alleen voor de anonieme klop : ' + v.alleenInPoortwacht.length +
      (v.alleenInPoortwacht.length ? '   ' + v.alleenInPoortwacht.slice(0, 4).join(', ') : ''));
    console.log('    alleen voor de keuring       : ' + v.alleenInDeKeuring.length +
      '   (hoort 0 te zijn: de poortwacht rekent met de som)');
    console.log('    deze meter rekent met PUBLIEK, de strengste van de twee');
  }
  if (u.klachten.length) { console.log('\n  DE METER ZAKT:'); for (const k of u.klachten) console.log('    ! ' + k); }
  console.log('');
  return u.klachten.length ? 1 : 0;
}

function main() {
  const argv = process.argv.slice(2);
  const u = meet();
  if (argv.includes('--json')) { console.log(JSON.stringify(u, null, 1)); return u.klachten.length ? 1 : 0; }
  const code = toon(u);
  if (argv.includes('--vastleggen')) {
    if (u.klachten.length) { console.log('  NIET vastgelegd: een meter die zakt, legt niets vast.\n'); return 1; }
    fs.writeFileSync(UITSLAG, JSON.stringify(u, null, 1) + '\n');
    console.log('  vastgelegd in HANDLERWACHT.json\n');
  }
  return code;
}

module.exports = { meet, GEZAG, handlerLijf, weeg, UITSLAG };
if (require.main === module) process.exit(main());
