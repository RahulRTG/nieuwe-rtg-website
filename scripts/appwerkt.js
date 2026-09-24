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
   al bestaat -- een gesloten ketenproef bewijst `voltooibaar` voor de app
   waarvan hij de kernbelofte loopt. Welke bron dat mag, staat in
   scripts/lib/appcontract.js; of hij het op deze code verdient, beslist
   scripts/lib/bewijsbron.js (koppeling gemeten, register vers, keten dicht).
   Niemand schrijft hier PASS: een verouderd register maakt het NIET_GETEST.

   De andere vijf (voltooibaar, waarheidsgetrouw, persistent, bevoegd,
   herstelbaar) vragen verder een testwereld waarin betalen, versturen en verwijderen
   ECHT mogen -- met sandboxprovider, sink-mailbox en wegwerpdata. Die bestaat
   nog niet, en daarom staan ze hier als GEEN_FIXTURE met de reden. Ze staan er
   WEL, want een bewijs dat je weglaat ziet eruit als een bewijs dat je haalt.

   DE STANDEN ZIJN GESLOTEN, en "waarschijnlijk goed" zit er niet bij:

     BEWEZEN                  gemeten en in orde
     GEBLOKKEERD_DOOR_DEFECT  gemeten en stuk -- iemand moet code repareren
     GEBLOKKEERD_DOOR_CONFIG  de code klopt, de omgeving mist iets (de server
                              zegt dat zelf, met een `hoe` of een 503 die naar
                              een niet-ingelezen bron wijst)
     GEEN_FIXTURE             niet te meten zonder testwereld, met de reden
     NIET_GETEST              deze ronde niet aangeraakt, met de reden

   WAT DIT SCRIPT NIET ZIET, en dat staat er even groot bij: het vult geen
   formulieren in, het tikt niets aan met een onomkeerbare naam (betalen,
   verwijderen, versturen, uitloggen -- die staan per rij in `overgeslagen`), en
   het tikt alleen knoppen van de APP aan die bij het laden te raken waren
   (./lib/bedieningsmeting.js; de gedeelde schil krijgt een eigen rij,
   `schil`). Een groene rij betekent dus
   "de ingang opent en de bediening breekt niet", en nadrukkelijk niet "de
   functie werkt". Dat verschil is de hele reden dat de andere vijf bewijzen er
   met naam bij staan.

   EN EEN GROOT DEEL VAN WAT ER STAAT, IS NIET AAN TE TIKKEN. Op vluchten.html
   staan 23 zichtbare knoppen en zijn er 13 niet te bereiken: 8x ligt er iets
   overheen ("intercepts pointer events"), 4x is de knop niet zichtbaar op het
   moment van tikken, 1x staat hij buiten beeld. Wat daarvan een overlay is die
   een mens eerst wegtikt en wat een werkelijk onbereikbare knop, weet deze
   proef niet -- dus raakt hij minder dan de helft, dan heet de rij NIET_GETEST
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
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const reg = require('./lib/wereldregister');
const { haalSessies, opslagVoor } = require('./lib/proefsessies');
const { stempel } = require('./lib/stempel');
/* Bewijs SAMENSTELLEN uit proeven die al bestaan: het contract zegt welke bron
   een bewijs mag leveren, de bewijsbron of hij dat op deze code verdient. */
const { stelSamen } = require('./lib/bewijsbron');
const { CONTRACT, ZONDER_APP } = require('./lib/appcontract');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'APPWERKT.json');
const controle = process.argv.includes('--controle');
const stil = process.argv.includes('--stil');
const filter = (process.argv.find((a) => a.startsWith('--filter=')) || '').slice(9);
const PAR = Number((process.argv.find((a) => a.startsWith('--par=')) || '').slice(6) || 6);

/* Knoppen die iets doen wat je niet wilt uitlokken op een proefserver met een
   echte sessie. Ze worden NIET stil overgeslagen: elke rij noemt ze bij naam,
   zodat zichtbaar blijft welk deel van de bediening ongemeten is. Dit is de
   lijst die de testwereld uit BETROUWBAARHEID.md overbodig moet maken. */
