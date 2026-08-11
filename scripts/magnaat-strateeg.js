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
const { VRAAGFACTOR, KOSTENSTAND } = require('../server/kern/spellen/magnaat/prijsstand');
const { basisvraag, drukFactor } = require('../server/kern/spellen/magnaat/vraag');
const { MARKTPRIJS } = require('../server/kern/spellen/magnaat/handel');
const ONDERZOEK = require('../server/kern/spellen/magnaat/onderzoek');

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
    naam: 'hoge service', zones: ['boulevard', 'station'], prijs: 'hoog',
    doe(s) {
      if (!s.mijn.length) return s.open('hotel');
      for (const v of s.mijn) {
        s.beleid(v, { onderhoud: Math.round(v.omvang * 30) });
        if (v.gemist > 0) s.beleid(v, { personeel: v.personeel + 1 });
      }
      s.open('hotel');
    }
  },
  zuinig: {
    naam: 'goedkoop personeel', zones: ['centrum', 'haven'], prijs: 'laag',
    doe(s) {
      if (!s.mijn.length) return s.open('retail');
      for (const v of s.mijn) s.beleid(v, { personeel: 1 });
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
    /* Goedkoop EN adverteren. `prijs` staat op het profiel zodat er ook op die
       maat gebouwd wordt -- eerst stond hij alleen in `beleid`, en toen bouwde
       dit profiel op de vraag bij middenprijs en liet die panden vervolgens
       overlopen. Het won nul procent van zijn duels, en dat mat een zaak van de
       verkeerde maat en niet een strategie. */
    naam: 'marketing en volume', zones: ['centrum', 'boulevard'], prijs: 'laag',
    doe(s) {
      if (!s.mijn.length) return s.open('retail');
      // marketing naar rato van de zaak: een vast bedrag is voor een klein pand
      // een vermogen en voor een groot pand niets
      for (const v of s.mijn) s.beleid(v, { marketing: Math.round(v.omvang * 40) });
      s.open('retail');
    }
  },

  /* ---------- fase B: drie stijlen die om contracten draaien ----------
     Ze zijn er om EEN vraag te beantwoorden die het toernooi in fase A niet kon
     stellen: raken spelers elkaar nu ook als ze in andere buurten zitten? Een
     sectorfocus won toen bijna al zijn duels omdat er op 144 kavels geen
     schaarste is. Een leverancier die zich vol tekent heeft die luxe niet
     meer. */
  toelever: {
    naam: 'toeleverancier', zones: ['terrein', 'haven'],
    doe(s) {
      if (!s.mijn.length) return s.open('logistiek');
      // een groot deel van de vloot te koop zetten, onder de marktprijs
      for (const v of s.mijn) s.aanbieden(v, 0.6, 0.12);
      s.open('logistiek');
    }
  },
  keten: {
    naam: 'verticale integratie', zones: ['boulevard', 'terrein', 'centrum'],
    doe(s) {
      /* Eerst een afzetkant, dan je eigen toelevering ernaast. De vraag is of
         het loont om je toelevering zelf te bouwen in plaats van hem in te
         kopen -- en dat hoort een echte afweging te zijn en geen gratis winst. */
      const heeft = (sec) => s.mijn.some(v => v.sector === sec);
      if (!heeft('horeca')) return s.open('horeca');
      if (!heeft('logistiek')) return s.open('logistiek');
      if (!heeft('retail')) return s.open('retail');
      s.open('horeca');
    }
  },
  inkoper: {
    naam: 'scherp inkopen', zones: ['boulevard', 'centrum'],
    doe(s) {
      /* Geen eigen toelevering: alles bij een ander halen, zo scherp mogelijk.
         Het tegenbeeld van `keten`, en samen meten ze of maken of kopen een
         keuze is. Het aannemen zelf zit in het gereedschap, want een aanbod
         onder de marktprijs afslaan is geen stijl maar een rekenfout. */
      if (!s.mijn.length) return s.open('horeca');
      for (const v of s.mijn) s.beleid(v, { onderhoud: Math.round(v.omvang * 30) });
      s.open('horeca');
    }
  },

  /* ---------- onderzoek: twee stijlen die dezelfde vraag stellen ----------
     "Welke nieuwe strategie maakt deze feature mogelijk?" Voor onderzoek is dat
     antwoord: KLEIN BLIJVEN EN BETER WORDEN in plaats van groot worden. Een
     uitvinding werkt per vestiging, dus wie er vijf heeft betaalt vijf keer de
     uitrol; wie er twee heeft verdient hem twee keer terug en houdt geld over.
     Dat is een echte tegenkracht tegen `groei`, en het is de eerste stijl in
     dit toernooi die niet over kavels gaat.

     Ze staan er met z'n tweeen omdat een van de twee alleen niets bewijst.
     `uitvinder` doet het hele rondje (onderzoeken, uitrollen als het zich
     terugverdient, en dan afslanken); `laborant` onderzoekt wel maar rolt
     nooit uit. Als die tweede het net zo goed doet, is de uitrol decoratie; als
     hij onderaan eindigt, kost onderzoek geld tot je er iets mee doet -- en dat
     is precies de belofte uit de geldpompkeuring. */
  uitvinder: {
    naam: 'onderzoek en afslanken', zones: ['boulevard', 'centrum'],
    doe(s) {
      if (!s.mijn.length) return s.open('horeca');
      /* De efficientietak eerst: die verlaagt kosten en dat werkt op elke zaak.
         `meten` is de stam en verplicht -- dat is wat een boom een boom maakt. */
      s.onderzoeken(['energie', 'automatisering', 'keten', 'concept']);
      s.uitrollen();
      s.afslanken();
      s.open('horeca');
    }
  },
  laborant: {
    naam: 'alleen onderzoeken', zones: ['boulevard', 'centrum'],
    doe(s) {
      if (!s.mijn.length) return s.open('horeca');
      s.onderzoeken(['energie', 'automatisering', 'keten', 'concept']);
      s.open('horeca');
    }
  },
  /* DE MANAGER. Dezelfde stijl als `onderhoud`, maar de speler zet hem aan en
     kijkt niet meer om. De vraag die dit profiel beantwoordt is de balanseis van
     de beheerlaag: delegeren mag geen manier zijn om te WINNEN. Staat hij
     bovenaan, dan speelt het spel zichzelf; staat hij onderaan bij `niets doen`,
     dan is de dienst onbruikbaar. Hij hoort ertussenin -- beter dan wegkijken,
     slechter dan opletten. */
  afwezig: {
    naam: 'aanzetten en wegkijken', zones: ['boulevard', 'centrum'],
    doe(s, maand) {
      if (!s.mijn.length) return s.open('horeca');
      if (maand === 1) s.beheerAan();
      s.open('horeca');
    }
  },

  /* DE BLANCO. Dezelfde vorm als de twee hierboven -- dezelfde zones, dezelfde
     sector, dezelfde bovengrens van drie zaken -- en geen onderzoek. Zonder deze
     derde meet je niets: `uitvinder` tegen `laborant` zegt alleen of uitrollen
     helpt, niet of de hele tak de moeite waard is. */
  handwerk: {
    naam: 'dezelfde vorm, geen onderzoek', zones: ['boulevard', 'centrum'],
    doe(s) {
      if (!s.mijn.length) return s.open('horeca');
      s.open('horeca');
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
      /* DE PRIJSSTAND HOORT IN DE MAAT, en dat is een correctie op deze
         opstelling en niet op het spel. Eerst bouwde elk profiel op de vraag
         bij MIDDENprijs en zette daarna zijn prijs -- en dan meet je niet de
         prijsstrategie maar wat er gebeurt als je een pand van de verkeerde
         maat neerzet. Wie goedkoop wil zijn hoort GROTER te bouwen (er komen
         meer mensen), wie duur wil zijn KLEINER. Doe je dat niet, dan loopt de
         goedkope zaak over -- en dan zakt zijn kwaliteit, zijn reputatie en
         daarmee zijn vraag, in een spiraal die niets met de prijs te maken
         heeft. */
      const stand = profiel.prijs || 'midden';
      const vraag = basisvraag(k, kavel, sector, st.maand) * sec.markt * drukFactor(buren + 1) * VRAAGFACTOR[stand];
      const opMaat = Math.max(1, Math.round(vraag / sec.perMaand));
      /* Bouw zo groot als de vraag, of zoveel als er na de buffer betaalbaar is.
         Kleiner dan `KLEINSTE` bouwen we niet -- dan zijn de vaste lasten groter
         dan de zaak. */
      // de prijsstand zit OOK in de bouwsom (../server/kern/spellen/magnaat/acties.js);
      // hem hier vergeten liet een goedkope speler veel kleiner bouwen dan hij kon
      const betaalbaar = Math.floor((st.geld[mij] - BUFFER) / (sec.bouw * KOSTENSTAND[stand]));
      const omvang = Math.min(opMaat, betaalbaar);
      if (omvang < Math.min(KLEINSTE, opMaat)) return false;
      // de stand gaat MEE met het openen: hij bepaalt de bouwsom en de bezetting
      return !!m.spel.zet(potje, mij, { actie: 'open', kavel: kavel.id, sector, omvang, prijs: stand }).ok;
    },
    uitbreiden(v, erbij) { m.spel.zet(potje, mij, { actie: 'uitbreiden', id: v.id, erbij }); },
    beleid(v, wat) { m.spel.zet(potje, mij, Object.assign({ actie: 'beleid', id: v.id }, wat)); },

    /* ---------- fase B: contracten ----------
       Wat een profiel hiervan krijgt is BEWUST asymmetrisch, want zo staat het
       spel ook in elkaar: als leverancier zie je niet hoeveel een ander nodig
       heeft (dat staat in zijn boeken), als afnemer weet je het precies. Een
       aanbod is dus altijd een gok, en dat is geen tekortkoming van dit script
       maar de reden dat er onderhandeld wordt. */
    get beeld() { return m.eco.zicht(potje, st, mij); },
    /* AANBIEDEN: een deel van je vrije capaciteit te koop zetten tegen een
       korting op de marktprijs. `deel` is hoeveel van je capaciteit je durft te
       vergeven -- dat is de echte keuze, want vergeven capaciteit kan geen
       klanten meer bedienen. */
    aanbieden(v, deel, korting) {
      const soort = SECTOREN[v.sector].levert;
      if (!soort) return false;
      const beeld = this.beeld;
      const eigen = beeld.vestigingen.find(x => x.id === v.id) || {};
      const vrij = Math.max(0, (eigen.capaciteit || 0) - (eigen.vergeven || 0));
      const eenheden = Math.floor(vrij * deel);
      if (eenheden < 1) return false;
      const doelen = beeld.anderen.flatMap(a => a.zaken)
        .filter(z => (SECTOREN[z.sector].koopt || {})[soort]);
      for (const z of doelen) {
        const r = m.spel.zet(potje, mij, { actie: 'contract-voorstel', mijn: v.id, hun: z.id, soort,
          eenheden, bedrag: Math.round(eenheden * MARKTPRIJS[soort] * (1 - korting)),
          looptijd: 12, eis: 40, boete: Math.round(eenheden * MARKTPRIJS[soort] * 0.25),
          vooraf: 0, exclusief: false });
        if (r.ok) return true;
      }
      return false;
    },
    /* ANTWOORDEN OP WAT ER LIGT, en de regel daarvoor staat HIER en niet in een
       profiel -- net als op maat bouwen is dit basiscompetentie en geen stijl.
       Een afnemer die een aanbod aanneemt dat duurder is dan de markt, meet
       niet zijn strategie maar zijn onvermogen om twee getallen te vergelijken.

       DE VOLUMEKANT WORDT EEN TEGENVOORSTEL EN GEEN NEE, en dat is de correctie
       die deze hele laag pas liet werken. De eerste versie wees een aanbod af
       zodra het volume niet klopte, en toen kwamen er in een campagne van
       zesendertig maanden negenentachtig voorstellen en NUL contracten. De
       oorzaak is geen fout maar de economie zelf: een vervoerder met twintig
       voertuigen rijdt drieduizend ritten per maand en een restaurant heeft er
       vierenveertig nodig. Een leverancier kan onmogelijk raden hoeveel een
       ander nodig heeft -- dat staat in diens boeken -- dus is een eerste
       aanbod ALTIJD de verkeerde maat. Precies daarvoor bestaat het
       tegenvoorstel: de afnemer weet zijn behoefte wel, en zet hem erin. */
    antwoordOpAanbod() {
      const beeld = this.beeld;
      let gedaan = 0;
      for (const c of beeld.contracten.filter(x => x.aanZet)) {
        const perEenheid = c.bedrag / Math.max(1, c.eenheden);
        if (c.rol === 'leverancier') {
          /* WAT EEN LEVERANCIER MINSTENS WIL, en de eerste versie had het fout:
             "meer dan de marktprijs" klinkt streng maar is onzin, want dan wees
             hij zijn eigen aanbod af zodra de afnemer het volume bijstelde --
             en dan komt er nooit een contract tot stand.

             De juiste ondergrens hangt af van of er nog CAPACITEIT VRIJ is.
             Staat je vloot half stil, dan is elke euro boven je variabele
             kosten winst; zit je vol, dan geef je een klant weg en wil je
             minstens de marktprijs. Dat is geen stijl maar rekenen. */
          const eigen = beeld.vestigingen.find(x => x.id === c.leverancierId) || {};
          const stilstand = (eigen.capaciteit || 0) - (eigen.vergeven || 0) > (eigen.capaciteit || 0) * 0.15;
          const bodem = stilstand ? MARKTPRIJS[c.soort] * (SECTOREN[eigen.sector] || {}).inkoop : MARKTPRIJS[c.soort];
          const r = m.spel.zet(potje, mij, { actie: 'contract-antwoord', id: c.id,
            antwoord: perEenheid >= bodem ? 'ja' : 'nee' });
          if (r.ok) gedaan++;
          continue;
        }
        const mijnZaak = beeld.vestigingen.find(x => x.id === c.afnemerId);
        const post = mijnZaak && (mijnZaak.handel.posten || []).find(x => x.soort === c.soort);
        const nodig = post ? post.eenheden : 0;
        // te duur is te duur; daar valt niet over te praten
        if (perEenheid >= MARKTPRIJS[c.soort] || nodig < 1) {
          if (m.spel.zet(potje, mij, { actie: 'contract-antwoord', id: c.id, antwoord: 'nee' }).ok) gedaan++;
          continue;
        }
        // de prijs deugt, de maat niet: hetzelfde tarief, mijn volume
        const eenheden = Math.round(nodig);
        const zet = eenheden === c.eenheden ? { antwoord: 'ja' } : { antwoord: 'tegen',
          eenheden, bedrag: Math.max(1, Math.round(eenheden * perEenheid)), looptijd: c.looptijd,
          eis: c.eis, boete: Math.max(1, Math.round(c.boete * eenheden / Math.max(1, c.eenheden))),
          vooraf: c.vooraf, exclusief: c.exclusief };
        if (m.spel.zet(potje, mij, Object.assign({ actie: 'contract-antwoord', id: c.id }, zet)).ok) gedaan++;
      }
      return gedaan;
    },

    /* ---------- beheer ----------
       Een profiel dat zijn zaken uit handen geeft. Meer dan aanzetten is er niet
       aan: dat IS de stijl. */
    beheerAan() {
      return !!m.spel.zet(potje, mij, { actie: 'beheer-aan' }).ok;
    },

    /* ---------- onderzoek ----------
       Drie handelingen, en samen zijn ze het antwoord op de ontwerpvraag "welke
       nieuwe strategie maakt deze feature mogelijk?". Los van elkaar leveren ze
       niets op: onderzoeken zonder uitrollen is geld weggooien, en uitrollen
       zonder afslanken is uitrollen betalen voor niets. Dat is precies wat een
       toernooi hoort te meten -- als een van de drie stappen gemist mag worden,
       is de laag geen keuze maar een knop. */
    /* ONDERZOEKEN OP RICHTING EN NIET OP SLEUTEL. Sinds de boom per sector
       vertakt heeft elke sector eigen sleutels, dus een profiel dat er een lijst
       van opschrijft werkt in precies een sector -- en meet dan of het toevallig
       de goede lijst had. `volgorde` is een lijst PADEN (de stam eerst, dan
       bijvoorbeeld energie voor automatisering), en het profiel pakt de eerste
       die in zijn eigen boom openstaat. */
    onderzoeken(volgorde) {
      const beeld = this.beeld.onderzoek;
      if (beeld.bezig >= beeld.tegelijk) return false;
      const open = beeld.boom.filter(k => k.staat === 'open');
      if (!open.length) return false;
      const k = open.find(x => x.pad === 'stam')
        || volgorde.map(pad => open.find(x => x.pad === pad)).find(Boolean);
      if (!k) return false;
      // met een half budget duurt het twee keer zo lang; dat is de afweging
      return !!m.spel.zet(potje, mij, { actie: 'onderzoek-starten', sleutel: k.sleutel, budget: k.kosten }).ok;
    },
    /* UITROLLEN OP DE ZAKEN DIE HET TERUGVERDIENEN. De motor rekent zelf uit
       wat een uitvinding daar per maand oplevert (onderzoek.opbrengstVan); een
       profiel dat dat negeert en overal uitrolt, meet niet zijn stijl maar de
       kosten van niet kijken. */
    uitrollen(terugverdientijd = 12) {
      const beeld = this.beeld;
      const regels = (st.laatste[mij] || {}).regels || [];
      let gedaan = 0;
      for (const k of beeld.onderzoek.boom.filter(x => x.staat === 'klaar')) {
        for (const v of beeld.vestigingen) {
          if ((v.tech || []).includes(k.sleutel)) continue;
          const r = regels.find(x => x.id === v.id);
          if (!r) continue;
          /* DE MARGE TELT ALLEEN VOOR ZOVER ER RUIMTE IS. Een uitvinding die de
             VRAAG verhoogt levert niets op in een zaak die al vol zit; dan wordt
             het `gemist` en geen omzet. Zonder die begrenzing rolt een profiel de
             opbrengsttak uit op panden die er niets mee kunnen. */
          const ruimte = Math.max(0, 1 - (r.eenheden || 0) / Math.max(1, r.capaciteit || 1));
          const perMaand = ONDERZOEK.opbrengstVan(k.sleutel, { vast: r.vast, inkoop: r.inkoop,
            lonen: r.lonen, marge: Math.max(0, r.omzet - r.inkoop) * ruimte });
          const kosten = ONDERZOEK.uitrolkosten(v, k.sleutel);
          if (perMaand <= 0 || kosten / perMaand > terugverdientijd) continue;
          if (st.geld[mij] - kosten < BUFFER) continue;
          if (m.spel.zet(potje, mij, { actie: 'onderzoek-uitrollen', sleutel: k.sleutel, vestiging: v.id }).ok) gedaan++;
        }
      }
      return gedaan;
    },
    /* AFSLANKEN TOT WAT ER NODIG IS. Dit is waar `automatisering` zijn geld
       oplevert en nergens anders: de zaak zit tegen zijn omvang aan, dus een
       medewerker die meer aankan levert pas iets op als er iemand af gaat. Het
       getal komt van het scherm (`personeelNodig`) en wordt hier niet opnieuw
       uitgerekend. */
    afslanken() {
      let gedaan = 0;
      for (const v of this.beeld.vestigingen) {
        if (!v.personeelNodig || v.personeel <= v.personeelNodig) continue;
        if (m.spel.zet(potje, mij, { actie: 'beleid', id: v.id, personeel: v.personeelNodig }).ok) gedaan++;
      }
      return gedaan;
    }
  };
}

