/* DE POORTWACHT -- klopt anoniem aan bij ELKE geregistreerde API-route.

   Waarom dit bestaat. De Keuring meldt al twee rondes dat 52% van de endpoints
   in geen enkele test voorkomt. Die honderden endpoints stuk voor stuk een
   echte test geven duurt maanden. Maar de vraag die er veiligheidsmatig het
   meest toe doet is veel simpeler, en voor alle 2500 tegelijk te stellen:

     KOMT ER IEMAND BINNEN DIE NIET IS INGELOGD?

   Een rechten-fout in een ongeteste hoek is precies het soort gat dat niemand
   opmerkt: de functie werkt immers. Deze ronde stelt daarom niet de vraag "doet
   dit endpoint het goed", maar "doet dit endpoint open voor een vreemde".

   De uitslag per route:
     DICHT    401/403 -- netjes geweigerd
     STIL     400/404/422/429/5xx -- geen gegevens eruit, maar de poort zit niet
              vóór de afhandeling; dat is geen lek, wel een rommelige volgorde
     OPEN     2xx -- er komt een antwoord. Staat de route niet in PUBLIEK
              hieronder, dan is dit een bevinding.

   WAT DIT NIET IS: een bewijs dat een route veilig is. Een route die netjes 401
   geeft kan nog steeds een IDOR hebben tussen twee ingelogde leden. Daar is de
   aanvalsronde (scripts/aanval.js) voor. Deze ronde dekt precies één klasse,
   maar dan wel volledig.

   Draai:  node scripts/poortwacht.js [http://127.0.0.1:3000]
           node scripts/poortwacht.js --json
           node scripts/poortwacht.js --json --per-route
   Exitcode 1 zodra er een route OPEN staat die niet publiek hoort te zijn.

   --PER-ROUTE, EN WAAROM DAT ER APART IN ZIT. De uitslag hierboven telt op:
   zoveel dicht, zoveel stil, zoveel open. Dat is genoeg om te weten of er een
   gat is, en te weinig voor scripts/bewijsmatrix.js -- die wil per route weten
   wie zijn voordeur heeft gemeten, want anders blijft de AUTH-kolom op
   "verklaard" staan (in de bron gelezen, niet gevraagd). Met --per-route komt
   het oordeel per METHODE+pad mee in de JSON. Standaard staat het uit: het zijn
   een paar duizend regels en de gewone lezer heeft er niets aan. */
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
/* Hetzelfde plausibele lijf als de rolproef; twee versies van "geloofwaardige
   invoer" lopen gegarandeerd uiteen (LAT.md regel 4). */
const { plausibelLijf } = require('./lib/rolproef');
/* WAT VOOR SOORT DEUR DIT IS. De routekaart draagt de bewakerslagen al mee; de
   indeling ervan staat in scripts/lib/bewakers.js en hoort hier niet nog een
   keer te worden bedacht (LAT.md regel 4). */
const bewakerskaart = require('./lib/bewakers');
const { stempel } = require('./lib/stempel');

const args = process.argv.slice(2);
const jsonUit = args.includes('--json');
const perRouteUit = args.includes('--per-route');
const BASIS = args.find(a => a.startsWith('http')) || 'http://127.0.0.1:3000';

