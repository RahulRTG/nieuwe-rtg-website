/* Geldgraaf, deelbestand "patronen": terugkerende posten herkennen in de
   uitgaande wallet-transacties.

   De maat is bewust smal (GELD.md fase 1): twee of meer betalingen met
   dezelfde omschrijving of tegenpartij, met een tussenpoos van 25 tot 35
   dagen en bedragen die per stap hooguit tien procent verschillen, gelden
   als maandelijks. Alles wat daar niet aan voldoet is GEEN patroon -- te
   weinig geschiedenis levert eerlijk niets op, want een verzonnen vaste
   last is erger dan een gemiste: hij drukt de vooruitblik omlaag en het lid
   gaat sparen voor een rekening die niet bestaat.

   Inkomende transacties doen bewust niet mee: verwacht inkomen komt uit
   payroll (zie ./bronnen.js), en wie hier ook op inkomend zou matchen telt
   hetzelfde loon twee keer. */
'use strict';

const { vandaag, plusDagen, dagenTussen, mediaan, feit, LINK } = require('./hulp');

const POOS_MIN = 25, POOS_MAX = 35; // dagen: maandelijks, met speling voor weekend en feestdag

function herken(bronFeiten) {
  /* Groeperen op de titel: die is bij een wallet-transactie de omschrijving,
     en als die leeg was al bij de bron de tegenpartij. Een sleutel dus, geen
     twee, en daarmee geen kans dat omschrijving en tegenpartij elkaar
     tegenspreken. */
  const groepen = new Map();
  for (const f of bronFeiten) {
    if (f.soort !== 'transactie' || f.richting !== 'uit') continue;
    if (!f.wanneer || !Number.isFinite(f.centen)) continue;
    const sleutel = f.titel.toLowerCase().trim();
    if (!sleutel) continue;
    let lijst = groepen.get(sleutel);
    if (!lijst) { lijst = []; groepen.set(sleutel, lijst); }
    lijst.push(f);
  }

  const patronen = [], feiten = [];
  for (const rijen of groepen.values()) {
    if (rijen.length < 2) continue;
    rijen.sort((a, b) => a.wanneer.localeCompare(b.wanneer));

    /* Elke stap in de reeks moet kloppen, niet alleen de laatste: een post
       die vroeger wekelijks was en pas net maandelijks, is nog geen
       maandelijks patroon. */
    const pozen = [];
    let past = true;
    for (let i = 1; i < rijen.length; i++) {
      const poos = dagenTussen(rijen[i - 1].wanneer, rijen[i].wanneer);
      const a = rijen[i - 1].centen, b = rijen[i].centen;
      /* HET RITME bepaalt of dit een vaste post is, NIET het bedrag. Hier
         stond eerst ook een tienprocentsmaat op het bedrag, en die deed twee
         dingen tegelijk: hij groepeerde de reeks en hij mat de stijging.
         Gevolg: precies waar de uitzondering voor bestaat -- een vaste last
         die fors duurder wordt -- viel de reeks uit elkaar en zag niemand
         iets. Een sportclub die van 25 naar 30 euro gaat was onzichtbaar,
         een van 25 naar 27 niet. Dat is de verkeerde kant op.

         Het bedrag doet nog wel mee als grofheidscontrole: hooguit een
         factor vier uit elkaar, anders horen twee betalingen met toevallig
         dezelfde omschrijving (een tikkie van vijf euro en een rekening van
         vijfhonderd) niet in dezelfde reeks. In gehele centen, zodat er geen
         drijvende komma aan te pas komt. */
      if (poos < POOS_MIN || poos > POOS_MAX || Math.min(a, b) * 4 < Math.max(a, b)) {
        past = false;
        break;
      }
      pozen.push(poos);
    }
    if (!past) continue;

    const laatste = rijen[rijen.length - 1];
    const vorige = rijen[rijen.length - 2];
    const interval = mediaan(pozen);
    const volgende = plusDagen(laatste.wanneer, interval);

    /* Een patroon waarvan de verwachte volgende datum al meer dan een
       tussenpoos voorbij is, is gestopt (opgezegd abonnement). Dat de
       toekomst in projecteren zou een niet-bestaande last opvoeren. */
    if (dagenTussen(volgende, vandaag()) > interval) continue;

    patronen.push({
      titel: laatste.titel,
      centen: laatste.centen,        // het jongste bedrag: daarmee rekent de vooruitblik
      vorigeCenten: vorige.centen,
      aantal: rijen.length,
      interval,
      volgende,
      /* Elke verhoging telt, ook een kleine: de opdrachtmaat is "jongste
         hoger dan vorige", en de uitzondering is niveau kijken -- hij
         signaleert, hij doet niets. */
      duurder: laatste.centen > vorige.centen
    });
    feiten.push(feit({
      soort: 'vast', titel: laatste.titel, centen: laatste.centen,
      richting: 'uit', wanneer: volgende, herhaling: 'maandelijks',
      bron: 'wallet', link: LINK('wallet')
    }));
  }
  return { patronen, feiten };
}

module.exports = { herken };