/* Een campagne: twee profielen, een startpositie, zesendertig maanden. Geeft de
   EINDSTAND terug -- `duel` maakt er een winnaar van, en wie wil weten hoe hard
   een profiel op zichzelf groeit heeft de stand nodig en niet de uitslag. */
/* `duur` staat er sinds de onderzoekslaag. Een campagne van zesendertig maanden
   is kort voor een tak die twintig maanden onderzoek vraagt, en de vraag "is dit
   te traag of te duur" is alleen te beantwoorden door hem ook lang te draaien.
   De standaard blijft quick: dat is waar de rest van dit script op geijkt is. */
function campagne(aNaam, bNaam, offset, maanden = 36, duur = 'quick', wereld) {
  const m = maakMagnaat();
  /* DE PARTIJ-ID BEPAALT DE WERELD, en dat is een gat dat hier lang in zat. Uit
     die id komen de conjunctuur (./cyclus.js), de krant (./nieuws.js), de
     risico's en de onderzoeksuitkomsten. Hij stond vast op 'p', dus alle
     achthonderd campagnes van dit toernooi speelden zich af onder EEN
     hoogconjunctuur, EEN reeks gebeurtenissen en EEN reeks branden. De enige
     variatie was de startpositie.

     Dat maakt een uitslag als "mobility wint 97%" onbetrouwbaar: het kan een
     eigenschap van de stijl zijn, of van dat ene weer. Sinds nu hoort de wereld
     bij de meting -- `wereld` verzet hem, en scripts/magnaat-lab.js draait er
     tientallen naast elkaar. */
  const potje = { id: wereld || 'p', soort: 'magnaat', spelers: ['a', 'b'], teams: [0, 1, 0, 1, 0, 1],
    modus: 'vrij', status: 'bezig', beurt: 0, winnaar: null,
    variant: { vorm: 'economie', stad: 'IJmuiden', duur } };
  m.spel.init(potje);
  const gereed = {
    a: gereedschap(m, potje, 'a', PROFIELEN[aNaam], offset),
    b: gereedschap(m, potje, 'b', PROFIELEN[bNaam], offset + 2)
  };
  for (let maand = 0; maand < maanden && !potje.staat.klaar; maand++) {
    /* ANTWOORDEN GAAT VOOR HANDELEN, en voor iedereen -- ook voor profielen die
       zelf nooit een contract aanbieden. Een aanbod dat blijft liggen is geen
       stijl maar een speler die zijn scherm niet leest, en dan zou dit script
       meten wie er toevallig eerst aan de beurt was. */
    gereed.a.antwoordOpAanbod();
    gereed.b.antwoordOpAanbod();
    PROFIELEN[aNaam].doe(gereed.a, maand);
    PROFIELEN[bNaam].doe(gereed.b, maand);
    potje.staat.gerekendTot -= potje.staat.maandMs;
    m.eco.bijrekenen(potje);
  }
  const stand = m.eco.eindstand(potje);
  /* Hoeveel er werkelijk getekend is. Hangt aan de eindstand omdat het anders
     niet te zien is: een contractlaag die niemand gebruikt en een contractlaag
     die niets uithaalt geven dezelfde uitslag, en dat zijn twee heel
     verschillende bevindingen. Deze meter is er precies omdat die twee de
     eerste keer door elkaar liepen. */
  const c = potje.staat.contracten || [];
  stand.contracten = { voorgesteld: c.length, getekend: c.filter(x => x.status !== 'voorgesteld'
    && x.status !== 'afgewezen').length, afgewezen: c.filter(x => x.status === 'afgewezen').length,
    omzet: Math.round(c.reduce((n, x) => n + (x.betaald || 0), 0)) };
  /* EN HETZELFDE VOOR ONDERZOEK, om precies dezelfde reden. Een boom die
     niemand afmaakt en een boom die niets uithaalt geven dezelfde uitslag. Deze
     meter zei meteen wat het eerste antwoord was: in een campagne van
     zesendertig maanden werd er wel uitgevonden en bijna nooit uitgerold. */
  const o = potje.staat.onderzoek || [];
  stand.onderzoek = { gestart: o.length, klaar: o.filter(x => x.status === 'klaar').length,
    besteed: Math.round(o.reduce((n, x) => n + (x.besteed || 0), 0)),
    uitgerold: Object.values(potje.staat.vestigingen).flat()
      .reduce((n, v) => n + (v.tech || []).length, 0) };
  return stand;
}