const ONOMKEERBAAR = /uitlog|log uit|sign ?out|verwijder|delete|wis alles|betaal|afreken|bestel|verstuur|verzend|annuleer|opzegg|sluit account|export|download|nieuwe pin|noodslot/i;

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
const POORTEN = ['#poort.zien', 'html.rtf-toegang-dicht', '#rtf-toegang-slot',
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
        persona: PERSONA_VAN_WERELD[map.naam] || 'lid',
        ingang: url || ('(' + soort + ' in de app, geen eigen adres)'),
        soort,
        pad: url ? url.split('#')[0].split('?')[0] : null
      });
    }
  }
  return filter ? uit.filter((r) => (r.ingang || '').includes(filter) || r.app.toLowerCase().includes(filter.toLowerCase())) : uit;
}

/* ---- de vijf bewijzen die een testwereld nodig hebben ---- */
const GEEN_FIXTURE = (wat) => ({ status: 'GEEN_FIXTURE', reden: wat, bewijs: null });
const ONGEMETEN = {
  voltooibaar: () => GEEN_FIXTURE('vraagt een testwereld waarin de hele stroom mag worden afgemaakt (sandboxprovider, sink-mailbox, wegwerpdata); zie BETROUWBAARHEID.md par. 4'),
  waarheidsgetrouw: () => GEEN_FIXTURE('vraagt de liegpoort over alle schermen (RTG_LIEG); vandaag meet SCHERMLEUGEN.json er zes'),
  persistent: () => GEEN_FIXTURE('vraagt een tweede sessie en een herstart op dezelfde data'),
  bevoegd: () => GEEN_FIXTURE('vraagt de kruisproef met vreemde rollen, gezinnen en bedrijven; de routekant staat in IDOR.json en ROLPROEF.json, de schermkant niet'),
  herstelbaar: () => GEEN_FIXTURE('vraagt uitval van Redis/PostgreSQL, providertimeouts en een afgebroken verzoek midden in een mutatie')
};

/* ---- de meting ---- */
async function meet() {
  const { laadBrowser } = require(path.join(WORTEL, 'test', 'browser'));
  const pw = laadBrowser({ eigenDriver: false });
  if (!pw) { console.error('Geen browser beschikbaar; dit script meet in een echte browser.'); process.exit(2); }
  const { startServer } = require(path.join(WORTEL, 'test', 'helper.js'));
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appwerkt-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });

  const { sessies, overgeslagen } = await haalSessies(base);
  log('sessies: ' + Object.keys(sessies).join(', ') + (overgeslagen.length ? ' -- overgeslagen: ' + overgeslagen.map((o) => o.rol).join(', ') : ''));

  const lijst = rijen();
  log(lijst.length + ' onderdelen uit MAPPEN');
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
    while (true) {
      const i = n++; if (i >= lijst.length) break;
      const rij = lijst[i];
      uit.push(await meetRij(rij, base, persoonlijk, Object.keys(sessies)));
      if (uit.length % 10 === 0) log('  ' + uit.length + '/' + lijst.length);
    }
    for (const ctx of Object.values(persoonlijk)) await ctx.close();
  }
  await Promise.all(Array.from({ length: PAR }, werker));

  /* DE SCHIL, EEN KEER. De gedeelde bediening (Edge, sprong, Rahul, taal,
     randtoetsen) zit op vrijwel elk scherm, en hem per app meetellen is
     dezelfde fout 112 keer tellen. Hij krijgt hier een eigen bewijs, op de
     eerste ingang van een lid, met exact dezelfde procedure als een app. En
     elke rij draagt de uitslag als AFHANKELIJKHEID: een app waarvan de eigen
     bediening bewezen is terwijl de schil een gebrek heeft, leest nooit als
     "deze app werkt". */
  let schil = null;
  const schilRij = lijst.find((r) => r.pad && r.persona === 'lid' && sessies.lid);
  if (schilRij) {
    const ctx = await maakContext(browser, opslagVoor({ lid: sessies.lid }));
    const b = await bedien(ctx, base, schilRij.pad, 'schil');
    await ctx.close();
    const stuk = [...b.crash, ...b.serverfout];
    const o = stuk.length ? { status: 'GEBLOKKEERD_DOOR_DEFECT', reden: stuk[0] }
      : b.config.length ? { status: 'GEBLOKKEERD_DOOR_CONFIG', reden: b.config[0] }
        : oordeel(b.plan, b.uitslag);
    schil = { onderdeel: 'RTG-schil', gemetenOp: schilRij.pad, persona: 'lid',
      bedienbaar: { status: o.status, reden: o.reden }, trechter: b.trechter, nietKlikbaar: b.nietKlikbaar };
  } else {
    schil = { onderdeel: 'RTG-schil', bedienbaar: { status: 'NIET_GETEST', reden: 'geen ingang van een lid met een sessie om de schil op te meten' } };
  }
  for (const r of uit) r.afhankelijk = { 'RTG-schil': { bewijs: 'bedienbaar', status: schil.bedienbaar.status } };
  await browser.close();
  try { child.kill(); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  uit.sort((a, b) => (a.wereld + a.app).localeCompare(b.wereld + b.app));
  return { regels: uit, schil, sessiesOvergeslagen: overgeslagen };
}

