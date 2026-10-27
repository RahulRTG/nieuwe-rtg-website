#!/usr/bin/env node
/* ============================================================================
   DOET DE FUNCTIE HET? -- de eerste drie van acht bewijzen, gemeten.

   WAAROM DIT SCRIPT ER IS

   Dit huis kon tot 7 september 2026 niet zeggen welke van zijn functies het
   werkelijk DEDEN. Er waren registers voor bijna alles -- BELOFTE.json weet of
   de bestanden achter een belofte bestaan, TIKKEN.json hoe diep een scherm ligt,
   BEWIJSMATRIX.json welke bewering een toets vastlegt -- en geen daarvan
   beantwoordde de vraag van een gebruiker: als ik hierop tik, gebeurt er dan
   wat er beloofd wordt? BELOFTE.md zegt dat zelf met zoveel woorden: *"Dit
   register beoordeelt geen kwaliteit. Dat een bestand bestaat, zegt niet dat de
   belofte goed is ingelost."*

   Een handmatige ronde vond op een middag vier defecten die geen enkele toets
   zag, en alle vier waren ze STIL: RTG Navigatie toonde een demonstratieraster
   rond Ibiza aan een lid in Amsterdam, RTG Vrienden verloor zijn halve app aan
   een knop die niet bestond, drie schermen groeven zelf in een locatiesleutel
   die een eigenaar heeft, en LivingOS presenteerde een ingang naar een scherm
   met een andere deur. Geen foutmelding, geen rode toets, geen klacht.

   DE MEETEENHEID IS DE INGANG EN NIET HET BESTAND. Een scherm is geen functie:
   "Navigatie" is niet /apps/navigatie.html maar de belofte *breng mij van hier
   naar mijn bestemming*. Dit register meet daarom per ONDERDEEL uit `MAPPEN` --
   de enige lijst werelden (WERELD.md) -- met de persona die de wereld impliceert.
   Zo meet het wat een mens tegenkomt op de plek waar RTG hem iets aanbiedt.

   DE ACHT BEWIJZEN, EN WELKE DRIE HIER STAAN

   Een functie bestaat pas als een echte gebruiker haar bedoeling kan voltooien,
   de uitkomst klopt bewaard wordt, fouten begrijpelijk zijn, rechten kloppen en
   de stroom na storing, refresh en herhaling blijft werken. Dat zijn acht
   bewijzen (zie BETROUWBAARHEID.md). Dit script meet er DRIE:

     1 bereikbaar   -- opent de ingang voor de persona aan wie hij wordt getoond?
     2 bedienbaar   -- doen de knoppen iets, zonder te breken?
     8 menselijk    -- geen kale TypeError, 500 of knop die stil niets doet.

   SAMENSTELLEN (24 september 2026). Een bewijs mag ook uit een proef komen die
   al bestaat -- een gesloten ketenproef, of een ronde die elke rij meet (de
   liegronde, de bevoegdronde). Welke bron dat mag, staat in
   scripts/lib/appcontract.js; of hij het op deze code verdient, beslist
   scripts/lib/bewijsbron.js. Niemand schrijft hier PASS: een verouderd
   register maakt het NIET_GETEST.

   De andere vijf (voltooibaar, waarheidsgetrouw, persistent, bevoegd,
   herstelbaar) komen uit een andere proef of staan op GEEN_FIXTURE met de
   reden. Voor voltooibaar, persistent en herstelbaar is er sinds 11 oktober 2026
   een testwereld (scripts/voltooiproef.js: wegwerpdata, postvanger, sms-sandbox,
   een herstart en een crash); een onderdeel zonder scenario daarin houdt
   GEEN_FIXTURE, en de reden zegt of het een scenario of een adapter mist. Ze
   staan er WEL, want een bewijs dat je weglaat ziet eruit als een bewijs dat je
   haalt.

   DE STANDEN ZIJN GESLOTEN, en "waarschijnlijk goed" zit er niet bij:

     BEWEZEN                  gemeten en in orde
     GEBLOKKEERD_DOOR_DEFECT  gemeten en stuk -- iemand moet code repareren
     GEBLOKKEERD_DOOR_CONFIG  de code klopt, de omgeving mist iets (de server
                              zegt dat zelf, met een `hoe` of een 503 die naar
                              een niet-ingelezen bron wijst)
     GEEN_FIXTURE             niet te meten zonder testwereld, met de reden
     NIET_GETEST              deze ronde niet aangeraakt, met de reden

   WAT DIT SCRIPT NIET ZIET, en dat staat er even groot bij: het vult geen
   formulieren in. Het raakt sinds de volledige-bedieningsnorm wel iedere
   zichtbare knop, inclusief risicovolle bediening, maar uitsluitend op de
   lokale wegwerpserver; browserbevestigingen worden afgebroken, muterende
   verzoeken van zo'n UI-tik worden als `risicoFixtures` verantwoord en de
   risicovolle namen staan per rij in `risicovolAangeraakt`. Een groene rij betekent dus
   "de ingang opent en de bediening breekt niet", en nadrukkelijk niet "de
   functie werkt". Dat verschil is de hele reden dat de andere vijf bewijzen er
   met naam bij staan.

   EN EEN GROOT DEEL VAN WAT ER STAAT, IS NIET AAN TE TIKKEN. Op vluchten.html
   staan 23 zichtbare knoppen en zijn er 13 niet te bereiken: 8x ligt er iets
   overheen ("intercepts pointer events"), 4x is de knop niet zichtbaar op het
   moment van tikken, 1x staat hij buiten beeld. Wat daarvan een overlay is die
   een mens eerst wegtikt en wat een werkelijk onbereikbare knop, weet deze
   proef niet -- dus raakt hij niet alle bediening, dan heet de rij NIET_GETEST
   met de uitsplitsing erbij. `knoppenNietKlikbaar` en
   `schermenGrotendeelsOngemeten` staan in het register zodat dat een getal is
   en geen voetnoot.

   DRIE FOUTEN IN DIT INSTRUMENT ZELF zijn de reden dat het er zo uitziet, en ze
   staan hier omdat ze zich anders herhalen:
     1. Knoppen werden EEN keer gemarkeerd en daarna op nummer aangetikt. Na de
        eerste tik hertekent een scherm en zijn de markeringen weg -- er werd
        dus een knop per scherm getikt terwijl er veertien stonden, en dat werd
        als BEWEZEN gemeld. Een meter die te weinig doet, meldt groen.
     2. Een tik die navigeert sloopte de context van de volgende meting, en die
        fout werd uitgeschreven als een DEFECT VAN DE APP. Een instrument dat
        zijn eigen struikelen als beschuldiging meldt, is erger dan geen.
     3. De eerste ratelproef saboteerde een KLIK op een knop die de proef nooit
        bereikte, en concludeerde daaruit dat de ratel stuk was. Sabotage hoort
        bij het LADEN, want dat wordt op elk scherm gehaald.

   DRAAIEN

     node scripts/appwerkt.js              meet, schrijft APPWERKT.json
     node scripts/appwerkt.js --controle    zakt als er meer defecten zijn dan
                                            het register kent (ratel: alleen omlaag)
     node scripts/appwerkt.js --filter=nav  alleen onderdelen waarvan het adres
                                            dit fragment bevat
     node scripts/appwerkt.js --inventaris  werkt ALLEEN het blok `toezegklassen`
                                            bij, zonder browser (zie hieronder)
     node scripts/appwerkt.js --inventaris --controle
                                            zakt als dat blok achterloopt, een
                                            citaat rot is of een klasse buiten
                                            de vier valt

   HET BLOK `toezegklassen` (11 oktober 2026, AFBOUWPROGRAMMA.md). Het
   eigenaarsbesluit zegt dat alles wat RTG heeft TOEGEZEGD wordt afgebouwd en
   bewezen, en niet alles wat ooit in een document stond. Welk onderdeel in welke
   van de vier klassen valt (toegezegd, afgewezen-met-grens, vraagt-besluit,
   extern) staat daarom HIER, in hetzelfde register als de bewijzen -- er komt
   geen tweede completion-register naast. De inventaris wordt gelezen door
   scripts/lib/toezegklassen.js uit de documenten en TOEZEGKLASSEN.json, en hij
   wordt bij een volle meting gewoon meegeschreven. `--inventaris` bestaat omdat
   een browserronde over alle onderdelen te zwaar is om alleen een document-
   wijziging bij te werken; hij laat elk ander veld byte voor byte staan.
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const reg = require('./lib/wereldregister');
const { haalSessies, haalLifestyleLid, opslagVoor, verbindProeflid } = require('./lib/proefsessies');
const { haalSchoolsessies, maakSchoolContext } = require('./lib/schoolproefsessies');
const { stempel, eisSchoneBoom, magSchrijven } = require('./lib/stempel');
/* Bewijs SAMENSTELLEN uit proeven die al bestaan: het contract zegt welke bron
   een bewijs mag leveren, de bewijsbron of hij dat op deze code verdient. */
const { stelSamen } = require('./lib/bewijsbron');
/* Het raakvlak per bewijs (scripts/lib/bewijsraakvlak.js): EEN wereld per ronde, zodat
   elk bestand een keer wordt gelezen en gehasht, en de hashes in het register
   dezelfde inhoud dragen als waartegen elk bewijs vers werd verklaard. */
const raakvlakken = require('./lib/bewijsraakvlak');
let raakvlakWereld = null;
const RAAKVLAKWERELD = () => (raakvlakWereld = raakvlakWereld || raakvlakken.maakWereld());
const { CONTRACT, ZONDER_APP, TESTWERELD_ONTBREEKT } = require('./lib/appcontract');
const { beoordeel: beoordeelBestemming, personaAfwijking } = require('./lib/bestemming');
const { isBrowserruis } = require('./lib/browserruis');
/* De inventaris van toezeggingen (AFBOUWPROGRAMMA.md): een blok in dit register,
   geen eigen register. */
const toezegklassen = require('./lib/toezegklassen');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'APPWERKT.json');
const controle = process.argv.includes('--controle');
const stil = process.argv.includes('--stil');
const alleenInventaris = process.argv.includes('--inventaris');
const filter = (process.argv.find((a) => a.startsWith('--filter=')) || '').slice(9);
const PAR = Number((process.argv.find((a) => a.startsWith('--par=')) || '').slice(6) || 6);
/* De grootste gemeten schermen bevatten ruim 190 unieke handelingen. Omdat
   een vervolgstand soms twee of meer reeds bewezen openers moet herhalen, is
   256 rondes geen geldige bovengrens voor volledige dekking. 1024 blijft een
   harde, eindige veiligheidsgrens, maar laat de meter wel ieder uniek control
   plus zijn begrensde navigatiepad werkelijk aanraken. */
const MAXKLIK = 1024;
/* Een echte openerketen in RTG is kort. Per nog onaangeraakte eindtak krijgt
   de meter 32 herhaalde standstappen, met 128 als harde bovengrens. Een vaste
   grens van 32 stopte Magnaat na de eerste van meerdere geldige eindtakken:
   de restlijst verschoof per ronde, terwijl iedere tak afzonderlijk bereikbaar
   was. De adaptieve grens blijft eindig en verlaagt nooit de 100%-bewijsgrens. */
const MAXHERSTELZONDERNIEUW = 32;
const MAXHERSTELTOTAAL = 128;
function herstelgrens(resterend) {
  return Math.min(MAXHERSTELTOTAAL, MAXHERSTELZONDERNIEUW * Math.max(1, Number(resterend) || 0));
}
const BEDIENINGSSELECTOR = 'button,[role=button],[data-tab],[data-stand],input[type=button],input[type=submit],input[type=reset]';

/* Gedeelde bediening bewijst het scherm niet. Naast de generieke Edge en
   Command hebben gemigreerde Design-Systemschermen hun eigen .ds-edge en
   is de gedeelde Rahul KOMPAS-tab met zijn Command-werkblad geen appbediening.
   opent [data-ds-zoek] dezelfde globale sprong als .rtgsprong-greep. Als de
   appmeter die eerst aantikt, blijft de sprong over de app liggen en lijken
   alle volgende appknoppen onbereikbaar. Deze oppervlakken hebben eigen
   browsercontracten; APPWERKT telt en bedient uitsluitend het actieve scherm. */
const GEDEELDE_SCHIL = '.rtg-edge-chrome, .rnd-toets, .ios-thuis, .rtg-edge-2-edge-reveal, #rtgCommand, .ds-edge, [data-ds-zoek], .rtgsprong, .rtgsprong-greep, .rtg-rahul-tab, .rtg-rahul-page';

/* Risicovolle namen worden als laatste bediend op de lokale wegwerpserver en
   afzonderlijk verantwoord. Een browserbevestiging wordt afgebroken en een
   muterend verzoek wordt voor die ene UI-tik gefixttured; de knop zelf is dan
   wel echt geraakt, terwijl verwijdering of betaling niet buiten de daarvoor
   bedoelde voltooi- en financiële proef wordt uitgevoerd. */
const RISICOVOL = /uitlog|log uit|sign ?out|verlaat|leave|verwijder|delete|wis alles|betaal|uit\s+rtg\s+pay-saldo|afreken|bestel|verstuur|verzend|annuleer|opzegg|sluit account|export|download|nieuwe pin|noodslot|opbergen|weggooien|ster erop|sluimeren/i;
/* Alleen deze servermutaties zouden de gedeelde testpersona, haar hele account
   of de UI-fixture voor alternatieve betaalwegen wijzigen. Een echte betaling
   laat terecht de andere betaalbuttons verdwijnen; APPWERKT zou ze dan nooit
   allemaal kunnen aanraken. Daarom worden `/api/pay` en `/api/pay/saldo`
   uitsluitend tijdens die ene echte UI-tik gefixttured. De afzonderlijke
   financiële proeven blijven het zakelijke gevolg, concurrency en herstel
   bewijzen. De drie RTMail-mutaties veranderen dezelfde enige berichtfixture;
   ook zij worden per echte UI-tik gefixttured, zodat opbergen, ster, sluimeren
   en weggooien allemaal bediend kunnen worden. De RTMail-voltooi- en
   regressieproeven bewijzen hun werkelijke zakelijke effect. */
