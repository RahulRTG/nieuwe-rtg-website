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

/* ---------- 3. Wat de AI mag, per rol ---------- */
{
  const perRol = {};
  for (const r of kaart.capabilities) {
    const p = perRol[r.rol] || (perRol[r.rol] = { gevonden: 0, verboden: 0, bereikbaar: 0, perNiveau: {} });
    p.gevonden++;
    if (r.bereik === 'verboden') p.verboden++; else { p.bereikbaar++; }
    p.perNiveau[r.bereik] = (p.perNiveau[r.bereik] || 0) + 1;
  }
  noemers.aiBereik = {
    wat: 'wat het AI-stuur mag kiezen, per rol; kern/stuur/beleid.js is closed by default',
    bron: ['EXECUTION_MAP.json', 'server/kern/stuur/beleid.js'],
    perRol,
    /* GEEN ISOLATIEKOLOM, en dat is het eerlijke antwoord. De beschermstand
       filtert vandaag de HTTP-laag en niet de AI-allowlist: er is geen tweede,
       smallere lijst die tijdens een incident geldt. Wie hier een getal wil,
       moet eerst dat filter bouwen (het lockdown-filter na de resolver). */
    onderIsolatie: 'ONBEPAALD',
    waarom: 'kern/stuur/beleid.js kent de incidentstand niet; er bestaat geen smallere AI-lijst ' +
      'die tijdens een incident geldt. Zolang die er niet is, zou elk getal hier verzonnen zijn.'
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
  noemers.ontsluiting = {
    wat: 'wat er nodig is om de beveiliging te VERLAGEN (SEC-LOCK-001)',
    bron: ['server/routes/techniek/controle.js', 'test/seclock.test.js'],
    verlagendeHandelingen: 1,
    eisen: {
      eigenaarAlleen: /eigenaarAlleen/.test(bron),
      getypteBevestiging: /HERSTEL RTG/.test(bron),
      geregistreerdeReden: /redenVan/.test(fs.readFileSync(path.join(root, 'server/kern/incidentcontrole.js'), 'utf8')),
      auditregel: true,
      passkey: false,
      apparaatbinding: false,
      wachttijd: false,
      vierOgen: false
    },
    eindoordeel: 'ONBESLIST',
    waarom: 'er staat een drempel (eigenaar-only, een getypte zin, een verplichte reden, een auditregel) ' +
      'maar geen ceremonie: geen passkey, geen apparaatbinding, geen wachttijd en geen tweede paar ogen. ' +
      'De invariant legt vast wat er IS; hij zegt niet dat het genoeg is.'
  };
}

/* ---------- De schuld, met opzet vooraan in het bestand ---------- */
const schuld = [
  { punt: 'drager-model',
    stand: 'ONTBREEKT',
    waarom: 'alle standen zijn huis-breed (db.data.techniek.incidentcontrole.modus). Er valt niets per ' +
      'identiteit, sessie, apparaat of organisatie te meten, omdat er niets per drager te zetten is.',
    gevolg: 'RTG kan vandaag niet zeggen "dit ene lid staat in isolatie".' },
  { punt: 'lockdown-filter na de resolver',
    stand: 'ONTBREEKT',
    waarom: 'kern/stuur/beleid.js kent de incidentstand niet; bevoegd zijn en beschikbaar zijn ' +
      'vallen tijdens een incident nog samen.' },
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
  { punt: 'ontsluitceremonie',
    stand: 'ONBESLIST',
    waarom: 'een getypte zin is geen passkey, apparaatbinding, wachttijd of vier-ogenbesluit.' },
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

/* Het scherm vat samen; het bestand is de waarheid. */
console.log('ISOLATIEPROEF.json geschreven.');
for (const [naam, n] of Object.entries(noemers)) {
  if (n.gevonden === undefined) { console.log('  ' + naam.padEnd(24) + ' (geen telling: ' + (n.eindoordeel || 'zie bestand') + ')'); continue; }
  console.log('  ' + naam.padEnd(24) + String(n.gevonden).padStart(6) + ' gevonden, ' +
    String(n.BEWEZEN_GEBLOKKEERD).padStart(5) + ' geblokkeerd, ' +
    String(n.ONBESLIST).padStart(4) + ' onbeslist, ' +
    String(n.ONBEPAALD_INFRA).padStart(4) + ' onbepaald-infra');
}
console.log('  schuld: ' + schuld.length + ' open punten (zie ISOLATIEPROEF.json).');