async function maakContext(browser, opslag) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  /* De intake is niet wat hier gemeten wordt: een vers lid staat voor de
     ledenovereenkomst, en die tekent een mens een keer in zijn leven. Zelfde
     ingreep als in scripts/tikken.js en de schermtoetsen. */
  await ctx.route('**/api/onboarding/status', (r) => r.fulfill({ status: 200,
    contentType: 'application/json', body: JSON.stringify({ klaar: true }) }));
  await ctx.addInitScript((o) => { try { for (const k of Object.keys(o)) localStorage.setItem(k, o[k]); } catch (e) {} }, opslag);
  return ctx;
}

async function meetRij(rij, base, persoonlijk, rollen) {
  const r = { ...rij, bewijzen: {}, gevonden: 0, geklikt: 0, overgeslagen: [], nietKlikbaar: [], waarnemingen: [] };
  delete r.soort; delete r.pad;

  /* tab: en os: hebben geen eigen adres -- ze zijn een stand of een kiezer
     binnen de app. Meten kan dus niet vanaf een URL, en dat is geen defect. */
  if (!rij.pad) {
    const reden = rij.soort === 'tab'
      ? 'een stand binnen de ledenapp, geen eigen adres: alleen te meten door de app te bedienen'
      : 'een kiezer in de app: het adres ontstaat pas na een keuze';
    for (const b of ['bereikbaar', 'bedienbaar', 'menselijk']) r.bewijzen[b] = { status: 'NIET_GETEST', reden, bewijs: null };
    vulOngemeten(r);
    return r;
  }

  const bestand = path.join(WORTEL, 'public', rij.pad.replace(/^\//, ''));
  if (!fs.existsSync(bestand)) {
    r.bewijzen.bereikbaar = { status: 'GEBLOKKEERD_DOOR_DEFECT',
      reden: 'de wereld wijst naar ' + rij.pad + ' en dat bestand bestaat niet', bewijs: null };
    for (const b of ['bedienbaar', 'menselijk']) r.bewijzen[b] = { status: 'NIET_GETEST', reden: 'er is geen scherm om te bedienen', bewijs: null };
    vulOngemeten(r);
    return r;
  }

  // ---- bewijs 1: bereikbaar voor de persona van deze wereld ----
  const eigen = persoonlijk[rij.persona];
  if (!eigen) {
    r.bewijzen.bereikbaar = { status: 'NIET_GETEST',
      reden: 'inloggen als ' + rij.persona + ' lukte niet; niet gemeten mag nooit als in orde langskomen', bewijs: null };
    for (const b of ['bedienbaar', 'menselijk']) r.bewijzen[b] = { status: 'NIET_GETEST', reden: 'geen sessie voor deze persona', bewijs: null };
    vulOngemeten(r);
    return r;
  }
  const eersteBezoek = await bezoek(eigen, base, rij.pad);
  r.waarnemingen.push('als ' + rij.persona + ': ' + eersteBezoek.samenvatting);

  if (eersteBezoek.poort) {
    /* De deur staat dicht. Kan een ANDER er wel door? Dan is het scherm niet
       stuk maar staat de ingang in de verkeerde wereld -- precies het defect
       dat LivingOS met "Vrienden" had. Dat onderscheid staat in de reden. */
    let opener = null;
    for (const rol of rollen) {
      if (rol === rij.persona) continue;
      const proef = await bezoek(persoonlijk[rol], base, rij.pad);
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
        bewijs: rij.pad }
      : { status: 'NIET_GETEST',
        reden: 'er staat een deur die geen van de vier bekende sessies (lid, zaak, kantoor, gezin) opent; welke rol er wel doorheen komt, weet deze proef niet: ' + eersteBezoek.poortTekst,
        bewijs: rij.pad };
    for (const b of ['bedienbaar', 'menselijk']) r.bewijzen[b] = { status: 'NIET_GETEST', reden: 'achter een dichte deur valt de bediening niet te meten', bewijs: null };
    vulOngemeten(r);
    return r;
  }
  if (eersteBezoek.crash.length) {
    r.bewijzen.bereikbaar = { status: 'GEBLOKKEERD_DOOR_DEFECT',
      reden: 'het scherm gooit bij het laden: ' + eersteBezoek.crash[0], bewijs: rij.pad };
  } else if (eersteBezoek.config.length) {
    r.bewijzen.bereikbaar = { status: 'GEBLOKKEERD_DOOR_CONFIG',
      reden: 'de server zegt zelf dat er iets in de omgeving ontbreekt: ' + eersteBezoek.config[0], bewijs: rij.pad };
  } else {
    r.bewijzen.bereikbaar = { status: 'BEWEZEN',
      reden: 'opent voor een ' + rij.persona + ' zonder poort en zonder fout', bewijs: rij.pad };
  }

  // ---- bewijs 2 en 8: bedienbaar en menselijk ----
  const bediening = await bedien(eigen, base, rij.pad, 'app');
  r.gevonden = bediening.gevonden;
  r.geklikt = bediening.geklikt;
  r.overgeslagen = bediening.overgeslagen;
  r.nietKlikbaar = bediening.nietKlikbaar;
  /* Waarneming naast het oordeel, en bewust niet in het oordeel: zie bedien(). */
  r.trechter = bediening.trechter;
  if (bediening.instrument.length) r.waarnemingen.push('proef: ' + bediening.instrument.join('; '));
  const stuk = [...bediening.crash, ...bediening.serverfout];
  /* Geteld en niet weggelaten: een weigering met reden is geen defect, maar
     wie een scherm verdenkt dat de reden inslikt, ziet hier hoe vaak. */
  const bijzin = ((bediening.weigering || []).length ? '; ' + bediening.weigering.length + 'x geweigerd met een reden (' + bediening.weigering[0] + ')' : '')
    + (bediening.nietKlikbaar.length ? '; niet aan te tikken: ' + bediening.nietKlikbaar.slice(0, 3).join(', ') : '');
  if (stuk.length) {
    r.bewijzen.bedienbaar = { status: 'GEBLOKKEERD_DOOR_DEFECT', reden: stuk[0], bewijs: bediening.crash.concat(bediening.serverfout).slice(0, 5).join(' | ') };
  } else if (bediening.config.length) {
    r.bewijzen.bedienbaar = { status: 'GEBLOKKEERD_DOOR_CONFIG', reden: bediening.config[0], bewijs: null };
  } else {
    /* Het oordeel over de EIGEN bediening van de app, uit de bevroren noemer
       (./lib/bedieningsmeting.js). De gedeelde schil staat er apart naast als
       afhankelijkheid (`afhankelijk`), en wordt hier nooit bij opgeteld. */
    const o = oordeel(bediening.plan, bediening.uitslag);
    r.bewijzen.bedienbaar = { status: o.status, reden: o.reden + bijzin, bewijs: null };
  }
  /* Bewijs 8 wordt AFGELEID en niet apart gemeten, en dat staat er zo bij: een
     kale TypeError of 500 is nooit menselijk, en verder kan deze proef niet
     beoordelen of een foutmelding bruikbaar was. */
  r.bewijzen.menselijk = stuk.length || eersteBezoek.crash.length
    ? { status: 'GEBLOKKEERD_DOOR_DEFECT', reden: 'een kale JS-fout of 500 bereikt de gebruiker: ' + (eersteBezoek.crash[0] || stuk[0]), bewijs: null }
    : { status: 'NIET_GETEST', reden: 'afgeleid: geen kale fout gezien. Of een foutMELDING bruikbaar is, beoordeelt deze proef niet -- dat vraagt de storingen uit bewijs 7', bewijs: null };

  vulOngemeten(r);
  return r;
}

function vulOngemeten(r) {
  for (const [naam, maak] of Object.entries(ONGEMETEN)) r.bewijzen[naam] = maak();
  /* Pas NA de standaard: een contract kan een GEEN_FIXTURE alleen vervangen
     door wat een bron verdiend heeft. Niet genoemd = blijft staan. */
  r.samengesteld = stelSamen(r);
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
async function bezoek(ctx, base, pad) {
  const page = await ctx.newPage();
  const crash = [], config = [], serverfout = [];
  luister(page, base, { crash, config, serverfout });
  let eind = '', poort = false, poortTekst = '', tekst = 0;
  try {
    await page.goto(base + pad, { waitUntil: 'domcontentloaded', timeout: 20000 });
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
  return { crash, config, serverfout, poort, poortTekst, eind, tekst,
    samenvatting: poort ? 'poort dicht' : (crash.length ? 'gooit' : tekst + ' tekens zichtbaar') };
}

/* ---- de inventaris: wat er bij het laden staat, voor er getikt wordt ----

   Per knop-achtig element: zijn handtekening (merk), zijn HERKOMST (de
   topcontainer onder <body> -- schil of app, zie ./lib/bedieningsmeting.js),
   of hij zichtbaar is, of hij in beeld staat zonder scrollen, en op hoeveel van
   vijf punten hij na scrollen te raken is (elementFromPoint geeft de knop zelf
   of iets erin). Een punt is genoeg om mee te tellen: een knop waarvan alleen
   het midden onder een laag ligt, is voor een mens vaak gewoon bedienbaar.

   Dit gebeurt EEN keer, direct na het laden. Wat de proef daarna zelf openlegt
   -- een zoekpaneel, een la -- komt niet in de noemer: de meter mag zijn eigen
   examen niet zwaarder maken terwijl hij het afneemt. */
async function inventaris(page) {
  return page.evaluate(() => {
    const zie = (el) => { if (!el || el.hidden || el.disabled) return false;
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false;
      const b = el.getBoundingClientRect(); return b.width > 1 && b.height > 1; };
    const merk = (el) => [el.tagName, el.id || '', (el.getAttribute('aria-label') || '').slice(0, 30),
      (el.innerText || el.title || '').trim().slice(0, 40)].join('|');
    const herkomst = (el) => { let a = el; while (a && a.parentElement && a.parentElement !== document.body) a = a.parentElement;
      if (!a || a === document.body) return '(body)';
      const kl = (typeof a.className === 'string' && a.className.trim()) ? '.' + a.className.trim().split(/\s+/)[0] : '';
      return a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') + kl; };
    const vw = innerWidth, vh = innerHeight, sx = scrollX, sy = scrollY;
    const punten = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
    const uit = [];
    for (const el of document.querySelectorAll('button,[role=button],[data-tab],[data-stand]')) {
      if (el.getAttribute('href') || el.getAttribute('data-url')) continue;
      const k = { merk: merk(el), herkomst: herkomst(el), zichtbaar: zie(el), inBeeld: false, raakpunten: 0,
        tekst: (el.innerText || el.getAttribute('aria-label') || el.title || '').trim().slice(0, 40) };
      if (k.zichtbaar) {
        let b = el.getBoundingClientRect();
        k.inBeeld = b.bottom > 0 && b.right > 0 && b.top < vh && b.left < vw;
        try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (e) {}
        b = el.getBoundingClientRect();
        for (const [fx, fy] of punten) {
          const x = b.left + b.width * fx, y = b.top + b.height * fy;
          if (x < 0 || y < 0 || x >= vw || y >= vh) continue;
          const hit = document.elementFromPoint(x, y);
          if (hit && (hit === el || el.contains(hit))) k.raakpunten++;
        }
      }
      uit.push(k);
    }
    scrollTo(sx, sy);
    return uit;
  });
}

/* De stadia per kant, uit de inventaris: DOM aanwezig -> zichtbaar -> in beeld
   -> te raken. Waarneming naast het oordeel. */
function stadiaVan(inv) {
  const t = { app: { dom: 0, zichtbaar: 0, inBeeld: 0, raakbaar: 0 }, schil: { dom: 0, zichtbaar: 0, inBeeld: 0, raakbaar: 0 } };
  for (const k of inv) {
    const s = t[isSchil(k.herkomst) ? 'schil' : 'app'];
    s.dom++; if (k.zichtbaar) s.zichtbaar++; if (k.inBeeld) s.inBeeld++; if (k.raakpunten > 0) s.raakbaar++;
  }
  return t;
}

/* ---- de bediening: tikken op de bevroren noemer ----

   `kant` is 'app' of 'schil'. De proef tikt ALLEEN knoppen uit de noemer van die
   kant, elk hooguit een keer, tot het budget op is.

   DE THUISREGEL. Voor elke tik staat de proef op de pagina waar hij na het laden
   UITKWAM (de landing, na eventuele doorverwijzing -- niet het adres uit MAPPEN).
   Staat hij ergens anders, dan gaat hij terug en wacht hij op dezelfde
   gereedvoorwaarde als bij het eerste laden. Tot 24 september 2026 zag de proef
   na een navigerende tik een lege, halfgeladen andere pagina, en besloot hij dat
   er "geen nieuwe knop" was: 50 van de 97 schermen stopten zo te vroeg. */
async function bedien(ctx, base, pad, kant = 'app') {
  const page = await ctx.newPage();
  const crash = [], config = [], serverfout = [], weigering = [];
  const overgeslagen = [], nietKlikbaar = [], instrument = [];
  const u = { geprobeerd: 0, gelukt: 0, effect: 0, nietMeerGevonden: 0, overgeslagen: 0, teruggekeerd: 0 };
  let inv = [], p = null, thuis = null;
  const laad = async (url) => { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }); await page.waitForTimeout(2200); };
  const vingerafdruk = () => page.evaluate(() => location.href + '|' + document.querySelectorAll('*').length + '|' + (document.body ? document.body.innerText.length : 0)).catch(() => null);
  try {
    await laad(base + pad);
    luister(page, base, { crash, config, serverfout, weigering });   // pas NA het laden: laadfouten horen bij bewijs 1
    thuis = page.url();
    inv = await inventaris(page);
    for (const k of inv) k.onomkeerbaar = ONOMKEERBAAR.test(k.tekst || '');
    p = plan(inv);          // gooit MeterConfigFout als de drempel het budget niet kan halen
    const doel = p[kant];
    for (const m of doel.noemer.slice(0, doel.budget)) {
      let hier = null;
      try { hier = await page.evaluate(() => location.href); } catch (e) { hier = null; }
      if (hier !== thuis) {
        try { await laad(thuis); u.teruggekeerd++; }
        catch (e) { instrument.push('terugkeren naar de landing lukte niet: ' + String(e.message || e).split('\n')[0].slice(0, 80)); break; }
      }
      let staat = false;
      try {
        staat = await page.evaluate((zoek) => {
          const merk = (el) => [el.tagName, el.id || '', (el.getAttribute('aria-label') || '').slice(0, 30),
            (el.innerText || el.title || '').trim().slice(0, 40)].join('|');
          document.querySelectorAll('[data-appwerkt]').forEach((el) => el.removeAttribute('data-appwerkt'));
          for (const el of document.querySelectorAll('button,[role=button],[data-tab],[data-stand]')) {
            if (merk(el) === zoek) { el.setAttribute('data-appwerkt', '1'); return true; }
          }
          return false;
        }, m);
      } catch (e) { staat = false; }
      if (!staat) { u.nietMeerGevonden++; continue; }
      u.geprobeerd++;
      const voor = await vingerafdruk();
      try {
        await page.click('[data-appwerkt="1"]', { timeout: 2500, noWaitAfter: true });
        await page.waitForTimeout(600);
        u.gelukt++;
        const na = await vingerafdruk();
        if (voor && na && voor !== na) u.effect++;
      } catch (e) {
        /* De reden van een time-out staat in de LOG van Playwright, niet in de
           boodschap; zonder die reden is "niet aan te tikken" een dood getal. */
        const log = String(e.message || e);
        const waarom = (log.match(/intercepts pointer events|element is not visible|element is not stable|element is not enabled|element is outside of the viewport/i) || ['reden niet gemeld'])[0];
        nietKlikbaar.push(m.split('|').slice(2).join(' ').trim().slice(0, 40) + ': ' + waarom);
      }
    }
  } catch (e) {
    if (e && e.name === 'MeterConfigFout') { await page.close(); throw e; }
    instrument.push('bediening mislukt: ' + String(e.message || e).split('\n')[0].slice(0, 140));
  }
  await page.close();
  if (p) for (const k of inv) if (k.onomkeerbaar && k.raakpunten > 0 && (isSchil(k.herkomst) ? 'schil' : 'app') === kant) overgeslagen.push(k.tekst || '(naamloos)');
  u.overgeslagen = overgeslagen.length;
  const doel = p ? p[kant] : { noemer: [], drempel: 0, budget: 0 };
  const trechter = { kant, landing: thuis ? thuis.replace(base, '') : null, stadia: stadiaVan(inv),
    noemer: doel.noemer.length, drempel: doel.drempel, budget: doel.budget, ...u,
    nietRaakbaar: p ? p.nietRaakbaar[kant] : null, onomkeerbaar: p ? p.onomkeerbaar[kant] : null };
  return { plan: doel, uitslag: u, trechter, gevonden: doel.noemer.length, geklikt: u.gelukt,
    overgeslagen, nietKlikbaar, instrument, crash, config, serverfout, weigering };
}

/* De indeling van een foutantwoord woont in ./lib/foutindeling.js: een deur,
   de omgeving (een 503 die zichzelf uitlegt), een WEIGERING met een reden in
   gewone taal, of stuk. Daar staat ook waarom de weigering geen defect is, en
   wat die indeling niet kan zien. */
const { deelFoutIn } = require('./lib/foutindeling');
const { plan, oordeel, isSchil } = require('./lib/bedieningsmeting');

function luister(page, base, bak) {
  page.on('pageerror', (e) => bak.crash.push('JS: ' + String(e.message || e).slice(0, 180)));
  page.on('response', async (res) => {
    const s = res.status();
    if (s < 400) return;
    const pad = res.url().replace(base, '').slice(0, 80);
    if (s === 401 || s === 403 || s === 404) return;   // een deur is geen defect; bewijs 6 gaat daarover
    let lijf = '';
    try { lijf = (await res.text()).slice(0, 400); } catch (e) { lijf = ''; }
    const soort = deelFoutIn(s, lijf);
    if (soort === 'config') bak.config.push(s + ' ' + pad + ' -- ' + lijf.slice(0, 120));
    else if (soort === 'weigering') { if (bak.weigering) bak.weigering.push(s + ' ' + pad + ' -- ' + lijf.slice(0, 100)); }
    else bak.serverfout.push(s + ' ' + pad + (lijf ? ' -- ' + lijf.slice(0, 100) : ''));
  });
}

/* ---- schrijven ---- */
function bouw(meting) {
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
    uitleg: 'Doet de functie het? Per onderdeel uit MAPPEN, met de persona aan wie de wereld hem toont, gemeten in een echte browser met een echte sessie. Drie van de acht bewijzen uit BETROUWBAARHEID.md worden hier gemeten; een ander bewijs komt alleen uit een bestaande proef als het app-contract die bron noemt en het register vers is (zie `samenstelling`). Wat geen bron heeft staat er met de reden waarom het nog niet te meten is.',
    hoe: 'node scripts/appwerkt.js  (--controle zakt als het aantal defecten groeit)',
    grens: 'Een BEWEZEN rij betekent: de ingang opent voor zijn persona en de bediening breekt niet. Het betekent NIET dat de functie werkt -- daarvoor zijn de vijf bewijzen nodig die hier GEEN_FIXTURE zijn. Er worden geen formulieren ingevuld en geen onomkeerbare knoppen aangetikt; die staan per rij in `overgeslagen`. ' +
      'BEDIENBAAR gaat over de EIGEN bediening van de app: de noemer zijn de app-knoppen die bij het laden te raken zijn (minstens een van vijf hitpunten), bevroren voor er getikt wordt; de gedeelde schil staat apart in `schil` en elke rij noemt hem onder `afhankelijk`. Haalt de proef minder dan de helft van die noemer, dan is de rij NIET_GETEST -- dat is onvoldoende interactiedekking van de meter en geen productfalen. Een drempel die het budget niet kan halen, laat de meting als geheel falen (MeterConfigFout) in plaats van een rij.',
    standen: {
      BEWEZEN: 'gemeten en in orde',
      GEBLOKKEERD_DOOR_DEFECT: 'gemeten en stuk; hier moet code voor worden gerepareerd',
      GEBLOKKEERD_DOOR_CONFIG: 'de code klopt, de omgeving mist iets en de server zegt dat zelf',
      GEEN_FIXTURE: 'niet te meten zonder testwereld, met de reden erbij',
      NIET_GETEST: 'deze ronde niet aangeraakt, met de reden erbij'
    },
    stempel: stempel(),
    sessiesOvergeslagen: meting.sessiesOvergeslagen,
    gemeten: { onderdelen: meting.regels.length, defecten: defecten.length,
      knoppenGevonden: meting.regels.reduce((n, r) => n + (r.gevonden || 0), 0),
      knoppenAangetikt: meting.regels.reduce((n, r) => n + (r.geklikt || 0), 0),
      knoppenNietKlikbaar: meting.regels.reduce((n, r) => n + ((r.nietKlikbaar || []).length), 0),
      /* De eerlijkste maat voor hoe dun bewijs 2 is: op hoeveel schermen bleef
         meer dan de helft van wat er stond onaangeraakt? */
      schermenGrotendeelsOngemeten: meting.regels.filter((r) => (r.gevonden || 0) > 0
        && (r.geklikt || 0) * 2 < (r.gevonden || 0)).length,
      deurenZonderPersona: meting.regels.filter((r) => r.bewijzen.bereikbaar
        && r.bewijzen.bereikbaar.status === 'NIET_GETEST'
        && /er staat een deur/.test(r.bewijzen.bereikbaar.reden || '')).length },
    telling,
    perBewijs,
    /* De gedeelde schil als eigen onderdeel, niet in `regels` en niet in de
       telling: hij is geen onderdeel uit MAPPEN. Elke rij noemt hem onder
       `afhankelijk`. */
    schil: meting.schil || null,
    /* Welke bewijzen uit een ANDERE proef komen dan deze browserronde, en welke
       gesloten ketens (nog) voor geen enkele app tellen. Die tweede lijst staat
       er even groot bij: weglaten leest als "nog niet aan toegekomen". */
    samenstelling: {
      uitleg: 'Een bewijs mag uit een bestaande proef komen als scripts/lib/appcontract.js die bron noemt, de proef routes raakt die de ingang aanroept, en het register vers is (versheid() in scripts/lib/stempel.js). Een ketenproef levert alleen voltooibaar.',
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
    regels: meting.regels
  };
}

/* Voor test/appwerkt-meter.e2e.js: de bediening los aan te roepen op een
   synthetisch scherm, zonder server en zonder register. */
module.exports = { bedien, inventaris };

/* DE WACHT: dit script schrijft APPWERKT.json en start daarom niet bij het
   requiren (scripts/meetkeuring.js, regel `wacht`). Een laadcontrole -- node -e
   "require('./scripts/appwerkt')" -- mag geen browserronde starten en geen
   register overschrijven; dat is precies hoe ROLPROEF.json ooit van 3377 naar
   292 beproefde routes terugviel. */
if (require.main === module) (async () => {
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
  let meting;
  try { meting = await meet(); }
  catch (e) {
    /* Een MeterConfigFout is een fout van de METER: de drempel kan het budget
       niet halen. Dan schrijven we niets -- een register vol NIET_GETEST zou
       een intern probleem als uitspraak over de apps vermommen. */
    if (e && e.name === 'MeterConfigFout') { console.error('METERFOUT: ' + e.message); process.exit(3); }
    throw e;
  }
  const uit = bouw(meting);
  fs.writeFileSync(DOEL, JSON.stringify(uit, null, 1) + '\n');
  log('\nAPPWERKT.json geschreven: ' + uit.gemeten.onderdelen + ' onderdelen, ' + uit.gemeten.defecten + ' defect');
  for (const d of uit.defecten) log('  ✗ ' + d.wereld + ' / ' + d.app + ': ' + d.reden);
  process.exit(0);
})();