const VERNIETIGENDE_ROUTE = /^\/api\/(?:logout|privacy\/delete|risico|pay(?:\/saldo)?|member\/rtmail\/(?:verplaats|ster|sluimer))$/;

/* De DRIE toegangspoorten in dit huis, als selector. Geen woordenlijst en geen
   tekstherkenning: dit zijn de mechanismen zelf.

     #poort.zien           de poort van de losse schermen (navigatie, ov)
     .rtf-toegang-dicht    de gezinspoort   (apps/foundation/sessie.js)
     .rtf-school-dicht     de schoolpoort   (shared/rtg-school-session.js)

   De derde is er na de eerste volle ronde bij gekomen, en dat is precies het
   soort correctie dat een meter eerlijk houdt: `bord.html` en `schrift.html`
   werden als DEFECT gemeld terwijl ze een docentensessie vragen. Hun halt is
   een `throw` -- dezelfde techniek die vrienden.html per ongeluk sloopte, hier
   met opzet en na het openen van de deur. Een meter die dat niet kent, meldt
   een deur als een defect en verliest zijn geloofwaardigheid bij de eerste
   ronde. */
const POORTEN = ['#poort.zien:not([data-poort-soort="locatie"])', 'html.rtf-toegang-dicht', '#rtf-toegang-slot',
  'html.rtf-school-dicht', '#rtf-school-slot'];

/* Welke persona hoort bij welke wereld? Dit is de kern van bewijs 1: een ingang
   wordt aan IEMAND getoond, en die iemand moet erdoor kunnen. FoundationOS is
   de wereld van het gezin; de drie andere werelden zijn die van een lid. Dat
   WorkOS ook zakelijke schermen bevat, maakt het lid niet de verkeerde persona:
   het onderdeel hangt in de wereld van het lid, dus het lid is aan wie het
   beloofd wordt. Blijkt een ander de deur wel te kunnen openen, dan zegt de rij
   dat -- de belofte staat dan bij de verkeerde persona. */
const PERSONA_VAN_WERELD = { LivingOS: 'lid', WorkOS: 'lid', TravelOS: 'lid', FoundationOS: 'gezin' };

const log = (...a) => { if (!stil) console.log(...a); };

/* ---- de rijen: elk onderdeel van elke wereld ---- */
function rijen() {
  const uit = [];
  for (const map of reg.MAPPEN) {
    for (const item of map.items) {
      const [soort, sleutel] = [item.slice(0, item.indexOf(':')), item.slice(item.indexOf(':') + 1)];
      const bron = soort === 'link' ? reg.LINKS[sleutel] : (soort === 'os' ? reg.OSAPPS[sleutel] : null);
      const url = bron && bron.url ? bron.url : null;
      uit.push({
        app: bron && bron.naam ? bron.naam : sleutel,
        functie: item,
        wereld: map.naam,
        /* Een ingang met een werkrol toont de wereld alleen aan wie die rol in
           zijn sleutelbos heeft (app-main-24a3.js); dat is dan aan wie hij
           beloofd wordt, en dus de persona die erdoor moet kunnen. */
        persona: (bron && bron.werkrol) ||
          (soort === 'link' && reg.PREMIUM.has(sleutel) ? 'lifestyle' : null) ||
          PERSONA_VAN_WERELD[map.naam] || 'lid',
        ingang: url || ('(' + soort + ' in de app, geen eigen adres)'),
        soort,
        pad: url ? url.split('#')[0].split('?')[0] : null
      });
    }
  }
  return filter ? uit.filter((r) => (r.ingang || '').includes(filter) || r.app.toLowerCase().includes(filter.toLowerCase())) : uit;
}

/* Een interne tab heeft geen los publiek adres, maar kan WEL een meetbare
   ingang hebben. Het bestaande appcontract benoemt dan het echte scherm en de
   echte hash-navigatie. Alleen een declaratieve hash mag hier rechtstreeks
   worden geopend; natuurlijke-taalstappen voor OS-kiezers moeten door een
   expliciet gedeclareerde bedieningsadapter worden uitgevoerd. Alleen proza
   blijft eerlijk ongemeten: de meter leidt daar nooit zelf een route uit af. */
function meetIngang(rij, contract = CONTRACT) {
  if (rij && rij.pad) return { pad: rij.pad, bestemming: rij.pad, via: null };
  const c = rij && contract && contract[rij.functie];
  if (!c || typeof c.ingang !== 'string' || !c.ingang.startsWith('/') || typeof c.via !== 'string') return null;
  if (c.via.startsWith('#')) return { pad: c.ingang + c.via, bestemming: c.ingang, via: c.via,
    ...(typeof c.bereik === 'string' && c.bereik ? { bereik: c.bereik } : {}) };
  const a = c.adapter;
  if (!a || a.type !== 'rahul-opdracht' || !a.opdracht || !a.verwacht || !a.bereik || !a.titel) return null;
  return { pad: c.ingang, bestemming: c.ingang, via: c.via, adapter: { ...a } };
}

/* ---- de vijf bewijzen die een testwereld nodig hebben ---- */
const GEEN_FIXTURE = (wat) => ({ status: 'GEEN_FIXTURE', reden: wat, bewijs: null });
/* Bewijs 3, 5 en 7 hebben sinds 11 oktober 2026 een testwereld
   (scripts/voltooiproef.js: wegwerpdata, postvanger, sms-sandbox, simulatiebank,
   een nette herstart en een crash op dezelfde datamap). Wat een onderdeel dan
   nog mist, is zijn SCENARIO in scripts/lib/voltooi/ -- of, bij een handvol,
   een adapter die er niet is. Dat tweede staat per onderdeel in
   TESTWERELD_ONTBREEKT (scripts/lib/appcontract.js), zodat de reden zegt WELKE
   adapter ontbreekt in plaats van "vraagt een testwereld". */
const testwereldReden = (r, bewijs) => {
  const mist = TESTWERELD_ONTBREEKT[r.functie];
  if (mist) return 'de testwereld mist hiervoor een adapter: ' + mist;
  /* Op de ingang en niet op `soort`: meetRij() haalt dat veld weg voordat de
     rij hier langskomt (gemeten: alle 108 rijen heetten eerst "geen adres"). */
  if (!String(r.ingang || '').startsWith('/')) return 'geen eigen adres: een scenario kan pas aan deze ingang hangen als hij een scherm heeft waarvan SCHERMROUTES.json de routes kent';
  return 'de testwereld staat (scripts/voltooiproef.js), maar er is nog geen scenario voor deze ingang in scripts/lib/voltooi/; ' + bewijs;
};
const ONGEMETEN = {
  voltooibaar: (r) => GEEN_FIXTURE(testwereldReden(r, 'dat loopt de hele bedoeling af tot en met wat de ontvanger ziet')),
  waarheidsgetrouw: () => GEEN_FIXTURE('vraagt de liegpoort over alle schermen (RTG_LIEG); vandaag meet SCHERMLEUGEN.json er zes'),
  persistent: (r) => GEEN_FIXTURE(testwereldReden(r, 'dat herstart netjes op dezelfde datamap en leest de uitkomst in een nieuwe sessie en in de opslag')),
  bevoegd: () => GEEN_FIXTURE('vraagt de kruisproef met vreemde rollen, gezinnen en bedrijven; de routekant staat in IDOR.json en ROLPROEF.json, de schermkant niet'),
  herstelbaar: (r) => GEEN_FIXTURE(testwereldReden(r, 'dat beproeft dubbelklik, een herhaald en een afgebroken verzoek en een crash direct na de bevestiging (uitval van Redis of PostgreSQL zit er nog niet in)'))
};

/* ---- de meting ---- */
async function meet() {
  const { laadBrowser } = require(path.join(WORTEL, 'test', 'browser'));
  const pw = laadBrowser({ eigenDriver: false });
  if (!pw) { console.error('Geen browser beschikbaar; dit script meet in een echte browser.'); process.exit(2); }
  const { startServer, kantoorAlsPersoon } = require(path.join(WORTEL, 'test', 'helper.js'));
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appwerkt-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });

  const { sessies, overgeslagen } = await haalSessies(base);
  const kantoormens = await kantoorAlsPersoon(base, 'RTG-OFFICE');
  const lifestyle = await haalLifestyleLid(base, kantoormens);
  if (lifestyle.ok) sessies.lifestyle = {
    sleutel: 'rtg_member_token', waarde: lifestyle.token,
    start: '/apps/app.html?pas=lifestyle',
    uitleg: 'een door een kantoormens op naam goedgekeurd en geverifieerd Lifestyle-lid'
  };
  else overgeslagen.push({ rol: 'lifestyle', reden: lifestyle.reden });
  const contact = await verbindProeflid(base);
  if (!contact.ok) overgeslagen.push({ rol: 'lid-contact', reden: contact.reden });
  const school = await haalSchoolsessies(base, sessies);
  if (!school) overgeslagen.push({ rol: 'schoolproef', reden: 'de echte les- en leerlingensessies konden niet worden gemaakt' });
  log('sessies: ' + Object.keys(sessies).join(', ') + (overgeslagen.length ? ' -- overgeslagen: ' + overgeslagen.map((o) => o.rol).join(', ') : ''));

  const lijst = rijen();
  log(lijst.length + ' onderdelen uit MAPPEN');
  const kernen = (os.cpus() || []).length || 1;
  const last = () => Math.round(os.loadavg()[0] / kernen * 100) / 100;
  const belasting = { kernen, perKernBijStart: last() };
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  const uit = [];
  let n = 0;

  async function werker() {
    /* Twee contexten per werker: een met ALLEEN de sessie van de persona (dat
       is wat bewijs 1 meet) en een met alle sessies (om te zien of een ANDER
       er wel doorheen komt -- dan is de ingang niet stuk maar verkeerd
       geadresseerd, en dat is een ander gesprek). */
    /* Een context PER PERSONA. Er stond hier ook een context met ALLE sessies
       tegelijk; die meet niets wat de vier losse niet meten, en een browser met
       vier sessies tegelijk is geen mens. Weg, met de reden. */
    const persoonlijk = {};
    for (const rol of Object.keys(sessies)) {
      /* opslagVoor() weet hoe een sessie in localStorage hoort (de sleutelnaam,
         en dat het gezin een object is en de rest een string). Dat hoort op EEN
         plek te staan, ook als er hier maar een rol in gaat. */
      persoonlijk[rol] = await maakContext(browser, opslagVoor({ [rol]: sessies[rol] }));
    }
    /* De drie expliciete Rahul-adapters draaien op een eigen echt lid. De
       verbinding die Bellen en Snaps nodig hebben mag de staat van de gewone
       lidmeting niet wijzigen; anders verandert bijvoorbeeld de knopnoemer
       van Bestellen door deze fixture. */
    if (contact.ok) persoonlijk.adapterLid = await maakContext(browser,
      opslagVoor({ lid: { ...sessies.lid, waarde: contact.token } }));
    if (school) {
      persoonlijk['link:rtfbord'] = await maakSchoolContext(browser, school.bord, maakContext);
      persoonlijk['link:rtfschrift'] = await maakSchoolContext(browser, school.schrift, maakContext);
    }
    while (true) {
      const i = n++; if (i >= lijst.length) break;
      const rij = lijst[i];
      uit.push(await meetRij(rij, base, persoonlijk, Object.keys(sessies)));
      if (uit.length % 10 === 0) log('  ' + uit.length + '/' + lijst.length);
    }
    for (const ctx of Object.values(persoonlijk)) await ctx.close();
  }
  await Promise.all(Array.from({ length: PAR }, werker));
  await browser.close();
  try { child.kill(); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  uit.sort((a, b) => (a.wereld + a.app).localeCompare(b.wereld + b.app));
  belasting.perKernBijEinde = last();
  return { regels: uit, sessiesOvergeslagen: overgeslagen, belasting };
}

async function maakContext(browser, opslag) {
  /* Bedienbaarheid meet of een mens een functie kan gebruiken, niet of een
     cinematografische overgang exact binnen een drukke CI-tik klaar is. De
     gereduceerde-bewegingsstand is bovendien een ondersteunde
     toegankelijkheidsstand. Zonder deze vaste voorkeur verschoof een knop na
     het markeren maar voor de klik en onderschepte de body de invoer; dezelfde
     bronstand wisselde daardoor tussen 11/72 en 39/70 aangetikte knoppen. */
  const ctx = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  /* haalSessies() rondt de echte onboarding en actuele overeenkomst via de
     server af. Hier staat dus geen `klaar:true`-mock meer: interne ledenapp-
     standen worden gemeten met dezelfde geactiveerde identiteit als een mens. */
  /* DE PERSONA SPREEKT NEDERLANDS. Zonder rtg_lang volgde het scherm de taal
     van de headless browser (en-US), dus mat deze proef de Engelse schil van
     een Nederlands huis -- gezien op 24 september 2026. */
  await ctx.addInitScript((o) => { try { for (const k of Object.keys(o)) localStorage.setItem(k, o[k]); } catch (e) {} },
    Object.assign({ rtg_lang: 'nl' }, opslag));
  return ctx;
}