/* DE GEDEELDE LIJST EERST, EN DAAROM. `scripts/lib/publiekeroutes.js` is de
   plek waar dit huis bijhoudt welke route BEWUST zonder poort open staat, met
   per stuk een reden die een mens heeft geschreven. Zijn eigen kop zegt waarom
   hij daar woont: "Twee plekken die dezelfde waarheid vasthouden lopen uiteen
   (LAT.md regel 4), en dat zou hier duur zijn."

   Deze sonde had zijn EIGEN lijst en las die andere niet -- een derde lezer die
   nooit is aangesloten. Ze waren uiteen gelopen tot 64 tegenover 125, met 75
   paden die alleen de gedeelde kende. Dat kostte echt iets: /api/claims,
   /api/sociaalbeleid en /api/betaaldiensttarief staan met een uitgeschreven
   reden op de gedeelde lijst, kwamen hier als OPEN uit de meting, werden
   daardoor in de bewijsmatrix een gezakte AUTH-cel, gingen in VERTROUWEN.json
   naar `geschorst`, en werden door server/middleware/schorspoort.js met een 503
   dichtgezet. Vier bewust publieke routes gingen offline omdat twee lijsten uit
   elkaar liepen.

   DE AANVULLING HIERONDER BLIJFT BESTAAN, en dat is geen halve reparatie maar
   een ander soort vraag. De gedeelde lijst beantwoordt: "deze route heeft GEEN
   poort, en dat is met opzet." Deze sonde vraagt iets anders: "deze route
   antwoordt met 200 aan een anonieme beller, en dat is met opzet." Die twee
   overlappen maar vallen niet samen: /api/metrics HEEFT een poort (de
   meetpoort) die vanaf een intern adres opengaat, en hoort dus juist NIET op de
   gedeelde lijst -- keuringsregel 28 zou hem daar terecht als overbodige
   uitzondering aanwijzen. Wat hier overblijft is precies die klasse, en elke
   regel zegt waarom hij hier en niet daar staat. */
const GEDEELD = require('./lib/publiekeroutes').PUBLIEK;

/* Routes die BEWUST open staan voor een niet-ingelogde bezoeker terwijl ze wel
   een poort hebben. Elke regel heeft een reden; staat er geen reden bij, dan
   hoort hij hier niet. */
