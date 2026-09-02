#!/usr/bin/env node
/* DE ISOLATIEPROEF -- de veiligheidsboekhouding van de beschermstand.

   WAAROM DIT GEEN PERCENTAGE IS. De verleiding is een zin als "de beschermstand
   verkleint het aanvalsoppervlak met 93%". Dat getal is fictie zodra de teller
   en de noemer uit verschillende inventarissen komen -- exact de fout die
   MUTATIEINVENTARIS.json moest repareren, waar vier getallen rondliepen die
   alle vier "het aantal routes" heetten. Deze proef telt daarom PER NOEMER, en
   zet er nooit een samengesteld cijfer boven.

   WAAROM ER VIJF UITSLAGEN ZIJN EN GEEN TWEE. `veilig` tegenover `onveilig`
   dwingt een meter om te raden. De vijf hier laten hem eerlijk zwijgen:

     BEWEZEN_GEBLOKKEERD  de code houdt dit aantoonbaar tegen, hier gemeten
     BEWEZEN_TOEGESTAAN   het loopt aantoonbaar door, en dat is een keuze
     ONBESLIST            niemand heeft dit ingedeeld
     NIET_TOEPASSELIJK    de vraag slaat hier niet op
     ONBEPAALD_INFRA      de applicatie kan dit niet bewijzen; het hangt aan
                          de uitrol (egress, namespaces, netwerkbeleid)

   DIE LAATSTE IS DE BELANGRIJKSTE. Een applicatietoets die vaststelt dat een
   parser geen HTTP-client importeert, heeft NIET bewezen dat die parser geen
   internet heeft -- alleen dat de code er niet om vraagt. Het verschil tussen
   die twee zinnen is het verschil tussen een veiligheidsclaim en een
   veiligheidsgevoel. Zolang er geen uitrolbewijs is, staat er ONBEPAALD_INFRA
   met de reden erbij, en nooit een nul die groen leest.

   WAT DEZE PROEF MET OPZET NIET DOET: hij meet de HUIDIGE beschermstand, die
   huis-breed is. Er is nog geen drager-model (identiteit, sessie, apparaat,
   organisatie), dus er valt niets per lid te meten. Dat staat hieronder als
   schuld en niet als nul.

   Draaien: npm run isolatieproef  -> schrijft ISOLATIEPROEF.json */
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const functies = require(path.join(root, 'server/functies'));
const { maakBeschermstand, BEVRIEST, LOOPT_DOOR, UITZONDERINGEN } =
  require(path.join(root, 'server/kern/beschermstand'));
const beleid = require(path.join(root, 'server/kern/stuur/beleid'));
const maakIsolatie = require(path.join(root, 'server/kern/isolatie'));
const effectmodel = require(path.join(root, 'server/kern/isolatie/effecten'));
const effectcollecties = require(path.join(root, 'server/kern/isolatie/effectcollecties'));
const effectregister = require(path.join(root, 'server/kern/isolatie/effectregister'));
const proefmeting = require(path.join(root, 'server/kern/isolatie/proefmeting'));
const dragerlijst = require(path.join(root, 'server/kern/isolatie/dragers'));
const leesset = require(path.join(root, 'server/kern/isolatie/leesset'));
const { maakIsolatiefilter } = require(path.join(root, 'server/kern/stuur/isolatiefilter'));
const { maakBruikbaarheid } = require(path.join(root, 'server/kern/isolatie/bruikbaarheid'));
const herkomstlaag = require(path.join(root, 'server/kern/isolatie/herkomst'));

function lees(bestand) {
  try { return JSON.parse(fs.readFileSync(path.join(root, bestand), 'utf8')); }
  catch (e) { return null; }
}

const kaart = lees('EXECUTION_MAP.json');
if (!kaart || !Array.isArray(kaart.capabilities) || !kaart.capabilities.length) {
  console.error('ISOLATIEPROEF: EXECUTION_MAP.json ontbreekt of is leeg. Draai eerst `npm run executionmap`.');
  console.error('Een lege kaart zou hier een mooie 100% opleveren, en dat is precies waarom deze proef stopt.');
  process.exit(2);
}

const beschermstand = maakBeschermstand({ functies });
const noemers = {};

/* ---------- 1. HTTP-paden onder de beschermstand ---------- */
{
  const paden = [...new Set(kaart.capabilities.map(r => r.pad))].sort();
  const zonderFunctie = paden.filter(p => !functies.functieVoorPad(p));
  const tegengehouden = paden.filter(p => beschermstand.houdtTegen(p, 'POST'));

  /* GEEN FUNCTIE IS NIET HETZELFDE ALS NIEMAND HEEFT DIT INGEDEELD.

     Hier stond `ONBESLIST: zonderFunctie.length`, en dat las 81 paden als 81
     onbesliste gevallen. Voor 75 ervan bestaat de indeling al -- in
     server/kern/bestuursroutes.js, het register van paden die BEWUST nooit
     achter een functieschakelaar staan, met per prefix de reden. Die paden
     lopen aantoonbaar door EN dat is een keuze, en dat is per de definitie
     bovenaan dit bestand `BEWEZEN_TOEGESTAAN` en niet `ONBESLIST`.

     Het verschil is niet cosmetisch: zolang beide in een getal zaten, meldde
     dit register 81 ONBESLIST terwijl zijn eigen werklijst 0 zei, en zei
     scripts/schakelbaar.js over dezelfde vraag 7. Twee meters, twee antwoorden.
     ONBESLIST is nu wat het woord zegt: geen functie EN geen grond. */
  const { redenVoor: bestuursgrond } = require(path.join(root, 'server/kern/bestuursroutes'));
  const openpadenLijst = require(path.join(root, 'server/kern/isolatie/openpaden'));
  const heeftGrond = p => !!(bestuursgrond(p) || openpadenLijst.EIGEN_UITGANG[p] ||
    openpadenLijst.RECHT_VAN_DE_MENS[p] || openpadenLijst.BEWUST_DICHT[p]);
  const onbeslist = zonderFunctie.filter(p => !heeftGrond(p));

  noemers.httpPaden = {
    wat: 'unieke API-paden uit de executiekaart, gehouden tegen kern/beschermstand.js met methode POST',
    bron: ['EXECUTION_MAP.json', 'server/kern/beschermstand.js', 'server/functies',
      'server/kern/bestuursroutes.js'],
    gevonden: paden.length,
    BEWEZEN_GEBLOKKEERD: tegengehouden.length,
    BEWEZEN_TOEGESTAAN: paden.length - tegengehouden.length - onbeslist.length,
    ONBESLIST: onbeslist.length,
    ONBEPAALD_INFRA: 0,
    /* DE NOEMER IS AANTOONBAAR ONVOLLEDIG, EN DAT STAAT ERBIJ IN PLAATS VAN DAT
       4655 als "alle paden" leest. Twee gaten, allebei nagemeten:
       - EXECUTION_MAP.json is een bouwartefact en kan een commit achterlopen op
         nieuwe routes (npm run executionmap haalt hem bij);
       - de scanner van scripts/schakelbaar.js mist routes die met een BEREKENDE
         prefix worden gemonteerd (server/routes/papieren-deur.js), want hij
         zoekt letterlijke strings.
       Een derde scanner erbij bouwen mag niet: keuringsregel 56 verbiedt een
       nieuwe eigen routelijst, en schakelbaar.js staat daar al als uitzondering. */
    noemerachterstand: {
      wat: 'twee bekende gaten in de inventaris; 4655 is niet "alle paden"',
      kaartLooptAchter: 'EXECUTION_MAP.json wordt gegenereerd en draagt alleen wat er bij de laatste ' +
        'draai stond',
      berekendePrefix: 'routes die met een berekende prefix worden gemonteerd (routes/papieren-deur.js) ' +
        'ziet de statische scanner niet'
    },
    /* DE BLINDE VLEK, en die hoort bovenaan en niet in een voetnoot.
       houdtTegen() geeft `null` zodra er geen functie achter een pad hangt: er
       valt dan niets in te delen, en tegenhouden op grond van niets is raden.
       Dat is een verdedigbare keuze, maar het betekent wel dat deze paden de
       beschermstand ONGEMERKT passeren. */
    /* DE BLINDE VLEK, UIT ELKAAR GETROKKEN. Een getal van 81 leest als 81
       problemen, en dat is het niet: 68 zijn de eigen console van de eigenaar
       (eigenaar-only en bewust buiten de functieschakelaars, zie
       server/routes/techniek/controle.js) en 6 zijn de UITGANG van deze laag
       zelf, die met opzet niet dichtvalt (kern/isolatie/leesset.js EIGEN_UITGANG).
       Wie die twee meetelt in de werklijst, gaat werk zoeken dat er niet is --
       en wie ze weglaat, verzwijgt dat de beschermstand geen grip heeft op de
       console van de eigenaar. Dus staan ze er alle drie, apart. */
    blindeVlek: (() => {
      const openpaden = openpadenLijst;
      const uitgang = Object.keys(openpaden.EIGEN_UITGANG || {});
      const recht = Object.keys(openpaden.RECHT_VAN_DE_MENS || {});
      const dicht = openpaden.BEWUST_DICHT || {};
      /* DE GROND KOMT UIT HET BESTAANDE REGISTER EN NIET UIT EEN REGEX HIER.

         Hier stond `/^\/api\/(techniek|boardroom)\//`, en dat was een tweede
         waarheid naast server/kern/bestuursroutes.js -- de enige lijst van paden
         die BEWUST buiten de functieschakelaars staan, met per prefix de reden.
         Die regex kende /api/health, /api/metrics, /api/cluster, /api/sat en
         /api/test niet, en `blindEnVerzwakkend` verderop vergat /api/boardroom/
         helemaal. Vandaag onzichtbaar omdat de kaart die paden niet draagt,
         morgen een stille verkeerde indeling. */
      const redenVoor = bestuursgrond;
      const console_ = zonderFunctie.filter(p => redenVoor(p) &&
        !uitgang.includes(p) && !recht.includes(p) && !dicht[p]);
      const eigen = zonderFunctie.filter(p => uitgang.includes(p));
      const rechten = zonderFunctie.filter(p => recht.includes(p));
      const besloten = zonderFunctie.filter(p => dicht[p]);
      const rest = zonderFunctie.filter(p => !console_.includes(p) && !eigen.includes(p) &&
        !rechten.includes(p) && !besloten.includes(p));
      return {
        aantal: zonderFunctie.length,
        waarom: 'geen functie in de functiecatalogus achter dit pad; de beschermstand deelt hem daarom ' +
          'niet in en laat hem door',
        eigenaarConsole: { aantal: console_.length,
          wat: 'bewust buiten de functieschakelaars, met een grond die al bestond: de hand die ' +
            'repareert, de meetlijn die eerlijk moet blijven, en de AVG-knoppen die RTG niet mag uitzetten',
          bron: 'server/kern/bestuursroutes.js: REDENEN (het bestaande register, niet hier overgetypt)',
          gronden: Object.fromEntries([...new Set(console_.map(p => redenVoor(p)))].map(r =>
            [r, console_.filter(p => redenVoor(p) === r).length])),
          maar: 'de beschermstand heeft daarmee geen grip op die console' },
        eigenUitgang: { aantal: eigen.length, paden: eigen,
          wat: 'de uitgang van de stand zelf; die valt met opzet niet dicht',
          bron: 'server/kern/isolatie/openpaden.js: EIGEN_UITGANG' },
        rechtVanDeMens: { aantal: rechten.length, paden: rechten,
          wat: 'inzage, uitdraai, het inzagejournaal en het intrekken van toestemming: die LEZEN of ' +
            'VERSMALLEN, dus ze vergroten geen vermogen en blijven open',
          bron: 'server/kern/isolatie/openpaden.js: RECHT_VAN_DE_MENS' },
        bewustDicht: { aantal: besloten.length,
          paden: Object.fromEntries(besloten.map(p => [p, dicht[p]])),
          wat: 'overwogen en met opzet niet opengezet' },
        werklijst: { aantal: rest.length, paden: rest,
          wat: 'blinde vlekken zonder verklaring; dit is het werk' }
      };
    })()
  };
}

