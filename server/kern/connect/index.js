/* ============================================================================
   FOUNDATION CONNECT -- de bedrading, en waar de laag begint en ophoudt.

   Wat deze laag IS: een ontdeklus over bestaande domeinen. Wat zij NIET is: een
   plek waar inhoud woont. Er komt geen `posts`-tabel, geen contentdatabase en
   geen tweede feed. De leerstof blijft van kern/leerstof.js, de buurtactiviteit
   van kern/rtfos/publiek.js; deze laag voegt toe wat nergens stond -- de
   etiketten, de werkwoorden, de reden dat iets hier staat, en wat een mens
   ermee heeft gedaan.

   DRIE DINGEN WORDEN WEL BEWAARD, en het is goed om te weten welke drie:

     naklank     wat een mens met een DING deed (./naklank.js). Aan het ding.
     leerdossier wat een mens heeft gedaan (./leerdossier.js). Aan de codenaam.
     horizon     wat een mens heeft GEZEGD te willen (./horizon.js).

   Er wordt met opzet NIET bewaard: wat iemand heeft gezien maar niet aangeraakt,
   hoe lang hij keek, wanneer hij keek, of hoe vaak hij terugkwam. Dat zijn de
   variabelen van een aandachtsmachine; ze ontbreken hier niet per ongeluk maar
   omdat ./horizon.js ze bij naam weigert in `GEEN_SIGNAAL`.

   DE VOLGORDE VAN OPHANGEN IS GEDRAG en op twee plekken:

   - naklank krijgt de haak `bijHelp` van het LEERDOSSIER mee, en niet
     andersom. Wie iemand helpt, krijgt daar een dossierregel van -- maar de
     schrijfgrendel (`wieSchrijft`) hoort bij het dossier. Zou naklank zelf
     schrijven, dan kan iedereen via die weg zijn eigen `onderwezen` zetten.
   - de mixer krijgt zijn BRONNEN mee en kiest ze niet zelf, om dezelfde reden
     als kern/levensgraaf/graaf.js: een motor die zijn eigen brandstof kiest,
     kan er maar een soort verstoken.

   VIER VAN DE ACHT MOTOREN ZIJN NIET AANGESLOTEN, en dat staat in het antwoord
   van ./mixer.js met de reden erbij in plaats van dat hun plekken stil naar een
   buurman gaan. Ze zijn hier ook niet als lege functie neergezet: een motor die
   bestaat en altijd niets teruggeeft, is niet te onderscheiden van een motor
   die stuk is (KAARTEN.md par. 6).
   ========================================================================== */
'use strict';

const lus = require('./lus');
const kring = require('./kring');
const bruggen = require('./bruggen');
const ontdekking = require('./ontdekking');
const { maakLeerstofbron } = require('./bron-leerstof');
const { maakLokalebron } = require('./bron-lokaal');

