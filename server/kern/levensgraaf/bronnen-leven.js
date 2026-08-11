/* Levensgraaf, deelbestand "bronnen-leven": talenten en interesses.
   LEVEN.md par. 1.2 -- de graaf groeit van "wat u heeft" naar "wat er in uw
   leven speelt". De derde bron van die opdracht, de bijdrage, staat in
   ./bronnen-leven-bijdrage.js; samen passen ze niet onder de tien KB.

   WAT DEZE BRONNEN ANDERS MAAKT DAN DE ZEVENTIEN DIE ER AL STONDEN. Alles wat
   tot nu toe in de graaf zat gaat over SPULLEN en over DATUMS: een polis, een
   keuring, een vlucht, een fles. Deze gaan over de MENS zelf. Een paspoort dat
   verloopt is hooguit lastig; een talentsignaal dat bij de verkeerde kant
   terechtkomt kan een deur dichtdoen die daarna niet meer opengaat. Het werk
   zit hier dus niet in de data -- die stond er al -- maar in twee velden:
   `gevoelig` en `deel`.

   WAAROM ELKE KNOOP HIER MET DE HAND 'lid' DRAAGT. knoop() in ./graaf.js vult
   `deel` met 'rechterhand' zodra een bron het veld weglaat. Bij een keuring is
   dat de juiste standaard: daar is de Rechterhand voor. Hier is een vergeten
   veld geen leegte maar een lek -- dan reist het talent van een mens
   standaard mee naar iemand anders. Het veld staat daarom in elke K()
   hieronder, en test/levensgraafleven.test.js zakt zodra het verschuift.

   WAAROM DE POORT NIET NAAR DE LEEFTIJD KIJKT. LEVEN.md par. 2.1 vraagt om
   bescherming van de minderjarige, en de verleiding is een tak: is het lid
   jonger dan achttien, dan strenger. Die tak komt er niet, om twee redenen.
   Ten eerste kent deze laag de leeftijd niet en hoort hij hem niet te vragen
   (kern/paspoort.js: wie alleen hoeft te waarschuwen, krijgt alleen de datum).
   Ten tweede, en dat weegt zwaarder: een tak kan verkeerd om staan, en de dag
   dat hij dat doet lekt precies het geval waarvoor hij bestond. Een regel die
   voor iedereen geldt kan niet verkeerd om staan. Dus: vertrouwelijk en alleen
   het lid, ook voor een volwassene. Dat is strenger dan par. 2.1 vraagt, en
   dat mag: par. 2.2 verbiedt VERKLEINEN van mogelijkheden, niet van kijkers.

   EN NIET 'besloten', HOEWEL graaf.js DAN ZELF 'lid' ZOU AFDWINGEN. Drie is in
   ./hulp.js het dak van gezondheid en nalatenschap. Alles wat gevoelig voelt
   naar dat dak tillen maakt "besloten" een woord zonder betekenis, en dan
   beschermt het de twee kamers niet meer waarvoor het is gemaakt. De poort
   staat hier met de hand, en er staat een toets onder die hem vasthoudt.

   GEEN VERVALDATUM, NOOIT. Een talent of een interesse draagt geen `vervalt`,
   en dat is een besluit en geen omissie: alles met een datum komt in de
   Control Tower (./termijnen.js) en wordt daar iets wat AANDACHT VRAAGT. Zodra
   "je tekent graag" naast een verlopen verzekering in hetzelfde venster staat,
   is de uitnodiging een opdracht geworden. Het werkwoord van deze wereld is
   openen (LEVEN.md par. 2.2), en een deadline opent niets.

   WAT DE DOORLOOP KOST. db.data.leren is EEN lijst voor het hele platform, dus
   dit is een doorloop over alles wat er ooit is geleerd -- zelfde prijs en
   zelfde reden als de boekingen in ./bronnen-platform.js. Er staat hier bewust
   GEEN dak op het aantal knopen, want de schrijvende kant grendelt al:
   kern/leren weigert een eenentwintigste project per maker en een
   eenenvijftigste lijst per eigenaar, en de cv-bouwer houdt vijftien
   vaardigheden. Het aantal knopen is dus door de bron zelf begrensd; alleen de
   doorloop is dat niet. Krijgt de leerlaag ooit een index per persoon, dan
   hoort die hier gebruikt te worden.

   Gemount via ./bronnen.js. */
'use strict';

const H = require('./hulp');
const { VERTROUWELIJK, lijst, obj } = H;

/* De leerlaag van de RTFoundation (kern/leren), gelezen zonder hem aan te
   maken. Dezelfde reden als dossierVan() in ./graaf.js: wie de graaf opvraagt
   hoort geen lege takken in de database te schrijven. */
const leerlaag = (db) => obj(db && db.data && db.data.leren);