/* ---------- 2. De functiecatalogus zelf ---------- */
{
  const lijst = functies.FUNCTIES || [];
  const bevroren = lijst.filter(f => BEVRIEST[f.categorie] && !UITZONDERINGEN[f.id]);
  const uitgezonderd = lijst.filter(f => BEVRIEST[f.categorie] && UITZONDERINGEN[f.id]);
  noemers.functies = {
    wat: 'functies in de catalogus, ingedeeld door kern/beschermstand-lijst.js',
    bron: ['server/functies', 'server/kern/beschermstand-lijst.js'],
    gevonden: lijst.length,
    categorieën: new Set(lijst.map(f => f.categorie)).size,
    BEWEZEN_GEBLOKKEERD: bevroren.length,
    BEWEZEN_TOEGESTAAN: lijst.length - bevroren.length,
    ONBESLIST: 0,   // de fail-fast in beschermstand.js maakt dit onmogelijk
    ONBEPAALD_INFRA: 0,
    bevrorenCategorieën: Object.keys(BEVRIEST).length,
    doorlopendeCategorieën: Object.keys(LOOPT_DOOR).length,
    /* Uitzonderingen zijn een VERZWAKKING van de stand. Ze staan hier apart
       geteld zodat een groeiende lijst zichtbaar is: isolatie die aanblijft
       terwijl elke functie een uitzondering krijgt, is isolatie op papier. */
    uitzonderingen: uitgezonderd.map(f => ({ id: f.id, categorie: f.categorie, waarom: UITZONDERINGEN[f.id] }))
  };
}

/* ---------- 3. Wat de AI mag, per rol -- en wat er onder een stand overblijft ---------- */
{
  const perRol = {};
  /* 840 rijen dragen een LEGE rol. Dat is geen ontbrekend gegeven maar een
     toegangsklasse (MUTATIECONTRACT.md: "geen rol" hoort op te houden een
     restpost te zijn), en hem als '' in een tabel zetten maakt hem onleesbaar. */
  for (const r of kaart.capabilities) {
    const rol = r.rol || 'zonder-rol';
    const p = perRol[rol] || (perRol[rol] = { gevonden: 0, verboden: 0, bereikbaar: 0, perNiveau: {} });
    p.gevonden++;
    if (r.bereik === 'verboden') p.verboden++; else p.bereikbaar++;
    p.perNiveau[r.bereik] = (p.perNiveau[r.bereik] || 0) + 1;
  }

  /* DIT GETAL STOND HIER EERST ALS `ONBEPAALD`, en met reden: kern/stuur/beleid.js
     kende de incidentstand niet, dus er bestond geen smallere AI-lijst die tijdens
     een incident geldt. Nu bestaat hij (kern/stuur/isolatiefilter.js) en wordt hij
     GEMETEN in plaats van beloofd -- door de echte lijst door het echte filter te
     halen, met een echte drager in een echte stand. */
  const iso = maakIsolatie({ db: { data: {} }, save() {}, functies, klok: null, huisStand: () => 'normaal' });
  const filter = maakIsolatiefilter({ isolatie: iso, beleid });
  const onderStand = {};
  for (const stand of ['beschermd', 'isolatie']) {
    onderStand[stand] = {};
    for (const wereld of Object.keys(perRol)) {
      const paden = [...new Set(kaart.capabilities
        .filter(r => (r.rol || 'zonder-rol') === wereld && r.bereik !== 'verboden').map(r => r.pad))];
      const sleutel = 'meting-' + stand + '-' + wereld;
      iso.zet({ drager: 'identiteit', sleutel, naar: stand, door: 'isolatieproef',
        reden: 'meting van het isolatiefilter' });
      const uit = filter.versmal(paden, iso.context({ identiteit: sleutel }), wereld);
      onderStand[stand][wereld] = { bereikbaar: paden.length, naFilter: uit.paden.length,
        weggevallen: uit.weggevallen.length,
        regels: [...new Set(uit.weggevallen.map(w => w.regel).filter(Boolean))].sort() };
    }
  }

  noemers.aiBereik = {
    wat: 'wat het AI-stuur mag kiezen, per rol, en wat daarvan overblijft onder een stand',
    bron: ['EXECUTION_MAP.json', 'server/kern/stuur/beleid.js', 'server/kern/stuur/isolatiefilter.js'],
    perRol,
    onderStand,
    /* Het filter versmalt en verbreedt nooit; dat is per constructie zo en
       test/isolatie.test.js houdt het vast. Dit getal zegt dus hoeveel er
       dichtgaat, niet of er iets bijkwam. */
    handhaaft: true
  };
}