/* EEN VOL VELD: zes profielen in EEN campagne, en de vraag is niet wie er wint
   maar of de KAVELS OPRAKEN. Dat is de meting die een duel per definitie niet
   kan doen, en het is precies de meting die fase B nodig had.

   Fase A schreef de scheefheid toe aan het ontbreken van schaarste: twee
   spelers op 144 kavels lopen elkaar nooit tegen het lijf. Die verklaring was
   een gok, en dit is de toets erop -- want als hij klopt, hoort een tafel van
   zes een ander beeld te geven dan een duel van twee. Zes profielen die er elk
   dertig openen, willen samen 180 plekken op een kaart die er 144 heeft. */
/* EEN REGEL PER MAAND PER SPELER, en dit is de meetpost waar
   scripts/magnaat-lab.js van leeft. Een eindstand zegt WAT er uitkwam en niets
   over de weg ernaartoe: drawdown, tijd tot dominantie en de kans dat iemand
   onderweg onder nul zakte zijn alleen te zien als je elke maand kijkt.

   ALLES KOMT UIT DE MOTOR EN NIETS WORDT HIER OVERGEREKEND. Vermogen en schuld
   uit `eindstand`, omzet en contractomzet en de concernpost uit dezelfde regels
   die de speler op zijn maandoverzicht ziet (`st.laatste`). Een tweede
   berekening zou een tweede antwoord op dezelfde vraag zijn, en dan meet het lab
   zijn eigen rekenwerk. */
