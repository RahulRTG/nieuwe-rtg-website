#!/usr/bin/env node
/* DE STRATEEG: speelt Magnaat honderden keren uit en kijkt of er EEN antwoord is.

   `scripts/magnaat-balans.js` meet een momentopname per sector -- verdient een
   goed geplaatste zaak zichzelf terug. Dat is nodig en niet genoeg. De duurste
   fout in een economische simulatie is niet dat een getal scheef staat maar dat
   er een TRIVIALE STRATEGIE bestaat die altijd wint, want dan is er niets te
   kiezen en is het spel klaar zodra iemand hem vindt.

   DAT IS HIER ECHT GEBEURD. In de eerste versie van de economie won de speler
   die MINDER personeel aannam en GEEN onderhoud deed. Alle zeven sectoren
   draaiden verlies en niets doen was de beste zet. Geen enkele toets zag dat,
   en de balansmeter ook niet: die kijkt naar EEN zaak op EEN moment. Het bleek
   pas door een campagne uit te spelen.

   WAT DIT SCRIPT DOET. Het laat strategieprofielen tegen elkaar spelen -- elk
   profiel is een speler die elke maand volgens een vaste stijl handelt -- over
   veel verschillende startposities, en telt wie er wint. Daarna stelt het EEN
   vraag: domineert er een?

   WAAR DE VARIATIE VANDAAN KOMT, want dat is een eerlijke vraag bij een motor
   die met opzet geen dobbelsteen heeft. Niet uit toeval: uit STARTPOSITIE. Elk
   duel wordt over een reeks startplekken gespeeld (andere zone, ander kavel in
   de straat, andere volgorde van de twee spelers). Dat is precies de variatie
   die er in het echt ook is, en het houdt de uitkomst herhaalbaar: dezelfde
   opstelling geeft altijd dezelfde partij.

   WAT HET NIET IS: een bewijs dat het spel goed is. Het is een bewijs dat er
   geen enkelvoudig recept is dat altijd wint, en dat is iets kleiners en
   controleerbaars. Balans tussen profielen die allebei redelijk zijn blijft
   een smaakoordeel.

   Gebruik: node scripts/magnaat-strateeg.js [aantal-startposities]  */
'use strict';
const { kaart } = require('../server/kern/spellen/magnaat/kaart');
const { SECTOREN } = require('../server/kern/spellen/magnaat/sectoren');
const { basisvraag, drukFactor } = require('../server/kern/spellen/magnaat/vraag');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {}
});

/* Hoeveel er altijd in kas blijft, en hoe klein een nieuwe zaak mag zijn ten
   opzichte van de vraag ter plekke. Deze twee staan HIER en niet in de
   profielen, en dat is een correctie: eerst had elk profiel zijn eigen
   kasdrempel ("open als er meer dan 200.000 staat"), en toen mat dit script
   niet de stijlen maar die drempels. Een sector met dure kavels zette al zijn
   geld aan het werk, een sector met goedkope kavels hield elke ronde een ton
   dood kapitaal aan -- en dat verschil zag eruit als een sector die won.
   Dezelfde regel voor iedereen; het profiel gaat over WAT en WAAR, niet over
   rekenen. */
const BUFFER = 40000;
/* De kleinste zaak die het openen waard is, in eenheden. Bewust een ABSOLUUT
   getal en niet een fractie van de ideale maat: met een fractie kon een dure
   sector nooit beginnen. Logistiek heeft op een goed kavel dertig voertuigen
   nodig -- 732.000 -- en met een drempel van 55% moest een speler dus 443.000
   sparen voordat hij uberhaupt iets mocht openen. Startkapitaal is 250.000, dus
   het mobility-profiel deed letterlijk NIETS en eindigde naast `niets doen` in
   de uitslag. Kleiner beginnen dan de vraag is bovendien niet dom maar juist de
   efficiente stand: je zit vol en laat vraag liggen voor een ander. */
const KLEINSTE = 4;

/* De profielen. Elk krijgt elke spelmaand de kans om te handelen; wat het doet
   is de STIJL. Ze zijn met opzet simpel -- een profiel dat zelf slim rekent zou
   meten hoe goed die berekening is en niet hoe het spel in elkaar zit. */