/* ---------- 3b. De schaduw: waar het effectmodel en de beschermstand het oneens zijn ---------- */
{
  const iso = maakIsolatie({ db: { data: {} }, save() {}, functies, klok: null, huisStand: () => 'normaal' });
  iso.zet({ drager: 'identiteit', sleutel: 'schaduwmeting', naar: 'beschermd', door: 'isolatieproef',
    reden: 'meting van het effectmodel' });
  const ctx = iso.context({ identiteit: 'schaduwmeting' });
  const paden = [...new Set(kaart.capabilities.map(r => r.pad))].sort();

  const soorten = { eens: 0, strenger: [], losser: [], onbekend: 0 };
  const graden = { verklaard: 0, vermoed: 0, onbekend: 0 };
  for (const pad of paden) {
    const b = iso.besluit({ pad, methode: 'POST', context: ctx });
    graden[b.schaduw.graad] = (graden[b.schaduw.graad] || 0) + 1;
    if (!b.onenigheid) { soorten.eens++; continue; }
    if (b.onenigheid.soort === 'onbekend') { soorten.onbekend++; continue; }
    soorten[b.onenigheid.soort].push({ pad, regel: b.regel || null,
      effecten: b.schaduw.effecten, graad: b.schaduw.graad, geraakt: b.schaduw.geraakt });
  }

  /* DE DUURSTE RIJ VAN DE HELE PROEF. Een pad dat de beschermstand niet kent
     (geen functie in de catalogus) EN waarvan het effectmodel zegt dat het de
     beveiliging kan verzwakken, is een blinde vlek met een scherpe rand. Deze
     lijst is de werklijst en geen statistiek. */
  const blindEnGevaarlijk = soorten.strenger.filter(r => !functies.functieVoorPad(r.pad));

  noemers.schaduw = {
    wat: 'het effectmodel naast de beschermstand, in de schaduw: waar zijn ze het oneens',
    bron: ['server/kern/isolatie/effecten.js', 'server/kern/beschermstand.js'],
    handhaaft: false,
    waarom: 'CONTROLPLANE.md: een nieuwe handhavingsregel loopt eerst mee zonder te blokkeren. ' +
      'Deze getallen zijn de voorwaarde om hem ooit aan te zetten, niet het bewijs dat het al werkt.',
    gevonden: paden.length,
    effectgraad: graden,
    eens: soorten.eens,
    onbekend: soorten.onbekend,
    strenger: soorten.strenger.length,
    losser: soorten.losser.length,
    /* Ze worden NIET opgeteld: `strenger` wil dat de beschermstand iets erbij
       neemt, `losser` dat het effectmodel wordt bijgesteld, en `onbekend` dat
       iemand het pad een profiel geeft. Drie verschillende opdrachten. */
    geenSom: 'strenger, losser en onbekend vragen om drie verschillende dingen en worden nooit opgeteld',
    blindEnVerzwakkend: (() => {
      /* DEZE RIJ MOEST WORDEN OPGESPLITST, want zonder die splitsing meldt hij
         een alarm dat een verklaring heeft -- en een meter die je niet kunt
         geloven, wordt uitgezet. server/routes/techniek/controle.js zegt met
         zoveel woorden dat de techniekroutes eigenaar-only zijn en BEWUST buiten
         de functieschakelaars vallen: dat is de hand die repareert, en die mag
         tijdens een incident niet vastzitten (kern/beschermstand-lijst.js zet
         'RTG-Backoffice' om dezelfde reden op LOOPT_DOOR).

         WAT DE OBSERVATIE DAN NOG WEL WAARD IS, en dat hoort er even groot bij:
         de beschermstand heeft dus GEEN grip op de eigen console van de
         eigenaar. Dat is een aanvaard ontwerp en geen bug -- maar het betekent
         dat wie die console overneemt, langs deze hele laag heen loopt. Daar
         hangt de ontsluitceremonie van het huis aan, en die is er nog niet. */
      /* OOK HIER DE GROND UIT HET REGISTER. Deze filter keek alleen naar
         /api/techniek/ en vergat /api/boardroom/, dus /api/boardroom/betalingen/proef
         stond als werk op de lijst terwijl bestuursroutes.js hem al verklaart.
         Een werklijst met een verklaard pad erop, kost iemand een middag. */
      const bestuur = require(path.join(root, 'server/kern/bestuursroutes'));
      const eigenConsole = blindEnGevaarlijk.filter(r => bestuur.redenVoor(r.pad));
      const rest = blindEnGevaarlijk.filter(r => !bestuur.redenVoor(r.pad));
      return {
        aantal: blindEnGevaarlijk.length,
        waarom: 'deze paden kent de beschermstand niet (geen functie in de catalogus) terwijl het ' +
          'effectmodel er een gesloten effect in ziet',
        bijOntwerp: {
          aantal: eigenConsole.length,
          wat: 'bewust buiten de functieschakelaars, met een grond die al bestond',
          bron: 'server/kern/bestuursroutes.js: REDENEN',
          gronden: Object.fromEntries([...new Set(eigenConsole.map(r => bestuur.redenVoor(r.pad)))]
            .map(g => [g, eigenConsole.filter(r => bestuur.redenVoor(r.pad) === g).length])),
          maar: 'de beschermstand heeft daarmee geen grip op die console. Wie hem overneemt, loopt ' +
            'langs deze hele laag heen; daar hangt de ontsluitceremonie van het HUIS aan, en die is er nog niet.'
        },
        werklijst: { aantal: rest.length, paden: rest.slice(0, 60),
          wat: 'blinde vlekken zonder die verklaring; dit is het werk' }
      };
    })(),
    voorbeeldStrenger: soorten.strenger.slice(0, 10),
    voorbeeldLosser: soorten.losser.slice(0, 10)
  };
}

/* ---------- 3b1. Kan het effectmodel ooit uit de schaduw? ----------

   Dit is de noemer waar het besluit aan hangt, en hij is met opzet apart geteld
   van de onenigheden hierboven: die zeggen WAAR de twee lagen verschillen, dit
   zegt of het effectmodel genoeg WEET om ooit zelf te mogen beslissen. */
{
  const paden = [...new Set(kaart.capabilities.map(r => r.pad))].sort();
  const graden = {};
  const bronnen = {};
  for (const pad of paden) {
    const r = effectmodel.effectenVan(pad, 'POST', functies.functieVoorPad(pad));
    graden[r.graad] = (graden[r.graad] || 0) + 1;
    const b = (r.bronnen || []).join('+') || 'geen';
    bronnen[b] = (bronnen[b] || 0) + 1;
  }

  /* HET PLAFOND. Wat zou de dekking worden als IEDERE gemeten collectie was
     ingedeeld? Dat getal beantwoordt de vraag of dit register nog werk waard is,
     en het antwoord is: niet zoveel. De grens ligt bij de PROEF en niet bij de
     lijst -- een pad waar IDEMPROEF.json nooit met succes langskwam, raakt geen
     enkele collectie, en dus valt er niets uit af te leiden hoeveel namen er ook
     staan. Wie meer dekking wil, verbetert de proef. */
  let metGemetenCollectie = 0, blijftOnbekend = 0;
  for (const pad of paden) {
    const c = proefmeting.collectiesVan(pad);
    if (c && c.size) { metGemetenCollectie++; continue; }
    const r = effectmodel.effectenVan(pad, 'POST', functies.functieVoorPad(pad));
    if (r.graad === 'onbekend') blijftOnbekend++;
  }

  /* DE IJKING. Waar allebei de bronnen iets zeggen: zijn ze het eens? Dit is de
     vraag die vooraf moet gaan aan elk gebruik van de afleiding als gezag. */
  const ijking = { paren: 0, overlappend: 0, aanvullend: [] };
  for (const pad of paden) {
    const c = proefmeting.collectiesVan(pad);
    if (!c || !c.size) continue;
    const uitCol = new Set();
    for (const col of c) { const rij = effectcollecties.effectVan(col); if (rij) uitCol.add(rij.effect); }
    if (!uitCol.size) continue;
    const uitVerklaring = new Set();
    for (const r of effectregister.VERKLAARD) if (r.patroon.test(pad)) r.effecten.forEach(x => uitVerklaring.add(x));
    if (!uitVerklaring.size) continue;
    ijking.paren++;
    if ([...uitCol].some(x => uitVerklaring.has(x))) ijking.overlappend++;
    else if (ijking.aanvullend.length < 10) ijking.aanvullend.push({ pad, verklaard: [...uitVerklaring], afgeleid: [...uitCol] });
  }
  ijking.zonderOverlap = ijking.paren - ijking.overlappend;
  ijking.uitslag = 'de twee bronnen spreken elkaar niet tegen maar vullen elkaar aan: waar ze niet ' +
    'overlappen, ziet de een iets wat de ander principieel niet kan zien (de proef kijkt in de ' +
    'opslag en niet naar uitgaande aanroepen; de verklaring leest de naam en kent geen collecties). ' +
    'Daarom worden ze OPGETELD en niet gerangschikt.';

  /* DE SPREIDING PER INGEDEELDE COLLECTIE. Een collectie kan alleen een effect
     dragen als IEDEREEN die erin schrijft dat effect heeft. Wordt zij door
     onverwante padfamilies geraakt, dan zegt haar naam te weinig -- dat is hoe
     `techniek` een adres opzoeken het effect BEVEILIGING_VERZWAKKEN gaf. Deze
     lijst staat er zodat de volgende die een collectie indeelt, ziet waar hij
     aan begint; hij is een WAARSCHUWING en geen poort, want twee of drie
     verwante families zijn volstrekt normaal. */
  const spreiding = {};
  for (const rij of Object.values(require(path.join(root, 'IDEMPROEF.json')).perRoute || {})) {
    const c = proefmeting.collectiesVan(rij.pad);
    if (!c) continue;
    for (const col of c) {
      if (!effectcollecties.effectVan(col)) continue;
      (spreiding[col] = spreiding[col] || new Set()).add(String(rij.pad).split('/').slice(0, 3).join('/'));
    }
  }
  const breed = Object.entries(spreiding).map(([col, s]) => ({ collectie: col, families: s.size,
    voorbeelden: [...s].slice(0, 6) })).filter(x => x.families >= 4)
    .sort((a, b) => b.families - a.families);

  noemers.effectdekking = {
    wat: 'weet het effectmodel genoeg om ooit zelf te mogen beslissen?',
    bron: ['server/kern/isolatie/effecten.js', 'server/kern/isolatie/effectcollecties.js',
      'IDEMPROEF.json'],
    gevonden: paden.length,
    graden, bronnen,
    collectiesIngedeeld: Object.keys(effectcollecties.PER_COLLECTIE).length,
    collectiesGemeten: 236,
    plafond: {
      alsElkeCollectieIsIngedeeld: metGemetenCollectie,
      danNogOnbekend: blijftOnbekend,
      waarom: 'de grens ligt bij de PROEF en niet bij de lijst: een pad waar IDEMPROEF.json nooit ' +
        'met succes langskwam, raakt geen enkele collectie. Meer dekking komt van een betere proef, ' +
        'niet van meer namen in het register.'
    },
    ijking,
    spreiding: {
      wat: 'ingedeelde collecties die door VIER of meer onverwante padfamilies worden geraakt',
      waarom: 'zo\'n collectie draagt haar effect niet: iedereen die erin schrijft krijgt het, ook wie ' +
        'er niets mee te maken heeft. Een waarschuwing en geen poort -- twee of drie verwante ' +
        'families zijn normaal.',
      breed,
      uitgesloten: { vastlegging: effectcollecties.VASTLEGGING, grabbelton: effectcollecties.GRABBELTON,
        waarom: 'deze zijn met naam uitgesloten en laten de module bij het laden omvallen als iemand ' +
          'ze alsnog indeelt' }
    },
    /* HET ANTWOORD OP DE VRAAG WAAROM DEZE NOEMER BESTAAT. Hij staat er als
       oordeel en niet als getallen waar de lezer zelf iets van moet vinden. */
    magHandhaven: false,
    waarom: 'met ' + (graden.onbekend || 0) + ' van de ' + paden.length + ' paden zonder profiel kan ' +
      'dit model niet de laag zijn die beslist: het zou over meer dan de helft van het huis moeten ' +
      'raden, en raden in de gesloten richting legt het platform plat terwijl raden in de open ' +
      'richting niets beschermt. De blokkade is GEMETEN en heeft een naam -- de proef, niet het ' +
      'register -- en dat is iets anders dan "er is nog werk".'
  };
}

