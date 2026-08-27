/* RTG Atelier, deelbestand "bank": de categorieën, het gedempte quiet-luxury-palet
   en de creatieve spec-catalogus (BANK) per categorie, de onderdelenlijst voor het
   tech pack, plus de pure generatieve helpers die geen database nodig hebben
   (deterministische keuze, palet en het atelier-sjabloon voor een concept).
   Puur data + functies; de runtime woont in index.js en aiwerk.js. */

/* DIT HEETTE HIER `CATEGORIEEN`, EN DAT WAS EEN BOTSING IN HET KLEIN.

   De andere drie ontwerpdomeinen (architect, hardwarelab, studio) noemen hun
   vakgebied `DISCIPLINES`; dit noemde precies hetzelfde `CATEGORIEEN`. Dezelfde
   rol, een andere naam -- gevonden bij het handwerk aan de vier domeinen
   (BEWIJSMACHINE.md par. 3). En het was geen smaakkwestie: `CATEGORIEEN` droeg
   in dit huis negen betekenissen (app-, voertuig-, kleding-, risicocategorieen
   en vijf andere), terwijl `DISCIPLINES` er precies een draagt op vier plekken.
   De hernoeming haalt dit dus uit een botsing en zet het in een familie.

   WAT NIET IS MEEGEGAAN, en dat is een keuze en geen vergeetachtigheid: het
   VELD op een ontwerp heet nog steeds `categorie`, en het antwoord van de
   server nog steeds `categorieLabel` en `categorieen`. Daar hangt een scherm
   aan (public/apps/kantoren-collectieboek.js leest `o.categorieLabel ||
   o.categorie`) en er ligt data mee opgeslagen. Een naam in de code is gratis
   te veranderen; een naam op de draad is dat niet. */
const DISCIPLINES = {
  kleding:      { label: 'Couture & tailoring', icon: 'mode' },
  tassen:       { label: 'Maroquinerie', icon: 'tas' },
  horloges:     { label: 'Haute horlogerie', icon: 'juweel' },
  schoenen:     { label: 'Bottier', icon: 'mode' },
  hoeden:       { label: 'Millinery', icon: 'garderobe' },
  sieraden:     { label: 'Haute joaillerie', icon: 'juweel' },
  zonnebrillen: { label: 'Eyewear', icon: 'mode' },
  lederwaren:   { label: 'Kleinlederwaren', icon: 'tas' }
};
const STATUS = ['schets', 'ontwikkeling', 'prototype', 'monster', 'productie', 'archief'];

// een gedempt palet (naam -> hex); quiet luxury, geen felle tinten
const PALET = {
  'inkt-navy': '#1E2A38', 'houtskool': '#2B2B2B', 'kameel': '#C19A6B', 'ivoor': '#F2EBDD',
  'mos': '#4A5340', 'bordeaux': '#5E1F2D', 'steengrijs': '#8A867E', 'cognac': '#8B5A2B',
  'antraciet': '#33363B', 'crème': '#E8E0D0', 'oxbloed': '#4A1C24', 'salie': '#9CA88F',
  'nachtblauw': '#141A2A', 'taupe': '#7A6E63', 'goudoker': '#B08D3A', 'porselein': '#EDE7DD'
};
const PALET_NAMEN = Object.keys(PALET);

