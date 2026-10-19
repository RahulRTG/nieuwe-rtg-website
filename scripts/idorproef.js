#!/usr/bin/env node
/* ============================================================================
   DE IDOR-PROEF -- kan de VERKEERDE PERSOON bij het object van een ander?

   De rolproef kruist ROLLEN (een supplier op een member-route) en legt EEN
   foutklasse expliciet buiten zijn grens: twee mensen met DEZELFDE rol, de
   een die bij het dossier van de ander komt. Dat is IDOR, en het is de
   sluitweg die BEWIJSSCHULD.json bij de post `objectpoort` (106 routes)
   noemt. Dit instrument pakt hem op.

   HOE. Twee ECHTE leden (auth/register geeft elk een eigen sleutel, user-<id>;
   de demo-tiers delen hun sleutel en deugen hier dus niet). Lid A gaat langs
   alle member-schrijfroutes en OOGST wat hij terugkrijgt in de objectpool
   (scripts/lib/objectpool.js): echte id's van objecten die aan A toebehoren of
   die A mocht zien. Daarna probeert lid B DEZELFDE routes, met een lijf dat met
   A's id's is verrijkt. Wat B dan krijgt, oordeelt scripts/lib/idor.js.

   DE OPZET IS DIE VAN DE ANDERE PROEVEN: een eigen wegwerpserver met een eigen
   datamap (nooit de ontwikkeldata), en aankloppen met de rol die past. De
   proef MUTEERT: hij maakt twee accounts en stuurt schrijfverzoeken. Vandaar
   de wegwerpmap.

   DE EERLIJKE GRENS, en die staat ook in scripts/lib/idor.js: een 2xx van B is
   een BEVINDING, geen vonnis. Het object kan publiek zijn. Elke doorbraak
   hoort met de hand nagekeken; de proef meldt ze als vraag, niet als lek.

   Draai:  node scripts/idorproef.js
           node scripts/idorproef.js --vastleggen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');
const { alleRoutes, verdeelOpRol } = require('./lib/routes');
const { plausibelLijf } = require('./lib/rolproef');
const { maakPool } = require('./lib/objectpool');
const { maakSessiewacht } = require('./lib/sessiewacht');
const { oordeelIdor } = require('./lib/idor');
const { waarden, merktekens, oordeelAfbakening } = require('./lib/afbakening');
const opbouwLib = require('./lib/idoropbouw');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'IDOR.json');

/* NAGEKEKEN, EN GEEN LEK -- met de reden erbij, zoals de omgevingsruis in de
   staatproef. Een doorbraak is een VRAAG; deze zijn met de hand beantwoord.
   Het gemeenschappelijke patroon: de route haalt de eigenaar uit de SESSIE
   (req.session.key), niet uit het lijf, en zoekt het id op in de EIGEN
   namespace van de aanvrager. A's geoogste id bestaat ook in B's namespace
   omdat de demo-seed elk lid dezelfde standaard-inrichting geeft -- B bedient
   dus zijn EIGEN object, niet dat van A. Een route die hier NIET op staat en
   toch een doorbraak geeft, is een nieuwe vraag en hoort nagekeken. */