/* ---------- 3b2. De leesset: wat `isolatie` overlaat ---------- */
{
  const s = leesset.stand();
  const iso = maakIsolatie({ db: { data: {} }, save() {}, functies, klok: null, huisStand: () => 'normaal' });
  iso.zet({ drager: 'identiteit', sleutel: 'leesmeting', naar: 'isolatie', door: 'isolatieproef',
    reden: 'meting van de leesset' });
  const ctx = iso.context({ identiteit: 'leesmeting' });
  const paden = [...new Set(kaart.capabilities.map(r => r.pad))];
  const gronden = {};
  let open = 0;
  for (const pad of paden) {
    const b = iso.besluit({ pad, methode: 'POST', context: ctx });
    if (b.toegestaan) { open++; continue; }
    gronden[b.regel || b.reden] = (gronden[b.regel || b.reden] || 0) + 1;
  }

  noemers.leesset = {
    wat: 'wat er onder `isolatie` overblijft, en op welke grond',
    bron: ['server/kern/isolatie/leesset.js', 'IDEMPROEF.json', 'server/kern/isolatie/effecten.js'],
    gevonden: paden.length,
    BEWEZEN_GEBLOKKEERD: paden.length - open,
    BEWEZEN_TOEGESTAAN: open,
    ONBESLIST: 0,
    ONBEPAALD_INFRA: 0,
    gronden,
    meting: s,
    /* HET VERSCHIL DAT DE NAAM BELOOFT, in een getal. Stond er eerder als
       `nietGebouwd` in het antwoord van de server; nu is het gemeten. */
    tegenoverBeschermd: {
      beschermdLaatDoor: noemers.httpPaden.gevonden - noemers.httpPaden.BEWEZEN_GEBLOKKEERD,
      isolatieLaatDoor: open,
      waarom: 'isolatie draagt de eigenschap `beschermd` ook, en sluit daarbovenop alles waarvan ' +
        'het lezerschap niet is bewezen'
    },
    prijs: 'de meting kwam bij ' + s.nooitMetSuccesGemeten + ' van de ' + s.routesInDeProef +
      ' rol-paden nooit met succes langs. Die gaan onder isolatie dicht, en een deel ervan zijn ' +
      'onschuldige lezers. Isolatie is dus botter dan hij hoeft te zijn; dat wordt minder naarmate ' +
      'IDEMPROEF.json verder komt.'
  };
}

/* ---------- 3c. De dragers ---------- */
{
  /* DRIE KOLOMMEN EN GEEN EEN, want er zaten twee vragen onder een veldnaam.

     `metBron` telde de dragers met een OPSLAGPLEK en werd hier gelezen als "kan
     dit werken". Dat is niet hetzelfde: `apparaat` had een keurige plek in
     db.data.isolatie.apparaat en geen enkele plek in de code die er ooit een
     sleutel in stopte, en `sessie` viel stil terug op de identiteitsleutel. De
     meter meldde 5 van 6 terwijl er bij een echt verzoek EEN drager een sleutel
     had.

     De twee worden niet opgeteld en niet vervangen. RTG kan een organisatie wel
     dichtzetten vanaf de cockpit (dus de opslag werkt) terwijl die stand bij een
     verzoek van dat lid nog niet meeweegt (dus de sleutel ontbreekt) -- allebei
     waar, en samentellen zou van allebei een halve waarheid maken. */
  noemers.dragers = {
    wat: 'de zes dragers waarop een stand kan staan',
    bron: ['server/kern/isolatie/dragers.js', 'server/kern/isolatie/sessiedragers.js'],
    gevonden: dragerlijst.DRAGERS.length,
    metBron: dragerlijst.werkend().length,
    metSleutelbron: dragerlijst.metSleutelbron().length,
    verschil: 'metBron = er is een plek waar de stand STAAT. metSleutelbron = bij een lopend ' +
      'verzoek is er ook een SLEUTEL om hem aan te hangen. Alleen de tweede telt mee in de join ' +
      'van een echt verzoek.',
    zonderBron: dragerlijst.DRAGERS.filter(d => d.bron === null)
      .map(d => ({ naam: d.naam, waarom: d.nietGebouwd })),
    zonderSleutelbron: dragerlijst.DRAGERS.filter(d => !d.sleutelbron)
      .map(d => ({ naam: d.naam, waarom: d.geenSleutel })),
    /* Een drager zonder bron telt NIET stil als `normaal` mee in de join: hij
       levert geen stand, en dat is iets anders dan de stand normaal. */
    teltAlsNormaal: false
  };
}

/* ---------- 3c2. Achtergrondwerk: de maat van het gat `workload` ---------- */
{
  const achtergrond = require(path.join(root, 'scripts/lib/achtergrond')).meet();
  noemers.workload = {
    wat: 'hoeveel achtergrondwerk er draait, en of het ergens aan hangt',
    bron: ['server/kern/isolatie/dragers.js', 'server/kern/kosten/haak.js',
      'server/opzet/handeling.js', 'scripts/lib/achtergrond.js'],
    gevonden: achtergrond.sites,
    bestanden: achtergrond.bestanden,
    binnenEenContext: achtergrond.metContext,
    contextpunten: achtergrond.contextpunten,
    ondergrens: achtergrond.ondergrens,
    /* WAAROM DIT GEEN NOEMER MET EEN PERCENTAGE IS. "45 taken, 1 met context"
       leest als 2% dekking, en dat suggereert dat de andere 44 een context
       zouden moeten krijgen. Dat is niet de vraag: die ene treffer is een
       HTTP-poort in hetzelfde bestand, geen taak die zich aanmeldt. Het getal
       zegt hoe GROOT de afwezigheid is, niet hoe ver we zijn. */
    waarom: 'er is geen gedeeld punt waar een achtergrondtaak begint. De async-context die er wel ' +
      'is (kern/kosten/haak.js) wordt op drie plekken betreden en alle drie zijn HTTP-poorten; een ' +
      'achtergrondtaak krijgt daar `huis`, en dat woord betekent op die plek tegelijk ' +
      '"achtergrondtaak", "onbekende aanroeper" en "de kern was nog niet wakker". Die waarde als ' +
      'workload-signaal lezen zou een tweede betekenis op een bestaand woord zijn.',
    gevolg: 'een `bron` invullen voor de drager `workload` levert een stand op die niemand zet en ' +
      'niemand leest. Hij blijft dus leeg, maar het gat heeft nu een maat.'
  };
}