const PROFIELEN = {
  /* De ondergrens, en de belangrijkste regel van dit hele script: wie niets
     doet hoort te verliezen. Zolang dit profiel wint, is er geen spel. */
  niets: { naam: 'niets doen', zones: [], doe() {} },

  passief: {
    naam: 'een zaak en verder afwachten', zones: ['boulevard'],
    doe(s) { if (!s.mijn.length) s.open('horeca'); }
  },
  groei: {
    naam: 'agressieve groei', zones: ['boulevard', 'centrum', 'station', 'sluizen'],
    doe(s) {
      // altijd blijven openen zolang er geld is; niets in reserve houden
      if (!s.open(s.beursSector())) for (const v of s.mijn) s.uitbreiden(v, 4);
    }
  },
  voorzichtig: {
    naam: 'lage schuld', zones: ['centrum', 'station'],
    doe(s) {
      // pas uitbreiden als er een half jaar vaste lasten in kas zit
      // pas een tweede zaak als er ruim een jaar vaste lasten in kas staat
      if (!s.mijn.length) return s.open('retail');
      if (s.geld > 400000) s.open(s.beursSector());
    }
  },
  service: {
    naam: 'hoge service', zones: ['boulevard', 'station'],
    doe(s) {
      if (!s.mijn.length) return s.open('hotel');
      for (const v of s.mijn) {
        s.beleid(v, { prijs: 'hoog', onderhoud: Math.round(v.omvang * 30) });
        if (v.gemist > 0) s.beleid(v, { personeel: v.personeel + 1 });
      }
      s.open('hotel');
    }
  },
  zuinig: {
    naam: 'goedkoop personeel', zones: ['centrum', 'haven'],
    doe(s) {
      if (!s.mijn.length) return s.open('retail');
      for (const v of s.mijn) s.beleid(v, { prijs: 'laag', personeel: 1 });
      s.open('retail');
    }
  },
  onderhoud: {
    naam: 'zwaar onderhoud', zones: ['boulevard', 'centrum'],
    doe(s) {
      if (!s.mijn.length) return s.open('horeca');
      for (const v of s.mijn) s.beleid(v, { onderhoud: Math.round(v.omvang * 34) });
      s.open('horeca');
    }
  },
  verwaarlozen: {
    naam: 'geen onderhoud', zones: ['boulevard', 'centrum'],
    doe(s) {
      if (!s.mijn.length) return s.open('horeca');
      for (const v of s.mijn) s.beleid(v, { onderhoud: 0 });
      s.open('horeca');
    }
  },
  horeca: {
    naam: 'horeca-focus', zones: ['boulevard', 'sluizen', 'centrum'],
    doe(s) { s.open('horeca'); }
  },
  mobility: {
    naam: 'mobility-focus', zones: ['terrein', 'haven', 'sluizen'],
    doe(s) { s.open('logistiek'); }
  },
  markt: {
    naam: 'marketing en volume', zones: ['centrum', 'boulevard'],
    doe(s) {
      if (!s.mijn.length) return s.open('retail');
      for (const v of s.mijn) s.beleid(v, { prijs: 'laag', marketing: 6000 });
      s.open('retail');
    }
  }
};
const NAMEN = Object.keys(PROFIELEN);

/* Het gereedschap dat een profiel krijgt. Bewust smal: openen, uitbreiden en
   beleid. Een profiel dat de kaart mag doorzoeken zou meten hoe goed het zoekt. */