const LEVEN = [

  /* ---- Talenten: wat iemand MAAKT, en wat hij zelf zegt te kunnen ---- */
  { kamer: 'talenten', knopen(l, K, ctx) {
    const db = ctx && ctx.db, key = ctx && ctx.key;
    if (!db || !key) return [];
    const uit = [];

    /* 1. De projecten uit de leerlaag: een werkstuk, een spreekbeurt, een
       knutsel. Alleen wat deze mens ZELF begon (`door`), en niet de projecten
       waar hij aan meedoet.

       Dat onderscheid is de hele reden dat deze regel er staat. routes/leren.js
       bedient twee kanten op EEN motor: een RTG-lid op zijn sleutel en een
       RTF-gezinsprofiel op zijn handle. In een gedeeld project zit dus vaak een
       kind. Zou ik hier `p.leden.includes(key)` schrijven, dan komt de titel
       van het project van dat kind in het dossier van een volwassene te staan
       -- en dat is precies wat LEVEN.md par. 2.1 verbiedt: over een
       minderjarige wordt niet verzameld, voor hem wordt bewaard.

       En van het project komt alleen de TITEL mee. De medeleden (codenamen van
       anderen), de taken en de notities blijven waar ze horen; de graaf hoeft
       alleen te weten DAT dit er is. */
    for (const p of Object.values(obj(leerlaag(db).projecten))) {
      if (!p || p.door !== key || !p.titel) continue;
      uit.push(K({ id: 'leerproject:' + p.id, soort: 'talent', naam: p.titel,
        kamer: 'talenten', bron: 'Leren', gevoelig: VERTROUWELIJK, deel: 'lid' }));
    }

    /* 2. De vaardigheden uit het eigen cv (db.data.cvs, de cv-bouwer die ook
       een gratis lid heeft). Dit is de enige plek in dit huis waar een mens met
       zoveel woorden opschrijft wat hij kan.

       DAT HET CV VOOR EEN WERKGEVER IS BEDOELD, MAAKT DE GRAAF GEEN TWEEDE WEG
       DAARHEEN. Solliciteren loopt via routes/member/werk.js, waar het lid per
       keer een knop indrukt en zelf kiest bij wie. Wat hier ligt reist niet
       mee: 'lid'. Zou dit op 'kantoor' staan, dan zou een concierge iemands
       vaardigheden kunnen lezen zonder dat die daar ooit ja op zei, en dan is
       de graaf een sollicitatiekanaal geworden dat niemand heeft geopend. */
    lijst(obj(obj(db.data && db.data.cvs)[key]).skills).forEach((v, i) => {
      const naam = String(v == null ? '' : v).trim();
      if (!naam) return;
      uit.push(K({ id: 'talent:cv' + i, soort: 'talent', naam, kamer: 'talenten',
        bron: 'Cv', gevoelig: VERTROUWELIJK, deel: 'lid' }));
    });

    return uit;
  } },

  /* ---- Interesses: waar iemand uit zichzelf tijd in stopt ---- */
  { kamer: 'interesses', knopen(l, K, ctx) {
    const db = ctx && ctx.db, key = ctx && ctx.key;
    if (!db || !key) return [];
    const uit = [];

    /* De overhoorlijsten uit de leerlaag. Een lijst heet "Franse woordjes" of
       "Hoofdsteden van Europa", en die NAAM is het hele signaal: hier stopt
       iemand uit zichzelf tijd in. Verder komt er niets mee, en die drie
       weglatingen zijn stuk voor stuk een besluit:

       - DE PAREN NIET. Dat is de inhoud van iemands huiswerk, en de graaf heeft
         er niets aan. Wat een laag niet nodig heeft, hoort hij niet te dragen
         (zelfde regel als het paspoortnummer in ./bronnen-basis.js).
       - `beste` NIET, de hoogste score op die lijst. Dat is een cijfer over een
         mens, en LEVEN.md par. 2.4 laat er geen enkele binnen: een getal dat
         eenmaal in de graaf staat, staat een join verwijderd van een
         rangschikking. Wie ooit wil weten hoe goed het gaat, vraagt het de
         leerlaag zelf, waar het bij de lijst hoort.
       - DE SCHRIJFSELS NIET (db.data.leren.schrijfsels). De tekst is priveproza
         van soms zeshonderd woorden. En de OPDRACHT erboven wordt per
         leeftijdsgroep gekozen (kern/leren/schrijven.js), dus die verraadt de
         leeftijdsband van de schrijver. Een interessesignaal dat de leeftijd
         meelevert is precies het signaal dat par. 2.1 niet wil hebben. */
    for (const li of Object.values(obj(leerlaag(db).lijsten))) {
      if (!li || li.van !== key || !li.naam) continue;
      uit.push(K({ id: 'interesse:' + li.id, soort: 'interesse', naam: li.naam,
        kamer: 'interesses', bron: 'Leren', gevoelig: VERTROUWELIJK, deel: 'lid' }));
    }

    return uit;
  } }
];

/* De bijdrage staat apart en gaat hier mee naar buiten, zodat ./bronnen.js
   maar EEN naam hoeft te kennen voor "de drie bronnen van LEVEN.md par. 1.2".
   Zelfde vorm als de concat onderaan ./bronnen.js. */
module.exports = LEVEN.concat(require('./bronnen-leven-bijdrage'));