/* ---------- 3d. Wat er nog WERKT -- de andere helft van de vraag ---------- */
{
  const iso = maakIsolatie({ db: { data: {} }, save() {}, functies, klok: null, huisStand: () => 'normaal' });
  const meter = maakBruikbaarheid({ isolatie: iso, functies, beschermstand });
  const perStand = meter.overStanden(['normaal', 'waakzaam', 'beperkt', 'beschermd', 'isolatie']);
  const gezakt = [];
  const gezaktHard = [];
  for (const [stand, v] of Object.entries(perStand)) {
    for (const b of v.belofteGezakt) gezakt.push({ stand, verhaal: b.id, dicht: b.dicht });
    for (const b of v.belofteGezaktAfgedwongen) gezaktHard.push({ stand, verhaal: b.id, dicht: b.dicht });
  }

  noemers.bruikbaarheid = {
    wat: 'wat er onder elke stand nog werkt, per kritiek gebruikersverhaal',
    /* PER BAAN UITGESPLITST, want een totaal over vier banen verbergt precies wat
       je wilt weten: dat de mens-baan er goed doorkomt en de zaak-baan niet. */
    perBaan: Object.fromEntries(Object.entries(perStand).map(([k, v]) => [k, v.perBaan])),
    bron: ['server/kern/isolatie/bruikbaarheid.js'],
    gevonden: meter.VERHALEN.length,
    /* GEEN PERCENTAGE. Negen verhalen zijn geen steekproef, en 78% van negen
       zegt minder dan de rij zelf. */
    perStand: Object.fromEntries(Object.entries(perStand).map(([k, v]) =>
      [k, { werkt: v.werkt, beperkt: v.beperkt, werktNiet: v.werktNiet }])),
    beloftesGezakt: gezakt,
    /* TWEE KOLOMMEN EN NOOIT EEN SOM. `beloftesGezakt` is wat de BESLUITLAAG
       zegt; `beloftesGezaktAfgedwongen` is wat een draaiende server met een
       gewoon HTTP-verzoek doet. Die tweede was er niet, en daardoor meldde dit
       register nul gebroken beloftes terwijl `geld-lezen` -- de belofte die dit
       huis het hardst heeft opgeschreven -- op de enige weg die telt gebroken
       was. Groen licht boven een gat, precies de faalvorm die deze laag zoekt. */
    beloftesGezaktAfgedwongen: gezaktHard,
    verschil: 'de besluitlaag (kern/isolatie/besluit.js) kent de leesset-redding; de handhavende weg ' +
      '(kern/beschermstand.js, aangeroepen door middleware/functieschakelaars.js) niet. Waar de twee ' +
      'uiteenlopen, telt de tweede: dat is wat een mens merkt.',
    waarom: 'de tellingen hierboven zeggen wat er DICHTGAAT, en dat is de helft die een verkeerd ' +
      'gevoel geeft: hoe meer er dicht is, hoe beter het lijkt. Een isolatiestand die niemand durft ' +
      'aan te zetten, beschermt niemand.',
    /* Deze meting vond drie echte ontwerpfouten; ze staan hier zodat zichtbaar
       blijft waarvoor de noemer bestaat. */
    gevonden3: ['geld-lezen viel dicht onder beschermd -- de eerste handeling van iemand die zijn ' +
      'account niet vertrouwt', 'zelf-beschermen viel dicht door de bescherming zelf',
      'ontsluiten-aanvragen viel dicht: een stand zonder uitgang is een val']
  };
}

/* ---------- 3e. De herkomst van invoer ---------- */
{
  /* DE PRIJS VAN DE HERKOMSTPOORT, GEMETEN EN NIET GESCHAT. Dit is het getal
     waarop de eigenaar besluit of RTG_HERKOMST_AFDWINGEN omgaat, dus het hoort
     in het register en niet in een commentaarregel die stil veroudert. Gemeten
     met de ECHTE filter over de bereikbare paden per rol, met een gesprek dat
     een toolantwoord heeft gezien. */
  const herkomstPrijs = (() => {
    const beleidmod = require(path.join(root, 'server/kern/stuur/beleid'));
    const { maakIsolatiefilter } = require(path.join(root, 'server/kern/stuur/isolatiefilter'));
    const iso2 = maakIsolatie({ db: { data: {} }, save() {}, functies, klok: null, huisStand: () => 'normaal' });
    const filter2 = maakIsolatiefilter({ isolatie: iso2, beleid: beleidmod });
    const ctx2 = iso2.context({ identiteit: 'herkomstmeting' });
    const uit = {};
    for (const wereld of ['member', 'supplier', 'staff']) {
      const paden2 = [...new Set(kaart.capabilities.filter(r => r.rol === wereld && r.bereik !== 'verboden')
        .map(r => r.pad))];
      if (!paden2.length) continue;
      uit[wereld] = { voor: paden2.length,
        na: filter2.versmal(paden2, ctx2, wereld, ['gebruikersvraag', 'toolantwoord']).paden.length };
    }
    return uit;
  })();

  noemers.herkomst = {
    wat: 'onvertrouwde inhoud vergroot nooit de beschikbare capabilities',
    bron: ['server/kern/isolatie/herkomst.js', 'server/kern/stuur/isolatiefilter.js'],
    gevonden: herkomstlaag.KANALEN_INGEDEELD,
    klassen: herkomstlaag.KLASSENAMEN,
    sluitBijOnvertrouwd: herkomstlaag.NOOIT_UIT_ONVERTROUWD.length,
    sluitBijActiefOnvertrouwd: herkomstlaag.NOOIT_UIT_ACTIEF.length,
    /* `handhaaft` IS GEMETEN EN NIET BEWEERD, en dat is een reparatie waar dit
       register zich voor moet schamen. Hier stond vast `true` terwijl de regel
       NERGENS draaide: de enige productie-aanroeper riep stuurPaden met drie
       argumenten aan, dus `bronnen` was altijd `undefined` en `sluitDoorHerkomst([])`
       gaf altijd `[]`. De regel stond, de dekking was nul, en het register meldde
       bescherming. Dat is erger dan geen regel -- niemand bouwt wat er al lijkt
       te zijn.

       De meting leest de BRON van de lus: geeft hij zijn kanalen door, en hangt
       de poort ook bij `doe`? Beide zijn nodig; de kaart komt bij stap n en `doe`
       bij stap n+3, dus alleen de lijst versmallen sluit niets. */
    handhaaft: (() => {
      const lus = fs.readFileSync(path.join(root, 'server/kern/stuur/lus.js'), 'utf8');
      const stap = fs.readFileSync(path.join(root, 'server/kern/stuur/lusstap.js'), 'utf8');
      const geeftDoor = /stuurPaden\(app, opties\.wereld, isoContext\(\), vuil\.bronnen\(\)\)/.test(lus);
      const poortBijDoe = /herkomstpoort\(pad, wereld\)/.test(stap);
      const meldt = /vuil\.meldToolantwoord\(pad\)/.test(stap);
      return {
        kaartVersmalt: geeftDoor,
        poortBijUitvoeren: poortBijDoe,
        besmettingGeboekt: meldt,
        bijt: process.env.RTG_HERKOMST_AFDWINGEN === '1',
        wat: geeftDoor && poortBijDoe && meldt
          ? 'de leiding ligt er: de lus boekt zijn kanalen, de kaart versmalt erop en de poort ' +
            'hangt VOOR de uitvoering. Hij BIJT alleen met RTG_HERKOMST_AFDWINGEN=1; daarzonder telt ' +
            'hij en houdt hij niets tegen (CONTROLPLANE.md: eerst in de schaduw).'
          : 'de leiding is INCOMPLEET; wat hier ontbreekt maakt de regel dood'
      };
    })(),
    prijsPerRol: herkomstPrijs,
    waar: 'kern/stuur/herkomstpoort.js (het oordeel), kern/stuur/isolatiefilter.js (de lijst) en ' +
      'kern/stuur/lusstap.js (de poort voor de uitvoering) -- een oordeel, drie lezers',
    /* WAT DIT NIET IS, en dat hoort er even groot bij: er wordt geen tekst
       gescand op verdachte zinnen. Dat werkt niet, en het wekt de indruk dat het
       wel werkt -- wat erger is dan niets. */
    nietGebouwd: {
      detectie: 'er wordt geen tekst gescand; de klasse komt uit het KANAAL en nooit uit de inhoud',
      labelaars: 'van de 13 kanalen meldt er vandaag precies EEN zich aan: `toolantwoord`, geboekt ' +
        'door kern/stuur/besmetting.js. De andere twaalf hebben geen enkele aanmelder. Een route die ' +
        'weet dat zij post of een document teruggeeft, kan zich VERFIJNEN -- dat is niet gebouwd, en ' +
        'zolang dat zo is telt alles wat een gereedschap teruggeeft als `toolantwoord`. Dat is de ' +
        'veilige kant, maar dekking is het niet.',
      prijs: 'de standaard kost bereik: na de eerste geslaagde `doe` versmalt de lijst. Dat is de ' +
        'reden dat hij in de schaduw loopt en niet bijt -- eerst het getal, dan het besluit. Het ' +
        'getal staat hieronder in `prijsPerRol` en niet in deze zin, want een zin veroudert stil.'
    }
  };
}

/* ---------- 4. Uitgaande bestemmingen ---------- */
{
  const hosts = new Set();
  (function loop(map) {
    for (const naam of fs.readdirSync(map, { withFileTypes: true })) {
      const p = path.join(map, naam.name);
      if (naam.isDirectory()) { if (naam.name !== 'data' && naam.name !== 'node_modules') loop(p); continue; }
      if (!naam.name.endsWith('.js')) continue;
      const tekst = fs.readFileSync(p, 'utf8');
      for (const m of tekst.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
        const h = m[1].toLowerCase();
        if (/^(localhost|127\.|0\.0\.0\.0|example\.|schemas\.|www\.w3\.)/.test(h)) continue;
        hosts.add(h);
      }
    }
  })(path.join(root, 'server'));

  noemers.uitgaandeBestemmingen = {
    wat: 'hostnamen die letterlijk in server/ voorkomen; een ondergrens, geen inventaris',
    bron: ['server/**/*.js', 'server/kern/ssrf.js'],
    gevonden: hosts.size,
    BEWEZEN_GEBLOKKEERD: 0,
    BEWEZEN_TOEGESTAAN: 0,
    ONBESLIST: 0,
    ONBEPAALD_INFRA: hosts.size,
    appBewijs: 'kern/ssrf.js weigert privé- en metadata-adressen voor doelen die een CLIENT aanlevert, ' +
      'en houdt voor web-push een allowlist van pushdiensten aan',
    infraBewijs: 'ONTBREEKT: er is in deze repo geen egress-policy, geen deny-by-default en geen ' +
      'netwerknamespace-bewijs. En let op: hier stond "PRODUCTION.md belooft een egress-proxy; een ' +
      'belofte is geen meting" -- dat document noemt egress NERGENS. Er was dus niet eens een ' +
      'belofte, alleen een verwijzing naar een paragraaf die nooit heeft bestaan (dezelfde fout als ' +
      'de cap `rooms` in CLAUDE.md). Er is geen egress-poort, en er is er ook nooit een toegezegd',
    eindoordeel: 'ONBEPAALD_INFRA',
    /* Een hostnaam die in de code staat is niet hetzelfde als een bestemming
       waar het proces heen KAN. Een gecompromitteerde parser praat met elk
       adres dat het netwerk toelaat, niet alleen met de adressen die iemand
       heeft opgeschreven. Dit getal is daarom een ondergrens. */
      waarschuwing: 'dit telt genoemde hosts, niet bereikbare hosts. Zonder egress-policy is het ' +
      'werkelijke aantal bestemmingen het hele internet.',
    hosts: [...hosts].sort()
  };
}