function gereedschap(m, potje, mij, profiel, offset) {
  const k = kaart(potje.staat.stad);
  const st = potje.staat;
  return {
    get geld() { return st.geld[mij]; },
    get mijn() {
      const laatste = (st.laatste[mij] || {}).regels || [];
      return (st.vestigingen[mij] || []).map(v =>
        Object.assign({}, v, { gemist: (laatste.find(r => r.id === v.id) || {}).gemist || 0 }));
    },
    // de sector die bij de zone van dit profiel hoort, zonder te rekenen
    beursSector() {
      const zone = k.zone.get(profiel.zones[st.vestigingen[mij].length % profiel.zones.length]);
      return zone.sectoren.find(x => SECTOREN[x]) || 'retail';
    },
    /* OPENEN GEBEURT OP MAAT: zo groot als de vraag op dat kavel. Dat is geen
       strategie maar basiscompetentie -- de eigenschappen van een kavel staan
       gewoon op het scherm, en een speler die een zaak van dertig stoelen op een
       plek voor tien zet, meet niet zijn stijl maar zijn rekenwerk.

       Dit is een correctie. Eerst bouwde elk profiel een VAST aantal, en toen
       won `afwachten` 95% van zijn duels: uitbreiden was straf, want elke
       volgende zaak stond te groot op een minder goed kavel. Dat mat niet of
       groeien loont maar of de profielen konden rekenen. */
    open(sector) {
      const zone = profiel.zones[(st.vestigingen[mij].length + offset) % profiel.zones.length];
      const vrij = k.kavels.filter(x => x.zone === zone && !st.kavelBezet[x.id]);
      if (!vrij.length) return false;
      const kavel = vrij[(offset * 3) % vrij.length];
      const sec = SECTOREN[sector];
      /* DE BUREN TELLEN MEE. Wie een zaak op de vraag bouwt zonder te kijken
         hoeveel van hetzelfde er al in die buurt staat, zet zijn tiende
         restaurant even groot neer als zijn eerste -- en dan staat het voor
         driekwart leeg. Dat is geen strategie maar niet kijken, en het maakte
         de profielen die het HARDST groeiden ook de profielen die zichzelf
         kapot bouwden. Wie er al zitten is publieke informatie; een speler ziet
         het door de straat te lopen. */
      const buren = Object.values(st.vestigingen).flat()
        .filter(v => v.sector === sector && k.kavel.get(v.kavel).zone === zone).length;
      const vraag = basisvraag(k, kavel, sector, st.maand) * sec.markt * drukFactor(buren + 1);
      const opMaat = Math.max(1, Math.round(vraag / sec.perMaand));
      /* Bouw zo groot als de vraag, of zoveel als er na de buffer betaalbaar is.
         Kleiner dan `KLEINSTE` bouwen we niet -- dan zijn de vaste lasten groter
         dan de zaak. */
      const betaalbaar = Math.floor((st.geld[mij] - BUFFER) / sec.bouw);
      const omvang = Math.min(opMaat, betaalbaar);
      if (omvang < Math.min(KLEINSTE, opMaat)) return false;
      m.spel.zet(potje, mij, { actie: 'open', kavel: kavel.id, sector, omvang });
      return true;
    },
    uitbreiden(v, erbij) { m.spel.zet(potje, mij, { actie: 'uitbreiden', id: v.id, erbij }); },
    beleid(v, wat) { m.spel.zet(potje, mij, Object.assign({ actie: 'beleid', id: v.id }, wat)); }
  };
}

/* Een campagne: twee profielen, een startpositie, zesendertig maanden. Geeft de
   EINDSTAND terug -- `duel` maakt er een winnaar van, en wie wil weten hoe hard
   een profiel op zichzelf groeit heeft de stand nodig en niet de uitslag. */
function campagne(aNaam, bNaam, offset, maanden = 36) {
  const m = maakMagnaat();
  const potje = { id: 'p', soort: 'magnaat', spelers: ['a', 'b'], teams: [0, 1, 0, 1, 0, 1],
    modus: 'vrij', status: 'bezig', beurt: 0, winnaar: null,
    variant: { vorm: 'economie', stad: 'IJmuiden', duur: 'quick' } };
  m.spel.init(potje);
  const gereed = {
    a: gereedschap(m, potje, 'a', PROFIELEN[aNaam], offset),
    b: gereedschap(m, potje, 'b', PROFIELEN[bNaam], offset + 2)
  };
  for (let maand = 0; maand < maanden && !potje.staat.klaar; maand++) {
    PROFIELEN[aNaam].doe(gereed.a, maand);
    PROFIELEN[bNaam].doe(gereed.b, maand);
    potje.staat.gerekendTot -= potje.staat.maandMs;
    m.eco.bijrekenen(potje);
  }
  return m.eco.eindstand(potje);
}

/* De uitslag: wie won, of null bij gelijkspel. */
function duel(aNaam, bNaam, offset, maanden = 36) {
  const stand = campagne(aNaam, bNaam, offset, maanden);
  if (stand.length > 1 && stand[0].vermogen === stand[1].vermogen) return null;
  return stand[0].codenaam === 'a' ? aNaam : bNaam;
}

/* Het toernooi: iedereen tegen iedereen, over een reeks startposities. */
function toernooi(startposities = 6, maanden = 36) {
  const winst = Object.fromEntries(NAMEN.map(n => [n, 0]));
  const duels = Object.fromEntries(NAMEN.map(n => [n, 0]));
  let gespeeld = 0;
  for (let i = 0; i < NAMEN.length; i++)
    for (let j = i + 1; j < NAMEN.length; j++)
      for (let o = 0; o < startposities; o++) {
        const w = duel(NAMEN[i], NAMEN[j], o, maanden);
        duels[NAMEN[i]]++; duels[NAMEN[j]]++; gespeeld++;
        if (w) winst[w]++;
      }
  return { winst, duels, gespeeld,
    aandeel: Object.fromEntries(NAMEN.map(n => [n, duels[n] ? winst[n] / duels[n] : 0])) };
}

