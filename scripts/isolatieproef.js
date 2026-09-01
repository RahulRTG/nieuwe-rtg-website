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

  noemers.httpPaden = {
    wat: 'unieke API-paden uit de executiekaart, gehouden tegen kern/beschermstand.js met methode POST',
    bron: ['EXECUTION_MAP.json', 'server/kern/beschermstand.js', 'server/functies'],
    gevonden: paden.length,
    BEWEZEN_GEBLOKKEERD: tegengehouden.length,
    BEWEZEN_TOEGESTAAN: paden.length - tegengehouden.length - zonderFunctie.length,
    ONBESLIST: zonderFunctie.length,
    ONBEPAALD_INFRA: 0,
    /* DE BLINDE VLEK, en die hoort bovenaan en niet in een voetnoot.
       houdtTegen() geeft `null` zodra er geen functie achter een pad hangt: er
       valt dan niets in te delen, en tegenhouden op grond van niets is raden.
       Dat is een verdedigbare keuze, maar het betekent wel dat deze paden de
       beschermstand ONGEMERKT passeren. Ze staan hier met naam, want een blinde
       vlek die je niet kunt opnoemen, is er geen die je kunt sluiten. */
    blindeVlek: {
      aantal: zonderFunctie.length,
      waarom: 'geen functie in de functiecatalogus achter dit pad; de beschermstand deelt hem daarom ' +
        'niet in en laat hem door',
      paden: zonderFunctie
    }
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
      const eigenConsole = blindEnGevaarlijk.filter(r => /^\/api\/techniek\//.test(r.pad));
      const rest = blindEnGevaarlijk.filter(r => !/^\/api\/techniek\//.test(r.pad));
      return {
        aantal: blindEnGevaarlijk.length,
        waarom: 'deze paden kent de beschermstand niet (geen functie in de catalogus) terwijl het ' +
          'effectmodel er een gesloten effect in ziet',
        bijOntwerp: {
          aantal: eigenConsole.length,
          wat: 'de eigen console van de eigenaar: eigenaar-only en bewust buiten de functieschakelaars',
          bron: 'server/routes/techniek/controle.js',
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
  noemers.dragers = {
    wat: 'de zes dragers waarop een stand kan staan',
    bron: ['server/kern/isolatie/dragers.js'],
    gevonden: dragerlijst.DRAGERS.length,
    metBron: dragerlijst.werkend().length,
    zonderBron: dragerlijst.DRAGERS.filter(d => d.bron === null)
      .map(d => ({ naam: d.naam, waarom: d.nietGebouwd })),
    /* Een drager zonder bron telt NIET stil als `normaal` mee in de join: hij
       levert geen stand, en dat is iets anders dan de stand normaal. */
    teltAlsNormaal: false
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
      'netwerknamespace-bewijs. PRODUCTION.md belooft een egress-proxy; een belofte is geen meting',
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
  { punt: 'drager-model',
    stand: 'STAAT',
    waarom: 'server/kern/isolatie/: vijf van de zes dragers dragen een stand, samengevoegd met een join. ' +
      'De stand van het huis wordt GELEZEN uit de incidentcontrole en niet gekopieerd.',
    open: 'de drager `workload` heeft nog geen bron: een achtergrondtaak meldt zich nergens aan.' },
  { punt: 'isolatie per drager is strenger dan beschermd',
    stand: 'STAAT',
    waarom: 'server/kern/isolatie/leesset.js: onder isolatie blijft alleen open wat zijn lezerschap ' +
      'heeft BEWEZEN -- gemeten in IDEMPROEF.json en getoetst tegen het effectmodel, dat precies de ' +
      'blinde vlek van die meting dekt (bestanden en uitgaande aanroepen).',
    open: 'de meting kwam bij 3074 rol-paden nooit met succes langs; die gaan dicht terwijl een deel ' +
      'ervan onschuldige lezers zijn. Isolatie is dus botter dan nodig.' },
  { punt: 'ledenscherm',
    stand: 'STAAT',
    waarom: 'server/routes/isolatie.js en /apps/mijn-isolatie.html: een lid zet zichzelf, deze sessie ' +
      'of dit toestel strenger, met de sleutel uit de SESSIE en nooit uit het verzoek.',
    open: 'de drager `apparaat` werkt alleen als de sessie er een draagt; vandaag draagt zij die niet.' },
  { punt: 'lockdown-filter na de resolver',
    stand: 'STAAT',
    waarom: 'server/kern/stuur/isolatiefilter.js versmalt de lijst waaruit de AI kiest, per constructie ' +
      'een deelverzameling, met per weggevallen pad een reden.',
    open: 'hij is nog niet gemonteerd op de weg die het stuur werkelijk loopt.' },
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
      'namen in effectcollecties.js zetten.' },
  { punt: 'blinde vlek in de beschermstand',
    stand: 'GEMETEN',
    waarom: noemers.httpPaden.blindeVlek.aantal + ' paden hebben geen functie in de catalogus en ' +
      'passeren de beschermstand ongemerkt.' },
  { punt: 'egress deny-by-default',
    stand: 'ONBEPAALD_INFRA',
    waarom: 'niet uit deze repo te bewijzen; hoort bij de uitrol.' },
  { punt: 'procesisolatie van parsers',
    stand: 'ONBEPAALD_INFRA',
    waarom: noemers.bestandsverwerkers.gevonden + ' verwerkers draaien in het hoofdproces.' },
  { punt: 'herkomst en vertrouwensklasse van invoer (taint)',
    stand: 'ONTBREEKT',
    waarom: 'onvertrouwde inhoud (mail, document, webpagina, toolresultaat) draagt geen klasse, dus ' +
      'de regel "onvertrouwde inhoud vergroot nooit de beschikbare capabilities" is niet af te dwingen.' },
  { punt: 'bruikbaarheid onder isolatie',
    stand: 'ONGEMETEN',
    waarom: 'er is geen lijst kritieke gebruikersverhalen, dus er is niet te zeggen wat er tijdens ' +
      'een incident nog WERKT. Een isolatiestand die niemand durft aan te zetten, beschermt niets.' }
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
      String(n.ONBEPAALD_INFRA).padStart(4) + ' onbepaald-infra';
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
  if (naam === 'dragers') {
    return String(n.gevonden).padStart(6) + ' dragers, ' + String(n.metBron).padStart(5) + ' met een bron, ' +
      String(n.zonderBron.length).padStart(4) + ' zonder';
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