const EIGEN = new Map([
  ['/api/health', 'liveness voor de load balancer'],
  ['/api/ready', 'readiness voor de load balancer'],
  ['/api/ice', 'STUN/TURN-servers voor bellen; bevat geen persoonsgegevens'],
  ['/api/auth/register', 'aanmelden kan per definitie niet ingelogd'],
  ['/api/auth/login', 'inloggen kan per definitie niet ingelogd'],
  ['/api/sso/waarheen', 'het inlogscherm moet weten naar welke provider het je stuurt'],
  ['/api/sso/start', 'de heenreis naar de provider van een klant: nog niemand is ingelogd'],
  ['/api/sso/terug', 'de provider stuurt de bezoeker hierheen terug, zonder onze sessie'],
  ['/api/sso/wissel', 'het overdrachtsbewijs omruilen: dat IS de inlog'],
  ['/api/sso/saml/start', 'de heenreis naar de SAML-provider van een klant: nog niemand is ingelogd'],
  ['/api/sso/saml/acs', 'de provider POST de assertie hierheen; een sessie bestaat op dat moment nog niet'],
  ['/api/sso/saml/metadata', 'wat een klant bij zijn provider invult -- geen gegevens, alleen onze eigen adressen'],
  ['/api/auth/forgot', 'wachtwoord vergeten: je bent juist buitengesloten'],
  ['/api/auth/reset', 'herstel met een token uit de e-mail'],
  ['/api/auth/verify-email', 'e-mailbevestiging met een token uit de e-mail'],
  ['/api/auth/resend', 'bevestigingsmail opnieuw sturen'],
  ['/api/aanmeld/start', 'de ballotage-intake begint voor het account bestaat'],
  ['/api/aanmeld/zeg', 'idem: het gesprek loopt voor de inlog'],
  ['/api/aanmelding/aanvraag', 'een lidmaatschapsaanvraag komt per definitie van buiten; het besluit erover zit achter officeAuth'],
  ['/api/bedrijf/werkruimte/maak', 'de eerste deur van het Werk OS: de organisatie bestaat nog niet en het beheer-token ontstaat pas hier; rem per afzender in server/bedrijf/index.js'],
  ['/api/foundation/school/school/maak', 'een school meldt zich aan voor er een login bestaat; hij start op "wacht" tot RTG goedkeurt, met een rem per afzender'],
  ['/api/account/start', 'accountherkenning aan de poort'],
  ['/api/zegel/sleutel', 'de PUBLIEKE sleutel; partners verifieren er offline mee'],
  ['/api/salon/promo', 'uitgelichte Salon-posts zijn het publieke campagnebeeld'],
  ['/api/gids/app', 'welke apps bestaan er; geen ledengegevens'],
  ['/api/config', 'publieke front-end-configuratie'],
  ['/api/i18n', 'vertalingen'],
  ['/api/talen', 'talenlijst'],
  ['/api/webauthn/opties', 'passkey-inlog begint voor je bent ingelogd'],
  ['/api/zegel/controleer', 'partners verifieren een zegel; de sleutel is toch al publiek'],
  ['/api/translate', 'de taalkiezer staat op het inlogscherm; met rem, en zonder inlog geen AI'],
  /* DE TWAALF DIE DE RONDE VAN 12 AUGUSTUS AANWEES. Ze stonden alle twaalf al in
     de bron beschreven als bewust open, maar niet hier -- en zolang dat zo was,
     telde de AUTH-kolom ze als GEZAKT. Een deur die met opzet openstaat en
     nergens als zodanig genoteerd is, is niet te onderscheiden van een deur die
     iemand vergat te sluiten. Vandaar per regel de reden, uit de code zelf. */
  ['/api/fout/client', 'een fout die het inloggen sloopt, komt nooit binnen achter een poort die inloggen vereist; met een lijfgrens van 4 kB en een rem per IP'],
  ['/api/kantoor/gesprek/start', 'vervangt het codeveld van de backoffice-inlog en heeft dezelfde rem; er komt nooit iets terug wat de beller intypte'],
  ['/api/lab2/bewoner/labs', 'het publieke beeld van een living lab: alleen naam, stad en land van de ACTIEVE labs, zonder budget, tekenaars of partners'],
  ['/api/lab2/bewoner/kader', 'de spelregels van het onderzoek zelf; die horen juist openbaar te zijn'],
  ['/api/onderneming/rechtsvormen', 'een vaste lijst rechtsvormen per land; algemene kennis, geen gegevens'],
  ['/api/rtfos/publiek/campagnes', 'het publieke gezicht van de RTFoundation: welke campagnes lopen er'],
  ['/api/rtfos/publiek/jaarverslagen', 'verantwoording van een goededoelenstichting hoort openbaar te zijn'],
  ['/api/rtfos/publiek/steden', 'in welke steden de RTFoundation samenwerkt; geen personen'],
  ['/api/stad/algoritmes', 'het transparantieregister: welke rekenregels meedraaien, met hun beslisruimte en hun bekende beperkingen'],
  ['/api/stad/besluiten', 'het besluitenregister; er zitten geen personen in -- fracties stemmen met zetels en een collegestem draagt een functie'],
  ['/api/vertaal/ui', 'idem: de knopteksten van een uitgelogd scherm'],
  /* NAGEMETEN OP 19 AUGUSTUS 2026, en dit was de enige open deur van de ronde.
     Invisible Arrival is de gastenkant: een gast zonder account typt een wens
     ("morgen om acht uur met z'n vieren") en krijgt terug hoe het systeem die
     leest. De route doet niets anders: hij leest req.body.tekst, haalt er met
     vaste patronen datum, tijd, personen en wensen uit, en geeft dat terug. Er
     komt geen database aan te pas, er wordt niets bewaard, en er gaat niets
     terug wat de beller niet zelf heeft ingetypt. De vervolgstap
     (/api/arrival/request) is WEL dicht: die eist een aanvraagcode.

     Achter een inlog zetten zou de functie kapotmaken -- een gast heeft per
     definitie geen account -- en hem hier ongenoemd laten staan is erger: dan
     staat deze ronde rood om een deur die met opzet openstaat, en dan leert
     iedereen die uitslag wegkijken. Hij heeft een eigen rem per IP
     (interpretRem) en een lijfgrens van 500 tekens. */
  /* DE TWEE METERS, en waarom ze hier staan zonder dat ze publiek zijn. De
     ronde klopt aan vanaf 127.0.0.1, en dat is precies het adres dat de
     meetpoort (server/meetpoort.js) wél binnenlaat als er geen
     RTG_METRICS_TOKEN is gezet -- de gewone opzet met Prometheus naast de app.
     Van buiten geeft hij 404, en met een token gezet moet dat token mee. Deze
     ronde meet dus zijn eigen adres en niet een open deur; zonder deze regel
     staat er twee keer "open" waar niets opendoet. */
  ['/api/metrics', 'de Prometheus-scrape: van buiten 404, alleen intern of met RTG_METRICS_TOKEN. De ronde klopt zelf vanaf 127.0.0.1 aan, en dat adres mag'],
  ['/api/metrics/kort', 'dezelfde poort, in JSON, voor het techniekbord'],
  ['/api/arrival/interpret', 'de gastenkant van Invisible Arrival: een gast heeft per definitie geen account. Leest alleen de meegestuurde tekst met vaste patronen, raakt de database niet en bewaart niets; met een eigen rem per IP'],
  ['/api/pasprijzen', 'de prijzen staan op de website'],
  ['/api/partnertrips', 'het partnerkanaal is er juist voor niet-leden'],
  ['/api/rtf/vacatures', 'vacatures zijn openbaar; daar solliciteer je op'],
  ['/api/krant/gids', 'de krantengids is publieke redactionele inhoud'],
  ['/api/les/apps', 'zoekt in de publieke bibliotheken; leeg zonder zoekterm'],
  ['/api/munt/opties', 'welke munten geaccepteerd worden; geen gegevens'],
  ['/api/push/key', 'de PUBLIEKE VAPID-sleutel -- die hoort iedereen te hebben'],
  ['/api/pay/gezond', 'leven-teken van de betaallaag'],
  ['/api/sat/ping', 'leven-teken voor de satellietverbinding'],
  ['/api/foundation/health', 'leven-teken van de RTF (zonder cijfers, zie server/foundation.js)'],
  ['/api/foundation/impact', 'de RTFoundation legt haar impact juist publiek af'],
  ['/api/foundation/tip', 'een opvoedtip; vaste tekst, geen gegevens'],
  ['/api/foundation/bespaartip', 'een bespaartip; vaste tekst, geen gegevens'],
  ['/api/foundation/gesprekskaart', 'een gesprekskaart; vaste tekst, geen gegevens'],
  ['/api/foundation/les/maak', 'bewust zonder inlog: een quizbord in de klas. Wel een uurgrens per IP -- zie server/routes/lesmaker.js'],
  /* De twee webhooks MOETEN publiek bereikbaar zijn: de betaalprovider belt ze.
     Ze zijn niet onbeschermd -- ze verifieren een handtekening, en in productie
     zonder secret weigeren ze (zie server/betaal.js en test/poortwacht.test.js). */
  ['/api/betaal/webhook', 'de betaalprovider belt hier aan; beveiligd met een handtekening'],
  ['/api/munt/webhook', 'idem voor de munt-aanbieder'],
  /* De zaakdoos meldt zijn status op het EIGEN net van de zaak. Dat is een
     bewuste keuze (zie server/routes/doos.js), maar hij hangt hiermee wel aan
     de publieke kant van de server. Bedrijfstelemetrie, geen ledengegevens. */
  ['/api/doos/status', 'de zaakdoos meldt zijn status op het eigen net; bedrijfstelemetrie, geen ledengegevens'],
  ['/api/doos/rapport', 'idem: het dagrapport van de doos zelf'],
  /* Gevonden door een verse ronde tegen een wegwerpserver: deze route bestond
     nog niet toen POORTWACHT.json voor het laatst werd geschreven, en stond dus
     nergens. Hij is bewust open -- hij zet vrije tekst om in een CONCEPT en zegt
     dat er zelf bij ("Controleer dit plan; er is nog niets aangevraagd"). Er
     wordt niets opgeslagen en niets aangevraagd; de aanvraag zelf
     (/api/arrival/request) staat er los van en controleert wel. Wel een eigen
     snelheidsrem (interpretRem). */
  ['/api/arrival/interpret', 'zet vrije tekst om in een CONCEPTplan en slaat niets op; de aanvraag is een aparte route met eigen controle']
]);