const NAGEKEKEN = {
  'POST /api/boeken/boek': 'de huisbibliotheek is publiek; een boek-id is geen persoonlijk object',
  'POST /api/foodcourt/tijden': 'openingstijden van een restaurant zijn publiek',
  'POST /api/gemeente/afspraak': 'eigenaar uit req.session; het id valt in B\'s eigen namespace',
  'POST /api/gemeente/burgerzaken/slots': 'publieke slots op soort+datum, geen persoonlijk object',
  'POST /api/gemoed/zet': 'eigenaar uit req.session.key; seed-gedeeld id in B\'s eigen namespace',
  'POST /api/home/zet': 'homekit.zet zoekt het apparaat in woningVan(B); seed-gedeeld id, B\'s eigen apparaat',

  /* DE OOGST VAN DE HERSTELDE SESSIE. Toen de proef ophield zichzelf uit te
     loggen, groeide de objectpool van 120 naar 428 velden en kwamen er achttien
     nieuwe doorbraak-kandidaten boven water. Alle achttien zijn nagelopen in de
     code; geen ervan is een lek. Ze vallen in vier patronen, en die patronen
     zijn de moeite waard om te kennen, want ze komen terug:

       1  DE WINKEL. Een catalogus-id is geen persoonlijk object. B installeert
          een app of leest een reisgids uit dezelfde publieke etalage als A, en
          het resultaat landt in B's eigen bibliotheek (req.session.key).
       2  HET SOCIALE WERKWOORD. Liken, reageren, melden en bewaren HOREN op
          andermans bericht te werken -- anders is er geen sociaal netwerk. De
          handelende persoon komt uit de sessie, en het bericht moet door
          zichtbaar() heen. Bij de versiegeschiedenis staat het er zelfs met
          zoveel woorden bij: "elke vorige versie blijft staan, en iedereen kan
          hem lezen. Een correctie mag; ongemerkt herschrijven niet."
       3  IETS NIEUWS VOOR JEZELF. Een kanaal aanmelden of een KVK-inschrijving
          doen maakt een object voor de AANVRAGER. Het id uit A's lijf wordt
          genegeerd; het nieuwe nummer wordt afgeleid uit de eigen sleutel.
       4  DE CODE IS DE SLEUTEL. Een vergaderkamer werkt zoals een vergaderlink:
          wie de code heeft, mag erin -- en een BESLOTEN kamer weigert alsnog
          (magErin). Dat is de bedoelde vorm, geen omzeiling ervan. */
  'POST /api/mall/apps/installeer': 'catalogus-id; appbieb.installeer(req.session.key, id) zet de app in B\'s eigen bibliotheek',
  'POST /api/mall/apps/weg': 'zelfde bibliotheek, zelfde sleutel: B verwijdert uit zijn EIGEN lijst',
  'POST /api/mall/bestel': 'de winkelcatalogus is publiek en de bestelling draagt B\'s eigen naam en adres; er wordt geen bestaand object van A aangeraakt',
  'POST /api/mall/reis/installeer': 'reisgids uit de publieke bieb, geinstalleerd op req.session.key',
  'POST /api/mall/reis/lees': 'leest een publieke reisgids; er is geen eigenaar om te schenden',
  'POST /api/mall/reis/weg': 'verwijdert uit B\'s eigen bibliotheek',
  'POST /api/mall/rtf/installeer': 'zelfde publieke bieb, andere etage',
  'POST /api/mall/rtf/weg': 'verwijdert uit B\'s eigen bibliotheek',
  'POST /api/meet/kom': 'een kamercode werkt als een vergaderlink: wie hem heeft mag binnen, en een BESLOTEN kamer weigert alsnog (magErin). B komt binnen als B, met zijn eigen codenaam',
  'POST /api/member/pulse/bewaar': 'een bladwijzer op andermans bericht, in B\'s EIGEN plank; het bericht moet door zichtbaar() heen',
  'POST /api/member/pulse/like': 'liken hoort op andermans bericht te werken; de like staat op B\'s sleutel en het bericht moet zichtbaar zijn',
  'POST /api/member/pulse/meld': 'melden hoort juist op andermans bericht te werken -- dat is de knop',
  'POST /api/member/pulse/post': 'pulsePost(key, naam, tekst) negeert het id uit het lijf en schrijft een NIEUW bericht van B',
  'POST /api/member/pulse/reactie': 'reageren op een zichtbaar bericht; de reactie staat op B\'s naam',
  'POST /api/member/pulse/versies': 'de versiegeschiedenis staat met opzet open voor iedereen die het bericht mag zien -- dat is de voorwaarde waaronder bewerken eerlijk blijft',
  'POST /api/overheid/kvk/inschrijven': 'het kvknummer uit het lijf wordt genegeerd; het nieuwe nummer volgt uit B\'s eigen sleutel, en een tweede inschrijving op dezelfde sleutel geeft 409',
  'POST /api/podium/kanaal/aanmeld': 'kanaalMaak(req.session.key, ...) meldt een kanaal aan VOOR B; de makerkey uit het lijf wordt nergens gelezen',
  'POST /api/podium/meld': 'een kanaal melden hoort op andermans kanaal te werken; de melder is codenaamVan(req.session.key)',

  /* DE TWEEDE OOGST, van de ronde die zijn proefpersoon niet meer wist. Elf
     nieuwe kandidaten, en ze vallen in dezelfde vier patronen als hierboven --
     met een vijfde erbij die alleen deze proef treft: */
  'POST /api/privacy/delete': 'DE PROEF ZELF. wisLid(req.session) wist het account van de AANROEPER; het id uit het lijf wordt niet gelezen. Dit is de route die lid A op plek 1147 van de rij liet verdwijnen -- geen doorbraak maar het recht om vergeten te worden, dat precies doet wat het belooft',
  'POST /api/reis/wijzer': 'reisadvies per land; een landcode is publieke informatie en geen object van iemand',
  'POST /api/salon/bewaar': 'een bladwijzer op een zichtbare post, in B\'s eigen lijst (salonProfiel.bewaar(req.session.key, ...))',
  'POST /api/salon/meld': 'melden hoort op andermans post te werken -- drie VERSCHILLENDE melders verbergen hem voor iedereen, waarna het kantoor beslist',
  'POST /api/salon/reacties': 'de reacties onder een post die B mag zien; wie de post mag zien, mag de reacties zien',
  'POST /api/salon/reageer': 'reageren op een zichtbare post; de reactie staat op B\'s naam uit de sessie',
  'POST /api/salon/verberg': 'verbergt de post in B\'s EIGEN tijdlijn (s.verborgen[mij]); de post zelf blijft voor iedereen staan',
  'POST /api/samen/mee': 'een samen-code werkt als een uitnodigingslink: wie hem heeft mag meedoen, en hij komt binnen onder zijn eigen codenaam. De kamer is vol bij twaalf',
  'POST /api/samen/staat': 'de stand van een kamer waarvan je de code hebt; zelfde code-is-de-sleutel als hierboven',
  'POST /api/theater/kanaal/aanmeld': 'theaterKanaalMaak(req.session.key, ...) meldt een NIEUW kanaal aan voor B zelf',
  'POST /api/veiligheid/rust/aan': 'zet de rustmodus van B (rustAan(req.session.key, ...)); het id uit het lijf is verrijking die de route niet leest',

  /* DE DERDE OOGST (25 september 2026): vijf nieuwe kandidaten bij een verse
     meting, alle vijf B die iets van B doet. */
  'POST /api/connect/kring': 'connect.kringZet(huidig, gewenst) is een ZUIVERE berekening over twee kringnamen uit het lijf; er wordt geen opgeslagen object gelezen of geschreven',
  'POST /api/meet/maak': 'meet.meetMaak(req.session.key, ...) maakt een NIEUWE vergadering voor B; het id uit het lijf wijst niets aan',
  'POST /api/mijn/post/zet': 'commercieel.zet(req.session.key, soort, kanalen) zet B\'s EIGEN posttoestemming per soort; een soort is een categorie en geen object',
  'POST /api/opvang/vraag': 'de code is de openbare code van een opvang; de aanvraag komt op B\'s eigen codenaam (opvangwijzerVraag(sess, codenaam, ...))',
  'POST /api/samen/maak': 'samen.maak(req.session.key, codenaam) leest het lijf niet en maakt een NIEUWE kamer voor B',
  /* De ronde van 18 oktober 2026 (na de integratie van het toetsenspoor): drie
     nieuwe kandidaten, met de hand nagelezen, alle drie B die iets van B doet. */
  'POST /api/auth/aanmeldkanaal': 'leest alleen req.session.account (de eigen ledenstand) en het gekozen kanaal; een `id` in het lijf wordt nergens gelezen',
  'POST /api/member/magnaat/stad/maak': 'stad.maak(req.session.key, b) leest uit het lijf alleen moeilijkheid en begin en maakt een NIEUWE stad met een verse code; een meegestuurde code wijst niets aan',
  /* De eerste afbakeningsronde (gang 4, 19 oktober 2026): B kreeg met
     hetzelfde verzoek een merkteken van A terug, met de hand nagelezen. */
  'POST /api/browser/gids': 'webmaker-blader gids() geeft alleen sites die hun maker zelf online zette (d.online && d.adres): een openbare gids, en het adres is de codenaam die de maker publiceerde',
  /* De opbouwronde (19 oktober 2026, ./lib/idoropbouw.js): A had voor het eerst
     potten, een kring en een loopbaanprofiel, en vier nieuwe kandidaten kwamen
     boven. Met de hand nagelezen, alle vier B die iets van B doet. Twee ervan
     tonen een zwakte van de ijking zelf: de tweede poging van B (met een
     verzonnen id) faalde op de TOESTAND die B's eerste poging had gezet (409),
     niet op het id. */
  'POST /api/metier/naam-vrij': 'metierBewijs.geefVrij(req.session.key, code, waarvoor): B geeft zijn EIGEN naam vrij aan een zaak; de code is de openbare zaakcode, een verzonnen code geeft "Deze zaak kennen we niet"',
  'POST /api/neiging/antwoord': 'kern.neiging.antwoord(req.session.key, vraag, onderwerpen): de vraag is een id uit de vaste vragenlijst (kern/neiging/vraag-lijst.js), geen object van A; het antwoord landt op B\'s eigen sleutel',
  'POST /api/veiligheid/kring/mail': 'kringMailToevoegen(req.session.key, adres) leest geen id; de controle gaf 409 omdat B\'s eerste poging het adres al in B\'s EIGEN kring zette',
  'POST /api/veiligheid/wacht/start': 'wachtStart(req.session.key, codenaam, body) leest body.id niet en maakt een nieuwe wacht voor B; de controle gaf 409 "Er loopt al een wacht" door B\'s eerste poging',
  'POST /api/member/magnaat/stad/verlaat': 'stad.verlaat(req.session.key) leest het lijf niet: B verlaat zijn EIGEN stad, en de code van A doet niets'
};
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;
const VASTLEGGEN = argv.includes('--vastleggen');

