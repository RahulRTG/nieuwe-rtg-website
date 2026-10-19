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
  /* De tweede opbouwronde (19 oktober 2026). De tegenpoging staat nu in het
     register (`tegenpoging`); vier van de vijf vielen op 409, de TOESTAND die
     B's eigen eerste poging zette. */
  'POST /api/home/onderhoud/meld': 'woningOnderhoud.meld(req.session.key, body) leest geen id en maakt een nieuwe melding voor B; de tegenpoging gaf 409 door B\'s eerste melding',
  'POST /api/mall/aanvraag': 'mallAanvragen.plaats(req.session.key, ...) maakt een nieuwe aanvraag voor B; de pool vulde openbare categorie- en etage-id\'s in, en met verzonnen waarden faalt de validatie (400). Er wordt geen aanvraag van A aangeraakt',
  'POST /api/reserveer': 'reserveerTafel(req.session, ...) zet customerKey uit de SESSIE; een customerKey in het lijf wordt niet gelezen. De tegenpoging gaf 409 "al een reservering voor dit moment" door B\'s eerste reservering',
  'POST /api/vak/wachtlijst/zet': 'wachtZet({ key: req.session.key, ... }) zet B op de wachtlijst; de supplierCode is een openbare zaakcode, en de tegenpoging gaf 409 "al op de wachtlijst" door B\'s eerste poging',
  'POST /api/code/scan': 'een dynamische code is een getoonde code die een ANDER hoort te scannen; dyncode.lees controleert alleen handtekening en geldigheid, en een verzonnen token geeft 422',
  /* DE ZAKEN (gang 5, 19 oktober 2026): KIKUNOI tegen PONTO. Dertien
     kandidaten, alle dertien met de hand nagelezen: elke route haalt de zaak uit
     req.supplier (of de medewerker uit staffKey), en het id uit het lijf is
     een catalogus-id of wordt genegeerd. De tegenpoging faalde telkens op de
     TOESTAND die B's eerste poging zette of op validatie -- niet op A's id. De
     verdachtste (band/betaal, tegenpoging 404) is los gereproduceerd: KIKUNOI
     maakt band BAND-77, PONTO betaalt erop -> 404 "Deze band kennen we niet",
     KIKUNOI zelf -> 200. B betaalde in de gang op een EIGEN band die hij een
     route eerder (club/band) met hetzelfde verrijkte nummer had gemaakt. */
  'POST /api/staff/gemoed/zet': 'gemoedZet(staffKey(req), body): de stemming van de medewerker zelf; een stemming-id is een categorie',
  'POST /api/supplier/horeca/club/band/betaal': 'bandVan(req.supplier.code, nummer) zoekt alleen banden van de EIGEN zaak; los gereproduceerd: PONTO op een band van KIKUNOI -> 404. In de gang betaalde B op een band die B zelf een route eerder had gemaakt',
  'POST /api/supplier/horeca/venue/publiceer': 'leest alleen req.supplier.code en geen lijf; B publiceerde zijn EIGEN venue-concept, waarna de tegenpoging niets meer vond (404)',
  'POST /api/supplier/magnaat/studio/importeer': 'importeer(supplier, ...) zet het menu en de kamers van de EIGEN zaak in haar eigen tweeling; de tegenpoging gaf 409 door B\'s eerste import',
  'POST /api/supplier/net/verzoek': 'een netwerkverzoek gaat naar een andere zaak op haar OPENBARE code (findSupplier); dat is de bedoelde handeling, de verzoeker is req.supplier',
  'POST /api/supplier/overheid/kvk/inschrijven': 'kvkInschrijven({ supplierCode: req.supplier.code }): de eigen zaak; het kvknummer uit het lijf maakt niets van A open, de tegenpoging gaf 409 door B\'s eerste inschrijving',
  'POST /api/supplier/poort/rondleiding': 'rondleidingZet(req.supplier, id): de id is een vaste rondleiding uit de catalogus; een verzonnen id geeft 400',
  'POST /api/supplier/pr/nieuwsbrief': 'nieuwsbrief van req.supplier.code; de tegenpoging gaf 429 (hoogstens een per 7 dagen) door B\'s eerste brief',
  'POST /api/supplier/staff/invite': 'maakInvite(req.supplier, ...) met een idem-sleutel "inv:" + req.supplier.code: een nieuwe uitnodiging voor de EIGEN zaak; de tegenpoging gaf 409',
  'POST /api/supplier/training/add': 'een trainingstip in db.data.training[req.supplier.code]; de tegenpoging gaf 409 "al een tip met deze titel" door B\'s eerste poging',
  'POST /api/supplier/training/remove': 'zoekt de tip op titel in de lijst van req.supplier.code; B verwijderde zijn EIGEN tip uit de vorige route, daarna vond de tegenpoging niets (404)',
  'POST /api/supplier/verkoopweg/zet': 'commerce.wegZet(req.supplier.code, ...): de eigen verkoopwegen; soort en toegang zijn catalogus-waarden, verzonnen waarden geven 400',
  'POST /api/supplier/zaak/functie': 'zaakZet(req.supplier, id, aan): de functie-id is een catalogus-id; verzonnen geeft 400',
  /* WIE A IS, IN B'S ANTWOORD (19 oktober 2026): de 2xx-routes die eerst
     ongezien `publiek` heetten, worden nu gelezen op A's codenaam, e-mail en
     merkwoord. Vier treffers, met de hand nagelezen; alle vier een openbare
     etalage op codenaam, en nergens een sleutel of persoonsgegeven. */
  'POST /api/member/pulse/bewaard': 'pulseBewaard(req.session.key): B\'s EIGEN bladwijzers, gefilterd op zichtbaar(); B bewaarde in gang 2 een zichtbare post van A (pulse/bewaar, hierboven nagekeken), dus de auteur-codenaam staat erin',
  'POST /api/metier/lid': 'Metier is een openbaar beroepsregister: metier.publiek() geeft het profiel op codenaam, en aanbevelingenVan() laat verborgen aanbevelingen weg; B zag de aanbeveling die A op C\'s profiel schreef, met A\'s codenaam als schrijver',
  'POST /api/metier/zoek': 'kern/metier/zoek.js: "wie niets invulde, staat niet in de etalage" -- een ingevuld profiel is vindbaar op codenaam, zonder sleutel; A vulde zijn kaart in de opbouw',
  'POST /api/residentie/gids': 'de gids toont suites met s.open op codenaam; let wel: een suite ONTSTAAT open (kern/residentie/index.js suiteVan, open: true), dus wie zijn suite opent staat in de gids zonder zelf voor open te kiezen -- een productvraag over de standaard, geen IDOR',
  'POST /api/carriere/ledger/zet': 'carriereledger.zet(key, data) leest geen id en schrijft een NIEUW feit in reeks(key) van B; de tegenpoging gaf 409 "staat er al, woord voor woord" door B\'s eigen eerste regel',
  'POST /api/member/magnaat/stad/verlaat': 'stad.verlaat(req.session.key) leest het lijf niet: B verlaat zijn EIGEN stad, en de code van A doet niets'
};
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;
const VASTLEGGEN = argv.includes('--vastleggen');