/* De vereniging, met de EIGEN reden voorop waar een pad in allebei staat: die
   is geschreven over deze meting, en de gedeelde over de poortcontrole. */
const PUBLIEK = new Map([...GEDEELD, ...EIGEN]);

/* ---- DE TWEE METRICS-DEUREN ZIJN CONFIGURATIE, GEEN CODE ----

   Ze staan met opzet NIET in PUBLIEK hierboven, en dat verdient uitleg, want een
   lokale ronde meldt ze altijd als open.

   server/meetpoort.js maakt /api/metrics en /api/metrics/kort afhankelijk van de
   OPSTELLING: met RTG_METRICS_TOKEN gezet moet dat token mee; zonder token gaat
   de deur alleen open vanaf een intern adres. Deze sonde klopt aan vanaf
   127.0.0.1 en dat IS een intern adres, dus zonder token ziet hij ze altijd open
   -- precies zoals bedoeld voor een ontwikkelopstelling.

   Ze op de publieke lijst zetten zou daarom het verkeerde repareren: dan valt
   het ook niet meer op wanneer ze in PRODUCTIE opengaan, en dat is nu juist het
   geval dat ertoe doet. Ze horen open te heten op een lokale ronde en dicht op
   een productieronde, en het verschil zit in de omgeving en niet in de code.

   Wat daar wel uit volgt: een uitslag is pas te lezen als je weet TEGEN WELKE
   opstelling hij is gemaakt. Daarom staat dat sinds deze ronde in de uitvoer
   (zie `gemeten` onderaan) -- twee rondes tegen verschillend geconfigureerde
   servers zijn anders niet met elkaar te vergelijken, en dat is precies hoe een
   configuratieverschil er als een bevinding uit gaat zien. */

