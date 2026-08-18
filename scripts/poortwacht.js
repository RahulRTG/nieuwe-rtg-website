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

const args = process.argv.slice(2);
const jsonUit = args.includes('--json');
const perRouteUit = args.includes('--per-route');
const BASIS = args.find(a => a.startsWith('http')) || 'http://127.0.0.1:3000';

/* Routes die BEWUST open staan voor een niet-ingelogde bezoeker. Elke regel
   heeft een reden; staat er geen reden bij, dan hoort hij hier niet. */
const PUBLIEK = new Map([
  ['/api/health', 'liveness voor de load balancer'],
  ['/api/ready', 'readiness voor de load balancer'],
  ['/api/ice', 'STUN/TURN-servers voor bellen; bevat geen persoonsgegevens'],
  ['/api/auth/register', 'aanmelden kan per definitie niet ingelogd'],
  ['/api/auth/login', 'inloggen kan per definitie niet ingelogd'],
  ['/api/sso/waarheen', 'het inlogscherm moet weten naar welke provider het je stuurt'],
  ['/api/sso/start', 'de heenreis naar de provider van een klant: nog niemand is ingelogd'],
  ['/api/sso/terug', 'de provider stuurt de bezoeker hierheen terug, zonder onze sessie'],
  ['/api/sso/wissel', 'het overdrachtsbewijs omruilen: dat IS de inlog'],
  ['/api/auth/forgot', 'wachtwoord vergeten: je bent juist buitengesloten'],
  ['/api/auth/reset', 'herstel met een token uit de e-mail'],
  ['/api/auth/verify-email', 'e-mailbevestiging met een token uit de e-mail'],
  ['/api/auth/resend', 'bevestigingsmail opnieuw sturen'],
  ['/api/aanmeld/start', 'de ballotage-intake begint voor het account bestaat'],
  ['/api/aanmeld/zeg', 'idem: het gesprek loopt voor de inlog'],
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
  ['/api/doos/rapport', 'idem: het dagrapport van de doos zelf']
]);

const uit = { open: [], dicht: 0, stil: 0, publiek: 0, fout: 0, totaal: 0 };
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

async function klop(pad, methode) {
  const url = BASIS + vulPad(pad);
  const opt = { method: methode === 'ALL' ? 'POST' : methode, redirect: 'manual' };
  if (opt.method !== 'GET' && opt.method !== 'HEAD') {
    opt.headers = { 'Content-Type': 'application/json' };
    opt.body = '{}';
  }
  try {
    const r = await fetch(url, opt);
    return { status: r.status, tekst: (await r.text()).slice(0, 300) };
  } catch (e) { return { status: 0, tekst: String(e.message) }; }
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
        let oordeel;
        if (a.status === 0) { uit.fout++; oordeel = 'onbereikbaar'; }
        else if (a.status === 401 || a.status === 403) { uit.dicht++; oordeel = 'dicht'; }
        else if (a.status >= 200 && a.status < 300) {
          if (PUBLIEK.has(r.pad)) { uit.publiek++; oordeel = 'publiek'; }
          else {
            uit.open.push({ pad: r.pad, methode: m, status: a.status, begin: a.tekst.replace(/\s+/g, ' ').slice(0, 120) });
            oordeel = 'open';
          }
        } else { uit.stil++; oordeel = 'stil'; }
        if (perRouteUit) perRoute.push({ methode: m, pad: r.pad, status: a.status, oordeel });
      }
    }));
  }
}

ronde().then(() => {
  if (jsonUit) {
    console.log(JSON.stringify(perRouteUit ? { ...uit, perRoute } : uit, null, 1));
    process.exit(uit.open.length ? 1 : 0);
  }
  console.log('\n=== RTG poortwacht tegen ' + BASIS + ' ===\n');
  console.log('  aangeklopt        : ' + uit.totaal);
  console.log('  netjes geweigerd  : ' + uit.dicht + '  (401/403)');
  console.log('  stil afgeslagen   : ' + uit.stil + '  (400/404/5xx -- geen gegevens eruit)');
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
