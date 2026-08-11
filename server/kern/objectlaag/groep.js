/* De objectlaag, deelbestand "groep": wat kan ik met dit genootschap?

   HIER LIGT DE CAP AAN EEN ROL EN NIET AAN EEN VERMOEDEN. Een genootschap kent
   beheerders en gewone leden (kern/genootschap/index.js), en dat verschil
   bepaalt wat er kan. Beheer aanbieden aan wie geen beheerder is, is een knop
   die op een weigering uitkomt -- en een weigering die je had kunnen zien
   aankomen, is een ontwerpfout en geen foutmelding.

   GEEN LID, GEEN OBJECT. Wie geen lid is van deze groep krijgt geen lijst met
   caps die hij niet mag; hij krijgt niets. Dat is niet alleen netter maar ook
   veiliger: de enkele bit "u bent geen lid" lekt niets over wat er in de groep
   gebeurt, terwijl een lijst caps met een slotje eromheen wel verraadt dat de
   groep bestaat en wat hij doet. */
'use strict';

const { capVoor } = require('./caps');

module.exports = ({ kern }) => {

  /* Het object zelf: bestaat deze groep, en hoort dit lid erbij? Geeft null als
     een van beide niet zo is -- de aanroeper maakt daar een 404 van en zegt
     nooit welke van de twee het was. */
  function vind(key, id) {
    const gr = kern.genootschap.groepMet(id);
    if (!gr || !kern.genootschap.isLid(gr, key)) return null;
    return kern.genootschap.publiek(gr, key);
  }

  function caps(key, id) {
    const p = vind(key, id);
    if (!p) return null;

    const uit = [
      capVoor('prikbord', 'u bent lid'),
      capVoor('peiling', 'u bent lid'),
      capVoor('bijeenkomst', 'u bent lid'),
      capVoor('uitvoer', 'u bent lid')
    ];

    /* De enige cap die aan een rol hangt. `mijnRol` komt uit het domein zelf
       (publiek()), zodat deze laag niet zijn eigen idee heeft van wie beheerder
       is -- dat zou dezelfde waarheid op twee plekken zijn (LAT.md regel 4). */
    if (p.mijnRol === 'beheerder') uit.push(capVoor('beheer', 'u bent beheerder'));

    return { titel: p.naam, caps: uit.filter(Boolean), stil: [],
      /* Wat het scherm mag tonen zonder een tweede aanroep. Bewust mager: de
         ledenlijst hoort in Genootschap zelf, niet hier. */
      over: { leden: p.leden, soort: p.soort } };
  }

  return { caps, vind };
};