/* `pasNaLijf`: routes die pas bij de TWEEDE klop lieten zien dat ze een slot
   hebben. Apart geteld, want dat is precies de winst van die tweede klop -- en
   zonder eigen getal is niet te zien of hij nog iets oplevert. */
const uit = { open: [], dicht: 0, stil: 0, publiek: 0, fout: 0, totaal: 0, pasNaLijf: 0, stilOmdat: {} };
/* Alleen gevuld met --per-route; zie de kop. Eén regel per METHODE+pad, met
   hetzelfde oordeel dat hierboven wordt opgeteld -- geen tweede waarheid. */
const perRoute = [];

/* De routekaart uit de server zelf: alleen zo weet je zeker dat je alles hebt
   en niet de lijst toetst die iemand met de hand heeft bijgehouden. */
function routekaart() {
  const rauw = execFileSync(process.execPath,
    [path.join(__dirname, 'routekaart.js'), '--json'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 120000 });
  return JSON.parse(rauw).routes.filter(r => r.pad.startsWith('/api/'));
}

/* :param invullen met iets onschuldigs. Het antwoord mag gerust 404 zijn -- we
   toetsen de poort, niet of het ding bestaat. */
const vulPad = (pad) => pad.replace(/:([A-Za-z0-9_]+)/g, 'zzz-bestaat-niet');

async function klop(pad, methode, lijf) {
  const url = BASIS + vulPad(pad);
  const opt = { method: methode === 'ALL' ? 'POST' : methode, redirect: 'manual' };
  if (opt.method !== 'GET' && opt.method !== 'HEAD') {
    opt.headers = { 'Content-Type': 'application/json' };
    opt.body = JSON.stringify(lijf || {});
  }
  try {
    const r = await fetch(url, opt);
    return { status: r.status, tekst: (await r.text()).slice(0, 300) };
  } catch (e) { return { status: 0, tekst: String(e.message) }; }
}

/* ---- HET OORDEEL, ALS PURE FUNCTIE ----

   EEN PLEK WAAR HET OORDEEL VALT, en buiten de meetlus zodat een toets hem kan
   vastpakken zonder een server te starten. Dat is geen nettigheid: bij de
   OUTPUT-as zat precies zo'n oordeel opgesloten in de lus, en daardoor kon
   niemand met een mutatie natrekken of de regel wel ooit kon vuren. Hij kon het
   niet -- nul bewezen op 4185 routes, en de suite bleef groen.

   `eerste` en `tweede` zijn statuscodes (0 = onbereikbaar); `tweede` is null als
   er geen tweede klop nodig was. `publiek` zegt of dit pad met opzet open staat.

   DE TWEEDE KLOP, EN WAAROM HIJ ER IS. Een lege `{}` naar een route die eerst
   zijn invoer valideert geeft 400 of 404, en dat zegt NIETS over een slot: de
   validatie was gewoon eerder aan de beurt dan de autorisatie. 300 routes
   heetten daarom `stil` -- eerlijk, en onbeslist. De tweede klop stuurt hetzelfde
   plausibele lijf als de rolproef en nog steeds GEEN token. Komt er dan 401 of
   403, dan is de route wel degelijk dicht. Komt er 2xx, dan gaat hij zonder
   sleutel open, en dat is een bevinding die de eerste klop niet zag. */