/* WAT DIT SCRIPT HARD AFKEURT, en wat het alleen MELDT. Dat onderscheid is er
   met opzet, want ze zijn niet van dezelfde soort.

   HARD (`keur`) zijn de dingen die het spel kapot maken, en het zijn allemaal
   dingen die hier echt zijn misgegaan:
     - NIETS DOEN wint. Dan is er geen spel. Dat was de eerste versie.
     - AFWACHTEN wint van de actieve profielen. Dan is groeien straf, en dat was
       de tweede versie.
     - er is geen verscheidenheid: minder dan vier profielen halen de helft.
       Dan is er wel een winnaar maar geen keuze.
   Deze drie staan als toets in test/spelmagnaat.test.js.

   ZACHT (`signalen`) is de vraag of een profiel te ver voor ligt. Dat is een
   BEVINDING en geen fout: een sectorfocus hoort een generalist te kunnen
   verslaan, en hoeveel precies is een smaakoordeel dat met de volgende fase
   verandert. Het staat in de uitvoer zodat je het ziet, en niet in een toets
   die dan een smaakoordeel zou vastzetten.

   WAT ER VANDAAG UIT KOMT, eerlijk opgeschreven: mobility-focus wint bijna al
   zijn duels en horeca-focus het merendeel. Vier ijkingen hebben dat van 100%
   naar iets minder gebracht en de rest van het veld dicht bij elkaar; wat
   overblijft is dat een speler die zich op EEN sector stort het beter doet dan
   een die spreidt. In een duel van twee op een kaart met 144 kavels is er
   namelijk geen schaarste: ze lopen elkaar nooit tegen het lijf. Dat verandert
   zodra er contracten en veilingen zijn (fase B) -- dan raken spelers elkaar
   ook als ze in andere buurten zitten. Het staat als open punt in GAMEHALL.md
   en niet als opgelost. */
const GRENS_HOOG = 0.80, HELFT = 0.50, MIN_VARIATIE = 4;

// de harde regels: hier hoort de bouw op te vallen
function keur(uit) {
  const klachten = [];
  const actief = NAMEN.filter(n => n !== 'niets' && n !== 'passief');
  if (uit.aandeel.niets > 0.25)
    klachten.push('NIETS DOEN wint ' + Math.round(uit.aandeel.niets * 100) + '% -- dan is er geen spel');
  const besteActief = Math.max(...actief.map(n => uit.aandeel[n]));
  if (uit.aandeel.passief >= besteActief)
    klachten.push('AFWACHTEN doet het net zo goed als het beste actieve profiel -- dan is groeien straf');
  const levensvatbaar = actief.filter(n => uit.aandeel[n] >= HELFT).length;
  if (levensvatbaar < MIN_VARIATIE)
    klachten.push('maar ' + levensvatbaar + ' profielen halen de helft; er is een winnaar maar geen keuze');
  return klachten;
}

// de zachte: wel laten zien, niet op laten vallen
function signalen(uit) {
  return NAMEN.filter(n => n !== 'niets' && n !== 'passief' && uit.aandeel[n] > GRENS_HOOG)
    .map(n => n + ' ligt ver voor (' + Math.round(uit.aandeel[n] * 100) + '%)');
}

if (require.main === module) {
  const n = Number(process.argv[2]) || 6;
  const uit = toernooi(n);
  console.log('Magnaat-strateeg: ' + uit.gespeeld + ' campagnes, ' + NAMEN.length + ' profielen, ' + n + ' startposities\n');
  const rij = NAMEN.slice().sort((a, b) => uit.aandeel[b] - uit.aandeel[a]);
  for (const naam of rij)
    console.log(String(Math.round(uit.aandeel[naam] * 100)).padStart(3) + '%  ' +
      naam.padEnd(13) + uit.winst[naam] + '/' + uit.duels[naam] + '   ' + PROFIELEN[naam].naam);
  const sig = signalen(uit);
  if (sig.length) console.log('\nSIGNAAL (bevinding, geen fout):\n  ' + sig.join('\n  '));
  const klachten = keur(uit);
  console.log('\n' + (klachten.length ? 'AFGEKEURD:\n  ' + klachten.join('\n  ')
    : 'niets doen verliest, afwachten verliest, en er zijn meerdere levensvatbare stijlen'));
  if (klachten.length) process.exitCode = 1;
}

module.exports = { PROFIELEN, NAMEN, campagne, duel, toernooi, keur, signalen, GRENS_HOOG, HELFT, MIN_VARIATIE };