/* ---------- 5. Bestandsverwerkers ---------- */
{
  /* Wat in dit huis onvertrouwde bytes ontleedt. Herkend aan de naam en daarna
     nagelopen op wat er te bewijzen valt. `child_process` of een worker zou het
     begin van procesisolatie zijn; die is er nergens. */
  const kernmap = path.join(root, 'server/kern');
  const kandidaten = [];
  (function loop(map, prefix) {
    for (const naam of fs.readdirSync(map, { withFileTypes: true })) {
      const p = path.join(map, naam.name);
      const rel = prefix + naam.name;
      if (naam.isDirectory()) { loop(p, rel + '/'); continue; }
      if (!naam.name.endsWith('.js')) continue;
      if (!/pdf|beeld|foto|afbeeld|ocr|qr|zip|archief|office|xlsx|docx|csv|svg|audio|video|upload|bestand/i.test(rel)) continue;
      const tekst = fs.readFileSync(p, 'utf8');
      kandidaten.push({
        module: 'server/kern/' + rel,
        eigenProces: /child_process|worker_threads|new Worker\(/.test(tekst),
        netwerkclient: /\bfetch\(|https?\.request\(|require\('https?'\)/.test(tekst)
      });
    }
  })(kernmap, '');

  const geisoleerd = kandidaten.filter(k => k.eigenProces);
  noemers.bestandsverwerkers = {
    wat: 'modules in server/kern die onvertrouwde bytes ontleden, herkend aan hun naam',
    bron: ['server/kern/**/*.js'],
    gevonden: kandidaten.length,
    BEWEZEN_GEBLOKKEERD: 0,
    BEWEZEN_TOEGESTAAN: 0,
    ONBESLIST: 0,
    ONBEPAALD_INFRA: kandidaten.length,
    procesGeisoleerd: geisoleerd.length,
    appBewijs: kandidaten.filter(k => !k.netwerkclient).length + ' van de ' + kandidaten.length +
      ' importeren geen HTTP-client',
    infraBewijs: 'ONTBREEKT: geen van deze modules draait in een eigen proces met eigen geheugen-, ' +
      'CPU- en tijdgrens. Ze draaien in het hoofdproces van de server',
    eindoordeel: 'ONBEPAALD_INFRA',
    waarschuwing: '"importeert geen HTTP-client" is GEEN bewijs dat een parser geen internet heeft -- ' +
      'alleen dat de code er niet om vraagt. Een geheugenfout in een parser vraagt niets.',
    modules: kandidaten.sort((a, b) => a.module.localeCompare(b.module))
  };
}

/* ---------- 6. De ontsluiting ---------- */
{
  const bron = fs.readFileSync(path.join(root, 'server/routes/techniek/controle.js'), 'utf8');
  const ordening2 = require(path.join(root, 'server/kern/isolatie/ordening'));
  const { maakOntsluiting } = require(path.join(root, 'server/kern/isolatie/ontsluiting'));
  const o = maakOntsluiting({ opslag: require(path.join(root, 'server/kern/isolatie/opslag'))({ db: { data: {} } }),
    save() {}, klok: null, ordening: ordening2 });

  const perDrager = {};
  for (const d of ['huis', 'organisatie', 'identiteit', 'sessie', 'apparaat']) {
    const met = o.eisenVoor({ drager: d, van: 'isolatie', naar: 'normaal', tweedeMens: true });
    const zonder = o.eisenVoor({ drager: d, van: 'isolatie', naar: 'normaal', tweedeMens: false });
    perDrager[d] = { metTweedeMens: met.eisen, zonderTweedeMens: zonder.eisen,
      noodontsluiting: zonder.alleen === true };
  }

  noemers.ontsluiting = {
    wat: 'wat er nodig is om de beveiliging te VERLAGEN (SEC-LOCK-001)',
    bron: ['server/kern/isolatie/ontsluiting.js', 'server/routes/techniek/controle.js',
      'server/routes/isolatie.js', 'test/seclock.test.js'],
    verlagendeHandelingen: 5,
    perDrager,
    huisAchterCeremonie: /body\.ceremonie/.test(bron),
    eisen: {
      eigenaarAlleen: /eigenaarAlleen/.test(bron),
      getypteBevestiging: /HERSTEL RTG/.test(bron),
      passkey: true, apparaatbinding: true, wachttijd: true, vierOgen: true
    },
    eindoordeel: 'STAAT',
    waarom: 'alle vijf de dragers -- het huis inbegrepen -- verlagen alleen langs een ceremonie. Het ' +
      'huis kreeg er een omdat het achterliep op zijn eigen dragers: daar stond alleen een getypte ' +
      'zin, en dat was sinds de dragerlaag de zwakste schakel geworden.',
    voorbehoud: {
      passkeyEnApparaat: 'worden AFGETEKEND en niet uitgevoerd; het bewijs komt van server/webauthn/. ' +
        'Een ceremoniemodule die zelf mag besluiten dat er is ingelogd, is geen ceremonie.',
      noodontsluiting: 'waar er buiten de aanvrager niemand is die mag goedkeuren, vervalt het tweede ' +
        'paar ogen en draagt de ontsluiting een merk dat blijft staan. De waarde zit daar niet in het ' +
        'tegenhouden maar in het niet kunnen verbergen -- een eis die in een opstelling met een ' +
        'eigenaar nooit te halen is, maakt het platform onherstelbaar.'
    }
  };
}

/* ---------- De schuld, met opzet vooraan in het bestand ---------- */
const schuld = [
  /* DE POST DIE ONTBRAK, EN HET REGISTER DROEG DAARDOOR DEZELFDE LEUGEN ALS HET
     SCHERM. Drie posten hieronder zeggen STAAT -- en dat is waar over de
     BESLUITLAAG en niet over de handhaving: geen van de drie houdt vandaag een
     gewoon HTTP-verzoek tegen. Deze post staat daarom bovenaan en niet in een
     voetnoot. */
  { punt: 'de uitgaande mailweg koos zijn doel niet zelf',
    stand: 'GEREPAREERD, EN NIET DICHT',
    waarom: 'server/smtp-direct.js bezorg() zoekt de MX van het domein achter de @ op en opent daar ' +
      'een TCP-verbinding. Dat is de enige uitgaande verbinding van dit huis waarvan de BESTEMMING ' +
      'door een buitenstaander wordt gekozen: wie een domein beheert zet zijn MX waar hij wil, en ' +
      'dus ook op 10.0.0.5 of 127.0.0.1. kern/ssrf.js noemde zichzelf al een vangnet voor uitgaande ' +
      'fetches en de smarthost-kant (server/smtp.js) gebruikte hem; deze helft liep er nooit langs.',
    open: 'de poort geldt alleen op de DNS-tak -- een MX die onze eigen code meegeeft is niet door ' +
      'een aanvaller gekozen, en hem daar weigeren maakt een uitrol met een interne mailserver ' +
      'onmogelijk (de eerste versie deed dat wel en liet zes bestaande toetsen zakken). Wat NIET ' +
      'dicht is: een hostnaam die pas NA de DNS-opzoeking naar binnen wijst. Dat is DNS-rebinding en ' +
      'blijft ONBEPAALD_INFRA -- het hoort achter een egress-poort in de uitrol, en die is er niet.' },
  { punt: 'een zaaksessie bereikt de dragerlaag niet',
    stand: 'GEMETEN GAT',
    waarom: 'supplierAuth (opzet/leverancierpoort.js) zet req.supplier en req.actor, maar NOOIT ' +
      'req.session. kern/isolatie/sessiedragers.js leest req.session en de Authorization-kop, dus ' +
      'voor een zaakverzoek is er geen enkele drager -- niet alleen `organisatie` ontbreekt, de hele ' +
      'context is null. Beide contextbouwers (kern/stuur/luscontext.js en routes/stuur.js) geven ' +
      'daarop null terug.',
    open: 'de HERKOMSTkant is hierdoor niet meer stil: kern/stuur/paden.js keerde bij een lege ' +
      'context vroeg terug en versmalde dus ook niet op onvertrouwde invoer -- gemeten kostte dat een ' +
      'zaak 53 paden waar er 9 hadden moeten overblijven. Die terugkeer hangt nu alleen nog aan de ' +
      'LAAG en niet aan de context. Wat OPEN blijft: een zaak kan zichzelf niet in isolatie zetten ' +
      'en RTG kan een zaaksessie niet gericht dichtzetten, want er is geen sleutel om de stand aan ' +
      'te hangen. Dat vraagt een besluit over WELKE organisatie de drager is (TENANT.md houdt org, ' +
      'werkruimte en leverancier met opzet uit elkaar) en niet een regel code.' },
  { punt: 'handhaving in de HTTP-keten',
    stand: 'ONTBREEKT',
    waarom: 'GEMETEN: middleware/functieschakelaars.js leest alleen het HUIS-veld ' +
      '(ic.modus === "beschermd") en roept beschermstand.houdtTegen() aan. Grep naar "isolatie" in ' +
      'server/middleware/ geeft NUL treffers. isolatie.besluit() wordt in heel server/ door drie ' +
      'plekken aangeroepen: kern/stuur/isolatiefilter.js (de AI-padlijst), routes/techniek/isolatie.js ' +
      '(een proef die niets uitvoert) en kern/isolatie/bruikbaarheid.js (een meter).',
    open: 'een lid dat zichzelf op `isolatie` zet, versmalt alleen de lijst waaruit het model kiest; ' +
      'zijn gewone HTTP-paden blijven open. Het ledenscherm zegt dat inmiddels met zoveel woorden ' +
      '(het veld `afgedwongen` op /api/isolatie/mijn, afgeleid uit de code en niet uit een tekst), ' +
      'maar de poort zelf is er nog niet. Wie hem bouwt: hij hoort op de plek van het huis-blok in ' +
      'functieschakelaars.js -- de enige plek die elk /api/-verzoek ziet, vóór elke router staat, de ' +
      'bearer-kop al ontleedt en de 503 van deze as al bezit -- en hij hoort eerst in de SCHADUW te ' +
      'lopen (CONTROLPLANE.md). Let op twee gemeten valkuilen: een voorpoort die vraagt "staat er ' +
      'ergens een stand" kost bij 10.000 dichtgezette leden ~1 ms per verzoek (het materialiseren van ' +
      'de sleutels), dus de vraag hoort te zijn "staat er een stand VOOR DIT VERZOEK" -- een ' +
      'hash-opzoeking, O(1). En besluit() laat onder huis=beschermd 255 paden door die houdtTegen() ' +
      'vandaag dichthoudt: dat is een VERZWAKKING van bestaande handhaving en een eigen besluit met ' +
      'een eigen schaduwronde, niet iets dat meelift.' },
  { punt: 'drager-model',
    stand: 'STAAT ALS BESLUITLAAG',
    waarom: 'server/kern/isolatie/: vijf van de zes dragers dragen een stand, samengevoegd met een join. ' +
      'De stand van het huis wordt GELEZEN uit de incidentcontrole en niet gekopieerd. Vier dragers ' +
      'hebben ook een SLEUTELBRON en doen dus mee bij een lopend verzoek (kern/isolatie/sessiedragers.js).',
    open: 'twee dragers hebben geen sleutelbron. `workload`: geen achtergrondtaak meldt zich aan, en ' +
      'er is geen gedeeld beginpunt -- gemeten in noemers.workload. `organisatie`: een sessie draagt ' +
      'geen organisatiecode, dus RTG kan de stand wel ZETTEN vanaf de cockpit maar hij weegt bij een ' +
      'verzoek van dat lid niet mee.' },
  { punt: 'isolatie per drager is strenger dan beschermd',
    stand: 'STAAT ALS BESLUITLAAG',
    waarom: 'server/kern/isolatie/leesset.js: onder isolatie blijft alleen open wat zijn lezerschap ' +
      'heeft BEWEZEN -- gemeten in IDEMPROEF.json en getoetst tegen het effectmodel, dat precies de ' +
      'blinde vlek van die meting dekt (bestanden en uitgaande aanroepen).',
    open: 'de meting kwam bij 3074 rol-paden nooit met succes langs; die gaan dicht terwijl een deel ' +
      'ervan onschuldige lezers zijn. Isolatie is dus botter dan nodig.' },
  { punt: 'ledenscherm',
    stand: 'STAAT ALS BESLUITLAAG',
    waarom: 'server/routes/isolatie.js en /apps/mijn-isolatie.html: een lid zet zichzelf, deze sessie ' +
      'of dit toestel strenger, met de sleutel uit de SESSIE en nooit uit het verzoek.',
    open: 'de drager `apparaat` werkt alleen na een PASSKEY-inlog; wie met een wachtwoord inlogt draagt ' +
      'er geen, en dat komt terug met de reden in plaats van als lege waarde.' },
  { punt: 'de bruikbaarheidsmeter mat de verkeerde laag',
    stand: 'GEREPAREERD',
    waarom: 'de meter mat tegen isolatie.besluit() -- de besluitlaag, die de leesset-redding kent. ' +
      'De laag die in de HTTP-keten werkelijk iets tegenhoudt (beschermstand.houdtTegen) kent die ' +
      'niet. Gemeten onder huis=beschermd stond het verhaal `geld-lezen` -- een belofte met moetHeel ' +
      '-- volgens de besluitlaag op WERKT en afgedwongen op WERKT NIET: /api/pay/overzicht, ' +
      '/api/bank/afschrift en /api/bank/overzicht vallen alle drie dicht op de categorie "Geld". ' +
      'Dit register meldde ondertussen beloftesGezakt: []. Groen licht boven een gat.',
    open: 'de twee kolommen staan er nu naast elkaar (beloftesGezakt tegenover ' +
      'beloftesGezaktAfgedwongen) en worden nooit opgeteld. Ze GELIJKTREKKEN is een tweede besluit: ' +
      'de leesset-redding naar de handhavende weg brengen is een verzwakking van bestaande ' +
      'handhaving en vraagt een eigen schaduwronde.' },
  { punt: 'lockdown-filter na de resolver',
    stand: 'STAAT',
    waarom: 'server/kern/stuur/isolatiefilter.js versmalt de lijst waaruit de AI kiest, per constructie ' +
      'een deelverzameling, met per weggevallen pad een reden.' },
  { punt: 'ontsluitceremonie, ook voor het huis',
    stand: 'STAAT',
    waarom: 'alle vijf dragers verlagen alleen langs kern/isolatie/ontsluiting.js. Het huis liep achter ' +
      'op zijn eigen dragers (een getypte zin) en loopt nu langs dezelfde ceremonie.',
    open: 'passkey en apparaatbinding worden AFGETEKEND en niet uitgevoerd; het bewijs komt van elders.' },
  { punt: 'effectmodel handhaaft',
    stand: 'SCHADUW, MET EEN GEMETEN BLOKKADE',
    waarom: 'hij rekent mee en meldt onenigheden; hij blokkeert niets. Dat blijft zo, en de reden is ' +
      'nu een getal: zie noemers.effectdekking. De blokkade is de PROEF en niet het register -- ook ' +
      'met alle 236 collecties ingedeeld blijft de dekking staan waar IDEMPROEF.json ophoudt.',
    open: 'de proef verder laten reiken (werelden opzetten waar hij nu niet bij kan), niet meer ' +
      'namen in effectcollecties.js zetten. Eerste ronde gedaan: +53 gemeten, +44 bewezen lezers, ' +
      '0 regressies. Wat er nu nog dicht zit, zit dicht om een REDEN -- een vergunning of een ' +
      'vastgestelde identiteit die een mens heeft moeten zien -- en niet omdat de proef er niet bij kon.' },
  { punt: 'blinde vlek in de beschermstand',
    stand: 'GEMETEN',
    waarom: noemers.httpPaden.blindeVlek.werklijst.aantal + ' paden hebben geen functie in de ' +
      'catalogus en geen verklaring waarom niet. De andere ' +
      (noemers.httpPaden.blindeVlek.aantal - noemers.httpPaden.blindeVlek.werklijst.aantal) +
      ' zijn de eigenaar-console (bij ontwerp) en de uitgang van deze laag zelf.' },
  { punt: 'egress deny-by-default',
    stand: 'ONBEPAALD_INFRA',
    waarom: 'niet uit deze repo te bewijzen; hoort bij de uitrol.' },
  { punt: 'procesisolatie van parsers',
    stand: 'ONBEPAALD_INFRA',
    waarom: noemers.bestandsverwerkers.gevonden + ' verwerkers draaien in het hoofdproces.' },
  { punt: 'bruikbaarheid onder isolatie',
    stand: 'GEMETEN',
    waarom: 'kern/isolatie/bruikbaarheid.js: negen kritieke verhalen, per stand nagelopen. De meting ' +
      'vond meteen drie echte ontwerpfouten -- geld-lezen, zelf-beschermen en ontsluiten-aanvragen ' +
      'vielen alle drie dicht -- en die zijn gerepareerd.',
    open: 'negen verhalen is een begin en geen dekking; wie er een toevoegt, meet meteen mee.' },
  { punt: 'herkomst en vertrouwensklasse van invoer (taint)',
    stand: 'STAAT',
    waarom: 'kern/isolatie/herkomst.js: vier klassen, dertien kanalen, en de regel wordt AFGEDWONGEN ' +
      'in kern/stuur/isolatiefilter.js -- op dezelfde plek waar de isolatiestand versmalt. Onvertrouwde ' +
      'invoer sluit acht effecten, actief-onvertrouwde elf.',
    open: 'welke kanalen zich vandaag werkelijk aanmelden is niet gemeten. Een kanaal dat zwijgt telt ' +
      'als onvertrouwd -- de verkeerde kant is dus de veilige, maar dekking is dat niet.' },
  { punt: 'lockdown-filter gemonteerd',
    stand: 'STAAT',
    waarom: 'kern/stuur.js roept het filter aan in stuurPaden(), en kern/stuur/lus.js haalt de ' +
      'context uit de SESSIE van de aanroeper. De kaart zegt er bovendien bij WAT er wegviel, zodat ' +
      'het model niet denkt dat een vermogen niet bestaat.' },
  /* VIER VONDSTEN VAN DE BRUIKBAARHEIDSMETER, en het zijn BESLUITEN en geen bugs.
     Ze staan hier met de meting erbij in plaats van stil te worden rechtgetrokken:
     wie ze wegpoetst, verandert wat de stand aan een mens belooft zonder dat
     iemand daarover heeft besloten. */
  { punt: 'passkey-inloggen valt dicht onder beschermd',
    stand: 'BESLUIT VAN DE EIGENAAR',
    waarom: 'GEMETEN: /api/webauthn/opties komt er als bewezen lezer doorheen en /api/webauthn/login ' +
      'niet -- die hangt aan de functie `webauthn` in de bevroren categorie "Betalen & verificatie". ' +
      'Een halfopen voordeur is erger dan een dichte.',
    open: 'drie uitwegen. (1) /api/webauthn/login en /opties in de paden van `tg-inlog` zetten: een ' +
      'regel, de langste prefix wint dus registreren blijft bevroren, en het repareert meteen dat de ' +
      'knop "Passkeys" op het schakelbord het passkey-INLOGGEN vandaag niet uitzet -- prijs: die twee ' +
      'routes verhuizen van doelgroep LEDEN naar ALLE. (2) een eigen functie `tg-passkey-inlog` plus ' +
      'een uitzondering: meer boekhouding, geen doelgroepverschuiving. (3) niets doen en vastleggen ' +
      'dat wachtwoord-inloggen de gegarandeerde weg is. Dit is een keuze van de eigenaar.' },
  { punt: 'een horecazaak kan niet afrekenen onder beschermd',
    stand: 'BESLUIT VAN DE EIGENAAR',
    waarom: 'GEMETEN: van de vier zaak-verhalen staat er onder `beschermd` GEEN ENKELE op "werkt". ' +
      'Elke /api/supplier/-route valt onder de functie `supplier` in de bevroren categorie "Partners ' +
      '(leveranciers)"; ook het HACCP-temperatuurlogboek en de clubdeur gaan dicht.',
    open: 'de reden in beschermstand-lijst.js is "een leverancier schrijft hier in onze gegevens", ' +
      'maar een zaak die haar eigen tafelrekening bijwerkt is precies wat LOOPT_DOOR onder "Werk ' +
      '(zaken en personeel)" beschrijft als eigenaar en niet als derde. Dat is een tegenspraak in de ' +
      'indeling. LET OP: /api/supplier/pos/checkout BEWEEGT GELD via RTG Pay en hoort er nooit zomaar ' +
      'uit, wat er ook met de categorie gebeurt.' },
  { punt: 'de deur van het gezinsportaal',
    stand: 'BESLUIT VAN DE EIGENAAR',
    waarom: 'GEMETEN: onder `isolatie` staat /api/foundation/gezin/inloggen dicht terwijl de ' +
      'GET-reads erachter openblijven. Wie al binnen is leest door, wie erbuiten staat komt er niet in.',
    open: 'een ouder die zijn kind zoekt terwijl RTG een incident heeft, is niet de aanvaller waar ' +
      'deze stand tegen is. Of die deur bij de rechten van de mens hoort, is een besluit.' },
  { punt: 'de verblijfsdeur',
    stand: 'BESLUIT VAN DE EIGENAAR',
    waarom: 'GEMETEN: /api/verblijf/deur -- de sleutel van je hotelkamer -- gaat onder `isolatie` dicht.',
    open: 'iemand die op reis is en zijn kamer niet meer in kan omdat zijn account onder verdenking ' +
      'staat, is een echte schade. Openzetten is dat ook. Dit is geen meetfout maar een keuze.' }
];

const uit = {
  uitleg: 'De veiligheidsboekhouding van de beschermstand. Per noemer geteld, nooit samengesteld: ' +
    'een percentage tussen twee verschillende noemers is fictie.',
  gemetenOp: new Date().toISOString().slice(0, 10),
  uitslagen: ['BEWEZEN_GEBLOKKEERD', 'BEWEZEN_TOEGESTAAN', 'ONBESLIST', 'NIET_TOEPASSELIJK', 'ONBEPAALD_INFRA'],
  geenSamengesteldCijfer: 'met opzet. Zie de kop van scripts/isolatieproef.js.',
  schuld,
  noemers
};

fs.writeFileSync(path.join(root, 'ISOLATIEPROEF.json'), JSON.stringify(uit, null, 2) + '\n');

/* Het scherm vat samen; het bestand is de waarheid.

   GEEN `undefined` OP EEN BEVEILIGINGSREGEL. Niet elke noemer telt in de vijf
   uitslagen -- de schaduw telt onenigheden, de dragers tellen bronnen -- en die
   door dezelfde kolommen persen levert een regel op die er ingevuld uitziet en
   niets zegt. Elke noemer vat zichzelf samen. */
function vat(naam, n) {
  if (n.BEWEZEN_GEBLOKKEERD !== undefined) {
    return String(n.gevonden).padStart(6) + ' gevonden, ' +
      String(n.BEWEZEN_GEBLOKKEERD).padStart(5) + ' geblokkeerd, ' +
      String(n.ONBESLIST).padStart(4) + ' onbeslist, ' +
      String(n.ONBEPAALD_INFRA).padStart(4) + ' onbepaald-infra' +
      (naam === 'httpPaden' ? '  (blind: ' + n.blindeVlek.werklijst.aantal + ' werklijst, ' +
        n.blindeVlek.eigenaarConsole.aantal + ' console, ' + n.blindeVlek.eigenUitgang.aantal + ' uitgang, ' +
        n.blindeVlek.rechtVanDeMens.aantal + ' recht, ' + n.blindeVlek.bewustDicht.aantal + ' besloten)' : '');
  }
  if (naam === 'schaduw') {
    return String(n.gevonden).padStart(6) + ' gewogen, ' + String(n.strenger).padStart(5) + ' strenger, ' +
      String(n.losser).padStart(4) + ' losser, ' + String(n.onbekend).padStart(4) + ' zonder profiel' +
      '  (blind EN verzwakkend: ' + n.blindEnVerzwakkend.werklijst.aantal + ' werklijst, ' +
      n.blindEnVerzwakkend.bijOntwerp.aantal + ' bij ontwerp)';
  }
  if (naam === 'effectdekking') {
    return String(n.gevonden).padStart(6) + ' paden, ' + String(n.graden.verklaard || 0).padStart(4) +
      ' verklaard, ' + String(n.graden.afgeleid || 0).padStart(4) + ' afgeleid, ' +
      String(n.graden.vermoed || 0).padStart(5) + ' vermoed, ' + String(n.graden.onbekend || 0).padStart(5) +
      ' onbekend  (plafond: ' + n.plafond.danNogOnbekend + ' blijft onbekend)';
  }
  if (naam === 'bruikbaarheid') {
    const i = n.perStand.isolatie;
    return String(n.gevonden).padStart(6) + ' verhalen, onder isolatie: ' + i.werkt + ' werkt, ' +
      i.beperkt + ' beperkt, ' + i.werktNiet + ' niet  (beloftes gezakt: ' + n.beloftesGezakt.length +
      ' volgens het besluit, ' + n.beloftesGezaktAfgedwongen.length + ' afgedwongen)';
  }
  if (naam === 'herkomst') {
    return String(n.gevonden).padStart(6) + ' kanalen ingedeeld, ' + n.sluitBijOnvertrouwd +
      ' effecten dicht bij onvertrouwd, ' + n.sluitBijActiefOnvertrouwd + ' bij actief-onvertrouwd';
  }
  if (naam === 'dragers') {
    return String(n.gevonden).padStart(6) + ' dragers, ' + String(n.metSleutelbron).padStart(5) + ' met een sleutel bij een verzoek, ' +
      String(n.zonderSleutelbron.length).padStart(4) + ' zonder sleutel';
  }
  if (naam === 'workload') {
    return String(n.gevonden).padStart(6) + ' achtergrondsites, ' + String(n.bestanden).padStart(5) +
      ' bestanden, ' + String(n.binnenEenContext).padStart(4) + ' binnen een context';
  }
  if (naam === 'aiBereik') {
    const b = n.onderStand.beschermd || {};
    return Object.keys(b).map(w => w + ': ' + b[w].bereikbaar + '->' + b[w].naFilter).join(', ') +
      '  (onder beschermd)';
  }
  return '(zie bestand: ' + (n.eindoordeel || 'geen telling') + ')';
}

console.log('ISOLATIEPROEF.json geschreven.');
for (const [naam, n] of Object.entries(noemers)) console.log('  ' + naam.padEnd(24) + vat(naam, n));
console.log('  schuld: ' + schuld.length + ' punten (zie ISOLATIEPROEF.json).');