function maandrij(m, potje, spelers, namen) {
  const st = potje.staat;
  const stand = m.eco.eindstand(potje);
  const rij = {};
  for (let i = 0; i < spelers.length; i++) {
    const e = stand.find(x => x.codenaam === spelers[i]) || {};
    const regels = ((st.laatste || {})[spelers[i]] || {}).regels || [];
    rij[namen[i]] = {
      vermogen: e.vermogen || 0, geld: e.geld || 0, waarde: e.waarde || 0,
      schuld: e.schuld || 0, vestigingen: e.vestigingen || 0,
      omzet: regels.reduce((n, r) => n + (r.omzet || 0), 0),
      /* WAT ER VAN EEN CONTRACT KWAM, apart van de rest. Dit is de meter voor
         "afhankelijkheid van contracten": een concern dat zijn halve omzet uit
         toezeggingen van een medespeler haalt, staat er anders voor dan een dat
         alles bij de deur verkoopt -- ook als de eindstand gelijk is. */
      contractOmzet: regels.reduce((n, r) => n + ((r.levering && r.levering.omzet) || 0), 0),
      concern: regels.filter(r => r.soort === 'concern').reduce((n, r) => n - (r.resultaat || 0), 0),
      resultaat: regels.reduce((n, r) => n + (r.resultaat || 0), 0)
    };
  }
  return rij;
}