function oordeelVan(eerste, tweede, publiek) {
  const dicht = (s) => s === 401 || s === 403;
  const open = (s) => s >= 200 && s < 300;
  if (eerste === 0) return { oordeel: 'onbereikbaar', pasNaLijf: false };
  if (dicht(eerste)) return { oordeel: 'dicht', pasNaLijf: false };
  if (open(eerste)) return { oordeel: publiek ? 'publiek' : 'open', pasNaLijf: false };
  /* Vanaf hier was de eerste klop onbeslist. Zonder tweede klop blijft dat zo --
     en dat is met opzet geen 'dicht': niet weten is iets anders dan weten dat er
     iets is (LAT.md regel 3). */
  if (tweede === null || tweede === undefined) return { oordeel: 'stil', pasNaLijf: false };
  if (dicht(tweede)) return { oordeel: 'dicht', pasNaLijf: true };
  if (open(tweede)) return { oordeel: publiek ? 'publiek' : 'open', pasNaLijf: true };
  return { oordeel: 'stil', pasNaLijf: false };
}

async function ronde() {
  const routes = routekaart();
  // in blokken, anders zet je je eigen server met 2500 gelijktijdige verzoeken vast
  const BLOK = 24;
  for (let i = 0; i < routes.length; i += BLOK) {
    await Promise.all(routes.slice(i, i + BLOK).map(async (r) => {
      for (const m of (r.methoden || ['POST'])) {
        uit.totaal++;
        const a = await klop(r.pad, m);
        /* Eén plek waar het oordeel valt, en daarna pas tellen én opschrijven.
           Eerst stond het oordeel in de tellingen zelf verweven; wie er een
           tweede uitvoer naast zet, bouwt dan onvermijdelijk een tweede
           waarheid die er langzaam naast gaat lopen. */
        const publiek = PUBLIEK.has(r.pad);
        /* De tweede klop alleen waar de eerste onbeslist bleef; de kosten van
           deze sonde blijven zo begrensd tot de routes die er iets aan hebben. */
        const onbeslist = a.status !== 0 && !(a.status === 401 || a.status === 403) &&
          !(a.status >= 200 && a.status < 300);
        const b = onbeslist ? await klop(r.pad, m, plausibelLijf(r.pad)) : null;
        const u = oordeelVan(a.status, b ? b.status : null, publiek);
        const oordeel = u.oordeel;
        const tweede = b && oordeel === 'stil' ? b.status : null;
        if (oordeel === 'onbereikbaar') uit.fout++;
        else if (oordeel === 'dicht') { uit.dicht++; if (u.pasNaLijf) uit.pasNaLijf++; }
        else if (oordeel === 'publiek') uit.publiek++;
        else if (oordeel === 'stil') uit.stil++;
        else {
          const bron = u.pasNaLijf ? b : a;
          uit.open.push({ pad: r.pad, methode: m, status: bron.status,
            ...(u.pasNaLijf ? { viaLijf: true } : {}),
            begin: bron.tekst.replace(/\s+/g, ' ').slice(0, 120) });
        }
        /* ---- WAAROM BLIJFT DEZE STIL? ----

           DIT VELD KWAM ER NA EEN NEGATIEF RESULTAAT, en dat is de nuttigste
           soort. De tweede klop met een plausibel lijf bracht op 297 stille
           routes exact NUL nieuwe sloten aan het licht: 276 bleven 404, 19
           bleven 400, 2 bleven 503. De sonde was dus niet te zwak -- er valt
           daar niets aan te kloppen. 179 van die routes hebben helemaal geen
           bewakerslaag (de controle zit in de handler, achter een
           capability-token), 78 zijn een objectpoort die eerst een bestaand
           object wil, 37 hebben alleen een snelheidsrem. Drie blijven er over.

           Zonder dit veld leest "297 stil" als 297 open vragen, terwijl 294
           ervan al onder een andere post in BEWIJSSCHULD.json staan. Een
           schuldpost die dezelfde routes een tweede keer telt, maakt de
           achterstand groter dan hij is. */
        const bewaking = oordeel === 'stil'
          ? bewakerskaart.beoordeel({ bewakersBekend: true, bewakers: (r.bewakers && r.bewakers[m]) || [] })
          : null;
        if (bewaking) {
          /* Een 503 op een route MET een rol is de schakelkast die antwoordt
             voor de poort: de functie staat uit (bijv. dom-eigendomein, een
             boardroom-schakelaar die standaard dicht is). Dat is een besluit
             van het huis en geen open vraag over het slot -- en het hoort hier
             met naam, anders leest het als achterstand. Zelfde voor de
             meetpoort: daar beslist de opstelling, niet de bezoeker. */
          const k = bewaking.rol
            ? (a.status === 503 ? 'functie staat uit: de schakelkast antwoordt voor de poort'
              : 'een rol, maar de invoer strandt eerder')
            : /geen bewakerslaag/.test(bewaking.reden) ? 'capability in de handler'
              : /objectpoort/.test(bewaking.reden) ? 'objectpoort: eerst een bestaand object'
                : /geenBewaker/.test(bewaking.reden) ? 'geen autorisatielaag, alleen een rem'
                  : /omgeving/.test(bewaking.reden) ? 'omgeving beslist (meetpoort)'
                    : 'anders';
          uit.stilOmdat[k] = (uit.stilOmdat[k] || 0) + 1;
        }
        if (perRouteUit) perRoute.push({ methode: m, pad: r.pad, status: a.status,
          ...(tweede ? { statusMetLijf: tweede } : {}), oordeel,
          ...(bewaking ? { bewaking: bewaking.rol ? 'rol: ' + bewaking.rol : bewaking.reden } : {}) });
      }
    }));
  }
}

