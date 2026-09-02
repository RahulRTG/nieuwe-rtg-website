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

/* Routes die BEWUST open staan voor een niet-ingelogde bezoeker.

   De lijst stond hier als eigen kopie naast die van keuringsregel 28. Twee
   lijsten van wat openbaar mag zijn lopen uiteen, en de losse van de twee wordt
   de ruimere (LAT.md regel 4) -- dat is hier ook gebeurd: twintig paden stonden
   alleen hier, waarvan er twee niet eens meer bestonden als route en een een
   rem beloofde die op een gelijknamige route van een ander domein stond.

   Ze wonen nu allebei in ./lib/publiek.js, en met opzet niet als een lijst: dat
   bestand houdt PUBLIEK (welke SCHRIJFroute mag zonder gezagsfunctie) en
   ALLEEN_ANONIEM (welke route mag 2xx antwoorden aan een anonieme klop, ook een
   GET) uit elkaar, zodat geen van beide poorten ruimer wordt. POORTWACHT is de
   som en is wat deze ronde nodig heeft. Wie een pad toevoegt, doet dat daar. */
const { POORTWACHT: PUBLIEK } = require('./lib/publiek');

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