/* `extra` zet stijlen aan tafel die niet in PROFIELEN staan, en dat is er voor
   scripts/magnaat-lab.js: dat meet onder andere elke SECTOR los, en daar hoort
   geen vast profiel bij. Het alternatief was dat het lab zijn proefstijlen in
   PROFIELEN zou schrijven, en dan verandert een meting de tafel van iedereen die
   daarna in hetzelfde proces meet. Een meetopstelling hoort niets achter te
   laten. */
function veld(namen, offset = 0, maanden = 36, wereld, extra) {
  const stijl = (n) => (extra && extra[n]) || PROFIELEN[n];
  const m = maakMagnaat();
  const spelers = namen.map((_, i) => 's' + i);
  // zie de uitleg bij `campagne`: de partij-id IS de wereld
  const potje = { id: wereld || 'p', soort: 'magnaat', spelers, teams: spelers.map((_, i) => i),
    modus: 'vrij', status: 'bezig', beurt: 0, winnaar: null,
    variant: { vorm: 'economie', stad: 'IJmuiden', duur: 'quick' } };
  m.spel.init(potje);
  const gereed = spelers.map((sp, i) => gereedschap(m, potje, sp, stijl(namen[i]), offset + i * 2));
  const kavels = kaart(potje.staat.stad).kavels.length;
  let eerstVol = null;
  const reeks = [];
  for (let maand = 0; maand < maanden && !potje.staat.klaar; maand++) {
    for (const g of gereed) g.antwoordOpAanbod();
    namen.forEach((n, i) => stijl(n).doe(gereed[i], maand));
    potje.staat.gerekendTot -= potje.staat.maandMs;
    m.eco.bijrekenen(potje);
    const bezet = Object.keys(potje.staat.kavelBezet).length;
    if (eerstVol === null && bezet >= kavels * 0.9) eerstVol = maand + 1;
    reeks.push(maandrij(m, potje, spelers, namen));
  }
  const stand = m.eco.eindstand(potje);
  const bezet = Object.keys(potje.staat.kavelBezet).length;
  return { stand: stand.map(x => Object.assign({ profiel: namen[spelers.indexOf(x.codenaam)] }, x)),
    /* DE REEKS PER MAAND, want een eindstand zegt niets over de WEG ernaartoe.
       Drawdown, tijd tot dominantie en faillissementskans zijn alleen te meten
       als je weet hoe het vermogen zich bewoog; scripts/magnaat-lab.js leeft
       hiervan. */
    reeks, spelers: spelers.map((sp, i) => ({ speler: sp, profiel: namen[i] })),
    kavels, bezet, vol: bezet / kavels, eerstVol,
    contracten: (potje.staat.contracten || []).filter(c => c.status !== 'voorgesteld' && c.status !== 'afgewezen').length,
    veilingen: (potje.staat.veilingen || []).filter(v => v.status === 'gesloten' && v.winnaar).length };
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

WAT ER VANDAAG UIT KOMT, EERLIJK OPGESCHREVEN. Fase B heeft de vraag
   verplaatst in plaats van hem te beantwoorden, en dat is het vermelden waard
   omdat het antwoord van fase A een GOK was.

   Fase A zei: een sectorfocus wint omdat een duel van twee op 144 kavels geen
   schaarste kent -- ze lopen elkaar nooit tegen het lijf, dus contracten en
   veilingen gaan dat oplossen. Contracten zijn er nu, en ze lossen het NIET op.
   De reden is te meten en niet te raden: een restaurant koopt ongeveer vijf
   procent van zijn omzet aan vervoer in, dus een contract met twaalf procent
   korting is zes tiende procent van zijn omzet. Dat verschuift geen duel. De
   handel tussen bedrijven is in deze economie te klein om een strategie te
   kantelen; wat contracten WEL doen is capaciteit vastleggen, en dat is een
   echte keuze -- maar geen tegenwicht tegen een goede plek.

   DE ECHTE OORZAAK BLEEK IETS ANDERS, en die is met een aantal metingen
   ingekort tot twee zinnen. (1) Dezelfde stijl in andere zones verloor, en een
   andere sector in dezelfde zones ook -- dus het lag aan de COMBINATIE en niet
   aan de sector. (2) Wat die combinatie waard maakte was hoeveel bedrijvigheid
   EEN KAVEL draagt: een logistiekplek hield 132.000 omzet per maand, een
   horecaplek 28.000. Wie per plek vier keer zoveel kwijt kan, heeft vier keer
   minder plekken nodig -- en elke extra plek in een zone verdunt via
   `drukFactor` alle andere. Spreiden was zelfbeschadiging. Dat is de vijfde
   ijking geworden, en `test/spelmagnaat.test.js` houdt hem vast.

   ONDERWEG VIEL ER EEN GROTERE FOUT UIT, en die had niets met sectoren te
   maken: DE PRIJSSTAND WAS GEEN KEUZE. De omzetindex (vraag maal prijs) liep in
   elke sector netjes op van 0,83 via 1,00 naar 1,20, en bovendien haalde je bij
   een hoge prijs dezelfde omzet uit een KLEINER pand -- dus waren lonen, vaste
   lasten, huur en bouwsom ook nog eens 45% lager. Duur zijn was gratis en
   goedkoop zijn was straf. Dat is de zesde en zevende ijking: de vraagfactoren
   zijn geijkt tot de omzetindex vlak ligt, en duur zijn kost nu wat het in het
   echt kost (meer handen per gast, een duurder pand per stoel, een duurdere
   bouwsom). Op maat gebouwd verdienen de drie standen zich nu in tien tot elf
   maanden terug in plaats van in eenentwintig, elf en zes.

   EN TWEE MEETFOUTEN IN DEZE OPSTELLING ZELF, allebei van dezelfde soort als de
   twee die er in fase A al uit kwamen: de profielen bouwden op de vraag bij
   MIDDENprijs en zetten daarna hun prijs (dus stond er een pand van de
   verkeerde maat), en de betaalbaarheid werd bij middenkosten gerekend terwijl
   de bouwsom met de prijsstand meebeweegt. Het profiel dat op prijs en
   marketing speelde won daardoor NUL procent, en dat mat geen strategie maar
   een rekenfout in de meetopstelling.

   EN TOEN BLEEK DE VRAAG ZELF SCHEEF TE STAAN. Het toernooi speelt DUELS, en
   een duel van twee op 144 kavels is precies de situatie waarin sectorkeuze
   alles is en concurrentie niets: je loopt elkaar nooit tegen het lijf. Daarom
   staat er nu een tweede meting naast (`veld`): zes stijlen in EEN campagne.
   Daar valt de rangorde anders uit -- horeca-focus wint 100% van zijn duels en
   maar twee van de acht tafels, en zwaar onderhoud wint er vijf. Wie in een
   duel de beste sector kiest wint; wie aan een volle tafel zijn panden laat
   verslonzen, verliest van wie dat niet doet.

   DAT IS DE EIGENLIJKE CORRECTIE OP FASE A. Die schreef de scheefheid toe aan
   ontbrekende schaarste en verwachtte dat contracten en veilingen hem zouden
   oplossen. Het eerste deel klopte -- er IS geen schaarste in een duel -- maar
   niet de conclusie: het lag niet aan de ontbrekende laag maar aan de
   TAFELGROOTTE waarop gemeten werd.

   WAT ER OPEN BLIJFT, eerlijk: ook aan een tafel van zes raakt de kaart niet
   vol (ongeveer de helft van de kavels wordt bebouwd), dus veilingen om GROND
   blijven een randverschijnsel. Waar ze wel bijten is de overname van een
   lopende zaak, en dat is ook precies waar ze het meest voor bedoeld zijn: een
   speler die eruit stapt zonder de wereld kapot te maken. En zwaar onderhoud
   wint vijf van de acht tafels -- dat is een stijl en geen sector, dus het is
   een beter soort dominantie dan "kies logistiek", maar het is nog steeds
   dominantie en het staat hier als open punt. */
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
  /* EN DE TWEEDE METING, want de eerste kan een ding per definitie niet zien.
     Een duel van twee op 144 kavels kent geen schaarste; een tafel van zes wel
     -- en daar staat de rangorde er anders bij. Dat is geen detail maar de
     correctie op de verklaring uit fase A. */
  const zes = ['horeca', 'mobility', 'inkoper', 'toelever', 'keten', 'onderhoud'];
  const tafels = {}, TAFELS = 8;
  let bezet = 0, contracten = 0;
  for (let o = 0; o < TAFELS; o++) {
    const r = veld(zes, o);
    tafels[r.stand[0].profiel] = (tafels[r.stand[0].profiel] || 0) + 1;
    bezet += r.vol; contracten += r.contracten;
  }
  console.log('\nEEN VOL VELD (' + TAFELS + ' tafels van zes, ' + zes.length + ' stijlen naast elkaar):');
  console.log('  ' + Math.round(bezet / TAFELS * 100) + '% van de kavels bezet, ' +
    Math.round(contracten / TAFELS) + ' contracten per partij');
  for (const [n, w] of Object.entries(tafels).sort((a, b) => b[1] - a[1]))
    console.log('  ' + String(w).padStart(2) + 'x  ' + n.padEnd(12) + PROFIELEN[n].naam);

  const klachten = keur(uit);
  console.log('\n' + (klachten.length ? 'AFGEKEURD:\n  ' + klachten.join('\n  ')
    : 'niets doen verliest, afwachten verliest, en er zijn meerdere levensvatbare stijlen'));
  if (klachten.length) process.exitCode = 1;
}

module.exports = { PROFIELEN, NAMEN, campagne, duel, toernooi, veld, keur, signalen, GRENS_HOOG, HELFT, MIN_VARIATIE };