module.exports = { oordeelVan };

/* DE WACHT. Hieronder start een volledige ronde: een server, een routekaart en
   tweeduizend kloppen. Zonder deze regel gebeurde dat ook bij een gewone
   `require('./poortwacht')` -- en dat is precies hoe ROLPROEF.json ooit van 3377
   beproefde routes werd teruggezet naar 292 door een onschuldige laadcontrole.
   oordeelVan() staat er expres BOVEN, zodat een toets hem kan pakken zonder ook
   maar iets te starten. */
if (require.main !== module) return;

ronde().then(() => {
  if (jsonUit) {
    /* DE OPSTELLING HOORT BIJ DE UITSLAG. Zonder dit veld is een ronde niet te
       lezen: /api/metrics staat open of dicht afhankelijk van RTG_METRICS_TOKEN
       en RTG_CLUSTER_KEY (zie meetpoort.js en het blok bij PUBLIEK), en twee
       rondes tegen verschillend geconfigureerde servers verschillen dan zonder
       dat iemand kan zien waarom. Zo'n verschil leest als een bevinding, en dat
       is de duurste soort ruis.

       Bewust alleen of ze GEZET zijn en niet wat erin staat: dit bestand wordt
       gecommit. */
    /* Het stempel (wanneer, welke commit, vuile boom) komt uit de gedeelde
       helper; de opstelling komt daar bovenop, want die is van deze sonde
       alleen. Zonder commit kan scripts/versheid.js niet zien of deze uitslag
       nog bij de huidige code hoort. */
    const gemeten = Object.assign(stempel(), {
      adres: BASIS,
      metricsToken: !!process.env.RTG_METRICS_TOKEN,
      clusterSleutel: !!process.env.RTG_CLUSTER_KEY,
      domeinen: !!process.env.RTG_DOMAINS,
      let: 'Deze uitslag geldt voor DEZE opstelling. /api/metrics gaat zonder token open ' +
        'vanaf een intern adres; een lokale ronde meldt hem daarom als open zonder dat er ' +
        'iets mis is. Vergelijk alleen rondes met dezelfde vlaggen.'
    });
    /* UITLEG EN GRENS HOREN IN DE UITSLAG, niet alleen in dit bestand. Een
       register dat zichzelf niet uitlegt, wordt gelezen als een dekkende
       garantie; scripts/meetkeuring.js handhaaft dat. */
    const kop = {
      uitleg: 'Per route: gaat hij open voor een verzoek ZONDER token. dicht = 401 of 403, ' +
        'publiek = met opzet open (zie PUBLIEK in dit script), stil = iets anders dan 2xx ' +
        'waaruit niets valt af te leiden.',
      grens: 'klopt aan met een LEEG lichaam. Een 400 of 404 betekent dan dat de validatie of ' +
        'een opzoeking eerder aan de beurt was dan de autorisatie, en zegt NIETS over een slot -- ' +
        'die heten daarom stil en niet dicht. Sinds de TWEEDE klop met een plausibel lijf ' +
        '(nog steeds zonder token) is die groep kleiner: wie dan alsnog 401 of 403 geeft, telt als dicht. Zegt ook niets over wie er met een GELDIG token ' +
        'binnenkomt; dat is de rolproef.'
    };
    console.log(JSON.stringify(perRouteUit ? { ...kop, gemeten, ...uit, perRoute } : { ...kop, gemeten, ...uit }, null, 1));
    /* process.exitCode EN NIET process.exit(), en dat verschil is hier 146 KB
       waard. Naar een BESTAND schrijft node synchroon, dus `> POORTWACHT.json`
       ging altijd goed. Naar een PIPE schrijft hij asynchroon, en process.exit()
       wacht daar niet op: wie deze uitslag opving met spawnSync kreeg hem
       AFGEKAPT op precies 146176 bytes -- geldige tekst, kapotte JSON, en een
       exitcode 0 erbij. Dat is de ergste soort fout: hij ziet er geslaagd uit.
       Gevonden doordat scripts/meetronde.js de poortwacht als kindproces draait.
       Met exitCode loopt het proces netjes leeg en klopt de code nog steeds. */
    process.exitCode = uit.open.length ? 1 : 0;
    return;
  }
  console.log('\n=== RTG poortwacht tegen ' + BASIS + ' ===\n');
  console.log('  aangeklopt        : ' + uit.totaal);
  console.log('  netjes geweigerd  : ' + uit.dicht + '  (401/403)');
  console.log('  stil afgeslagen   : ' + uit.stil + '  (400/404/5xx op BEIDE kloppen -- geen gegevens eruit)');
  console.log('  pas na een lijf   : ' + uit.pasNaLijf + '  (leeg verzoek strandde op de validatie; met een plausibel lijf kwam het slot tevoorschijn)');
  for (const [k, n] of Object.entries(uit.stilOmdat).sort((a, b) => b[1] - a[1])) {
    console.log('     stil omdat     : ' + String(n).padStart(4) + '  ' + k);
  }
  console.log('  bewust publiek    : ' + uit.publiek);
  console.log('  onbereikbaar      : ' + uit.fout);
  if (!uit.open.length) {
    console.log('\nGeen enkele niet-publieke route deed open voor een vreemde.');
    console.log('Dat dekt EEN klasse fouten, niet alle: een route die 401 geeft kan tussen');
    console.log('twee ingelogde leden nog steeds lekken. Daarvoor is scripts/aanval.js.');
    process.exit(0);
  }
  console.log('\n!!! OPEN (' + uit.open.length + ') -- deze deden open zonder inlog:\n');
  for (const o of uit.open) console.log('  ' + o.methode + ' ' + o.pad + '  -> ' + o.status + '  ' + o.begin);
  console.log('\nZet een route hierboven in PUBLIEK (mét reden) als hij open HOORT te staan.');
  process.exit(1);
}).catch(e => { console.error('poortwacht viel om: ' + (e && e.message)); process.exit(2); });