if (require.main !== module) { module.exports = {}; return; }

(async () => {
  const server = await start({ naam: 'idor', env: { RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF' } });
  const { basis, klaar } = server;

  const kaal = async (pad, lijf, tok, koppen) => {
    try {
      const r = await fetch(basis + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(koppen || {}) },
        body: JSON.stringify(lijf || {}) });
      const tekst = await r.text();
      let data; try { data = JSON.parse(tekst); } catch (e) { data = tekst; }
      return { status: r.status, data, tekst };
    } catch (e) { return { status: 0, data: null, tekst: String(e.message) }; }
  };

  /* A EN B MET EEN GEBONDEN TOESTEL -- ./lib/proeftoestel.js, dezelfde weg als
     De Beproeving, de rolproef en de tredeproef (18 oktober 2026).

     Zonder toestel kon deze proef op de ZWARE paden (kern/identiteit/
     bezitspaden.js: geld, bank, privacy, sessies, het herstelkanaal) A en B
     niet kruisen: elke vraag strandde aan de toesteldeur met `bezitsbewijs:
     'vereist'`, voor A in de oogstgang net zo goed als voor B -- dus er werd
     niets geoogst en niets geprobeerd, en de eigenaarschapsvraag bleef daar
     ongesteld (scripts/lib/idor.js telt die weigering terecht als
     onbereikbaar). Precies op de paden waar een lek het duurst is, zei het
     register niets.

     De poort blijft zoals in productie. Alleen de CLIENT wordt echt: beide
     leden binden een toestel aan hun EIGEN sessie, en elk zwaar verzoek draagt
     een vers bewijs van de sleutel die bij DAT token hoort. B tekent dus met
     B's toestel -- een aanvaller heeft zijn eigen toestel, niet dat van A -- en
     de vraag op een zwaar pad wordt daarmee weer: mag B met zijn eigen, geldige
     toestel bij het object van A?

     DE BINDING HOORT BIJ DE SESSIE, dus elke verse sessie bindt opnieuw. Deze
     proef loopt langs /api/logout, /api/mijn/toestel/introk en
     /api/privacy/delete; de sessiewacht haalt dan een nieuwe sessie of een nieuw
     lid, en zonder herbinding zou de rest van de gang weer stil aan de
     toesteldeur blijven. Lukt een binding niet, dan staat dat met de reden in
     het register (`gemeten.toestel`), en dan telt de toesteldeur weer als
     onbereikbaar -- eerlijk ongemeten, nooit als scheiding. */
  const { bindToestel, metToestellen } = require('./lib/proeftoestel');
  const { zwaarPad } = require('../server/kern/identiteit/bezitsbewijs');
  const toestelVan = new Map();
  const toestelStand = { gebonden: 0, gekeurd: 0, mislukt: [] };
  const post = metToestellen(kaal, { toestellen: () => [...toestelVan.values()] });
  const bind = async (n, tok) => {
    if (!tok) return tok;
    const t = await bindToestel({ post: kaal, token: tok, naam: 'IDOR-toestel lid ' + n });
    if (t.klaar) { toestelVan.set(tok, t.klaar); toestelStand.gebonden++; }
    else toestelStand.mislukt.push('lid ' + n + ': ' + t.reden);
    return tok;
  };

  /* TWEE ECHTE LEDEN. auth/register geeft elk een eigen user-sleutel; alleen
     dan bestaat er eigenaarschap om te schenden. Beiden meerderjarig zodat de
     jeugdpoort niets afsluit dat de proef aanziet voor een IDOR-weigering. */
  const geheugen = {};
  const identiteit = {};
  const leden = {};
  let teller = 0;
  const maakLid = async (n) => {
    const email = 'idor' + n + '-' + Date.now() + '-' + (++teller) + '@voorbeeld.test';
    const wachtwoord = 'geheim' + n + '123';
    const r = await post('/api/auth/register', {
      name: 'IDOR Lid ' + n, email, phone: '06123456' + (10 + n), password: wachtwoord,
      geboortedatum: '1990-01-0' + n, pasApp: 'rtg' });
    geheugen[n] = { email, wachtwoord };
    const tok = r.data && r.data.token;
    if (!tok) return tok;
    /* Gekeurd, zoals een echt lid dat geld beweegt: RTG Pay vraagt eenmalig het
       paspoort, en zonder keuring zou A op de betaalpaden niets oogsten. De
       keuring loopt langs de echte weg (test/helper.js keurLidGoed). */
    const user = r.data.state && r.data.state.user;
    /* Wie dit lid IS, als merkteken voor de afbakening (gang 4): een codenaam of
       e-mail van A in B's antwoord is A's gegeven, wat de route ook is. */
    (identiteit[n] = identiteit[n] || new Set());
    leden[n] = { email, codenaam: user && user.codename };
    for (const w of [email, user && user.codename, user && user.email]) if (typeof w === 'string' && w.length >= 6) identiteit[n].add(w);
    try { await require('../test/helper').keurLidGoed(basis, tok, user && user.codename); toestelStand.gekeurd++; }
    catch (e) { toestelStand.mislukt.push('lid ' + n + ' niet gekeurd: ' + e.message); }
    return bind(n, tok);
  };
  let A = await maakLid(1);
  let B = await maakLid(2);
  /* C, DE CONTROLE voor de afbakening (gang 4). C loopt de routes VOOR A, en
     alles wat C te zien kreeg -- seed-inrichting, publieke catalogus,
     server-brede waarden -- telt daarna niet als merkteken van A. C probeert
     zelf niets bij A of B. */
  let C = await maakLid(3);
  if (!A || !B || !C) { console.error('kon geen drie leden registreren; A=' + !!A + ' B=' + !!B + ' C=' + !!C); klaar(); process.exit(2); }
  /* De context van de opbouw (./lib/idoropbouw.js): de tegenpartij is C. */
  const ctx = { get tegen() { return leden[3]; }, get ik() { return leden[1]; } };
  const basisLijf = (pad) => opbouwLib.lijfVoor(pad, plausibelLijf(pad), ctx);

  /* ---- DE SESSIE OVERLEEFT DE PROEF, want anders bewijst hij het tegendeel ----

     DIT IS EEN ECHTE FOUT GEWEEST, en een van de gevaarlijkste soort: hij maakte
     de uitslag BETER dan de waarheid. Deze proef loopt alle member-schrijfroutes
     langs, en daar zit /api/logout tussen. Vanaf dat punt was het token van A (en
     in de tweede gang dat van B) ongeldig, en dan gebeurt er dit:

       gang 1  A oogst niets meer -- elke volgende route geeft 401, dus de
               objectpool blijft halverwege steken;
       gang 2  B krijgt op ELKE volgende route een 401, en oordeelIdor leest een
               401 als "bewezen gescheiden". Een uitgelogde proef schrijft dus
               honderden routes als bewijs van scheiding weg, terwijl er alleen
               maar geen sessie was.

     Nagetrokken met een mutatie: /api/logout op een echt accounttoken geeft 200,
     en /api/auth/me daarna 401. (Voor office en supplier gebeurt dit niet: die
     komen op /api/logout niet eens door de member-poort heen.)

     De reparatie is niet "logout overslaan" -- dan blijft de volgende
     sessiebeeindiger die erbij komt onopgemerkt (LAT.md regel 4). De reparatie
     is een 401 NIET geloven voordat is vastgesteld dat de sessie nog leeft. Is
     hij dood, dan halen we een verse en doen de route over; pas daarna telt het
     antwoord. */
  const levend = async (tok) => (await post('/api/auth/me', {}, tok)).status === 200;
  /* EN DE PROEF WIST ZIJN EIGEN PROEFPERSOON. Een gang die elke schrijfroute
     aanraakt, komt niet alleen langs /api/logout maar ook langs
     /api/privacy/delete -- het recht om vergeten te worden. Gemeten op route
     1147 van de 1480: vanaf daar bestond lid A niet meer, kon hij ook niet
     opnieuw inloggen, en oogstte de rest van de gang niets. Een sessie
     terughalen hielp daar niet; het account zelf was weg.

     Dezelfde gedachte een laag dieper: een dode sessie krijgt een verse sessie,
     een gewist account krijgt een vers account. Geen uitzonderingslijst met
     routes die je moet overslaan (die veroudert stil, LAT.md regel 4) maar
     herstel op de waarneming. De vervanger is een ANDER lid, en dat maakt de
     IDOR-vraag niet zwakker: B blijft een vreemde voor de objecten van A. Wat
     wel verandert is de pool -- id's van voor de wissing wijzen naar objecten
     die met het account zijn meegegaan, en die geven een eerlijke 404 en dus
     'onbereikbaar', niet een valse 'gescheiden'. */
  let vervangen = 0;
  const versLid = async (n) => {
    const r = await post('/api/auth/login', { login: geheugen[n].email, password: geheugen[n].wachtwoord });
    if (r.data && r.data.token) return bind(n, r.data.token);
    if (vervangen >= 6) return null;              // begrensd: een route die elk lid wist, moet opvallen
    vervangen++;
    return maakLid(n);
  };
  /* De regel zelf staat in scripts/lib/sessiewacht.js, want hij zat op DRIE
     instrumenten tegelijk en drie kopieen lopen uiteen (LAT.md regel 4). Hier
     met een probe: /api/auth/me is goedkoper dan elke 401 met een verse inlog
     natrekken, en een lid heeft zo'n route. */
  const wacht = maakSessiewacht({ post, rollen: {
    1: { vers: () => versLid(1), leeft: levend, zet: (t) => { A = t; } },
    2: { vers: () => versLid(2), leeft: levend, zet: (t) => { B = t; } },
    3: { vers: () => versLid(3), leeft: levend, zet: (t) => { C = t; } }
  } });
  const roep = (pad, lijf, n, tok) => wacht.roep(pad, lijf, n, tok);

  /* Alleen member-schrijfroutes: IDOR gaat over het bedienen van een object,
     niet over lezen of over een publieke deur. */
  const kandidaten = alleRoutes()
    .filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET')
    .filter(r => !r.pad.includes(':'));
  const verdeling = verdeelOpRol(kandidaten, ['member']);
  let routes = verdeling.metRol.filter(r => r.rol === 'member');
  if (MAX) routes = routes.slice(0, MAX);

  console.log('\n=== DE IDOR-PROEF ===\n');
  console.log('  twee echte leden, ' + routes.length + ' member-schrijfroutes\n');

  /* GANG 0: de controle. C raakt dezelfde routes aan VOOR A er is; wat C ziet
     kan dus nooit een object van A zijn. */
  const controle = new Set();
  for (const r of routes) {
    const u = await roep(r.pad, basisLijf(r.pad), 3, C);
    if (u.data && typeof u.data === 'object') waarden(u.data, controle);
  }
  for (const w of identiteit[3] || []) controle.add(w);

  /* GANG 1: A oogst. Elk geslaagd antwoord draagt id's van objecten die A mag
     bedienen; de pool onthoudt ze per domein. En elke merkbare waarde die A
     terugkreeg gaat in vanA: de kandidaat-merktekens voor gang 4. */
  const pool = maakPool();
  const vanA = new Set();
  for (const r of routes) {
    const u = await roep(r.pad, basisLijf(r.pad), 1, A);
    if (u.status >= 200 && u.status < 300 && u.data && typeof u.data === 'object') { pool.leer(u.data, r.pad); waarden(u.data, vanA); }
  }

  /* GANG 1b: DE OPBOUW. A maakt langs de echte routes de objecten die de
     oogstgang niet kon maken (een pot, een gesprek met C, een team). Wat
     terugkomt leert de pool en de merktekens, net als elk ander antwoord. */
  const opbouw = { stappen: 0, geslaagd: 0, mislukt: [] };
  let kantoor = null;
  const hulp = { post, A: () => A, C: () => C };
  for (const st of opbouwLib.stappen(ctx)) {
    opbouw.stappen++;
    if (typeof st.doe === 'function') {
      try { await st.doe(hulp, ctx); opbouw.geslaagd++; }
      catch (e) { opbouw.mislukt.push(st.naam + ': ' + e.message); }
      continue;
    }
    const lijf = typeof st.lijf === 'function' ? st.lijf(ctx) : (st.lijf || {});
    if (st.als === 'kantoor' && !kantoor) {
      kantoor = ((await post('/api/office/login', { code: 'RTG-OFFICE-PROEF' })).data || {}).token || null;
    }
    const u = st.als === 'kantoor' ? await post(st.pad, lijf, kantoor)
      : st.als === 'tegen' ? await roep(st.pad, lijf, 3, C) : await roep(st.pad, lijf, 1, A);
    if (st.als) {
      if (u.status >= 200 && u.status < 300) { opbouw.geslaagd++; if (typeof st.bewaar === 'function') { try { st.bewaar(u.data, ctx); } catch (e) {} } }
      else opbouw.mislukt.push((st.als + ' ') + st.pad + ' ' + u.status + ' ' + String(u.tekst || '').slice(0, 80));
      continue;
    }
    if (u.status >= 200 && u.status < 300) {
      opbouw.geslaagd++;
      if (u.data && typeof u.data === 'object') {
        pool.leer(u.data, st.pad); waarden(u.data, vanA);
        if (typeof st.bewaar === 'function') { try { st.bewaar(u.data, ctx); } catch (e) {} }
      }
    } else opbouw.mislukt.push(st.pad + ' ' + u.status + ' ' + String(u.tekst || '').slice(0, 80));
  }
  const poolStand = pool.grootte();
  /* DE PROEF CONTROLEERT ZICHZELF, want dit is precies de fout die hij een
     ronde lang niet zag. Leeft A na de oogstgang niet meer, dan is de pool
     halverwege gestopt met vullen en zegt alles wat hierna komt minder dan het
     lijkt. Dan geen halve uitslag maar stoppen, in dezelfde vorm als "DE METER
     IS BLIND" van de rolproef. */
  /* DE PROEF CONTROLEERT ZICHZELF, want dit is precies de fout die hij een ronde
     lang niet zag. Wat de sessiewacht garandeert is dat een dode sessie NOOIT
     langer dan een route meegaat: de eerstvolgende 401 herstelt hem. Wat zij
     niet kan opvangen is de route die de sessie beeindigt met een 200 en daarna
     de LAATSTE van de rij blijkt -- dan komt er geen 401 meer om op te reageren.
     Onschadelijk (die gang was toch klaar), maar de volgende gang moet niet met
     een dood token beginnen. Dus hier herstellen, en alleen stoppen als ook dat
     niet lukt. */
  if (!(await levend(A))) {
    const vers = await versLid(1);
    if (!vers) {
      console.error('\n  DE SESSIE VAN A IS DOOD na de oogstgang en er komt geen verse voor terug. ' +
        'Dan is niet vast te stellen hoeveel van deze gang met een geldige sessie is gelopen, en ' +
        'elke 401 hierna zou als "gescheiden" tellen zonder dat iemand iets heeft geweigerd.\n');
      klaar(); process.exit(2);
    }
    A = vers;
  }

  /* GANG 2: B probeert dezelfde routes met A's id's. En de IJKING die dit
     instrument scherp maakt (zonder haar is elke publieke lees-POST een vals
     alarm): een 2xx telt alleen als A's SPECIFIEKE id het verschil maakt.
     Daarom vuurt B bij een 2xx nog een keer met een VERZONNEN id in hetzelfde
     lijf. Zakt die controle naar een 4xx, dan opende A's echte id de deur ->
     doorbraak. Blijft hij 2xx, dan is de route gewoon publiek en telt hij als
     publiek, niet als bevinding. Dezelfde gedachte als de vingerafdruk-ijking
     van de rolproef: eerst bewijzen dat je meetinstrument iets KAN zien. */
  const perRoute = {};
  const telling = { gescheiden: 0, doorbraak: 0, nagekeken: 0, publiek: 0, onbereikbaar: 0, lek: 0 };
  const verzonnen = () => 'ZZ-' + Math.random().toString(36).slice(2, 10);
  for (const r of routes) {
    const sleutel = r.methode + ' ' + r.pad;
    const verrijkt = pool.verrijk(basisLijf(r.pad), r.pad);
    /* A's eigen verwijzingen uit de opbouw (./lib/idoropbouw.js VAN_A) gaan er
       NA het verrijken op: de pool kent een IBAN niet en deelt een `id` per
       domein, en B hoort precies A's object te noemen. */
    const eigen = opbouwLib.vanA(r.pad, ctx);
    const lijf = Object.assign(verrijkt.lijf, eigen);
    const velden = [...new Set([...verrijkt.velden, ...Object.keys(eigen)])];
    if (!velden.length) { telling.onbereikbaar++; perRoute[sleutel] = { staat: 'onbereikbaar', reden: 'geen id van A in dit domein' }; continue; }
    const u = await roep(r.pad, lijf, 2, B);
    const o = oordeelIdor(u.status, u.tekst);
    if (o.staat === 'doorbraak') {
      const nep = { ...lijf };
      for (const v of velden) nep[v] = verzonnen();
      const controle = await post(r.pad, nep, B);
      if (controle.status >= 200 && controle.status < 300) {
        telling.publiek++;
        perRoute[sleutel] = { status: u.status, staat: 'publiek', velden,
          reden: 'ook met een VERZONNEN id een ' + controle.status + ': de route is publiek/rol-open, ' +
            'A\'s id maakt geen verschil -- geen objectreferentie om te schenden' };
        continue;
      }
      if (NAGEKEKEN[sleutel]) {
        telling.nagekeken++;
        perRoute[sleutel] = { status: u.status, staat: 'nagekeken', velden,
          reden: 'doorbraak-kandidaat, met de hand nagekeken en GEEN lek: ' + NAGEKEKEN[sleutel] };
        continue;
      }
      perRoute[sleutel] = { status: u.status, staat: 'doorbraak', velden,
        reden: 'B kreeg ' + u.status + ' met A\'s id maar ' + controle.status + ' met een verzonnen id: ' +
          'A\'s ECHTE object opende de deur voor B -- dit is een objectreferentie die B niet hoort te hebben' };
      telling.doorbraak++;
      continue;
    }
    /* DE GEIJKTE 400. Een 400 voor B zegt op zichzelf niets: de validatie kan
       eerder gestrand zijn. Maar stuurt A LETTERLIJK HETZELFDE lijf -- met zijn
       eigen id's -- en komt A wel binnen, dan was het lijf geldig en is het
       enige verschil wie het stuurt. Dan is B's weigering een scheiding. Een
       antwoord voor B dat een merkteken van A draagt telt nooit als scheiding. */
    if (o.staat === 'onbereikbaar' && (u.status === 400 || u.status === 422)) {
      const ijk = await roep(r.pad, lijf, 1, A);
      if (ijk.status >= 200 && ijk.status < 300) {
        const merken = merktekens({ antwoordA: ijk.data, vanA, controle, lijf, wie: identiteit[1] });
        const gezien = merken.filter((m) => String(u.tekst || '').includes(JSON.stringify(m).slice(1, -1)));
        if (!gezien.length) {
          telling.gescheiden++;
          perRoute[sleutel] = { status: u.status, statusA: ijk.status, staat: 'gescheiden', velden,
            reden: 'geijkt: A kwam met letterlijk hetzelfde lijf binnen (' + ijk.status + '), B kreeg ' + u.status +
              ' -- het lijf was geldig, het enige verschil is wie het stuurt' };
          continue;
        }
      }
    }
    perRoute[sleutel] = { status: u.status, ...o, velden };
    telling[o.staat]++;
    if (o.lek) telling.lek++;
  }

  /* ---- GANG 4: DE AFBAKENING (scripts/lib/afbakening.js) ----

     De routes waar gang 2 niets kon, omdat ze geen id dragen: ze bakenen af op
     de sessie. Hier is de vraag of B met HETZELFDE verzoek iets van A
     terugkrijgt. A gaat eerst: alleen als A's antwoord een merkteken van A
     draagt (iets wat A zag, de controle niet, en dat niet in het verzoek
     stond), zegt B's antwoord iets. Anders blijft de route onbereikbaar. */
  telling.afgebakend = 0;
  const afbakening = { routes: 0, afgebakend: 0, gescheiden: 0, doorbraak: 0, nagekeken: 0, onbereikbaar: 0 };
  for (const r of routes) {
    const sleutel = r.methode + ' ' + r.pad;
    const v = perRoute[sleutel];
    if (!v || v.staat !== 'onbereikbaar' || (v.velden && v.velden.length)) continue;
    afbakening.routes++;
    const lijf = basisLijf(r.pad);
    const a = await roep(r.pad, lijf, 1, A);
    if (a.status >= 200 && a.status < 300 && a.data && typeof a.data === 'object') waarden(a.data, vanA);
    const merken = merktekens({ antwoordA: a.data, vanA, controle, lijf, wie: identiteit[1] });
    const b = merken.length && a.status >= 200 && a.status < 300 ? await roep(r.pad, lijf, 2, B) : { status: 0, tekst: '' };
    let o = oordeelAfbakening({ a, b, merken });
    if (o.staat === 'doorbraak' && NAGEKEKEN[sleutel]) {
      o = { staat: 'nagekeken', reden: 'afbakening-kandidaat, met de hand nagekeken en GEEN lek: ' + NAGEKEKEN[sleutel] };
    }
    afbakening[o.staat]++;
    if (o.staat === 'onbereikbaar') { v.afbakening = o.reden; continue; }   // gang 2 blijft staan, met de reden van gang 4 erbij
    telling.onbereikbaar--;
    telling[o.staat]++;
    if (o.lek) telling.lek++;
    perRoute[sleutel] = { status: b.status, statusA: a.status, gang: 'afbakening', ...o, velden: [] };
  }
  if (!(await levend(B))) {
    const vers = await versLid(2);
    if (!vers) {
      console.error('\n  DE SESSIE VAN B IS DOOD na de aanvalsgang en er komt geen verse voor terug: de ' +
        '401\'s die als bewezen scheiding zijn geteld, kunnen ook gewoon "geen sessie" zijn geweest. ' +
        'Deze uitslag deugt niet.\n');
      klaar(); process.exit(2);
    }
    B = vers;
  }

  /* ---- GANG 3: DE WERKPLEK-POORT (de 78 objectpoort-routes) ----

     Een andere vorm van dezelfde vraag, en de reden dat de rolproef hier
     niets kon: huisPoort doet werkplek.kent(req.body.bedrijf) VOOR het naar de
     identiteit kijkt, dus een verzonnen bedrijfscode geeft 404 en de
     eigenaarschapsvraag komt nooit aan de beurt. Met een ECHTE code komt hij
     er wel aan toe, en dan is de vraag zuiver: mag een lid dat geen toegang
     tot dit huis heeft er toch in?

     DE IJKING IS ONMISBAAR. Een 403 voor B bewijst alleen iets als de deur
     voor de RECHTMATIGE persoon opengaat -- anders meet je een deur die voor
     iedereen dicht zit, en dat is geen scheiding maar een muur. De eigenaar
     mag per definitie in elk huis (werkplek.magIn: baas -> true), dus die is
     de ijking. Zonder open deur wordt de uitslag ONBEREIKBAAR en geen bewijs. */
  const eig = (await post('/api/auth/login', {
    login: process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com',
    password: process.env.DEMO_PASS || 'Imran' })).data.token;
  const werkplekRoutes = alleRoutes()
    .filter(r => r.methode === 'POST' && r.pad.startsWith('/api/werkplek/'))
    .filter(r => !r.pad.includes(':'));
  const huizen = eig
    ? (((await post('/api/werkplek/mijn', {}, eig)).data || {}).bedrijven || []).map(b => b.code)
    : [];
  const werkplekTelling = { gescheiden: 0, doorbraak: 0, onbereikbaar: 0 };
  const werkplekPerRoute = {};
  const code = huizen[0];

  /* TWEE GANGEN VOOR DE IJKING, en dat is de reparatie van de grootste rest die
     deze proef overhield: 62 routes bleven ONBEREIKBAAR omdat ook de eigenaar er
     met alleen `{ bedrijf }` niet in kwam. Die routes willen meer -- een
     bestaand document, een klus, een dienst -- en een verzonnen id geeft
     dezelfde 404 als geen id. Dat is precies waar de objectpool voor is (zie
     scripts/lib/objectpool.js): oogsten is geen raden.

     GANG A laat de EIGENAAR elke route aanraken met een plausibel lijf, en
     oogst alles wat er terugkomt. Dat werkt twee kanten op: de leesroutes
     leveren de id's van wat er al is, en de maak-routes maken tijdens deze gang
     zelf nieuwe objecten aan waarvan het antwoord het id draagt.
     GANG B geeft iedereen die de eerste keer niet binnenkwam een tweede kans,
     nu met een verrijkt lijf.

     Wat B straks stuurt is LETTERLIJK HETZELFDE LIJF als waarmee de eigenaar
     binnenkwam. Anders vergelijkt de proef twee verschillende vragen en zegt
     een 404 voor B niets over de scheiding. */
  const wpPool = maakPool();
  const ijkUit = new Map();
  if (eig && huizen.length) {
    for (const r of werkplekRoutes) {
      const lijf = { ...plausibelLijf(r.pad), bedrijf: code };
      const ijk = await post(r.pad, lijf, eig);
      if (ijk.status >= 200 && ijk.status < 300) wpPool.leer(ijk.data, r.pad);
      ijkUit.set(r.pad, { ijk, lijf, verrijkt: false });
    }
    for (const r of werkplekRoutes) {
      const v = ijkUit.get(r.pad);
      if (v.ijk.status >= 200 && v.ijk.status < 300) continue;
      /* `bedrijf` wordt NA het verrijken teruggezet: de pool overschrijft
         id-achtige velden, en het huis waar we tegen ijken staat vast. */
      const lijf = { ...wpPool.verrijk(v.lijf, r.pad).lijf, bedrijf: code };
      const ijk = await post(r.pad, lijf, eig);
      if (ijk.status >= 200 && ijk.status < 300) {
        wpPool.leer(ijk.data, r.pad);
        ijkUit.set(r.pad, { ijk, lijf, verrijkt: true });
      }
    }
  }

  let herwonnen = 0;
  for (const r of werkplekRoutes) {
    const sleutel = r.methode + ' ' + r.pad;
    if (!eig || !huizen.length) {
      werkplekTelling.onbereikbaar++;
      werkplekPerRoute[sleutel] = { staat: 'onbereikbaar',
        reden: eig ? 'de eigenaar ziet geen enkel huis; geen open deur om tegen te ijken'
          : 'geen eigenaarstoken; zonder ijking bewijst een weigering niets' };
      continue;
    }
    const gang = ijkUit.get(r.pad);
    const ijk = gang.ijk;
    if (!(ijk.status >= 200 && ijk.status < 300)) {
      werkplekTelling.onbereikbaar++;
      werkplekPerRoute[sleutel] = { staat: 'onbereikbaar', status: ijk.status,
        reden: 'ook de rechtmatige eigenaar kwam er niet in (' + ijk.status + '), ook niet met een ' +
          'lijf dat verrijkt was met echte id\'s uit zijn eigen huis: deze deur is voor iedereen ' +
          'dicht, dus een weigering voor B bewijst geen scheiding' };
      continue;
    }
    if (gang.verrijkt) herwonnen++;
    const aanval = await roep(r.pad, gang.lijf, 2, B);
    const o = oordeelIdor(aanval.status, aanval.tekst);
    /* EEN 2xx OP EEN GEFILTERDE LIJST IS GEEN DOORBRAAK, en dit huis heeft er
       een: /api/werkplek/mijn antwoordt elk ingelogd lid met 200 en geeft
       daarin ALLEEN de huizen waar hij in mag -- voor B dus een lege lijst.
       Dat is geen lek maar precies de bedoeling. Het onderscheid is meetbaar:
       draagt B's antwoord de code van het huis, dan kreeg hij de inhoud;
       draagt het hem niet, dan is het gefilterd. Zonder deze scheiding meldt
       de proef een lek dat er niet is, en na drie loze alarmen zet iemand hem
       uit (dezelfde les als de ruisvloer van de staatproef). */
    const draagtInhoud = new RegExp('\\b' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i')
      .test(String(aanval.tekst || ''));
    if (o.staat === 'doorbraak' && !draagtInhoud) {
      werkplekTelling.gescheiden++;
      werkplekPerRoute[sleutel] = { status: aanval.status, staat: 'gescheiden', bedrijf: code,
        reden: 'B kreeg ' + aanval.status + ' maar zonder de inhoud van dit huis (gefilterde lijst): ' +
          'de scheiding zit in het antwoord, niet in de statuscode' };
      continue;
    }
    if (o.staat === 'doorbraak') {
      werkplekTelling.doorbraak++;
      werkplekPerRoute[sleutel] = { status: aanval.status, staat: 'doorbraak', bedrijf: code,
        reden: 'de eigenaar kwam binnen (' + ijk.status + ') EN lid B ook (' + aanval.status +
          '), terwijl B geen toegang tot dit huis heeft: de werkplek-poort scheidt hier niet' };
    } else if (o.staat === 'gescheiden') {
      werkplekTelling.gescheiden++;
      werkplekPerRoute[sleutel] = { status: aanval.status, staat: 'gescheiden', bedrijf: code,
        reden: 'de deur ging open voor de eigenaar (' + ijk.status + ') en bleef dicht voor B (' +
          aanval.status + '): bewezen scheiding op de werkplek-poort' };
    } else {
      werkplekTelling.onbereikbaar++;
      werkplekPerRoute[sleutel] = { status: aanval.status, staat: 'onbereikbaar', reden: o.reden };
    }
  }

  klaar();

  const doorbraken = Object.entries(perRoute).filter(([, v]) => v.staat === 'doorbraak');
  /* DE ZWARE PADEN APART GETELD: dat is waar het toestel voor is, en een totaal
     over 2000 routes laat niet zien of juist die nu gekruist zijn. `aanDeDeur`
     telt wat nog steeds aan de toesteldeur strandde -- blijft dat hoog terwijl
     het toestel gebonden is, dan tekent de client verkeerd. */
  const zwaar = { routes: 0, gescheiden: 0, doorbraak: 0, nagekeken: 0, publiek: 0, onbereikbaar: 0, aanDeDeur: 0 };
  for (const [sleutel, v] of Object.entries(perRoute)) {
    if (!zwaarPad(sleutel.split(' ')[1])) continue;
    zwaar.routes++;
    zwaar[v.staat] = (zwaar[v.staat] || 0) + 1;
    if (/bezitsbewijs vereist/.test(v.reden || '')) zwaar.aanDeDeur++;
  }
  const uit = {
    stempel: stempel(),
    uitleg: 'Twee echte leden met dezelfde rol: A oogst objecten (objectpool), B probeert ze te ' +
      'bedienen. gescheiden = B geweigerd (bewijs); doorbraak = B kreeg 2xx op een object uit A\'s ' +
      'antwoord (BEVINDING, met de hand nakijken -- kan publiek zijn); onbereikbaar = geen id of ' +
      'validatie strandde eerder. Zie scripts/lib/idor.js voor het oordeel.',
    grens: 'een doorbraak is een VRAAG en geen vonnis: het object kan publiek zijn. En de proef ziet ' +
      'alleen wat A terugkreeg -- objecten die alleen via een eigen keten ontstaan, blijven buiten beeld.',
    gemeten: { routes: routes.length, ...telling, poolDomeinen: poolStand.domeinen, poolVelden: poolStand.velden,
      werkplek: { routes: werkplekRoutes.length, ...werkplekTelling,
        herwonnen, pool: wpPool.grootte() }, sessieHernieuwd: wacht.hernieuwd(), subjectVervangen: vervangen,
      toestel: toestelStand, zwarePaden: zwaar, afbakening, opbouw, merktekens: { vanA: vanA.size, controle: controle.size } },
    doorbraken: doorbraken.map(([route, v]) => ({ route, status: v.status, velden: v.velden })),
    perRoute,
    werkplekPerRoute
  };

  if (argv.includes('--json')) { console.log(JSON.stringify(uit, null, 1)); process.exitCode = 0; return; }
  console.log('  gescheiden (B geweigerd)      : ' + telling.gescheiden);
  console.log('  doorbraak (2xx -- NIEUW, NAKIJKEN): ' + telling.doorbraak);
  console.log('  nagekeken (geen lek, met reden): ' + telling.nagekeken);
  console.log('  publiek (id maakt geen verschil): ' + telling.publiek);
  console.log('  onbereikbaar (geen id/validatie): ' + telling.onbereikbaar);
  console.log('  weigering die een persoonsveld lekt: ' + telling.lek);
  console.log('  afbakening (gang 4, routes zonder id): ' + JSON.stringify(afbakening));
  console.log('  opbouw (gang 1b): ' + opbouw.geslaagd + ' van ' + opbouw.stappen + ' stappen geslaagd' +
    (opbouw.mislukt.length ? '; mislukt: ' + opbouw.mislukt.join(' | ') : ''));
  console.log('  objectpool: ' + poolStand.domeinen + ' domeinen, ' + poolStand.velden + ' velden');
  console.log('  toestel: ' + toestelStand.gebonden + ' bindingen, ' + toestelStand.gekeurd + ' gekeurd' +
    (toestelStand.mislukt.length ? ', MISLUKT: ' + toestelStand.mislukt.join('; ') : ''));
  console.log('  zware paden: ' + JSON.stringify(zwaar));
  console.log('\n  WERKPLEK-POORT (de objectpoort-routes), geijkt op de eigenaar:');
  console.log('    gescheiden (eigenaar erin, B eruit): ' + werkplekTelling.gescheiden);
  console.log('    doorbraak (B kwam ook binnen)       : ' + werkplekTelling.doorbraak);
  console.log('    onbereikbaar (geen open deur)      : ' + werkplekTelling.onbereikbaar);
  console.log('    herwonnen met een verrijkt lijf    : ' + herwonnen +
    '  (pool: ' + wpPool.grootte().domeinen + ' naamruimtes, ' + wpPool.grootte().velden + ' velden)');
  console.log('    sessie hernieuwd na een dode 401    : ' + wacht.hernieuwd() +
    '  (deze proef loopt ook langs /api/logout)');
  console.log('    proefpersoon vervangen             : ' + vervangen +
    '  (deze proef loopt ook langs /api/privacy/delete)\n');
  for (const [route, v] of doorbraken.slice(0, 20)) console.log('   ? ' + route + ' -> ' + v.status + ' (via ' + (v.velden || []).join(',') + ')');

  if (VASTLEGGEN) {
    fs.writeFileSync(UITSLAG, JSON.stringify(uit, null, 1) + '\n');
    console.log('\n  vastgelegd in IDOR.json\n');
  } else {
    console.log('\n  (niet vastgelegd; --vastleggen schrijft IDOR.json)\n');
  }
  process.exitCode = 0;
})().catch(e => { console.error('de IDOR-proef viel om: ' + (e && e.stack || e)); process.exit(2); });
