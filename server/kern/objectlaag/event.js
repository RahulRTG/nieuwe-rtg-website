/* De objectlaag, deelbestand "event": wat kan ik met deze bijeenkomst?

   EEN EVENT WOONT IN EEN GROEP, en dat is de reden dat dit bestand zoekt in
   plaats van opvraagt. Het domein kent geen "geef mij bijeenkomst X" -- het kent
   `lijstVan(groepId)` (kern/genootschap/bijeenkomst.js). Zoeken over de groepen
   van het lid is daarom niet omslachtig maar precies goed: wie de bijeenkomst
   niet via een van zijn eigen groepen kan bereiken, hoort hem niet te vinden.
   De poort zit zo in de zoekweg zelf en niet in een controle die je kunt
   vergeten.

   EEN AFGELASTE BIJEENKOMST VERDWIJNT NIET, MAAR KAN NIETS MEER. Hij blijft
   opvraagbaar -- er staat iets in iemands agenda en die wil weten waarom het
   niet doorgaat -- maar de antwoord-cap gaat eraf. Een "laat weten of u komt"
   onder een afgelaste bijeenkomst is een knop naar een teleurstelling. */
'use strict';

const { capVoor } = require('./caps');

module.exports = ({ kern }) => {

  /* De bijeenkomst plus de groep waar hij in zit. Zoekt alleen in de groepen van
     dit lid; sess wordt doorgegeven omdat publiek() er `vanMij` en
     `mijnAntwoord` uit haalt -- de twee velden waar dit hele bestand op draait. */
  /* VERGELIJKEN OP STRINGVORM, en dat is geen slordigheid maar het domein
     volgen. Een bijeenkomst-id is een GETAL (Date.now(), zie
     kern/genootschap/bijeenkomst.js), en alles wat via een route binnenkomt is
     een string. Een kale `!==` matcht dan nooit: het object werd niet gevonden
     en de route gaf een keurige 404 op een bijeenkomst die gewoon bestond.

     Zo hoort het ook, want het domein doet het zelf al zo: `groepMet` vergelijkt
     met String(x.id) === String(id). Dat is de reden dat de groep het wel deed
     en het event niet -- en waarom deze regel de conventie van het domein volgt
     in plaats van er een eigen te verzinnen.

     Gevonden door test/objectlaagroutes.test.js, die met de ECHTE domeinen
     praat. De toetsen die de domeinen nabouwen zagen het niet: daar was de id
     een string, want zo had ik hem opgeschreven. */
  function vind(key, id) {
    const sess = { key };
    for (const gr of kern.genootschap.mijne(key) || []) {
      for (const b of kern.bijeenkomst.lijstVan(gr.id) || []) {
        if (String(b.id) !== String(id)) continue;
        return { groep: gr, bijeenkomst: kern.bijeenkomst.publiek(b, sess) };
      }
    }
    return null;
  }

  function caps(key, id) {
    const v = vind(key, id);
    if (!v) return null;
    const b = v.bijeenkomst;

    const uit = [capVoor('vandegroep', v.groep.naam)];

    if (b.afgelast) {
      /* Niets meer dan de weg naar de groep. Met opzet geen cap met een
         doorgestreepte naam of een uitleg waarom het niet kan: een uitgeschakelde
         knop is nog steeds een knop, en het lid heeft hier niets te kiezen. */
      return { titel: b.wat, caps: uit.filter(Boolean), stil: [],
        over: { datum: b.datum, tijd: b.tijd, waar: b.waar, afgelast: b.afgelast, gastheer: b.gastheer } };
    }

    uit.push(capVoor('antwoord', b.mijnAntwoord
      ? 'u heeft "' + b.mijnAntwoord + '" geantwoord'
      : 'u heeft nog niet geantwoord'));

    /* `vanMij` komt uit het domein en niet uit een vergelijking hier: publiek()
       weet wie de gastheer is, en dat hoort maar op een plek te wonen. */
    if (b.vanMij) uit.push(capVoor('gastheer', 'u heeft deze bijeenkomst uitgeschreven'));

    return { titel: b.wat, caps: uit.filter(Boolean), stil: [],
      over: { datum: b.datum, tijd: b.tijd, waar: b.waar, afgelast: null, gastheer: b.gastheer,
        ja: b.ja, misschien: b.misschien, vol: b.vol } };
  }

  return { caps, vind };
};