const BANK = {
  kleding: {
    silhouet: ['strak getailleerd tweedelig', 'gedeconstrueerde overjas', 'vloeiende bias-cut japon', 'oversized atelier-blazer', 'dubbelrijs kolbert met scherpe schouder'],
    materiaal: ['dubbelgetwijnde kasjmier', 'wol-mohair uit Biella', 'matte zijde-duchesse', 'gewassen Belgisch linnen', 'Sea Island-katoen', 'gebrushte alpaca'],
    detail: ['met de hand gerolde zoom', 'onzichtbare pat-sluiting', 'ingezette paspelzakken', 'schouderwerk in canvas opgebouwd', 'passepoil in contrasttoon'],
    afwerking: ['volledig gevoerd in habotai-zijde', 'kraag met de hand ingezet', 'knopen van buffelhoorn']
  },
  tassen: {
    silhouet: ['gestructureerde top-handle', 'zachte hobo met plooival', 'architecturale bucket', 'platte enveloppe-clutch', 'compacte crossbody op maat'],
    materiaal: ['volnerf boxcalf', 'geborsteld nappa', 'saffiano-kalfsleer', 'suède van hertenleer', 'Alligator mississippiensis (gecertificeerd)'],
    detail: ['met de hand gezadelstikte randen', 'verzonken magneetsluiting', 'beslag in geborsteld palladium', 'monogram in blindpreeg', 'draagriem met rolgesp'],
    afwerking: ['randen in acht lagen gelakt', 'voering in suède-alcantara', 'onderkant op metalen studs']
  },
  horloges: {
    silhouet: ['ultradun dresshorloge', 'geïntegreerde sportkast', 'kussenvormige kast', 'skelet met open werk', 'chronograaf met twee tellers'],
    materiaal: ['geborsteld titanium graad 5', '18k Sedna-goud', 'gepolijst platina 950', 'satijngeborsteld staal', 'keramiek in kooktechniek'],
    detail: ['met de hand geguillocheerde wijzerplaat', 'gefacetteerde uurindexen', 'saffierglas met dubbele AR-coating', 'kroon met cabochon', 'transparante bodem'],
    afwerking: ['handmatig gefinishte bruggen met Genève-strepen', 'gebloemde schroefkoppen', 'geschuurde flanken']
  },
  schoenen: {
    silhouet: ['Oxford met gladde neus', 'ongevoerde loafer', 'Chelsea-boot op maat', 'sculpturale pump', 'derby met three-eyelet'],
    materiaal: ['Blake-genaaid boxcalf', 'patina-kalfsleer', 'suède uit Toscane', 'cordovan van de schaduwzijde', 'exotisch python (gecertificeerd)'],
    detail: ['met de hand opgebouwde patina', 'dichte broguering', 'gestikte mocassin-neus', 'bies in contrastkleur', 'ingelegde hielkap'],
    afwerking: ['volleren zool met eikenschors gelooid', 'gebeeldhouwde houten hak', 'ingelegde messing pin']
  },
  hoeden: {
    silhouet: ['brede fedora', 'strakke cloche', 'panama met snap-brim', 'sculpturale cocktailhoed', 'baret in wolvilt'],
    materiaal: ['fur felt van haas', 'Panama Montecristi-vlecht', 'geschoren bever-velours', 'geperst kasjmiervilt'],
    detail: ['grosgrain-lint met de hand gestrikt', 'met stoom gevormde bol', 'gebrande rand', 'binnenband van leer', 'veer met de hand ingezet'],
    afwerking: ['rand met de hand afgebiesd', 'gestempeld gouden logo binnenin']
  },
  sieraden: {
    silhouet: ['rivière-collier', 'cocktailring met hoofdsteen', 'oorsieraad in cascade', 'gearticuleerde armband', 'sautoir met kwast'],
    materiaal: ['18k witgoud', '18k rozégoud', 'zwart geëmailleerd goud', 'platina 950'],
    detail: ['oud-mine geslepen diamant', 'Colombiaanse smaragd', 'Akoya-parels', 'onzichtbare zetting', 'pavé van briljant'],
    afwerking: ['met de hand gezette stenen', 'satijnmat geborsteld goud', 'gegraveerde binnenzijde']
  },
  zonnebrillen: {
    silhouet: ['pantos-rondbril', 'oversized cat-eye', 'strakke pilotenbril', 'hoekige navigator', 'onzichtbare rimless'],
    materiaal: ['acetaat uit Mazzucchelli', 'titanium scharnieren', 'goud-PVD montuur', 'gebüffeld hoorn'],
    detail: ['5-baraaj scharnier', 'mineraalglazen', 'verzonken logo op de tempel', 'zadelbrug', 'gepolariseerde lens'],
    afwerking: ['met de hand gepolijst front', 'tempels met kern van staal']
  },
  lederwaren: {
    silhouet: ['langwerpige portefeuille', 'compacte kaarthouder', 'zip-around etui', 'sleutelhoes', 'reispochette'],
    materiaal: ['volnerf boxcalf', 'saffiano-kalfsleer', 'geborsteld nappa', 'geitensuède'],
    detail: ['met de hand gezadelstikt', 'blindgepreegd monogram', 'verzonken drukknoop', 'binnenvakken in contrastkleur'],
    afwerking: ['randen in lagen gelakt', 'voering in kalfsleer']
  }
};

const ONDERDELEN = {
  kleding: ['Buitenstof', 'Voering', 'Kraag & revers', 'Knopen', 'Naadafwerking'],
  tassen: ['Body', 'Voering', 'Handvat/riem', 'Sluiting', 'Beslag'],
  horloges: ['Kast', 'Wijzerplaat', 'Uurwerk', 'Band', 'Kroon & glas'],
  schoenen: ['Bovenwerk', 'Voering', 'Zool', 'Hiel', 'Sluiting'],
  hoeden: ['Bol', 'Rand', 'Binnenband', 'Lint', 'Afwerking'],
  sieraden: ['Montuur', 'Hoofdsteen', 'Zetting', 'Sluiting', 'Gravure'],
  zonnebrillen: ['Front', 'Lenzen', 'Tempels', 'Scharnieren', 'Neusbrug'],
  lederwaren: ['Body', 'Voering', 'Vakindeling', 'Sluiting', 'Preeg']
};

/* hash, kies en palet stonden hier byte voor byte gelijk aan die in de drie
   andere ontwerpbanken; ze wonen nu in kern/ontwerpbank.js. Het PALET blijft
   hier, want dat is wat dit domein onderscheidt. Zie de kop daar. */
const { hash, kies, paletUit } = require('../ontwerpbank');
const palet = (seed, n) => paletUit(PALET, seed, n);

// het atelier-sjabloon: een deterministisch concept uit de bank (val-terug voor de AI)
function maakConcept(categorie, brief, naam, scho) {
  const b = BANK[categorie] || BANK.tassen;
  const seed = hash((categorie || '') + '|' + (naam || '') + '|' + (brief || ''));
  const kleuren = palet(seed, 3);
  const materialen = kies(b.materiaal, seed >>> 2, 2);
  const details = kies(b.detail, seed >>> 4, 3);
  const silhouet = b.silhouet[seed % b.silhouet.length];
  const afwerking = b.afwerking[(seed >>> 6) % b.afwerking.length];
  const insp = scho(brief, 120) || 'de stilte van luxe';
  const verhaal = 'Een ' + silhouet + ' in ' + materialen[0] + ', gedragen door ' + kleuren[0].naam +
    ' en ' + kleuren[1].naam + '. Geboren uit "' + insp + '": ingetogen, zeker van zichzelf, zonder een enkel overbodig gebaar. ' +
    'Het is een stuk dat fluistert in plaats van roept, en juist daardoor blijft hangen.';
  return { silhouet, materialen, kleuren, details, afwerking, verhaal };
}

module.exports = { DISCIPLINES, STATUS, PALET, PALET_NAMEN, BANK, ONDERDELEN, hash, kies, palet, maakConcept };
