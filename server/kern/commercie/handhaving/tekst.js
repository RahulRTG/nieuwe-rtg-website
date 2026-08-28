/* JAVASCRIPT LEZEN ALS TEKST -- de onderlaag van de caller-meting.

   ../handhaving.js weegt capabilities; dit bestand doet iets veel doms en veel
   preciezers: het kijkt waar een tekenreeks in een bronbestand staat, en of dat
   in code is of in commentaar. Die twee horen niet in een bestand, want het zijn
   twee onderwerpen: de een kent het productprofiel, de ander kent alleen
   aanhalingstekens.

   WAAROM COMMENTAAR ERUIT MOET. De gevaarlijkste vermelding van een capability
   is een toelichting die uitlegt hoe hij werkt: die leest als bewijs dat hij
   werkt. Vier bestanden legden uit hoe `can_use_pos` werkte terwijl niemand ooit
   werd tegengehouden.

   EN WAAROM TEKENREEKSEN MOETEN BLIJVEN. De capability ZELF is een tekenreeks
   (`mag(pas, 'can_use_pos')`), dus een stripper die tekenreeksen weggooit meet
   niets. Een tekenreeks kan bovendien `//` bevatten -- elke URL doet dat -- en
   commentaar kan een aanhalingsteken bevatten; wie daar niet op let, strip of te
   veel of te weinig.

   DE BEKENDE ONVOLKOMENHEID: een reguliere expressie die `/*` of `//` bevat kan
   de toestandsmachine in de war brengen. Dat staat hier omdat een meetfout die
   je kent iets anders is dan een meetfout die je niet kent -- en een capability
   binnen een reguliere expressie is geen aanroep die we willen tellen. */
'use strict';

/* Commentaar eruit, tekenreeksen erin laten. Een tekenreeks kan `//` bevatten
   (elke URL doet dat) en een commentaar kan een aanhalingsteken bevatten; wie
   daar niet op let, strip of te veel of te weinig. */
function zonderCommentaar(bron) {
  const s = String(bron || '');
  let uit = '';
  let i = 0;
  let staat = 'code';                 // code | regel | blok | enkel | dubbel | sjabloon
  while (i < s.length) {
    const c = s[i];
    const volgend = s[i + 1];
    if (staat === 'code') {
      if (c === '/' && volgend === '/') { staat = 'regel'; i += 2; continue; }
      if (c === '/' && volgend === '*') { staat = 'blok'; i += 2; continue; }
      if (c === "'") staat = 'enkel';
      else if (c === '"') staat = 'dubbel';
      else if (c === '`') staat = 'sjabloon';
      uit += c; i++; continue;
    }
    if (staat === 'regel') {
      if (c === '\n') { staat = 'code'; uit += c; }
      i++; continue;
    }
    if (staat === 'blok') {
      if (c === '*' && volgend === '/') { staat = 'code'; i += 2; continue; }
      if (c === '\n') uit += c;        // regelnummers houden kloppen
      i++; continue;
    }
    // in een tekenreeks: een backslash maakt het volgende teken onschadelijk
    if (c === '\\') { uit += c + (volgend || ''); i += 2; continue; }
    if ((staat === 'enkel' && c === "'") || (staat === 'dubbel' && c === '"') ||
        (staat === 'sjabloon' && c === '`')) staat = 'code';
    uit += c; i++; continue;
  }
  return uit;
}

/* De aanroep waar deze tekenreeks in staat. We kijken terug naar het dichtstbij
   liggende haakje dat nog openstaat en pakken de naam ervoor. Dat is wat het
   verschil maakt tussen `mag(pas, 'can_use_pos')` -- een slot -- en
   `tredenMet('can_use_pos')` -- een zin. */
function omhullendeAanroep(bron, index) {
  const venster = bron.slice(Math.max(0, index - 200), index);
  const m = venster.match(/([A-Za-z_$][\w$]*)\s*\(\s*[^()]*$/);
  return m ? m[1] : null;
}

const POORTNAMEN = new Set(['mag', 'magNiet', 'vereist', 'heeftCap', 'eist']);

/* Elke plek in EEN bestand waar deze capability als tekenreeks wordt gebruikt.
   Wat alleen in commentaar staat, komt hier niet uit -- dat wordt apart geteld
   door de aanroeper, die het onbewerkte bestand nog heeft. */
function gebruiken(bron, cap) {
  const schoon = zonderCommentaar(bron);
  const uit = [];
  const naald = new RegExp('[\'"`]' + cap.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\'"`]', 'g');
  let m;
  while ((m = naald.exec(schoon))) {
    const aanroep = omhullendeAanroep(schoon, m.index);
    uit.push({
      regel: schoon.slice(0, m.index).split('\n').length,
      aanroep,
      soort: POORTNAMEN.has(aanroep) ? 'poort' : (aanroep === 'tredenMet' ? 'beschrijving' : 'overig')
    });
  }
  return uit;
}

module.exports = { zonderCommentaar, omhullendeAanroep, gebruiken, POORTNAMEN };