if (require.main !== module) { module.exports = {}; return; }

(async () => {
  /* Het kaatsmodel (./lib/kaatsmodel.js) is de lokale modelserver van deze
     wereld: een AI-route geeft dan terug wat de server in de prompt zette, en een
     merkwoord van A in B's prompt valt op. Zonder model antwoordden die routes
     503 en bleef de vraag ongesteld. */
  const kaats = await require('./lib/kaatsmodel').start();
  const server = await start({ naam: 'idor', env: Object.assign({ RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF' }, kaats.omgeving) });
  const { basis } = server;
  const klaar = () => { kaats.stop(); server.klaar(); };

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
  const ctx = { get tegen() { return leden[3]; }, get ik() { return leden[1]; }, merk: opbouwLib.merkwoord() };
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
  /* DE HANDLERPOORT. Een route zonder bewakerslaag controleert de sessie in de
     handler (een stroomticket, een dynamische code, een gezins- of werkruimte-
     token). Ledenschermen roepen er tientallen aan met een ledentoken, en
     /api/stroom/ticket geeft een lid gewoon 200. Ze horen dus dezelfde vraag te
     krijgen. Of een lid er binnenkomt, beslist de gang zelf: komt A er niet in,
     dan blijft de route eerlijk onbereikbaar. */
  const handlerRoutes = verdeling.zonderRol.filter(z => /^geen bewakerslaag/.test(z.reden))
    .map(z => ({ methode: z.methode, pad: z.pad, rol: 'handler' }));
  routes = routes.concat(handlerRoutes);
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
  const hulp = { post, kaal, A: () => A, C: () => C,
    tweedeSessieA: async () => ((await post('/api/auth/login', { login: geheugen[1].email, password: geheugen[1].wachtwoord })).data || {}).token || null };
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
    /* Wat C in de opbouw maakt (een clip, een aanbeveling voor A) is van C en
       hoort bij de controle: anders lijkt C's nieuwe object straks een
       merkteken van A, alleen omdat C het na zijn controlegang maakte. */
    if (st.als === 'tegen' && u.data && typeof u.data === 'object') waarden(u.data, controle);
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
  /* EEN KRUISFUNCTIE VOOR TWEE GANGEN, en voor twee soorten tegenpartij: twee
     leden (hieronder) en twee zaken (gang 5). Wie A en B zijn, staat in de
     aanroep; het oordeel staat hier een keer, zodat het niet uiteenloopt
     (LAT.md regel 4). */
  const verzonnen = () => 'ZZ-' + Math.random().toString(36).slice(2, 10);
  const spoor = (pad) => process.env.IDOR_SPOOR && new RegExp(process.env.IDOR_SPOOR).test(pad);
  async function kruis({ routes, pool, basis, eigenVan, vanA, controle, wie, roepA, roepB, tegenB }) {
    const perRoute = {};
    const telling = { gescheiden: 0, doorbraak: 0, nagekeken: 0, publiek: 0, onbereikbaar: 0, lek: 0, afgebakend: 0 };
    for (const r of routes) {
      const sleutel = r.methode + ' ' + r.pad;
      const verrijkt = pool.verrijk(basis(r.pad), r.pad);
      /* A's eigen verwijzingen uit de opbouw (./lib/idoropbouw.js VAN_A) gaan er
         NA het verrijken op: de pool kent een IBAN niet en deelt een `id` per
         domein, en B hoort precies A's object te noemen. */
      const eigen = eigenVan(r.pad);
      const lijf = Object.assign(verrijkt.lijf, eigen);
      const velden = [...new Set([...verrijkt.velden, ...Object.keys(eigen)])];
      if (!velden.length) { telling.onbereikbaar++; perRoute[sleutel] = { staat: 'onbereikbaar', reden: 'geen id van A in dit domein' }; continue; }
      const u = await roepB(r.pad, lijf);
      if (spoor(r.pad)) console.error('SPOOR2B', r.pad, u.status, String(u.tekst).slice(0, 200));
      const o = oordeelIdor(u.status, u.tekst);
      /* WIE A IS, IN B'S ANTWOORD. Een 2xx voor B die ook met een verzonnen id
         2xx blijft, heette publiek -- zonder dat iemand in het antwoord keek.
         Draagt B's antwoord A's codenaam, e-mail of merkwoord, dan kreeg B iets
         van A, welke statuscode de tegenpoging ook geeft. (Gemeten toen het
         kaatsmodel meedraaide: een AI-route die A's profiel in B's prompt zet,
         zou anders als "publiek" door de meting gaan.) */
      const zagA = (wie() || []).filter((w) => typeof w === 'string' && w.length >= 6 && !controle.has(w) &&
        !String(JSON.stringify(lijf)).includes(w) && String(u.tekst || '').includes(JSON.stringify(w).slice(1, -1)));
      if (o.staat === 'doorbraak' && zagA.length) {
        if (NAGEKEKEN[sleutel]) {
          telling.nagekeken++;
          perRoute[sleutel] = { status: u.status, staat: 'nagekeken', velden, gezien: zagA.slice(0, 3),
            reden: 'B zag wie A is; met de hand nagekeken en GEEN lek: ' + NAGEKEKEN[sleutel] };
          continue;
        }
        perRoute[sleutel] = { status: u.status, staat: 'doorbraak', velden, gezien: zagA.slice(0, 3),
          reden: 'B kreeg ' + u.status + ' en zijn antwoord draagt wie A is (' + zagA.length + ' merkteken(s)): NAKIJKEN' };
        telling.doorbraak++;
        continue;
      }
      if (o.staat === 'doorbraak') {
        const nep = { ...lijf };
        for (const v of velden) nep[v] = verzonnen();
        const tegenpoging = await tegenB(r.pad, nep);
        if (tegenpoging.status >= 200 && tegenpoging.status < 300) {
          telling.publiek++;
          perRoute[sleutel] = { status: u.status, staat: 'publiek', velden,
            reden: 'ook met een VERZONNEN id een ' + tegenpoging.status + ': de route is publiek/rol-open, ' +
              'A\'s id maakt geen verschil -- geen objectreferentie om te schenden' };
          continue;
        }
        if (NAGEKEKEN[sleutel]) {
          telling.nagekeken++;
          perRoute[sleutel] = { status: u.status, staat: 'nagekeken', velden,
            reden: 'doorbraak-kandidaat, met de hand nagekeken en GEEN lek: ' + NAGEKEKEN[sleutel] };
          continue;
        }
        perRoute[sleutel] = { status: u.status, tegenpoging: tegenpoging.status, staat: 'doorbraak', velden,
          reden: 'B kreeg ' + u.status + ' met A\'s id maar ' + tegenpoging.status + ' met een verzonnen id: ' +
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
        const ijk = await roepA(r.pad, lijf);
        if (spoor(r.pad)) console.error('SPOOR2', r.pad, 'B', u.status, String(u.tekst).slice(0, 100), 'A', ijk.status, String(ijk.tekst).slice(0, 200));
        if (ijk.status >= 200 && ijk.status < 300) {
          const merken = merktekens({ antwoordA: ijk.data, vanA, controle, lijf, wie: wie() });
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

    /* ---- DE AFBAKENING (scripts/lib/afbakening.js) ----

       De routes waar het kruisen niets kon, omdat ze geen id dragen: ze bakenen
       af op de sessie. Hier is de vraag of B met HETZELFDE verzoek iets van A
       terugkrijgt. A gaat eerst: alleen als A's antwoord een merkteken van A
       draagt (iets wat A zag, de controle niet, en dat niet in het verzoek
       stond), zegt B's antwoord iets. Anders blijft de route onbereikbaar. */
    const afbakening = { routes: 0, afgebakend: 0, gescheiden: 0, doorbraak: 0, nagekeken: 0, onbereikbaar: 0 };
    for (const r of routes) {
      const sleutel = r.methode + ' ' + r.pad;
      const v = perRoute[sleutel];
      if (!v || v.staat !== 'onbereikbaar' || (v.velden && v.velden.length)) continue;
      afbakening.routes++;
      const lijf = basis(r.pad);
      const a = await roepA(r.pad, lijf);
      /* EEN MERKTEKEN IS IETS WAT A AL HAD, en niet wat deze ene aanroep net
         verzon. Hier stond eerst waarden(a.data, vanA) VOOR de merktekens, en
         dan was het verse ticket van /api/stroom/ticket een "merkteken van A":
         een waarde die per aanroep nieuw is, die B dus nooit kan zien, wat de
         route ook doet. Een experiment dat niet kan zakken (BEWIJSMACHINE.md par.
         6a). Nu telt alleen wat A in een EERDERE aanroep (oogst, opbouw) al kreeg:
         een blijvend object van A. */
      const merken = merktekens({ antwoordA: a.data, vanA, controle, lijf, wie: wie() });
      if (a.status >= 200 && a.status < 300 && a.data && typeof a.data === 'object') waarden(a.data, vanA);
      /* IDOR_SPOOR=<patroon> toont voor die routes wat A kreeg: om een open route te
         begrijpen zonder het register te lezen. Verandert niets aan de meting. */
      if (spoor(r.pad)) console.error('SPOOR4', r.pad, a.status, JSON.stringify(merken), String(a.tekst).slice(0, 400));
      const b = merken.length && a.status >= 200 && a.status < 300 ? await roepB(r.pad, lijf) : { status: 0, tekst: '' };
      let o = oordeelAfbakening({ a, b, merken });
      if (o.staat === 'doorbraak' && NAGEKEKEN[sleutel]) {
        o = { staat: 'nagekeken', reden: 'afbakening-kandidaat, met de hand nagekeken en GEEN lek: ' + NAGEKEKEN[sleutel] };
      }
      afbakening[o.staat]++;
      if (o.staat === 'onbereikbaar') { v.afbakening = o.reden; continue; }   // het kruisen blijft staan, met de reden van de afbakening erbij
      telling.onbereikbaar--;
      telling[o.staat]++;
      if (o.lek) telling.lek++;
      perRoute[sleutel] = { status: b.status, statusA: a.status, gang: 'afbakening', ...o, velden: [] };
    }
    return { perRoute, telling, afbakening };
  }

  /* GANG 2 EN 4: de leden. */
  const { perRoute, telling, afbakening } = await kruis({ routes, pool, basis: basisLijf,
    /* Wie A IS: codenaam, e-mail, en A's merkwoord. Dat laatste staat alleen in
       wat A zelf maakte; een antwoord voor B dat het draagt, ergens in een lange
       tekst (een AI-prompt, een chatgeschiedenis), toont iets van A. */
    eigenVan: (pad) => opbouwLib.vanA(pad, ctx), vanA, controle, wie: () => [...(identiteit[1] || []), ctx.merk],
    roepA: (pad, lijf) => roep(pad, lijf, 1, A), roepB: (pad, lijf) => roep(pad, lijf, 2, B),
    tegenB: (pad, lijf) => post(pad, lijf, B) });

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

  /* ---- GANG 5: DE ZAKEN (organisatie A tegen organisatie B) ----

     Ledenschermen als Horeca, Tweede scherm en OV-routes roepen leveranciers-
     routes aan. Daar is "een ander lid" geen vraag; de vraag is of een ANDERE
     ZAAK bij het object van deze zaak kan. Dezelfde kruisfunctie, met zaken:
     de manager van KIKUNOI is A, die van PONTO is B, en SAKURA is de controle
     die de routes eerst loopt. De zaak komt bij elke leveranciersroute uit het
     token, dus B probeert met zijn eigen sessie de objecten die A terugkreeg.

     Een zaaksessie kan eindigen (een uitlogroute, een personeelswissel): de
     sessiewacht haalt dan een verse via het rooster, zoals bij de leden. */
  const zaakLogin = async (code) => {
    const ro = await post('/api/supplier/roster', { code });
    const man = (((ro.data || {}).staff) || []).find((x) => x.role === 'manager');
    if (!man) return null;
    return ((await post('/api/supplier/login', { code, staffId: man.id, pin: '1234' })).data || {}).token || null;
  };
  const ZAKEN = { 11: 'KIKUNOI', 12: 'PONTO', 13: 'SAKURA' };
  const zaakTok = {};
  for (const [n, code] of Object.entries(ZAKEN)) zaakTok[n] = await zaakLogin(code);
  const zaakLeeft = async (tok) => (await post('/api/supplier/state', {}, tok)).status === 200;
  const zaakWacht = maakSessiewacht({ post, rollen: Object.fromEntries(Object.entries(ZAKEN).map(([n, code]) =>
    [n, { vers: () => zaakLogin(code), leeft: zaakLeeft, zet: (t) => { zaakTok[n] = t; } }])) });
  const zroep = (pad, lijf, n) => zaakWacht.roep(pad, lijf, n, zaakTok[n]);
  const zaakRoutes = verdeelOpRol(kandidaten, ['supplier']).metRol.filter((r) => r.rol === 'supplier');
  const zLijf = (pad) => opbouwLib.lijfVoor(pad, plausibelLijf(pad), {});
  let zaak = { routes: zaakRoutes.length, reden: null };
  let zaakPerRoute = {};
  if (!zaakTok[11] || !zaakTok[12] || !zaakTok[13]) {
    zaak.reden = 'geen drie zaaksessies (' + Object.entries(ZAKEN).filter(([n]) => !zaakTok[n]).map(([, c]) => c).join(', ') + ')';
  } else {
    const zControle = new Set();
    for (const r of zaakRoutes) {
      const u = await zroep(r.pad, zLijf(r.pad), 13);
      if (u.data && typeof u.data === 'object') waarden(u.data, zControle);
    }
    const zPool = maakPool();
    const vanZaakA = new Set();
    for (const r of zaakRoutes) {
      const u = await zroep(r.pad, zLijf(r.pad), 11);
      if (u.status >= 200 && u.status < 300 && u.data && typeof u.data === 'object') { zPool.leer(u.data, r.pad); waarden(u.data, vanZaakA); }
    }
    const z = await kruis({ routes: zaakRoutes, pool: zPool, basis: zLijf, eigenVan: () => ({}),
      vanA: vanZaakA, controle: zControle, wie: () => [],
      roepA: (pad, lijf) => zroep(pad, lijf, 11), roepB: (pad, lijf) => zroep(pad, lijf, 12),
      tegenB: (pad, lijf) => post(pad, lijf, zaakTok[12]) });
    zaakPerRoute = z.perRoute;
    zaak = { routes: zaakRoutes.length, ...z.telling, afbakening: z.afbakening, pool: zPool.grootte(),
      sessieHernieuwd: zaakWacht.hernieuwd(), zaken: ZAKEN };
  }

  /* ---- GANG 6: DE STROOM (/api/stroom/ticket en GET /api/stream) ----

     De live stroom van een lid draait op een ticket: de sessie gaat in de kop
     naar /api/stroom/ticket, het ticket gaat in het adres naar /api/stream.
     Achttien ledenschermen openen hem. De vraag is of de stroom van B iets van
     A laat zien, en daar is geen id voor: een ticket is van wie hem haalde.

     Het experiment: A en B openen elk hun EIGEN stroom. Dan stuurt C in het
     gesprek met A een bericht met een vers merkwoord. A's stroom moet het
     dragen -- dat is de ijking, want zonder die gebeurtenis bij A bewijst een
     lege stroom bij B niets -- en B's stroom niet. Daarna probeert B A's al
     GEBRUIKTE ticket: een ticket is eenmalig, en een tweede opening hoort
     geweigerd te worden, ook voor een ander. */
  const leesStroom = async (ticket, ms) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    let status = 0, tekst = '';
    try {
      const r = await fetch(basis + '/api/stream?ticket=' + encodeURIComponent(ticket || ''), { signal: ac.signal });
      status = r.status;
      if (r.body) {
        const rd = r.body.getReader();
        for (;;) { const { value, done } = await rd.read(); if (done) break; tekst += Buffer.from(value).toString('utf8'); }
      }
    } catch (e) { /* afgebroken na ms: zo eindigt een stroom */ }
    clearTimeout(t);
    return { status, tekst };
  };
  const stroom = { staat: 'onbereikbaar', reden: null };
  {
    const merk = 'stroom-' + opbouwLib.merkwoord();
    const tA = ((await post('/api/stroom/ticket', { stroom: 'lid' }, A)).data || {}).ticket;
    const tB = ((await post('/api/stroom/ticket', { stroom: 'lid' }, B)).data || {}).ticket;
    if (!tA || !tB || !ctx.gesprek) {
      stroom.reden = 'geen ticket voor A en B, of geen gesprek van A met C om een gebeurtenis bij A te laten landen';
    } else {
      const lezen = Promise.all([leesStroom(tA, 3500), leesStroom(tB, 3500)]);
      await new Promise((r) => setTimeout(r, 800));
      const stuur = await roep('/api/comm/stuur', { id: ctx.gesprek, tekst: merk }, 3, C);
      const [sA, sB] = await lezen;
      const herhaal = await leesStroom(tA, 800);
      Object.assign(stroom, { statusA: sA.status, statusB: sB.status, stuur: stuur.status, herhaal: herhaal.status });
      if (!(sA.status === 200 && sA.tekst.includes(merk))) {
        stroom.reden = 'A\'s stroom droeg het bericht van C niet (status ' + sA.status + ', bericht ' + stuur.status +
          '): zonder gebeurtenis bij A zegt een lege stroom bij B niets';
      } else if (sB.tekst.includes(merk)) {
        stroom.staat = 'doorbraak';
        stroom.reden = 'B\'s EIGEN stroom droeg het bericht dat C aan A stuurde';
      } else if (herhaal.status >= 200 && herhaal.status < 300) {
        stroom.staat = 'doorbraak';
        stroom.reden = 'A\'s gebruikte ticket opende de stroom een tweede keer (' + herhaal.status + '): een ticket in een adres hoort eenmalig te zijn';
      } else {
        stroom.staat = 'afgebakend';
        stroom.reden = 'A\'s stroom droeg het bericht van C, B\'s eigen stroom (' + sB.status + ') niet, en A\'s gebruikte ticket werd een tweede keer geweigerd (' +
          herhaal.status + ')';
      }
    }
    /* Het experiment beproeft beide routes: het ticket bepaalt wiens stroom opengaat. */
    perRoute['GET /api/stream'] = { gang: 'stroom', ...stroom };
    if (stroom.staat !== 'onbereikbaar') perRoute['POST /api/stroom/ticket'] = { gang: 'stroom', ...stroom };
  }

  /* ---- GANG 7: DE PASSKEY (/api/webauthn/registreer, /weg, /bevestig/opties) ----

     Een passkey-ceremonie is niet na te doen met een verzonnen lijf, en dus
     stonden deze drie routes open op elk identiteitsscherm. De authenticator
     van test/webauthn-authenticator.js tekent met een echte P-256-sleutel; met
     hem registreert A een passkey langs de echte ceremonie. Daarna:
       registreer   B speelt A's ondertekende registratie na onder zijn eigen
                    sessie -- dat hoort te stranden (de challenge is van A);
       bevestig     A's ceremonie noemt A's credential; die van B hoort dat niet
                    te doen (anders weet B welke sleutels A heeft);
       weg          B probeert A's passkey weg te halen; daarna moet hij bij A
                    nog staan, en de ijking is dat A hem ZELF wel weg kan halen.
     Deze gang loopt als laatste: een passkey maakt A's herbevestiging zwaar, en
     dat zou de gangen hierboven anders raken. */
  const passkey = {};
  {
    const { maakAuthenticator } = require('../test/webauthn-authenticator');
    const url = new URL(basis);
    const sleutel = maakAuthenticator(url.hostname);
    const credVan = async (tok) => ((((await post('/api/webauthn/lijst', {}, tok)).data) || {}).sleutels || []).map((x) => x.id);
    const oA = await post('/api/webauthn/registreer/opties', { huidig: geheugen[1].wachtwoord }, A);
    const ch = oA.data && oA.data.opties && oA.data.opties.challenge;
    const antwoordA = ch ? sleutel.registratieAntwoord(ch, url.origin) : null;
    const regA = antwoordA ? await post('/api/webauthn/registreer', { antwoord: antwoordA, naam: 'IDOR passkey A' }, A) : { status: 0 };
    const credA = regA.status === 200 ? (await credVan(A))[0] : null;
    if (!credA) {
      passkey.reden = 'A kon geen passkey registreren (opties ' + oA.status + ', registreer ' + regA.status + '); zonder passkey van A is er niets te kruisen';
    } else {
      const oB = await post('/api/webauthn/registreer/opties', { huidig: geheugen[2].wachtwoord }, B);
      const naspel = await post('/api/webauthn/registreer', { antwoord: antwoordA, naam: 'nagespeeld' }, B);
      const bHeeft = (await credVan(B)).includes(credA);
      passkey.registreer = (naspel.status >= 400 && naspel.status < 500 && !bHeeft)
        ? { staat: 'gescheiden', status: naspel.status, reden: 'A registreerde een passkey (200); B speelde A\'s ondertekende registratie na onder zijn eigen sessie en kreeg ' +
            naspel.status + ', en A\'s credential staat niet in B\'s lijst' }
        : { staat: 'doorbraak', status: naspel.status, opties: oB.status, reden: 'B\'s nagespeelde registratie van A gaf ' + naspel.status + (bHeeft ? ' en A\'s credential staat in B\'s lijst' : '') + ': NAKIJKEN' };
      const bevA = await post('/api/webauthn/bevestig/opties', { actie: 'passkey-weg' }, A);
      const bevB = await post('/api/webauthn/bevestig/opties', { actie: 'passkey-weg' }, B);
      const zieA = String(bevA.tekst || '').includes(credA), zieB = String(bevB.tekst || '').includes(credA);
      passkey.bevestig = !zieA ? { staat: 'onbereikbaar', reden: 'A\'s eigen ceremonie noemde A\'s credential niet (' + bevA.status + '): niets om in B\'s ceremonie te zoeken' }
        : zieB ? { staat: 'doorbraak', reden: 'B\'s ceremonie noemde A\'s credential: NAKIJKEN' }
          : { staat: 'afgebakend', status: bevB.status, reden: 'A\'s ceremonie noemde A\'s credential, die van B (' + bevB.status + ') niet' };
      const wegB = await post('/api/webauthn/weg', { id: credA }, B);
      const nogBijA = (await credVan(A)).includes(credA);
      let wegA = { status: 0 };
      if (bevA.data && bevA.data.ceremonie && bevA.data.opties) {
        wegA = await post('/api/webauthn/weg', { id: credA, ceremonie: bevA.data.ceremonie,
          antwoord: sleutel.loginAntwoord(bevA.data.opties.challenge, url.origin, 1) }, A);
      }
      const ob = oordeelIdor(wegB.status, wegB.tekst);
      passkey.weg = !(wegA.status >= 200 && wegA.status < 300) ? { staat: 'onbereikbaar', reden: 'A kon zijn eigen passkey niet weghalen (' + wegA.status + '): de deur is voor niemand open, een weigering voor B bewijst niets' }
        : !nogBijA ? { staat: 'doorbraak', status: wegB.status, reden: 'na B\'s poging (' + wegB.status + ') stond A\'s passkey niet meer bij A: NAKIJKEN' }
          : ob.staat === 'gescheiden' ? { staat: 'gescheiden', status: wegB.status, reden: 'B kreeg ' + wegB.status + ' op A\'s passkey, die stond daarna nog bij A, en A haalde hem zelf weg (' + wegA.status + ')' }
            : { staat: ob.staat === 'doorbraak' ? 'doorbraak' : 'onbereikbaar', status: wegB.status, reden: 'B kreeg ' + wegB.status + ' op A\'s passkey: ' + ob.reden };
      perRoute['POST /api/webauthn/registreer'] = { gang: 'passkey', ...passkey.registreer };
      perRoute['POST /api/webauthn/bevestig/opties'] = { gang: 'passkey', ...passkey.bevestig };
      perRoute['POST /api/webauthn/weg'] = { gang: 'passkey', ...passkey.weg };
    }
  }

  klaar();

  const doorbraken = Object.entries(perRoute).concat(Object.entries(zaakPerRoute)).filter(([, v]) => v.staat === 'doorbraak');
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
      toestel: toestelStand, zwarePaden: zwaar, zaak, stroom, passkey, kaatsmodel: { verzoeken: kaats.verzoeken() }, afbakening, opbouw, merktekens: { vanA: vanA.size, controle: controle.size } },
    doorbraken: doorbraken.map(([route, v]) => ({ route, status: v.status, velden: v.velden })),
    perRoute,
    werkplekPerRoute,
    zaakPerRoute
  };

  if (argv.includes('--json')) { console.log(JSON.stringify(uit, null, 1)); process.exitCode = 0; return; }
  console.log('  gescheiden (B geweigerd)      : ' + telling.gescheiden);
  console.log('  doorbraak (2xx -- NIEUW, NAKIJKEN): ' + telling.doorbraak);
  console.log('  nagekeken (geen lek, met reden): ' + telling.nagekeken);
  console.log('  publiek (id maakt geen verschil): ' + telling.publiek);
  console.log('  onbereikbaar (geen id/validatie): ' + telling.onbereikbaar);
  console.log('  weigering die een persoonsveld lekt: ' + telling.lek);
  console.log('  afbakening (gang 4, routes zonder id): ' + JSON.stringify(afbakening));
  console.log('  zaken (gang 5, KIKUNOI tegen PONTO): ' + JSON.stringify(zaak));
  console.log('  stroom (gang 6): ' + JSON.stringify(stroom));
  console.log('  passkey (gang 7): ' + JSON.stringify(passkey));
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