function maakConnect(ctx) {
  const { db, save, crypto, DOELEN, rtfos } = ctx || {};

  const dossier = require('./leerdossier')({ db, save, crypto });
  const horizon = require('./horizon')({ db, save });

  /* De haak: een `geholpen` van iemand anders wordt bij de MAKER een regel op
     de trede `onderwezen`. `door: 'eenAnder'` is geen formaliteit -- het is
     precies het woord waarop leerdossier.js zijn grendel zet. */
  /* `makerVan` zoekt op van WIE een stuk werk is. Vandaag geeft hij altijd
     niets terug, en dat is een eerlijke stand en geen vergeten bedrading: geen
     van de twee aangesloten bronnen draagt een maker -- leerstof is van dit
     huis, een buurtactiviteit van een afdeling. Zolang dat zo is, wordt een
     `geholpen` wel geteld maar ontstaat de trede `onderwezen` niet, met de
     reden in het antwoord. Wie hier ooit een bron met makers aansluit
     (kern/mediaos/wekken.js kent `nieuwWerk(key, ...)`), geeft die resolver
     hier mee en de lus sluit vanzelf.

     HIJ STAAT ER ALS FUNCTIE EN NIET ALS `null`, want dan zou naklank.js twee
     takken moeten kennen. Nu is er een tak, en het antwoord zegt waarom hij
     leeg is -- zelfde vorm als een motor zonder bron in ./mixer.js. */
  const makerVan = ctx && ctx.makerVan ? ctx.makerVan : () => null;

  const naklank = require('./naklank')({ db, save, makerVan,
    bijHelp: ({ maker, onderwerp, bron }) => dossier.noteer(maker, {
      trede: 'onderwezen', onderwerp, bron, door: 'eenAnder', herkomst: 'connect' }) });

  const leerstofbron = maakLeerstofbron({ DOELEN });
  const lokalebron = maakLokalebron({ rtfos });

  const mixer = require('./mixer')({ bronnen: {
    interesse: (c) => leerstofbron.interesse(c),
    nieuwsgierig: (c) => leerstofbron.nieuwsgierig(c),
    lokaal: (c) => lokalebron.lokaal(c)
    /* groei, menselijk, brug, actualiteit en toeval: geen bron. Ze staan in
       mixer.MOTOREN met hun reden en melden zelf dat ze niet kijken. */
  } });

  /* DE LUS ZELF. De sleutel opent de voorkeuren en gaat NERGENS anders heen:
     de bronnen krijgen `onderwerpen`, `plaats` en `vandaag`, en geen codenaam.
     Dat is dezelfde knip als bij `vondsten(voorwaarde)` in de aanvoerlaag --
     een bron die om de mens vraagt, kan hem hier niet krijgen. */
  async function ontdek(sleutel, opties) {
    const o = opties || {};
    const h = horizon.lees(sleutel);
    const bronCtx = {
      onderwerpen: h.onderwerpen,
      /* De plaats komt uit het VERZOEK en niet uit de kluis. Zie de kop van
         ./bron-lokaal.js: nergens afgeleid, en niet bewaard. */
      plaats: String(o.plaats || ''),
      vandaag: String(o.vandaag || new Date().toISOString().slice(0, 10))
    };
    const r = await mixer.mix(bronCtx, {
      schuif: h.schuif,
      eenmaligOntdekken: !!o.verras,
      gezien: Array.isArray(o.gezien) ? o.gezien : []
    });
    return Object.assign(r, {
      horizon: { schuif: h.schuif, uitleg: h.uitleg },
      /* Wat de mens zelf kan zeggen, uit de bron en niet overgetypt. */
      signalen: horizon.SIGNALEN,
      onderwerpenDieBruggenKennen: bruggen.ONDERWERPEN,
      plaatsGevraagd: !bronCtx.plaats
        ? 'Voor wat er in de buurt gebeurt is een plaats nodig. Die wordt nergens uit afgeleid en niet bewaard -- geef hem mee als u hem wilt gebruiken.'
        : null
    });
  }

  /* IETS OPENEN. Dit is de enige plek waar de trede `gezien` ontstaat, en met
     opzet NIET bij het tonen: een dossier dat volloopt met alles wat langskwam,
     meet aandacht en geen leren. Precies het verschil dat ./leerdossier.js in
     zijn eerste trede uitschrijft. */
  function open(sleutel, item) {
    const i = item || {};
    return dossier.noteer(sleutel, { trede: 'gezien', onderwerp: i.onderwerp,
      bron: i.id, door: 'hetSysteem', herkomst: i.herkomst });
  }

  return {
    connectOntdek: ontdek,
    connectOpen: open,
    connectNaklank: naklank.geef,
    connectNaklankWeg: naklank.neemTerug,
    connectNaklankTel: naklank.tel,
    connectDossier: dossier.lees,
    connectDossierNoteer: dossier.noteer,
    connectHorizon: horizon.lees,
    connectSchuif: horizon.schuifNaar,
    connectSignaal: horizon.signaal,
    connectKringZet: kring.zet,
    connectKringKeuzes: kring.keuzes,
    connectMagZien: kring.magZien,
    connectLus: lus.verklaar,
    connectWerkwoord: lus.uitleg,
    connectMotoren: mixer.motoren,
    connectBruggen: bruggen.vanaf,
    /* De vaste lijsten, zodat een scherm ze niet overtypt. Een tweede kopie op
       de client loopt uiteen met deze, en dan staat er op het scherm iets
       anders dan wat de server afdwingt (LAT-regel 4). */
    CONNECT: {
      werkwoorden: require('./werkwoordlijst').WERKWOORDEN,
      treden: dossier.TREDEN,
      naklanken: naklank.SOORTEN,
      kringen: kring.KRINGEN,
      signalen: horizon.SIGNALEN,
      motoren: mixer.MOTOREN,
      plekken: mixer.PLEKKEN
    }
  };
}

module.exports = { maakConnect, lus, kring, ontdekking, bruggen };