async function meetRij(rij, base, persoonlijk, rollen) {
  const r = { ...rij, bewijzen: {}, gevonden: 0, geklikt: 0, overgeslagen: [], risicovolAangeraakt: [], risicoFixtures: [], nietKlikbaar: [], waarnemingen: [] };
  delete r.soort; delete r.pad;

  const meet = meetIngang(rij);
  /* Een OS-kiezer met alleen een menselijke bedieningsbeschrijving heeft nog
     geen uitvoerbare adapter. Hash-tabs hebben die inmiddels wel via hun
     bestaande appcontract en worden hieronder als echte appstand geopend. */
  if (!meet) {
    const reden = rij.soort === 'tab'
      ? 'een stand binnen de ledenapp, geen eigen adres: alleen te meten door de app te bedienen'
      : 'een kiezer in de app: het adres ontstaat pas na een keuze';
    for (const b of ['bereikbaar', 'bedienbaar', 'menselijk']) r.bewijzen[b] = { status: 'NIET_GETEST', reden, bewijs: null };
    vulOngemeten(r);
    return r;
  }
  if (meet.via) r.via = meet.via;

  const bestand = path.join(WORTEL, 'public', meet.bestemming.replace(/^\//, ''));
  if (!fs.existsSync(bestand)) {
    r.bewijzen.bereikbaar = { status: 'GEBLOKKEERD_DOOR_DEFECT',
      reden: 'de wereld wijst naar ' + meet.bestemming + ' en dat bestand bestaat niet', bewijs: null };
    for (const b of ['bedienbaar', 'menselijk']) r.bewijzen[b] = { status: 'NIET_GETEST', reden: 'er is geen scherm om te bedienen', bewijs: null };
    vulOngemeten(r);
    return r;
  }

  /* Een BEVINDING en geen oordeel: meet de proef met een andere persona dan het
     register als doelgroep noemt? Beide bronnen staan erbij (./lib/bestemming.js). */
  r.personaAfwijking = personaAfwijking(rij.persona, meet.bestemming, SCHERMREGISTER());

  // ---- bewijs 1: bereikbaar voor de persona van deze wereld ----
  const eigen = persoonlijk[rij.functie] || (meet.adapter && rij.persona === 'lid' && persoonlijk.adapterLid
    ? persoonlijk.adapterLid
    : persoonlijk[rij.persona]);
  if (!eigen) {
    r.bewijzen.bereikbaar = { status: 'NIET_GETEST',
      reden: 'inloggen als ' + rij.persona + ' lukte niet; niet gemeten mag nooit als in orde langskomen', bewijs: null };
    for (const b of ['bedienbaar', 'menselijk']) r.bewijzen[b] = { status: 'NIET_GETEST', reden: 'geen sessie voor deze persona', bewijs: null };
    vulOngemeten(r);
    return r;
  }
  const eersteBezoek = await bezoek(eigen, base, meet);
  r.waarnemingen.push('als ' + rij.persona + ': ' + eersteBezoek.samenvatting);
  if (eersteBezoek.rem.length) r.waarnemingen.push('proef: bij het laden ' + eersteBezoek.rem.length + 'x de rem (429) geraakt, door het gedeelde adres van de meting');

  if (eersteBezoek.poort) {
    /* De deur staat dicht. Kan een ANDER er wel door? Dan is het scherm niet
       stuk maar staat de ingang in de verkeerde wereld -- precies het defect
       dat LivingOS met "Vrienden" had. Dat onderscheid staat in de reden. */
    let opener = null;
    for (const rol of rollen) {
      if (rol === rij.persona) continue;
      const proef = await bezoek(persoonlijk[rol], base, meet);
      if (!proef.poort && !proef.crash.length) { opener = rol; break; }
    }
    /* TWEE HEEL VERSCHILLENDE UITKOMSTEN, en ze door elkaar halen maakt dit
       register waardeloos.

       Gaat de deur open voor een ANDERE persona die deze proef kent, dan is de
       ingang aan de verkeerde persoon geadresseerd -- dat is een DEFECT, en het
       is precies wat LivingOS met "Vrienden" deed.

       Gaat hij voor niemand open, dan weet deze proef alleen dat er een deur
       staat. Misschien is de functie onbereikbaar; misschien kent de proef de
       rol niet die er wel doorheen komt (een docentencode, een keurder, een
       gemeente). Dat is NIET_GETEST met de deurtekst erbij, en nooit een
       beschuldiging -- een defect melden dat je niet kunt onderbouwen, kost dit
       register bij de eerste ronde zijn geloofwaardigheid. Ze worden apart
       geteld (`deurenZonderPersona`) zodat ze werkvoorraad blijven en niet in
       de ruis verdwijnen. */
    r.bewijzen.bereikbaar = opener
      ? { status: 'GEBLOKKEERD_DOOR_DEFECT',
        reden: 'de wereld toont deze ingang aan een ' + rij.persona + ', maar de deur gaat alleen open voor een ' + opener + ': ' + eersteBezoek.poortTekst,
        bewijs: meet.pad }
      : { status: 'NIET_GETEST',
        reden: 'er staat een deur die geen van de vier bekende sessies (lid, zaak, kantoor, gezin) opent; welke rol er wel doorheen komt, weet deze proef niet: ' + eersteBezoek.poortTekst,
        bewijs: meet.pad };
    for (const b of ['bedienbaar', 'menselijk']) r.bewijzen[b] = { status: 'NIET_GETEST', reden: 'achter een dichte deur valt de bediening niet te meten', bewijs: null };
    vulOngemeten(r);
    return r;
  }
  if (eersteBezoek.crash.length) {
    r.bewijzen.bereikbaar = { status: 'GEBLOKKEERD_DOOR_DEFECT',
      reden: 'het scherm gooit bij het laden: ' + eersteBezoek.crash[0], bewijs: meet.pad };
  } else if (eersteBezoek.config.length) {
    r.bewijzen.bereikbaar = { status: 'GEBLOKKEERD_DOOR_CONFIG',
      reden: 'de server zegt zelf dat er iets in de omgeving ontbreekt: ' + eersteBezoek.config[0], bewijs: meet.pad };
  } else {
    /* OPENDE ZONDER POORT EN ZONDER FOUT -- maar OP DE BEDOELDE BESTEMMING?
       Een deur kan ook een doorverwijzing zijn: vier kantoorschermen stuurden
       een lid naar de kantoordeur, en stonden hier op BEWEZEN. Het oordeel komt
       uit ./lib/bestemming.js, op de capability uit SCHERMEIGENAAR.json en niet
       op url-gelijkheid. De andere sessies worden alleen bezocht als de
       bestemming niet klopte: dan is de vraag of de ingang verkeerd geadresseerd
       is (de bestaande uitkomst) of gewoon niet bereikt. */
    const landing = eersteBezoek.eind || meet.bestemming;
    let o = beoordeelBestemming({ ingang: meet.bestemming, landing, register: SCHERMREGISTER(), persona: rij.persona, anderen: [] });
    if (o.status !== 'BEWEZEN' && o.bestemming.uitkomst === 'andere-capability') {
      const anderen = [];
      for (const rol of rollen) {
        if (rol === rij.persona || !persoonlijk[rol]) continue;
        const b = await bezoek(persoonlijk[rol], base, meet);
        if (!b.poort && !b.crash.length) anderen.push({ persona: rol, landing: b.eind || meet.bestemming });
      }
      o = beoordeelBestemming({ ingang: meet.bestemming, landing, register: SCHERMREGISTER(), persona: rij.persona, anderen });
    }
    r.bestemming = o.bestemming;
    r.bewijzen.bereikbaar = { status: o.status, reden: o.reden, bewijs: meet.pad };
    if (o.status !== 'BEWEZEN') {
      for (const b of ['bedienbaar', 'menselijk']) r.bewijzen[b] = { status: 'NIET_GETEST',
        reden: 'de proef kwam niet op de bedoelde bestemming; de bediening van een ander scherm zegt niets over deze app', bewijs: null };
      vulOngemeten(r);
      return r;
    }
  }

  // ---- bewijs 2 en 8: bedienbaar en menselijk ----
  const bediening = await bedien(eigen, base, meet);
  r.gevonden = bediening.gevonden;
  r.geklikt = bediening.geklikt;
  r.aangeraakt = bediening.aangeraakt;
  r.herhaaldAangeraakt = bediening.herhaaldAangeraakt;
  r.schil = bediening.schil;
  r.bedekt = bediening.bedekt;
  r.overgeslagen = bediening.overgeslagen;
  r.risicovolAangeraakt = bediening.risicovolAangeraakt;
  r.risicoFixtures = bediening.risicoFixtures;
  r.nietKlikbaar = bediening.nietKlikbaar;
  r.onaangeraakt = bediening.onaangeraakt;
  r.onderschept = bediening.onderschept;
  if (bediening.instrument.length) r.waarnemingen.push('proef: ' + bediening.instrument.join('; '));
  if (bediening.rem.length) r.waarnemingen.push('proef: ' + bediening.rem.length + 'x de rem (429) geraakt, door het gedeelde adres van de meting');
  r.rem = bediening.rem.length + eersteBezoek.rem.length;
  r.gezegd = bediening.gezegd;
  r.taalWissel = bediening.taalWissel;
  const stuk = [...bediening.crash, ...bediening.serverfout];
  /* De uitsplitsing staat ALTIJD in de reden, ook bij een geslaagde rij: "3
     knoppen aangetikt zonder fout" leest als een bewijs, maar zonder de noemer
     weet niemand of dat alles was of het topje. */
  const redenenTelling = {};
  for (const n of bediening.nietKlikbaar) { const w = n.split(': ').pop(); redenenTelling[w] = (redenenTelling[w] || 0) + 1; }
  const uitsplitsing = bediening.geklikt + ' van ' + bediening.gevonden + ' eigen knoppen aangetikt zonder fout'
    + (bediening.schil ? ' (plus ' + bediening.schil + ' van de gedeelde schil, die hier niet telt)' : '')
    + (bediening.nietKlikbaar.length ? ', ' + bediening.nietKlikbaar.length + ' niet aan te tikken (' + Object.entries(redenenTelling).map(([w, n]) => n + 'x ' + w).join(', ') + ')' : '')
    + (bediening.risicovolAangeraakt.length ? ', ' + bediening.risicovolAangeraakt.length + ' risicovolle bediening(en) aangeraakt op de wegwerpserver' : '')
    + (bediening.onaangeraakt.length ? ', onaangeraakt: ' + bediening.onaangeraakt.slice(0, 8).map((n) => '"' + n + '"').join(', ')
      + (bediening.onaangeraakt.length > 8 ? ' en ' + (bediening.onaangeraakt.length - 8) + ' meer' : '') : '');
  if (bediening.geklikt === 0 && !bediening.gevonden) {
    r.bewijzen.bedienbaar = { status: 'NIET_GETEST', reden: 'geen eigen knop zonder bestemming gevonden' + (bediening.schil ? ' (alleen ' + bediening.schil + ' van de gedeelde schil)' : '') + '; wat dit scherm doet, loopt via links of formulieren', bewijs: null };
  } else if (stuk.length) {
    r.bewijzen.bedienbaar = { status: 'GEBLOKKEERD_DOOR_DEFECT', reden: stuk[0], bewijs: bediening.crash.concat(bediening.serverfout).slice(0, 5).join(' | ') };
  } else if (bediening.bedekt.length) {
    r.bewijzen.bedienbaar = { status: 'GEBLOKKEERD_DOOR_DEFECT',
      reden: bediening.bedekt.length + ' eigen knop(pen) volledig bedekt door de gedeelde schil; een muis komt er niet bij',
      bewijs: bediening.bedekt.slice(0, 5).join(' | ') };
  } else if (bediening.config.length) {
    r.bewijzen.bedienbaar = { status: 'GEBLOKKEERD_DOOR_CONFIG', reden: bediening.config[0], bewijs: null };
  } else if (!volledigeBediening(bediening)) {
    /* EEN SCHERM WAAR EEN UNIEKE KNOP ONAANGERAAKT BLEEF, IS NIET BEWEZEN.
       De eindnorm is volledige bediening: iedere toepasselijke knop wordt in
       de browser aangeraakt, risicovolle acties op de lokale wegwerpserver.
       Een herstelroute, overlap of meetlimiet mag niet achter een percentage
       verdwijnen. */
    r.bewijzen.bedienbaar = { status: 'NIET_GETEST',
      reden: uitsplitsing + ' -- de proef raakte niet alle unieke bediening, dus dit scherm is niet volledig beproefd', bewijs: null };
  } else {
    r.bewijzen.bedienbaar = { status: 'BEWEZEN', reden: uitsplitsing, bewijs: null };
  }
  /* Bewijs 8 wordt AFGELEID en niet apart gemeten, en dat staat er zo bij: een
     kale TypeError of 500 is nooit menselijk, en verder kan deze proef niet
     beoordelen of een foutmelding bruikbaar was. */
  r.bewijzen.menselijk = stuk.length || eersteBezoek.crash.length
    ? { status: 'GEBLOKKEERD_DOOR_DEFECT', reden: 'een kale JS-fout of 500 bereikt de gebruiker: ' + (eersteBezoek.crash[0] || stuk[0]), bewijs: null }
    : { status: 'NIET_GETEST', reden: 'afgeleid: geen kale fout gezien. Of een foutMELDING bruikbaar is, beoordeelt deze proef niet -- dat vraagt de storingen uit bewijs 7, en die levert de voltooiproef (VOLTOOIPROEF.json) voor een onderdeel met een scenario', bewijs: null };

  vulOngemeten(r);
  return r;
}

function vulOngemeten(r) {
  for (const [naam, maak] of Object.entries(ONGEMETEN)) r.bewijzen[naam] = maak(r);
  /* Pas NA de standaard: een contract kan een GEEN_FIXTURE alleen vervangen
     door wat een bron verdiend heeft. Niet genoemd = blijft staan. */
  r.samengesteld = stelSamen(r, { wereld: RAAKVLAKWERELD() });
  /* De vier randvoorwaarden uit de opdracht die hier niet gemeten worden, maar
     die wel een plek in de rij verdienen -- weglaten leest als "in orde". */
  r.mobiel = { status: 'NIET_GETEST', reden: 'deze ronde meet op bureaubreedte; de telefoonkant staat in TIKKEN.json en ADAPTIEF.md' };
  r.toegankelijk = { status: 'NIET_GETEST', reden: 'gemeten door npm run a11y (A11Y-INGELOGD.json), nog niet aan deze rij gekoppeld' };
  r.provider = { status: 'NIET_GETEST', reden: 'welke externe dienst deze functie nodig heeft, staat nergens per functie vastgelegd' };
  r.status = eindstand(r);
}

/* De rijstand is de STRENGSTE van de gemeten bewijzen. Een rij is nooit groener
   dan haar zwakste gemeten bewijs, en een rij met alleen ongemeten bewijzen is
   niet BEWEZEN maar NIET_GETEST -- daar zit de hele eerlijkheid van dit
   register in. */
function eindstand(r) {
  const standen = Object.values(r.bewijzen).map((b) => b.status);
  if (standen.includes('GEBLOKKEERD_DOOR_DEFECT')) return 'GEBLOKKEERD_DOOR_DEFECT';
  if (standen.includes('GEBLOKKEERD_DOOR_CONFIG')) return 'GEBLOKKEERD_DOOR_CONFIG';
  if (standen.includes('GEEN_FIXTURE')) return 'GEEN_FIXTURE';
  if (standen.includes('NIET_GETEST')) return 'NIET_GETEST';
  /* Alle acht bewijzen BEWEZEN. Vandaag haalt geen enkele rij dit, en dat hoort
     zo: vijf bewijzen wachten op de testwereld. Deze tak staat er wel, want een
     eindstand die BEWEZEN niet kan uitdrukken zou de lat stilzwijgend verlagen
     zodra die testwereld er is. */
  return 'BEWEZEN';
}

/* ---- een bezoek: laden en kijken wat er gebeurt ---- */
function ingangOpties(ingang) {
  return typeof ingang === 'string' ? { pad: ingang, bestemming: ingang, via: null } : ingang;
}

/* Voer alleen adapters uit die het appcontract expliciet verklaart. Dit loopt
   dezelfde zichtbare Edge/Rahul-route als een lid; geen private browserfunctie,
   verzonnen URL of directe openOsApp-aanroep. Het verwachte scherm en zijn
   titel zijn deel van het contract, zodat een opdracht die stil niets opent de
   meting laat falen. */
async function voerIngangAdapterUit(page, meet) {
  if (!meet.adapter) return meet;
  await page.waitForFunction(() => document.body && document.body.getAttribute('data-rtg-adaptive-ready') === 'true',
    null, { timeout: 12000 });
  const mond = page.locator('.rtg-adaptive-item[aria-label="Praat met Rahul"]:visible').first();
  await mond.waitFor({ state: 'visible', timeout: 10000 });
  await mond.click();
  const vraag = page.locator('input[placeholder^="Vraag Rahul"]:visible').first();
  await vraag.waitFor({ state: 'visible', timeout: 10000 });
  await vraag.fill(meet.adapter.opdracht);
  await vraag.press('Enter');
  await page.waitForSelector(meet.adapter.verwacht, { state: 'visible', timeout: 10000 });
  const titel = ((await page.textContent(meet.adapter.verwacht + ' #osBelTitel').catch(() => '')) || '').trim();
  if (titel !== meet.adapter.titel) throw new Error('bedieningsadapter verwachtte titel "' + meet.adapter.titel + '", zag "' + titel + '"');
  return meet;
}

async function wachtOpOnboarding(page) {
  /* Iedere schone heropening bouwt app.html opnieuw op. De onboardinglaag is
     dan kort zichtbaar terwijl de echte serverstatus wordt gelezen, ook als
     dezelfde proefsessie al volledig is afgerond. Alleen bij de eerste ingang
     wachten maakte de volle parallelle ronde afhankelijk van machinesnelheid:
     Assets was los 8/8, maar werd onder belasting door #onbGate geblokkeerd.
     Een scherm zonder deze laag voldoet direct aan `hidden`. */
  await page.waitForSelector('#onbGate', { state: 'hidden', timeout: 12000 }).catch(() => {});
}

async function wachtOpInteractielaag(page) {
  /* De Social Control Plane-opener wordt eerder getekend dan de runtime haar
     dialoog en klikhandler monteert. Een vaste pauze was onder volle belasting
     te kort: de knop werd technisch geklikt maar kon nog niets openen. Wacht
     op de bijbehorende, waarneembare laag. Pagina's zonder deze opener zijn
     onmiddellijk klaar. */
  await page.waitForFunction(() => {
    const opener = document.querySelector('.rtg-intel-command');
    return !opener || !!document.querySelector('.rtg-intel-scrim [role="dialog"]');
  }, null, { timeout: 12000 }).catch(() => {});
}

async function wachtOpAppGereed(page) {
  /* Een app die haar eigen hoofdvlak als busy markeert, publiceert daarmee dat
     de eerste bruikbare stand nog onderweg is. Navigatie wacht bijvoorbeeld op
     een expliciet locatiebesluit. Zonder dit signaal keek een schone replay al
     rond terwijl de vertrekkeuze nog niet bestond en bleven geldige opties
     onaangeraakt. Pagina's zonder zo'n busy hoofdvlak voldoen onmiddellijk. */
  await page.waitForFunction(() => !document.querySelector('main[aria-busy="true"]'),
    null, { timeout: 15000 }).catch(() => {});
}

async function openIngang(page, base, ingang) {
  const meet = ingangOpties(ingang);
  await page.goto(base + meet.pad, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await wachtOpOnboarding(page);
  await wachtOpInteractielaag(page);
  await wachtOpAppGereed(page);
  await voerIngangAdapterUit(page, meet);
  return meet;
}

async function bezoek(ctx, base, ingang) {
  const meet = ingangOpties(ingang);
  const page = await ctx.newPage();
  const crash = [], config = [], serverfout = [], rem = [];
  luister(page, base, { crash, config, serverfout, rem });
  let eind = '', poort = false, poortTekst = '', tekst = 0;
  try {
    await openIngang(page, base, meet);
    await page.waitForTimeout(2600);
    eind = page.url().replace(base, '');
    const p = await page.evaluate((sel) => {
      for (const s of sel) { const el = document.querySelector(s); if (el) return (el.innerText || '').trim().slice(0, 180) || s; }
      return null;
    }, POORTEN);
    if (p) { poort = true; poortTekst = p.replace(/\s+/g, ' '); }
    tekst = await page.evaluate(() => (document.body.innerText || '').trim().length);
  } catch (e) {
    crash.push('laden mislukt: ' + String(e.message || e).split('\n')[0].slice(0, 140));
  }
  await page.close();
  return { crash, config, serverfout, rem, poort, poortTekst, eind, tekst,
    samenvatting: poort ? 'poort dicht' : (crash.length ? 'gooit' : tekst + ' tekens zichtbaar') };
}

/* ---- de bediening: tikken op wat er staat ---- */
/* WAAROM EEN TIK NIET LUKTE, uit de log van Playwright. De vijf bekende
   redenen eerst. Daarna twee die eerst als "reden niet gemeld" in het register
   stonden en wel degelijk iets zeggen: de tik is VERSTUURD maar de pagina
   rondde hem niet af binnen de limiet (de laag erachter kan dus open staan),
   of de pagina antwoordde niet eens op de vraag of de knop zichtbaar en stil
   staat (de hoofddraad was bezet). Allebei traagheid, en nadrukkelijk geen
   bewijs dat de knop werkt: ze blijven "niet aan te tikken". */
function klikReden(log) {
  const l = String(log || '');
  const bekend = l.match(/intercepts pointer events|element is not visible|element is not stable|element is not enabled|element is outside of the viewport/i);
  if (bekend) return bekend[0];
  if (/performing click action/i.test(l)) return 'tik verstuurd maar niet afgerond binnen de limiet';
  if (/waiting for element to be visible, enabled and stable/i.test(l)) return 'pagina antwoordde niet binnen de limiet';
  return 'reden niet gemeld';
}

/* Sommige schermen tekenen hun hoofdactie opnieuw zodra de serverstand
   binnenkomt. Playwright kan dan precies het oude element hebben gevonden:
   de knop bestaat in de schone stand, maar verdwijnt tussen zoeken en tikken.
   Net als bij een bedekking toetsen we zo'n bediening precies eenmaal opnieuw
   vanaf de gedeclareerde ingang. Een knop die daar verborgen blijft, faalt
   nog steeds; dit maakt een werkelijk onzichtbare bediening dus niet groen. */
function redenVoorSchoneTegenproef(waarom) {
  return /intercepts pointer events|element is outside of the viewport|element is not visible/i.test(String(waarom || ''));
}

/* De productnorm voor bewijs 2 staat op één plek. Een percentage, een
   afgeronde verhouding of een overgeslagen risicoknop mag nooit als volledige
   bediening worden gepresenteerd. */
function volledigeBediening(bediening) {
  return Number.isInteger(bediening && bediening.gevonden) && bediening.gevonden > 0 &&
    Number.isInteger(bediening.geklikt) && bediening.geklikt === bediening.gevonden &&
    Array.isArray(bediening.overgeslagen) && bediening.overgeslagen.length === 0;
}

/* Het element dat de klik opving, uit de log van Playwright: "<a ...>…</a> from
   <div id="x" ...>…</div> subtree intercepts pointer events" -> div#x. Bij een
   subtree telt de WORTEL (die ligt over de knop), niet het kind. */
function onderschepper(log) {
  const m = /(<[a-z][^>]*>)(?:[^<]*<\/[a-z0-9-]+>)?\s+(?:from\s+(<[a-z][^>]*>)(?:[^<]*<\/[a-z0-9-]+>)?\s+subtree\s+)?intercepts pointer events/i.exec(String(log || ''));
  if (!m) return 'onbekend';
  const el = m[2] || m[1];
  const tag = (/^<([a-z0-9-]+)/i.exec(el) || [])[1] || '?';
  const id = (/\sid="([^"]+)"/.exec(el) || [])[1];
  const klas = ((/\sclass="([^"]+)"/.exec(el) || [])[1] || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return tag.toLowerCase() + (id ? '#' + id : '') + klas.map((c) => '.' + c).join('');
}

async function bedien(ctx, base, ingang) {
  const meet = ingangOpties(ingang);
  const pad = meet.pad;
  const ingangPad = String(meet.bestemming || pad).split('#')[0].split('?')[0];
  const opIngang = () => {
    try { return new URL(page.url()).pathname === ingangPad; }
    catch (e) { return false; }
  };
  const bereik = meet.bereik || (meet.adapter && meet.adapter.bereik);
  const page = await ctx.newPage();
  const crash = [], config = [], serverfout = [], rem = [], weigering = [], gezegd = [], taalWissel = [], bedekt = [], wachtend = [];
  let laatste = null;
  let geklikt = 0, gevonden = 0, schil = 0;
  const gevondenMerken = new Set();
  const gevondenNamen = new Map();
  const aangetiktMerken = new Set();
  const telStand = (stand) => {
    for (const merk of (stand && stand.merken) || []) gevondenMerken.add(merk);
    for (const bediening of (stand && stand.bedieningen) || []) {
      if (!gevondenNamen.has(bediening.merk)) gevondenNamen.set(bediening.merk, bediening.tekst);
    }
    gevonden = gevondenMerken.size;
    schil = Math.max(schil, (stand && stand.schil) || 0);
  };
  let heropeningen = 0;
  /* Tijdens een verklaarde A -> B-herstelroute moet B in de huidige stand
     worden herhaald voordat we opnieuw naar de ingang springen. Buiten zo'n
     route gaan we juist eerst schoon terug, zodat een blijvende contextopener
     geen gewone beginacties gevangen houdt. */
  let herstelketenActief = false;
  let herstelZonderNieuw = 0;
  const opnieuwGeprobeerd = new Set();
  /* Een opener mag eenmaal per zichtbare stand en bewijsvoortgang worden
     herhaald. De stand hoort bij de sleutel: zo kan de meter A -> B opnieuw
     doorlopen om een volgende keuze achter twee lagen te bereiken, zonder in
     A -> B -> A te blijven draaien wanneer de pagina geen voortgang oplevert. */
  const herhaald = new Set(), herhaaldAangeraakt = [];
  const overgeslagen = [], risicovolAangeraakt = [], risicoFixtures = [], nietKlikbaar = [], onderschept = [], instrument = [];
  /* APPWERKT bewijst dat de zichtbare bediening reageert; de mutatie-,
     voltooi- en financiële proeven bewijzen het zakelijke gevolg. Dat
     onderscheid is ook een veiligheidsgrens. Een echte tik op bijvoorbeeld
     Uitloggen trok vroeger de server-side proefsessie in die nog door andere
     apps werd gebruikt. De eerste volledige 100%-ronde maakte daardoor na
     twintig apps zijn eigen volgende metingen ongeldig.

     Laat de browser de risicovolle knop daarom werkelijk bedienen, inclusief
     alle lokale handlers, dialoog en navigatie, maar vang uitsluitend gedurende
     die ene tik een muterend verzoek aan DE LOKALE WEGWERPSERVER af. GET/HEAD
     blijven echt, externe adressen blijven ongemoeid en iedere fixture wordt
     met methode en pad verantwoord. Dit is geen productie-mock en maakt geen
     zakelijk bewijs groen: die gevolgen blijven uitsluitend uit de aparte
     contractproeven komen. */
  let actieveRisicoklik = null;
  const basisHerkomst = new URL(base).origin;
  await page.route('**/*', async (route) => {
    const verzoek = route.request();
    const methode = verzoek.method().toUpperCase();
    let url;
    try { url = new URL(verzoek.url()); } catch (e) { return route.continue(); }
    if (!actieveRisicoklik || url.origin !== basisHerkomst || /^(GET|HEAD|OPTIONS)$/.test(methode) ||
        !VERNIETIGENDE_ROUTE.test(url.pathname)) {
      return route.continue();
    }
    const bewijs = { knop: actieveRisicoklik, methode, pad: url.pathname };
    if (!risicoFixtures.some((x) => x.knop === bewijs.knop && x.methode === bewijs.methode && x.pad === bewijs.pad)) {
      risicoFixtures.push(bewijs);
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      ok: true, success: true, status: 'appwerkt-proef', id: 'appwerkt-proef', reference: 'appwerkt-proef'
    }) });
  });
  page.on('dialog', async (dialoog) => {
    instrument.push('de proef raakte bediening met een browserbevestiging en brak de onomkeerbare bevestiging af');
    await dialoog.dismiss().catch(() => {});
  });
  try {
    await page.goto(base + pad, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2200);
    /* Pas meten als de Edge staat. Daarvoor ligt de onderste herstelstrook er
       nog en is een balk die de Edge overneemt nog niet overgenomen; een meting
       in die tussenstand meldde Office als bedekt terwijl zijn balk een tel
       later in de Edge zat. Een scherm zonder adaptieve Edge wordt nooit klaar,
       vandaar de grens. */
    await page.waitForFunction(() => document.body && document.body.getAttribute('data-rtg-adaptive-ready') === 'true',
      null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    /* De ledenapp tekent eerst de verplichte onboardinglaag en verbergt die
       pas nadat haar status bekend is. Onder parallelle belasting kon de
       vaste laadpauze verlopen terwijl #onbGate nog boven interne tabbladen
       lag; de meter beschuldigde daarna Assets, Betalen en Reizen van de deur
       die hij zelf te vroeg had gemeten. Wacht op het waarneembare product-
       gedrag. Een scherm zonder zo'n laag voldoet meteen aan `hidden`. */
    await wachtOpOnboarding(page);
    await wachtOpInteractielaag(page);
    await wachtOpAppGereed(page);
    luister(page, base, { crash, config, serverfout, rem, weigering, wachtend });   // pas NA het laden: laadfouten horen bij bewijs 1
    if (meet.adapter) await voerIngangAdapterUit(page, meet);
    /* Een interne module tekent haar inhoud vaak pas na meerdere API-antwoorden.
       De vaste algemene laadpauze was onder parallelle belasting soms eerder
       voorbij dan bijvoorbeeld Zorg, waardoor dezelfde bronstand wisselde
       tussen 0 en 28 zichtbare moduleknoppen. Wacht bij een expliciet bereik
       op ten minste een eigen zichtbare bediening; een werkelijk lege module
       blijft na de begrensde wacht eerlijk op nul staan. */
    if (bereik) await page.waitForFunction(({ selector, bediening }) => {
      const root = document.querySelector(selector);
      if (!root) return false;
      return [...root.querySelectorAll(bediening)].some((el) => {
        if (el.hidden || el.disabled || el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
        const r = el.getBoundingClientRect();
        return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden';
      });
    }, { selector: bereik, bediening: BEDIENINGSSELECTOR }, { timeout: 8000 }).catch(() => {});
    bedekt.push(...await bedektDoorSchil(page, bereik));
    /* Welke tik de taal van de persona verandert: een vertaalverzoek naar een
       andere taal dan nl na een tik, met de knop erbij. */
    page.on('request', (q) => {
      if (!q.url().includes('/api/vertaal/ui')) return;
      let naar = null; try { naar = JSON.parse(q.postData() || '{}').naar; } catch (e) {}
      if (naar && naar !== 'nl' && laatste && !taalWissel.some((w) => w.knop === laatste && w.naar === naar)) taalWissel.push({ knop: laatste, naar });
    });
    const gehad = new Set();
    for (let ronde = 0; ronde < MAXKLIK; ronde++) {
      let k;
      try { k = await kijkRonde(page, gehad, bereik, herhaald); }
      catch (e) {
        /* Een tik kan navigeren, en dan is de context van de pagina weg op het
           moment dat de volgende ronde kijkt ("Execution context was
           destroyed"). Dat is een eigenschap van de PROEF en niet van het
           scherm. Zonder deze opvang werd een navigerende knop gemeld als een
           defect van de app -- een instrument dat zijn eigen struikelen als
           beschuldiging uitschrijft is erger dan geen instrument. */
        if (!/Execution context was destroyed|Target closed|Navigation|frame was detached/i.test(String(e.message || e))) throw e;
        instrument.push('de proef verloor de pagina door een navigatie en opende hem opnieuw');
        try { await openIngang(page, base, meet); await page.waitForTimeout(1200); k = await kijkRonde(page, gehad, bereik, herhaald); }
        catch (x) { instrument.push('opnieuw openen lukte niet: ' + String(x.message || x).split('\n')[0].slice(0, 80)); break; }
      }
      telStand(k);
      if (k.klaar) {
        /* Een echte bediening kan het hele scherm van stand laten wisselen.
           De meter had dan bijvoorbeeld 49 knoppen GEZIEN, tikte een tab aan,
           zag in de nieuwe stand alleen de al aangetikte tab terug en stopte
           op 12/49. De overige 37 waren niet onbereikbaar: de proef had ze
           zelf uit beeld geschakeld.

           Open daarom de gedeclareerde ingang opnieuw zolang een schone
           beginstand nog eerder geziene maar niet aangetikte bediening kan
           bevatten. `laatsteHeropenStand` voorkomt een lus als die resterende
           bediening alleen via een al beproefde tussenstand bereikbaar is;
           MAXKLIK begrenst zowel tikken als herstelpogingen. Dit verlaagt de
           bewijsgrens niet: elke extra knop wordt nog steeds echt aangetikt en
           op browser- en serverfouten beoordeeld. */
        if (gehad.size < gevonden) {
          try {
            /* Een reeds ingezette openerketen vervolgen we in de huidige
               stand. Zo blijft A -> B -> dialoog bereikbaar. Dit pad wordt
               uitsluitend gezet door een expliciet herhaalde standopener en
               valt terug naar de schone ingang zodra het geen vervolg heeft. */
            if (herstelketenActief) {
              k = await kijkRonde(page, gehad, bereik, herhaald, true);
              telStand(k);
              if (k.klaar) herstelketenActief = false;
            }
            /* Eerst terug naar de schone ingang. Een dynamisch scherm kan na
               een keuze tientallen eerder gevonden knoppen verbergen. In de
               oude volgorde herhaalde de proef dan iedere bekende opener in de
               gemuteerde stand voordat zij terugging; Mall bereikte daardoor
               MAXKLIK terwijl 45 gewone beginknoppen onaangeraakt bleven.

               De schone ingang is de kortste route naar zulke bediening. Pas
               wanneer daar niets nieuws staat, herhalen we een verklaarde
               opener om A -> B -> resterende keuze opnieuw te bereiken. De
               bewijsgrens verandert niet: iedere unieke knop wordt nog steeds
               werkelijk aangetikt. */
            if (k.klaar && heropeningen < MAXKLIK) {
              heropeningen++;
              await openIngang(page, base, meet);
              await page.waitForTimeout(1200);
              herstelketenActief = false;
              instrument.push('de proef heropende de ingang om bediening uit de oorspronkelijke stand afzonderlijk te toetsen');
            }
            if (k.klaar) {
              k = await kijkRonde(page, gehad, bereik, herhaald);
              telStand(k);
            }
            if (k.klaar) {
              k = await kijkRonde(page, gehad, bereik, herhaald, true);
              telStand(k);
            }
            if (k.klaar) break;
          } catch (e) {
            instrument.push('heropenen van de oorspronkelijke stand lukte niet: ' + String(e.message || e).split('\n')[0].slice(0, 80));
            break;
          }
        }
        else break;
      }
      if (k.herhaling) {
        herhaald.add(k.herhaalSleutel);
        herstelketenActief = true;
        herstelZonderNieuw++;
        const grens = herstelgrens(gevonden - gehad.size);
        if (herstelZonderNieuw > grens) {
          instrument.push('de proef stopte een openercyclus na ' + grens +
            ' herstelstappen zonder nieuwe unieke bediening; de resterende bediening blijft eerlijk onaangeraakt');
          break;
        }
        if (!instrument.some((x) => /toestandsafhankelijke openerketen/.test(x))) {
          instrument.push('de proef volgde een toestandsafhankelijke openerketen naar resterende bediening');
        }
      } else {
        gehad.add(k.merk);
        herstelketenActief = false;
        herstelZonderNieuw = 0;
      }
      laatste = k.tekst || '(naamloos)';
      const isRisicovol = RISICOVOL.test(laatste);
      if (isRisicovol && !risicovolAangeraakt.includes(laatste)) risicovolAangeraakt.push(laatste);
      try {
        actieveRisicoklik = isRisicovol ? laatste : null;
        await page.click('[data-appwerkt="1"]', { timeout: 2500, noWaitAfter: true });
        if (k.herhaling) {
          if (!herhaaldAangeraakt.includes(k.tekst || '(naamloos)')) herhaaldAangeraakt.push(k.tekst || '(naamloos)');
        } else {
          aangetiktMerken.add(k.merk);
          geklikt = aangetiktMerken.size;
        }
        /* Een scherm mag zijn asynchrone overgang met aria-busy kenbaar
           maken. Wacht dan op de werkelijke nieuwe inhoud in plaats van op
           machinesnelheid te gokken. RTMAIL gebruikt dit bij bericht ->
           gesprek; dezelfde standaard werkt voor iedere app. */
        await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'),
          null, { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(600);
        /* Face ID bevestigt pas na 1,1 seconde en verstuurt de betaling dus
           later dan de gewone klikpauze. Houd de tijdelijke routefixture vast
           zolang de echte betaaloverlay open staat. Zonder deze wacht liep
           `/api/pay/saldo` alsnog door, verdween de factuur en bleven twee
           alternatieve betaalbuttons ten onrechte onaangeraakt. */
        if (isRisicovol) {
          await page.waitForSelector('#paywait.open', { state: 'hidden', timeout: 3000 }).catch(() => {});
        }
        actieveRisicoklik = null;
        await beoordeelWeigeringen(page, weigering, gezegd, serverfout, wachtend);
        /* Een app-eigen knop kan navigeren (Terug, Open volledig, enzovoort).
           De tik bewijst die knop, maar de bediening op het bestemmingsscherm
           hoort niet in de noemer van de bronapp. Voorheen keek `vervolg`
           eerst rond en pas onderaan de iteratie naar de URL; Commerce erfde
           daardoor 70 Mall-knoppen die het nooit kon bedienen. Keer meteen
           terug naar de gedeclareerde ingang en inventariseer pas daar verder.
           Hashwissels binnen dezelfde ingang blijven wel onderdeel van de app. */
        if (!opIngang()) {
          await openIngang(page, base, meet);
          await page.waitForTimeout(1500);
          instrument.push('de proef raakte een navigatieknop en opende de app opnieuw zonder bediening van het bestemmingsscherm mee te tellen');
          continue;
        }
        /* EN DAN DICHT, zoals een mens doet. Een tik opent vaak een laag (het
           paneel van Rahul, de sprong, de taalkeuze); bleef die open, dan lag hij
           over elke volgende knop en telde de proef zijn eigen lade als
           "onbereikbaar" (gemeten 24 september 2026: 517 knoppen, vrijwel
           allemaal onder zo'n gedeelde laag). Escape is de gewone weg dicht; wat
           daarna nog over een knop ligt, sluit niet met Escape of bedekt hem
           echt -- en dat is wel een bevinding. */
        /* Een app-eigen opener kan een dialoog, blad of vervolgstand tonen met
           de bediening die de gebruiker werkelijk nodig heeft. Meteen Escape
           sturen sloot die inhoud voordat de volgende meetronde haar ooit kon
           zien (Instellingen: 7/19 ondanks vijf goed werkende panelen).

           Kijk daarom eerst of de tik nieuwe, nog niet beproefde bediening
           zichtbaar maakte. Zolang die er is blijft de stand open en loopt de
           volgende ronde er echt doorheen. Alleen een eindstand zonder nieuwe
           bediening sluiten we met de gewone Escape-route. De bestaande
           schone-tegenproef blijft een achtergebleven, niet-sluitende laag
           begrenzen; de bewijsdrempel wordt niet verlaagd. */
        let vervolg = null;
        try { vervolg = await kijkRonde(page, gehad, bereik, herhaald); } catch (e) { vervolg = null; }
        if (vervolg) telStand(vervolg);
        /* Na een herhaalde opener kan de dialoog uitsluitend bediening tonen
           die al eerder is gezien. `vervolg.klaar` betekent dan niet dat het
           herstelpad klaar is: bekende, nog onaangeraakte paneelacties kunnen
           achter een reeds beproefde tab zitten. Escape sloot het echte Social
           Control Plane hier direct na OPEN COMMAND. Laat de laag in precies
           die begrensde situatie staan; de volgende ronde herhaalt expliciete
           standnavigatie en MAXKLIK blijft de bovengrens. */
        const herstelpadOpen = k.herhaling && gehad.size < gevonden;
        if ((!vervolg || vervolg.klaar) && !herstelpadOpen) {
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(250);
        }
      } catch (e) {
        actieveRisicoklik = null;
        /* De reden van een time-out staat in de LOG van Playwright ("intercepts
           pointer events", "element is not visible"), niet in de boodschap.
           Zonder die reden is "niet aan te tikken" een dood getal: een knop
           onder een balk is iets anders dan een knop die er niet is. */
        const log = String(e.message || e);
        const waarom = klikReden(log);
        /* Een eerdere geslaagde bediening kan een laag achterlaten die niet met
           Escape sluit. De volgende, op zichzelf geldige knop wordt dan door
           die PROEFSTAND onderschept. Toets zo'n knop eenmaal opnieuw vanaf de
           gedeclareerde, schone ingang. Pas wanneer dezelfde bediening daar
           opnieuw niet bereikbaar is, telt zij als werkelijk niet klikbaar.

           `gehad.delete()` is hier essentieel: kijkRonde selecteert op de
           stabiele handtekening van de bediening. De Set begrenst dit tot een
           enkele tegenproef per knop, zodat een echte overlap nooit in een
           heropeningslus verdwijnt. */
        if (k.herhaling) {
          instrument.push('een herhaalde opener was vanuit de schone stand niet opnieuw te bedienen: ' +
            (k.tekst || '(naamloos)') + ' (' + waarom + ')');
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(250).catch(() => {});
          continue;
        }
        const opnieuwVanafSchoon = redenVoorSchoneTegenproef(waarom) &&
          !opnieuwGeprobeerd.has(k.merk);
        if (opnieuwVanafSchoon) {
          opnieuwGeprobeerd.add(k.merk);
          gehad.delete(k.merk);
          try {
            await openIngang(page, base, meet);
            await page.waitForTimeout(1200);
            instrument.push('de proef toetste een verdwenen of geblokkeerde bediening opnieuw vanaf de schone ingang');
            continue;
          } catch (x) {
            gehad.add(k.merk);
            instrument.push('schoon hertesten van de geblokkeerde bediening lukte niet: ' + String(x.message || x).split('\n')[0].slice(0, 80));
          }
        }
        nietKlikbaar.push((k.tekst || '(naamloos)') + ': ' + waarom);
        /* WIE ligt erover. "intercepts pointer events" alleen zegt niet of het
           een lade is die een mens eerst dichttikt of een balk die de knop
           voorgoed bedekt (BETROUWBAARHEID.md par. 7, stap 1). Playwright noemt
           het element; dat wordt bewaard als tag#id.klasse, zonder tekst. */
        if (/intercepts pointer events/i.test(waarom)) onderschept.push({ knop: k.tekst || '(naamloos)', door: onderschepper(log) });
        /* OOK NA EEN MISLUKTE TIK DICHT, zoals na een geslaagde. Een tik die in
           de tijdslimiet loopt, kan WEL zijn aangekomen: Playwright stuurt de muis
           en wacht dan tot de pagina hem heeft verwerkt ("performing click
           action"). Op een volle machine duurt dat langer dan 2,5 s, de laag
           (de sprong, het paneel van Rahul, Meenemen) staat dan open, en zonder
           deze Escape lag hij over elke volgende knop. Gemeten op 18 oktober
           2026, load average 25 op 4 kernen: Vonk, Food Court, Podium, Wonen en
           Vluchten verloren zo hun hele bediening aan EEN trage tik, en de
           onderschepper wees de eigen laag van het scherm aan als boosdoener.
           Dezelfde ronde op de code van 11 oktober (toen 96 BEWEZEN) gaf
           hetzelfde beeld: het was de machine, niet de code. Wat na Escape nog
           over een knop ligt, sluit niet met Escape -- en dat blijft een
           bevinding, precies zoals bij een geslaagde tik. */
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(250).catch(() => {});
      }
      if (!opIngang()) {
        try { await openIngang(page, base, meet); await page.waitForTimeout(1500); } catch (e) { break; }
      }
    }
  } catch (e) {
    instrument.push('bediening mislukt: ' + String(e.message || e).split('\n')[0].slice(0, 140));
  }
  await beoordeelWeigeringen(page, weigering, gezegd, serverfout, wachtend);
  await page.close();
  const onaangeraakt = [...gevondenMerken].filter((merk) => !aangetiktMerken.has(merk))
    .map((merk) => gevondenNamen.get(merk) || merk).filter(Boolean);
  const aangeraakt = [...aangetiktMerken].map((merk) => gevondenNamen.get(merk) || merk).filter(Boolean);
  return { geklikt, gevonden, aangeraakt, herhaaldAangeraakt, onaangeraakt, schil, bedekt, overgeslagen, risicovolAangeraakt, risicoFixtures, nietKlikbaar, onderschept, instrument, crash, config, serverfout, rem, gezegd, taalWissel };
}

/* WAT STAAT ER NU, EN WAT HEBBEN WE NOG NIET GEHAD.

   Hier stond eerst: markeer in EEN keer veertien knoppen met `data-appwerkt` en
   tik ze daarna op nummer aan. Dat werkte precies een keer per scherm -- een tik
   wisselt vaak van stand, het scherm hertekent, de markeringen verdwijnen, en
   elke volgende klik liep in een time-out die stil werd overgeslagen. Gemeten
   over de hele ronde: 1206 knoppen gevonden, 331 aangetikt, mediaan 14 gevonden
   tegen 2 aangetikt. "Bedienbaar BEWEZEN" sloeg dus vrijwel overal op EEN knop,
   en dat is de gevaarlijkste soort defect in een meter: te weinig doen en groen
   melden.

   Daarom per ronde OPNIEUW kijken, en bijhouden wat al gehad is op een
   HANDTEKENING (tag, id, aria-label, tekst) en niet op een positie -- na een
   hertekening klopt een positie niet meer. */
/* Staat de zin van een weigering op het scherm, dan heeft de gebruiker gezien
   waarom (gezegd); anders is het een defect: de server weigerde en niemand
   vertelde het hem. */
/* Een vervolgvraag telt alleen met de bijbehorende netwerkrespons en zichtbare
   bediening. Een willekeurige (of achtergebleven) dialoog is geen bewijs. */
const poortVerkeer = new WeakMap();
async function gegevensVraagGetoond(page, w) {
  if (w.s !== 428 || !w.poort) return false;
  const verkeer = poortVerkeer.get(page) || [];
  const i = verkeer.indexOf(w.poort);
  const volgende = verkeer[i + 1];
  if (i < 0 || !volgende || volgende.pad !== '/api/gegevens/start' || volgende.s !== 200 || volgende.methode !== 'POST' || volgende.volgorde <= w.poort.volgorde) return false;
  const [poort, vraag] = await Promise.all([w.poort.data, volgende.data]);
  if (!poort || !vraag || !poort.soort || volgende.soort !== poort.soort || !vraag.id || !vraag.tekst ||
      !Array.isArray(poort.ontbreekt) || !poort.ontbreekt.some(v => v.veld === vraag.veld)) return false;
  return page.evaluate(({ tekst, veld }) => {
    const zichtbaar = el => {
      if (!el || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
      const r = el.getBoundingClientRect();
      const boven = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return r.width > 0 && r.height > 0 && boven && (boven === el || el.contains(boven));
    };
    return [...document.querySelectorAll('.rp-waas .rp-kaart[role="dialog"]')].some(d => {
      const v = d.querySelector('.rp-vraag'), stop = d.querySelector('.rp-stop');
      if (!zichtbaar(v) || v.innerText.trim() !== tekst.trim() || !zichtbaar(stop) || stop.disabled) return false;
      if (veld === 'identiteit') return true; // de bestaande verificatiestap heeft geen invoerveld
      const invoer = d.querySelector('.rp-in'), door = d.querySelector('.rp-door');
      return zichtbaar(invoer) && !invoer.disabled && zichtbaar(door) && !door.disabled;
    });
  }, { tekst: vraag.tekst, veld: vraag.veld }).catch(() => false);
}

async function beoordeelWeigeringen(page, weigering, gezegd, serverfout, wachtend = []) {
  /* Playwright wacht niet op een async response-listener. Lees daarom eerst
     alle reeds ontvangen foutantwoorden uit voordat het scherm wordt bekeken;
     anders kon de meter een zichtbare foutzin pas na het sluiten van haar
     formulier administreren en onterecht een productdefect melden. */
  if (wachtend.length) await Promise.allSettled(wachtend.splice(0));
  while (weigering.length) {
    const w = weigering.shift();
    let tekst = '';
    try { tekst = await page.evaluate(() => document.body ? document.body.innerText : ''); } catch (e) { tekst = ''; }
    if (tekst.includes(w.zin)) gezegd.push(w.s + ' ' + w.pad + ': ' + w.zin);
    else if (await gegevensVraagGetoond(page, w)) gezegd.push(w.s + ' ' + w.pad + ': bijbehorende gegevensvraag zichtbaar en bedienbaar');
    else serverfout.push(w.s + ' ' + w.pad + ' -- de server weigerde ("' + w.zin.slice(0, 80) + '") maar het scherm toonde de reden niet');
  }
}

/* EEN EIGEN KNOP DIE DE SCHIL HELEMAAL BEDEKT, IS EEN DEFECT en geen
   ongemeten knop. Gevonden op 27 september 2026: de tabbalk van Decision Room
   lag onder de onderbalk van de Edge, en de werkbalk van de browser onder de
   herstelstrook die de Edge in de compacte stand over de bovenrand legt. Een
   muis kwam er niet bij; de proef meldde dat als "niet aan te tikken" en de rij
   bleef NIET_GETEST, waarmee het defect uit beeld verdween.

   Streng met opzet: pas als ALLE 45 meetpunten van de knop (na hem in beeld te
   schuiven, zoals een mens scrolt) op de schil vallen. Een knop die half
   bedekt is, is nog aan te tikken en blijft een zaak voor de gewone tik.

   EN HIJ SCROLT DIRECT, NIET GLAD (6 oktober 2026). Een scherm met
   `scroll-behavior: smooth` laat scrollIntoView ANIMEREN, en deze functie mat
   meteen daarna: de knop stond dan nog op zijn oude plek, onder de balk. Zo
   meldde de meting op os-portaal.html vier "bedekte" tegels die na de animatie
   vrij lagen (0 van 45 meetpunten). `behavior: 'instant'` gaat boven de CSS. */
async function bedektDoorSchil(page, bereik) {
  try {
    return await page.evaluate(({ SCHIL, bereik, bediening }) => {
      /* Een knop in een dichtgeklapte <details> ziet niemand: een regel die de
         inhoud van <details> een vaste display geeft, geeft hem toch een vak.
         Zo meldde deze meting op 18 oktober 2026 de standen van rtg.html als
         "bedekt door de schil" terwijl ze in "Uw volledige overzicht" dicht lagen. */
      const zie = (el) => { if (!el || el.hidden || el.disabled) return false;
        if (el.closest('details:not([open])') && !el.closest('summary')) return false;
        if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false;
        const b = el.getBoundingClientRect(); return b.width > 1 && b.height > 1; };
      const uit = [];
      const wortel = bereik ? document.querySelector(bereik) : document;
      if (!wortel) return [];
      /* scrollIntoView kan ook een overflow:hidden-vlak programmatisch
         verschuiven. Op het digitale bord schoof zo de tekenwerkbalk onder de
         bovenbalk en maakte de overlapmeting haar eigen bedieningsfout. Bewaar
         daarom alle werkelijk scrollbare vlakken en zet ze exact terug. */
      const scrollStand = [document.scrollingElement, ...document.querySelectorAll('*')]
        .filter((el, i, a) => el && a.indexOf(el) === i &&
          (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth))
        .map(el => ({ el, top: el.scrollTop, left: el.scrollLeft }));
      const knoppen = Array.from(wortel.querySelectorAll(bediening))
        .filter(zie).filter((el) => !el.closest(SCHIL) && !el.closest('#rtg-lang-modal'));
      for (const el of knoppen) {
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        const r = el.getBoundingClientRect();
        let punten = 0, onderSchil = 0, door = null;
        for (let a = 1; a < 10; a++) for (let c = 1; c < 6; c++) {
          const x = r.x + r.width * a / 10, y = r.y + r.height * c / 6;
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
          punten++;
          const t = document.elementFromPoint(x, y);
          const s = t && !el.contains(t) && t.closest(SCHIL);
          if (s) { onderSchil++; door = door || (t.tagName.toLowerCase() + '.' + Array.from(t.classList).slice(0, 2).join('.')); }
        }
        if (punten && onderSchil === punten) {
          uit.push((el.innerText || el.value || el.getAttribute('aria-label') || el.title || '(naamloos)').trim().replace(/\s+/g, ' ').slice(0, 30) + ' onder ' + door);
        }
      }
      for (const s of scrollStand) { s.el.scrollTop = s.top; s.el.scrollLeft = s.left; }
      return uit;
    }, { SCHIL: GEDEELDE_SCHIL, bereik, bediening: BEDIENINGSSELECTOR });
  } catch (e) { return []; }
}

async function kijkRonde(page, gehad, bereik, herhaald = new Set(), magHerhalen = false) {
  return page.evaluate(({ alGehad, alHerhaald, magHerhalen, SCHIL, bereik, bediening, risicovol }) => {
    const zie = (el) => { if (!el || el.hidden || el.disabled) return false;
      if (el.closest('details:not([open])') && !el.closest('summary')) return false;
      if (typeof el.checkVisibility === 'function' &&
          !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false;
      const b = el.getBoundingClientRect(); return b.width > 1 && b.height > 1; };
    const merk = (el) => {
      const label = (el.getAttribute('aria-label') || '').trim();
      const naam = label || (el.innerText || el.value || el.title || '').trim();
      return [el.tagName, el.id || '', naam.slice(0, 60)].join('|');
    };
    /* De taalkeuze wordt niet aangetikt: een taal kiezen verandert de persona
       voor ELK volgend scherm (en liet elk scherm daarna vertalingen vragen).
       Dat is een instelling, geen functie van het scherm onder de meting. */
    const wortel = bereik ? document.querySelector(bereik) : document;
    if (!wortel) return { klaar: true, zichtbaar: 0, merken: [], bedieningen: [], schil: 0 };
    /* Een open modale dialoog maakt de achtergrond tijdelijk onbedienbaar,
       ook al geeft offsetParent daar nog maten voor terug. Meet in die stand
       uitsluitend de top-layer dialoog. Zonder dit onderscheid telde de
       meter zowel paneel als achtergrond in dezelfde noemer en maakte hij
       zijn eigen bewijsgrens onhaalbaar. */
    const modaal = [...document.querySelectorAll('dialog[open], [role="dialog"]')]
      .find((el) => zie(el) && wortel.contains(el));
    const actiefWortel = modaal || wortel;
    const kandidaten = Array.from(actiefWortel.querySelectorAll(bediening))
      .filter(zie).filter((el) => !el.getAttribute('href') && !el.getAttribute('data-url'))
      .filter((el) => !el.closest('#rtg-lang-modal'));
    /* DE SCHIL IS NIET DIT SCHERM. De Edge (.rtg-edge-chrome) en de toetsknop
       van het veeggebaar (.rnd-toets, randen.js) staan op ELK scherm en worden
       daar door hun eigen toetsen beproefd (test/appmenu.e2e.js e.a.). Telden
       ze mee, dan mat elke rij vooral de schil: op geven.html waren alle 23
       knoppen schil en nul van het scherm zelf, en met hoogstens MAXKLIK tikken
       tegen "minstens de helft van wat zichtbaar is" kon een scherm met meer dan
       28 knoppen nooit bewezen worden (gemeten 27 september 2026: 111 van 112
       rijen NIET_GETEST, geen enkele boven de 14 tikken). De .rnd-toets staat
       bovendien met opzet buiten beeld tot hij focus krijgt; zijn "outside of
       the viewport" was de proef, niet het scherm. */
    /* Command/Spatial is net als Edge een gedeelde werkruimte rond het actieve
       scherm. Op app.html staan #rtgCommand en #shell tegelijk in de DOM. De
       18 Command-acties achter het actieve OS-blad werden daardoor als knoppen
       van bijvoorbeeld Assets geteld en vervolgens terecht door #shell
       onderschept. Command heeft eigen browsertoetsen; deze rij kwalificeert
       alleen de actieve app. */
    const alle = kandidaten.filter((el) => !el.closest(SCHIL));
    /* En een knop telt EEN keer: vier kaarten met "Bekijken" zijn een handeling,
       en de proef tikt er ook maar een aan (hetzelfde merk). In de noemer
       stonden ze vier keer. */
    const merken = [...new Set(alle.map(merk))];
    const bedieningen = [...new Map(alle.map((el) => [merk(el), {
      merk: merk(el),
      tekst: (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '').trim().replace(/\s+/g, ' ').slice(0, 80)
    }])).values()];
    const zichtbaar = merken.length;
    const schil = kandidaten.length - alle.length;
    document.querySelectorAll('[data-appwerkt]').forEach((el) => el.removeAttribute('data-appwerkt'));
    /* In een app-eigen dialoog staat de sluitknop vaak als eerste in de DOM.
       Die als eerste aantikken maakt alle inhoud onzichtbaar en laat de meter
       daarna zonder replaypad achter. Een mens opent het paneel juist om de
       inhoud te gebruiken en sluit het daarna. Houd uitsluitend expliciete
       sluitbediening daarom achteraan; zij wordt nog steeds echt beproefd. */
    const sluiter = (el) => /^(?:sluit(?:en)?|close)(?:\b|$)|^[×✕]$/i.test(
      (el.getAttribute('aria-label') || el.innerText || el.value || el.title || '').trim());
    /* Ook app-eigen openers zijn echte standnavigatie. Sport gebruikt
       data-open voor Mijn tickets -> Wedstrijddag en RTMAIL data-i voor de
       inbox -> berichtweergave. Bij een schone replay moeten deze routes vóór
       willekeurige taakacties terugkeren, anders blijven bedieningselementen
       achter hun tweede scherm ten onrechte onaangeraakt. */
    const standNavigatie = (el) => el.matches('[role="tab"],[data-tab],[data-stand],[data-open],[data-i],[aria-controls]');
    const dialoogOpener = (el) => el.matches('[aria-haspopup="dialog"]');
    /* Een primaire lege-toestandactie kan door een latere mutatie verdwijnen.
       Raak haar daarom aan zodra zij zichtbaar is. Dit is dezelfde semantische
       hoofdactie die de interface al voor de gebruiker declareert. */
    const hoofdactie = (el) => el.matches('[data-hoofdactie]');
    const contextactie = (el) => el.matches('[data-contextactie]');
    const risico = new RegExp(risicovol, 'i');
    const risicoRang = (el) => {
      const tekst = (el.getAttribute('aria-label') || el.innerText || el.value || el.title || '').trim();
      if (/uitlog|log uit|sign ?out/i.test(tekst)) return 3;
      if (/verlaat|leave|verwijder|delete|wis alles|sluit account/i.test(tekst)) return 2;
      return risico.test(tekst) ? 1 : 0;
    };
    const nieuwe = alle.filter((el) => !alGehad.includes(merk(el)))
      .sort((a, b) => Number(!hoofdactie(a)) - Number(!hoofdactie(b)) ||
        Number(!contextactie(a)) - Number(!contextactie(b)) ||
        Number(!standNavigatie(a)) - Number(!standNavigatie(b)) ||
        risicoRang(a) - risicoRang(b) || Number(sluiter(a)) - Number(sluiter(b)));
    let doel = nieuwe[0], herhaling = false, herhaalSleutel = null;
    if (!doel && magHerhalen) {
      const stand = merken.slice().sort().join('¦');
      const herhaalStand = new Set(alHerhaald);
      doel = alle.filter((el) => alGehad.includes(merk(el)) &&
          (standNavigatie(el) || dialoogOpener(el) || contextactie(el)) &&
          !herhaalStand.has(alGehad.length + '§' + stand + '§' + merk(el)))
        /* Nieuwe dialooginhoud wordt hierboven altijd voor de sluitknop
           aangeraakt. Is in een modale stand niets nieuws meer over, dan doet
           een mens het omgekeerde: sluit de afgewerkte laag en gaat verder op
           het scherm eronder. Een reeds gebruikte taakactie opnieuw kiezen
           kan dezelfde overlay steeds heropenen (Magnaat: actieve opdracht)
           en voegt geen uniek bedieningsbewijs toe. Buiten een modal blijven
           openers vooraan om A -> B -> resterende keuze te kunnen replayen. */
        .sort((a, b) => modaal
          /* Als een reeds geziene tab een nog onaangeraakte paneelactie kan
             onthullen, moet die route voor de sluitknop worden herhaald. Dit
             is expliciete standnavigatie, geen willekeurige taakactie. Zonder
             deze rangorde zag het Social Control Plane AAN en ANALYSEER
             CONTEXT wel, maar sloot het deck voordat hun tab terugkwam. */
          ? Number(!standNavigatie(a)) - Number(!standNavigatie(b)) ||
            Number(!contextactie(a)) - Number(!contextactie(b)) ||
            Number(!sluiter(a)) - Number(!sluiter(b)) || risicoRang(a) - risicoRang(b)
          : Number(!contextactie(a)) - Number(!contextactie(b)) ||
            Number(!dialoogOpener(a)) - Number(!dialoogOpener(b)) ||
            Number(!standNavigatie(a)) - Number(!standNavigatie(b)) ||
            risicoRang(a) - risicoRang(b) || Number(sluiter(a)) - Number(sluiter(b)))[0];
      herhaling = !!doel;
      if (doel) herhaalSleutel = alGehad.length + '§' + stand + '§' + merk(doel);
    }
    if (!doel) return { klaar: true, zichtbaar, merken, bedieningen, schil };
    doel.setAttribute('data-appwerkt', '1');
    return { klaar: false, zichtbaar, merken, bedieningen, schil, merk: merk(doel), herhaling, herhaalSleutel,
      tekst: (doel.innerText || doel.value || doel.getAttribute('aria-label') || doel.title || '').trim().slice(0, 40) };
  }, { alGehad: [...gehad], alHerhaald: [...herhaald], magHerhalen, SCHIL: GEDEELDE_SCHIL, bereik,
    bediening: BEDIENINGSSELECTOR, risicovol: RISICOVOL.source });
}

/* Een 503 die zichzelf uitlegt is CONFIG en geen DEFECT. Dit huis schrijft die
   uitleg zelf op -- `hoe` in het antwoord, of een zin die naar een niet
   ingelezen bron wijst -- dus dat wordt gelezen en niet geraden. */
const CONFIGZINNEN = /nog niet ingeladen|niet gemount|draait niet mee|is niet beschikbaar|geen model|nietGebouwd/i;

function weigerZin(lijf) {
  try { const e = JSON.parse(lijf).error; return typeof e === 'string' && e.trim().length > 3 ? e.trim() : null; }
  catch (x) { return null; }
}

function luister(page, base, bak) {
  const verkeer = [], verzoeken = new WeakMap();
  let volgorde = 0;
  page.on('request', q => verzoeken.set(q, ++volgorde));
  poortVerkeer.set(page, verkeer);
  page.on('pageerror', (e) => {
    if (!isBrowserruis(e)) bak.crash.push('JS: ' + String(e.message || e).slice(0, 180));
  });
  page.on('response', (res) => {
    const werk = (async () => {
    const s = res.status();
    const pad = res.url().replace(base, '').slice(0, 80);
    let poort = null;
    if (s === 428 || pad === '/api/gegevens/start') {
      let aanvraag = {}; try { aanvraag = JSON.parse(res.request().postData() || '{}'); } catch (e) {}
      poort = { s, pad, volgorde: verzoeken.get(res.request()) || 0, methode: res.request().method(), soort: aanvraag.soort,
        data: res.text().then(t => { try { return JSON.parse(t); } catch (e) { return null; } }, () => null) };
      verkeer.push(poort);
    }
    if (s < 400) return;
    if (s === 401 || s === 403 || s === 404) return;   // een deur is geen defect; bewijs 6 gaat daarover
    // de zin eerst uit het HELE antwoord: afgekapt op 200 tekens is het geen JSON meer
    let vol = '';
    try { vol = await res.text(); } catch (e) { vol = ''; }
    const lijf = vol.slice(0, 200);
    if (s === 503 && (CONFIGZINNEN.test(lijf) || /"hoe"/.test(lijf))) bak.config.push(s + ' ' + pad + ' -- ' + lijf.slice(0, 120));
    /* De rem (429) reageert hier op de PROEF: alle browsers van deze meting
       delen een adres. Dat is een eigenschap van het instrument, geen defect. */
    else if (s === 429 && bak.rem) bak.rem.push(pad);
    /* Een weigering MET een zin (400/409/422/428 en {"error": "..."}) is pas een
       defect als de gebruiker niet te zien krijgt waarom. Of hij hem ziet, kijkt
       bedien() na de tik op het scherm na. */
    else if ([400, 409, 422, 428].includes(s) && bak.weigering && weigerZin(vol)) bak.weigering.push({ s, pad, zin: weigerZin(vol), ...(poort ? { poort } : {}) });
    else bak.serverfout.push(s + ' ' + pad + (lijf ? ' -- ' + lijf.slice(0, 100) : ''));
    })();
    if (bak.wachtend) bak.wachtend.push(werk);
  });
}

/* ---- schrijven ---- */
/* De bewijzen die deze browserronde ZELF meet, krijgen hun raakvlak hier, op
   het stempel van de ronde. Een samengesteld bewijs kreeg het al bij de bron;
   menselijk heeft dan twee helften, en beide moeten vers blijven. */
const EIGEN_BEWIJZEN = ['bereikbaar', 'bedienbaar', 'menselijk'];
function legRaakvlakken(regels, st) {
  const w = RAAKVLAKWERELD();
  const grof = require('./lib/stempel').versheid;
  for (const r of regels) {
    for (const naam of EIGEN_BEWIJZEN) {
      const b = r.bewijzen[naam];
      if (!b || b.status === 'GEEN_FIXTURE') continue;
      if ((r.samengesteld || []).includes(naam) && naam !== 'menselijk') continue;
      const v = raakvlakken.versheidVoor(w, { ingang: r.ingang, soort: 'browser' }, grof)(st);
      if (!v.raakvlak) continue;   // niet vers op de eigen commit: dan is er geen raakvlak om te bewaren
      b.raakvlak = ((r.samengesteld || []).includes(naam) ? (b.raakvlak || []) : []).concat([v.raakvlak]);
    }
  }
  return raakvlakken.hashes(w);
}

let laatsteHashes = null;
function bouw(meting) {
  const st = stempel();
  const hashes = laatsteHashes = legRaakvlakken(meting.regels, st);
  const telling = {};
  for (const r of meting.regels) telling[r.status] = (telling[r.status] || 0) + 1;
  const perBewijs = {};
  for (const r of meting.regels) {
    for (const [naam, b] of Object.entries(r.bewijzen)) {
      perBewijs[naam] = perBewijs[naam] || {};
      perBewijs[naam][b.status] = (perBewijs[naam][b.status] || 0) + 1;
    }
  }
  const defecten = meting.regels.filter((r) => r.status === 'GEBLOKKEERD_DOOR_DEFECT');
  return {
    uitleg: 'Doet de functie het? Per onderdeel uit MAPPEN, met de persona aan wie de wereld hem toont, gemeten in een echte browser met een echte sessie. Drie van de acht bewijzen uit BETROUWBAARHEID.md worden hier gemeten; de andere vijf staan er met de reden waarom ze nog niet te meten zijn.',
    hoe: 'node scripts/appwerkt.js  (--controle zakt als het aantal defecten groeit)',
    grens: 'Een BEWEZEN rij betekent: de ingang opent voor zijn persona en 100% van de unieke toepasselijke knopbediening is in de browser aangeraakt zonder fout. Risicovolle bediening wordt alleen op de lokale wegwerpserver geraakt; browserbevestigingen worden afgebroken en de volledige zakelijke uitkomst hoort bij de voltooi-, herstel- en financiële proeven. Het betekent dus niet op zichzelf dat de hele functie werkt. Een onaangeraakte, bedekte of onbereikbare knop houdt de rij NIET_GETEST of maakt haar defect.',
    standen: {
      BEWEZEN: 'gemeten en in orde',
      GEBLOKKEERD_DOOR_DEFECT: 'gemeten en stuk; hier moet code voor worden gerepareerd',
      GEBLOKKEERD_DOOR_CONFIG: 'de code klopt, de omgeving mist iets en de server zegt dat zelf',
      GEEN_FIXTURE: 'niet te meten zonder testwereld, met de reden erbij',
      NIET_GETEST: 'deze ronde niet aangeraakt, met de reden erbij'
    },
    stempel: st,
    /* Het raakvlak (scripts/lib/bewijsraakvlak.js, BETROUWBAARHEID.md par. 4i):
       de sha256 per bestand staat in APPWERKT-RAAKVLAK.json, met hetzelfde
       stempel, zodat dit register leesbaar blijft. Hier staat de verwijzing met
       de samengestelde hash over die hashes; elk bewijs draagt zijn eigen
       samengestelde hash in `raakvlak`. */
    raakvlak: raakvlakken.verwijzing(st, hashes),
    sessiesOvergeslagen: meting.sessiesOvergeslagen,
    /* DE MACHINE STAAT ERBIJ. Deze proef tikt met een tijdslimiet, en op een
       machine die drie keer meer werk heeft dan kernen loopt een gezonde tik
       daar overheen (18 oktober 2026: van 96 naar 89 BEWEZEN zonder dat de code
       het verschil maakte). Wie twee rondes vergelijkt, ziet zo of ze onder
       dezelfde last liepen. Een getal, geen correctie: de uitslag zelf wordt er
       niet op aangepast. */
    belasting: meting.belasting || null,
    gemeten: { onderdelen: meting.regels.length, defecten: defecten.length,
      knoppenGevonden: meting.regels.reduce((n, r) => n + (r.gevonden || 0), 0),
      knoppenAangetikt: meting.regels.reduce((n, r) => n + (r.geklikt || 0), 0),
      knoppenNietKlikbaar: meting.regels.reduce((n, r) => n + ((r.nietKlikbaar || []).length), 0),
      remGeraakt: meting.regels.reduce((n, r) => n + (r.rem || 0), 0),
      weigeringenGetoond: meting.regels.reduce((n, r) => n + ((r.gezegd || []).length), 0),
      taalWissels: meting.regels.flatMap((r) => (r.taalWissel || []).map((w) => r.app + ': "' + w.knop + '" -> ' + w.naar)),
      /* Welke elementen de meeste kliks opvingen, over alle schermen: een
         handvol dezelfde wijst naar een gedeelde laag (de schil, de Edge),
         een lange staart naar losse schermen. */
      onderscheppers: Object.fromEntries(Object.entries(meting.regels.reduce((t, r) => {
        for (const o of r.onderschept || []) t[o.door] = (t[o.door] || 0) + 1; return t; }, {}))
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
      /* Iedere openstaande knop houdt bewijs 2 open. De historische sleutel
         blijft voor registercompatibiliteit bestaan, maar draagt nu de
         strengere volledige-bedieningsbetekenis. */
      schermenGrotendeelsOngemeten: meting.regels.filter((r) => (r.gevonden || 0) > 0
        && (r.geklikt || 0) < (r.gevonden || 0)).length,
      deurenZonderPersona: meting.regels.filter((r) => r.bewijzen.bereikbaar
        && r.bewijzen.bereikbaar.status === 'NIET_GETEST'
        && /er staat een deur/.test(r.bewijzen.bereikbaar.reden || '')).length },
    telling,
    perBewijs,
    /* Welke bewijzen uit een ANDERE proef komen dan deze browserronde, en welke
       gesloten ketens (nog) voor geen enkele app tellen. Die tweede lijst staat
       er even groot bij: weglaten leest als "nog niet aan toegekomen". */
    samenstelling: {
      uitleg: 'Een bewijs mag uit een bestaande proef komen als scripts/lib/appcontract.js die bron noemt, de proef routes raakt die de ingang aanroept, en het register vers is (versheid() in scripts/lib/stempel.js). Een ketenproef levert alleen voltooibaar; de voltooiproef (VOLTOOIPROEF.json) levert voltooibaar, persistent en herstelbaar, per onderdeel met een eigen scenario; een ronde uit ALGEMEEN levert per rij alleen het bewijs waarvoor hij staat.',
      koppelingen: meting.regels.filter((r) => (r.samengesteld || []).length).map((r) => ({
        app: r.app, functie: r.functie,
        bewijzen: Object.fromEntries(r.samengesteld.map((n) => [n, { status: r.bewijzen[n].status,
          bron: r.bewijzen[n].bron ? r.bewijzen[n].bron.instrument : null,
          commit: r.bewijzen[n].bewijs ? r.bewijzen[n].bewijs.commit : null }]))
      })),
      contractZonderRij: Object.keys(CONTRACT).filter((f) => !meting.regels.some((r) => r.functie === f)),
      ketensZonderApp: ZONDER_APP
    },
    defecten: defecten.map((d) => ({ app: d.app, wereld: d.wereld, ingang: d.ingang,
      reden: Object.values(d.bewijzen).find((b) => b.status === 'GEBLOKKEERD_DOOR_DEFECT').reden })),
    deurenZonderPersona: meting.regels.filter((r) => r.bewijzen.bereikbaar
      && r.bewijzen.bereikbaar.status === 'NIET_GETEST'
      && /er staat een deur/.test(r.bewijzen.bereikbaar.reden || ''))
      .map((r) => ({ app: r.app, wereld: r.wereld, ingang: r.ingang, reden: r.bewijzen.bereikbaar.reden })),
    toezegklassen: toezegklassen.inventaris(),
    regels: meting.regels
  };
}

/* Alleen het inventarisblok vervangen: elk ander veld blijft zoals de laatste
   browsermeting het schreef, inclusief zijn stempel. De sleutelvolgorde blijft
   die van bouw(), zodat een volle meting daarna geen schijnverschil geeft. */
function metInventaris(oud, blok) {
  const uit = {};
  for (const [k, v] of Object.entries(oud)) {
    if (k === 'toezegklassen') continue;
    if (k === 'regels') uit.toezegklassen = blok;
    uit[k] = v;
  }
  if (!('toezegklassen' in uit)) uit.toezegklassen = blok;
  return uit;
}

/* Het oordeel over het blok, zonder browser. Rot en fouten laten zakken; een
   blok dat achterloopt op de documenten ook, met de weg om het bij te werken. */
function inventarisOordeel(opgeslagen, vers) {
  const bezwaren = [];
  for (const r of vers.rot) bezwaren.push('ROT: ' + r.document + ' -- "' + r.citaat.slice(0, 70) + '" (' + r.reden + ')');
  for (const f of vers.fouten) bezwaren.push('FOUT: ' + f);
  for (const it of vers.items) {
    if (!Object.prototype.hasOwnProperty.call(toezegklassen.KLASSEN, it.klasse)) bezwaren.push('KLASSE buiten de vier: ' + it.document + ':' + it.regel + ' ' + it.klasse);
    if (!it.citaat) bezwaren.push('ZONDER CITAAT: ' + it.document + ':' + it.regel);
  }
  if (!opgeslagen) bezwaren.push('APPWERKT.json draagt geen blok toezegklassen -- draai node scripts/appwerkt.js --inventaris');
  else if (JSON.stringify(opgeslagen) !== JSON.stringify(vers)) {
    bezwaren.push('het blok toezegklassen loopt achter op de documenten (vingerafdruk ' +
      (opgeslagen.bron && opgeslagen.bron.vingerafdruk) + ' tegen ' + vers.bron.vingerafdruk + ') -- draai node scripts/appwerkt.js --inventaris');
  }
  return bezwaren;
}

/* DE WACHT: dit script schrijft APPWERKT.json en start daarom niet bij het
   requiren (scripts/meetkeuring.js, regel `wacht`). Een laadcontrole -- node -e
   "require('./scripts/appwerkt')" -- mag geen browserronde starten en geen
   register overschrijven; dat is precies hoe ROLPROEF.json ooit van 3377 naar
   292 beproefde routes terugviel. */
/* SCHERMEIGENAAR.json pas lezen als er gemeten wordt: een laadcontrole hoort
   niets van schijf te halen. */
let schermregister = null;
function SCHERMREGISTER() {
  if (!schermregister) schermregister = JSON.parse(fs.readFileSync(path.join(WORTEL, 'SCHERMEIGENAAR.json'), 'utf8')).schermen;
  return schermregister;
}

/* onderschepper en weigerZin voor de toetsen van de meter; rijen, maakContext,
   bezoek en POORTEN voor de rondes die per rij van APPWERKT meten
   (scripts/liegronde.js, scripts/bevoegdronde.js). */
module.exports = { luister, beoordeelWeigeringen, onderschepper, klikReden, redenVoorSchoneTegenproef, herstelgrens, volledigeBediening, weigerZin, rijen, meetIngang, maakContext, openIngang, bezoek, bedien, bedektDoorSchil, POORTEN,
  metInventaris, inventarisOordeel };

if (require.main === module) (async () => {
  if (alleenInventaris) {
    const oud = JSON.parse(fs.readFileSync(DOEL, 'utf8'));
    const vers = toezegklassen.inventaris();
    if (controle) {
      const bezwaren = inventarisOordeel(oud.toezegklassen, vers);
      if (bezwaren.length) { for (const b of bezwaren) console.error('NIET OK: ' + b); process.exit(1); }
      console.log('OK: toezegklassen ' + JSON.stringify(vers.telling) + ' over ' + vers.bron.documenten + ' documenten, 0 rot.');
      process.exit(0);
    }
    const bezwaren = inventarisOordeel(null, vers).filter((b) => !b.startsWith('APPWERKT.json draagt'));
    if (magSchrijven(eisSchoneBoom('appwerkt'), DOEL)) fs.writeFileSync(DOEL, JSON.stringify(metInventaris(oud, vers), null, 1) + '\n');
    log('APPWERKT.json: blok toezegklassen gemeten ' + JSON.stringify(vers.telling) +
      ' (niet geteld: ' + vers.nietGeteld.prozaMarkeringen + ' in lopende tekst, ' + vers.nietGeteld.standOnbekend + ' andere standwaarden)');
    if (bezwaren.length) { for (const b of bezwaren) console.error('NIET OK: ' + b); process.exit(1); }
    process.exit(0);
  }
  /* Een gefilterde ronde vergelijken met het VOLLEDIGE register telt appels bij
     peren: minder rijen geeft altijd minder defecten, dus de ratel zou altijd
     groen zeggen. Dat is precies het soort stille geruststelling waar dit
     register tegen bedoeld is. */
  if (controle && filter) {
    console.error('NIET OK: --controle en --filter gaan niet samen. De ratel vergelijkt met het hele register, ' +
      'en een gefilterde ronde heeft per definitie minder rijen -- dan zegt hij altijd ten onrechte groen.');
    process.exit(2);
  }
  if (controle) {
    /* De controlestand meet opnieuw en vergelijkt met het register. De ratel:
       het aantal defecten mag alleen omlaag. Groeit het, dan is er een functie
       stukgegaan die het deed -- en dat hoort de bouw te laten zakken. */
    const oud = JSON.parse(fs.readFileSync(DOEL, 'utf8'));
    const nieuw = bouw(await meet());
    const was = oud.gemeten.defecten, is = nieuw.gemeten.defecten;
    if (is > was) {
      console.error('NIET OK: ' + is + ' defecten, het register kent er ' + was + '. Erbij:');
      const bekend = new Set(oud.defecten.map((d) => d.app + '|' + d.ingang));
      for (const d of nieuw.defecten) if (!bekend.has(d.app + '|' + d.ingang)) console.error('  - ' + d.app + ' (' + d.ingang + '): ' + d.reden);
      process.exit(1);
    }
    console.log('OK: ' + is + ' defecten (register: ' + was + ').');
    process.exit(0);
  }
  const uit = bouw(await meet());
  if (magSchrijven(eisSchoneBoom('appwerkt'), DOEL)) {
    fs.writeFileSync(DOEL, JSON.stringify(uit, null, 1) + '\n');
    fs.writeFileSync(raakvlakken.REGISTER_PAD, JSON.stringify(raakvlakken.register(uit.stempel, laatsteHashes), null, 1) + '\n');
  }
  log('\nAPPWERKT: ' + uit.gemeten.onderdelen + ' onderdelen, ' + uit.gemeten.defecten + ' defect');
  for (const d of uit.defecten) log('  ✗ ' + d.wereld + ' / ' + d.app + ': ' + d.reden);
  process.exit(0);
})();
