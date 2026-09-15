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
     schrijfgrendel (`doorWie`) hoort bij het dossier. Zou naklank zelf
     schrijven, dan kan iedereen via die weg zijn eigen `gebruikt` zetten.
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

  /* EEN DEUR NAAR db.data, en niet vier. ./opslag.js draagt het register van de
     drie collecties die deze laag bezit, en het onderscheid tussen PAKKEN (dat
     aanmaakt) en PEILEN (dat niets aanmaakt). Dat verschil stond eerst drie keer
     overgetypt, en precies daar ging het drie keer mis. */
  const opslag = require('./opslag')({ db, save });

  const dossier = require('./leerdossier')({ opslag, save, crypto });
  const horizon = require('./horizon')({ opslag, save });

  /* De haak: een naklank van iemand anders wordt bij de MAKER een regel op een
     OVERDRACHTStrede -- welke, beslist ./naklanklijst.js en niet deze plek.
     `door: 'eenAnder'` is geen formaliteit: het is precies het woord waarop
     leerdossier.js zijn grendel zet. */
  /* `makerVan` zoekt op van WIE een stuk werk is, en sinds 15 september 2026 is
     hij ECHT bedraad: kern/mediaos/werkherkomst.js, het register waar vijf
     domeinen via `nieuwWerk()` zelf vertellen dat deze maker dit heeft gemaakt.
     Draait deze laag zonder kern/mediaos (zoals in een unittoets), dan geeft hij
     niets terug -- en dan wordt een naklank wel geteld maar ontstaat er geen
     regel bij de maker, met de reden in het antwoord. Dat is een eerlijke stand
     en geen vergeten bedrading.

     HIJ STAAT ER ALS FUNCTIE EN NIET ALS `null`, want dan zou naklank.js twee
     takken moeten kennen. Nu is er een tak, en het antwoord zegt waarom hij
     leeg is -- zelfde vorm als een motor zonder bron in ./mixer.js. */
  const makerVan = ctx && ctx.makerVan ? ctx.makerVan : () => null;

  const naklank = require('./naklank')({ opslag, save, makerVan,
    /* De trede komt van de NAKLANK en staat hier niet vast. Vroeger stond hier
       `trede: 'onderwezen'` voor elke naklank die doorliep; sinds de ladder vijf
       overdrachtstreden kent, beslist ./naklanklijst.js welke -- en of er
       uberhaupt een is (`mooi` levert er geen op). */
    bijOverdracht: ({ maker, onderwerp, trede, bron }) => dossier.noteer(maker, {
      trede, onderwerp, bron, door: 'eenAnder', werkwoord: 'help', herkomst: 'connect' }) });

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

  /* Openen en het overnemen van eigen werk staan in ./openen.js en ./werkbij.js
     -- twee HANDELINGEN die een dossierregel schrijven, geen lezingen. Zie de
     koppen daar. `werkenVan` komt uit de bedrading en is er vandaag alleen als
     kern/mediaos gemonteerd is; ontbreekt hij, dan zegt de uitkomst dat en
     verzint hij niets. */
  const { open } = require('./openen')({ noteer: dossier.noteer, makerVan });
  const { werkBij } = require('./werkbij')({
    werkenVan: ctx && ctx.werkenVan ? ctx.werkenVan : null, noteer: dossier.noteer });

  /* EEN NAAM IN DE KERN-TAS EN GEEN ACHTTIEN, in de vorm van
     kern/carriereledger (`const { app, carriereledger, auth } = kern`). De kop
     van scripts/grenzen.js zegt waarom dat meer is dan netjes: van de 1597
     namen in de gedeelde tas raken er 1360 maar EEN domein aan, en die horen
     in dat domein zelf. Wat het NIET oplost is verstrengeling -- `kernGedeeld`
     bewoog hier geen streep. Smallere tas, niet lossere koppeling; grenzen.js
     telt die twee met opzet apart. */
  return { connect: {
    ontdek, open, werkBij,
    portfolio: dossier.portfolio, dossier: dossier.lees, dossierNoteer: dossier.noteer,
    naklank: naklank.geef, naklankWeg: naklank.neemTerug, naklankTel: naklank.tel,
    horizon: horizon.lees, schuif: horizon.schuifNaar, signaal: horizon.signaal,
    kringZet: kring.zet, kringKeuzes: kring.keuzes, magZien: kring.magZien,
    lus: lus.verklaar, werkwoord: lus.uitleg,
    motoren: mixer.motoren, bruggen: bruggen.vanaf,
    /* De vaste lijsten, zodat een scherm ze niet overtypt. Een tweede kopie op
       de client loopt uiteen met deze, en dan staat er op het scherm iets
       anders dan wat de server afdwingt (LAT-regel 4). */
    LIJSTEN: {
      werkwoorden: require('./werkwoordlijst').WERKWOORDEN,
      treden: dossier.TREDEN, naklanken: naklank.SOORTEN, kringen: kring.KRINGEN,
      signalen: horizon.SIGNALEN, motoren: mixer.MOTOREN, plekken: mixer.PLEKKEN
    }
  } };
}

module.exports = { maakConnect, lus, kring, ontdekking, bruggen };
