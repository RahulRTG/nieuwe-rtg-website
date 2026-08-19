/* WELKE REGELS GOLDEN ER OP DIE DATUM -- de brug tussen de rekenplekken en de
   jaargangen (./jaargangen.js).

   WAAROM DIT EEN EIGEN BESTANDJE IS. Drie rekenplekken stellen dezelfde vraag
   (de maandboekhouding, het Z-rapport en straks meer), en alle drie moeten ze
   hetzelfde antwoord krijgen als de jaargangen er NIET zijn. Dat laatste is
   geen theorie: `maakFiscaal` wordt in server.js opgebouwd voordat de
   Regelwacht bestaat (kernlaag4c), en de toetsen bouwen hem los op met een
   stub-db en zonder jaargangen. Die terugval drie keer opschrijven is drie
   plekken die dezelfde waarheid vasthouden -- LAT.md regel 4 -- en dan rekent
   het Z-rapport ooit net anders terug dan de maandboekhouding.

   DE TERUGVAL IS DE LOPENDE TABEL, en dat is met opzet geen fout maar een
   eerlijke tweede keus: zonder jaargangen is "de regels van vandaag" het beste
   dat er is. Wat NIET mag, is doen alsof dat een historisch antwoord is --
   daarom draagt elk antwoord een `bron` ('jaargangen' of 'lopend'), en de
   rekenplekken stempelen die op hun uitkomst. Wie later een bedrag herbouwt,
   ziet dan of het op teruggerekende of op huidige regels stond.

   LUI DOORGEGEVEN. De jaargangen mogen een functie zijn in plaats van een
   object; server.js geeft ze zo door omdat de laag pas later ontstaat. Hetzelfde
   idioom als de bevoegdheidslaag daar (zie de kop bij `functies`). */
'use strict';

const { LANDEN } = require('./landen');
const { uitTabel } = require('./tarief');

module.exports = function maakRegelbron(jaargangenIn) {
  const store = () => {
    const j = typeof jaargangenIn === 'function' ? jaargangenIn() : jaargangenIn;
    return j && typeof j.regelsOp === 'function' ? j : null;
  };

  /* De regels van een land op een datum. Zonder jaargangen: de lopende tabel.
     Geeft nooit null voor een bekend land, want een rekenplek zonder tarieven
     zou stilletjes op nul uitkomen -- en een btw-bedrag van nul dat een fout is,
     ziet er precies zo uit als een btw-bedrag van nul dat klopt. */
  function regelsOp(landCode, datum) {
    const cc = String(landCode || '').toUpperCase();
    const j = store();
    if (j) {
      const uit = j.regelsOp(cc, datum);
      if (uit) return { regels: uit, bron: 'jaargangen' };
    }
    return { regels: LANDEN[cc] || null, bron: 'lopend' };
  }

  // Het percentage van een categorie op een datum; de keuze zelf komt uit
  // ./tarief.js, dezelfde routine als voor de lopende tabel.
  function tariefOp(landCode, cat, datum) {
    const { regels } = regelsOp(landCode, datum);
    return regels ? uitTabel(regels.tarieven, cat) : null;
  }

  /* DE STEMPEL die op een uitkomst gaat: op welke datum is teruggerekend, uit
     welke bron, en welke wijzigingen golden er toen. Dat laatste is wat een
     herbouw later nodig heeft -- zonder de id's is "de regels van toen" een
     bewering zonder verwijzing. */
  function stempel(landCode, datum) {
    const cc = String(landCode || '').toUpperCase();
    const j = store();
    const bron = j ? 'jaargangen' : 'lopend';
    const toegepast = j && typeof j.geschiedenis === 'function'
      ? j.geschiedenis(cc).filter(x => x.geldigVanaf <= datum).map(x => x.id)
      : [];
    return { op: datum, bron, jaargangen: toegepast };
  }

  return { regelsOp, tariefOp, stempel, heeftJaargangen: () => !!store() };
};
