/* VRIJHEID: EERLIJKHEID OVER TIJD -- zonder score op een mens.

   Het grootboek bewaart GEBEURTENISSEN (dit schaarse moment is toegekend, dit
   is geweigerd, iemand dekte extra), en er wordt nooit een getal van gemaakt
   dat "hoe eerlijk" of "hoe flexibel" iemand is. Wat er wel wordt geteld, is
   per SOORT moment hoe vaak iemand het kreeg -- dat is een feit over een
   verdeling en geen oordeel over een mens, en het wordt alleen gebruikt om
   dezelfde soort moment opnieuw te verdelen (NO_HIDDEN_PEOPLE_SCORE). Er is
   geen functie die het grootboek per persoon samenvat voor iets anders.

   DE ROTATIE voor een schaars moment (kerst, oud en nieuw, een populaire
   week), in deze volgorde en met niets anders erin:
     1 wie het vergelijkbare moment het minst vaak kreeg, gaat voor;
     2 bij gelijk: wie het het langst geleden kreeg (nooit gaat voor);
     3 bij gelijk: een loting met een vaste zaad per moment -- reproduceerbaar
       en voor niemand te beinvloeden.
   Met opzet NIET: het tijdstip van de aanvraag (wie het snelst drukt), wie de
   manager kent, of hoeveel keer iemand opnieuw aanvroeg. Intrekken en opnieuw
   indienen verandert de volgorde dus niet: alleen toekenningen tellen.

   NO_UNFAIR_TRANSFER: vrijheid die alleen kan doordat een ander verplicht
   overwerkt, zijn rust verliest of steeds weer de gaten dicht, is geen
   vrijheid maar een verschuiving. */
'use strict';
const crypto = require('crypto');
const T = require('./tijd');

const SOORTEN_GEBEURTENIS = Object.freeze(['POPULAR_SLOT_GRANTED', 'POPULAR_SLOT_DECLINED', 'FREEDOM_RELEASE_GRANTED',
  'SHIFT_SWAP', 'EXTRA_COVERAGE', 'HOLIDAY_SLOT_GRANTED', 'POLICY_EXCEPTION_GRANTED']);

const lot = (zaad, persoon) => crypto.createHash('sha256').update(String(zaad) + '|' + String(persoon)).digest('hex');

function rotatie(kandidaten, { moment, plekken, zaad }, grootboek) {
  const uniek = [...new Set((kandidaten || []).map(String))];
  const rij = uniek.map(persoon => {
    const eerder = (grootboek || []).filter(g => g.soort === 'POPULAR_SLOT_GRANTED' && g.moment === moment && g.persoon === persoon);
    const laatste = eerder.map(g => g.datum).sort().pop() || null;
    return { persoon, eerder: eerder.length, laatste, lot: lot(zaad || moment, persoon) };
  });
  rij.sort((a, b) => a.eerder - b.eerder
    || (a.laatste === b.laatste ? 0 : a.laatste === null ? -1 : b.laatste === null ? 1 : a.laatste < b.laatste ? -1 : 1)
    || (a.lot < b.lot ? -1 : a.lot > b.lot ? 1 : 0));
  const n = Math.max(0, Number(plekken) || 0);
  return rij.map((r, i) => ({
    persoon: r.persoon,
    toegekend: i < n,
    /* De uitleg noemt alleen de eigen geschiedenis en de regel -- nooit die van
       een collega. */
    uitleg: (i < n ? 'Toegekend. ' : 'Niet toegekend. ') +
      'U kreeg dit moment eerder ' + r.eerder + ' keer' + (r.laatste ? ' (laatst ' + r.laatste + ')' : '') + '. ' +
      'Wie het vergelijkbare moment minder vaak of langer geleden kreeg, gaat voor; bij gelijke stand beslist een vaste loting.'
  }));
}

/* Volgorde voor het aanbieden van eerder-naar-huis wanneer de dekking maar
   een deel van de mensen kan laten gaan: wie in het venster het minst vaak
   eerder weg mocht, eerst. */
function vrijheidsVolgorde(personen, grootboek, { datum, vensterDagen, zaad }) {
  const grens = vensterDagen != null ? T.plusDagen(datum, -vensterDagen) : null;
  const telt = (p) => (grootboek || []).filter(g => g.soort === 'FREEDOM_RELEASE_GRANTED' && g.persoon === p && (!grens || g.datum >= grens)).length;
  return [...new Set(personen)].map(p => ({ persoon: p, eerder: telt(p), lot: lot(zaad || datum, p) }))
    .sort((a, b) => a.eerder - b.eerder || (a.lot < b.lot ? -1 : 1)).map(r => r.persoon);
}

/* vervangers: [{ persoon, instemming, rust: { stand } }] -- wie het werk zou
   dragen. Een lege lijst betekent dat niemand iets extra draagt. */
function oneerlijkeOverdracht(vervangers, grootboek, beleid, datum) {
  const bezwaren = [];
  const venster = beleid.waarde('eerlijkheid.vensterDagen');
  const max = beleid.waarde('eerlijkheid.maxExtraDekking');
  for (const v of vervangers || []) {
    if (v.instemming !== true) bezwaren.push({ persoon: v.persoon, regel: 'zonder-instemming', uitleg: 'Werk zou zonder instemming worden doorgeschoven.' });
    if (v.rust && v.rust.stand !== 'SAFE') bezwaren.push({ persoon: v.persoon, regel: 'rust', uitleg: v.rust.uitleg });
    if (venster.open || max.open) { bezwaren.push({ persoon: v.persoon, regel: 'onbekend', uitleg: 'Hoe vaak iemand extra mag dekken is nog niet vastgesteld.', onbekend: true }); continue; }
    const vanaf = T.plusDagen(datum, -venster.waarde);
    const al = (grootboek || []).filter(g => g.soort === 'EXTRA_COVERAGE' && g.persoon === v.persoon && g.datum >= vanaf).length;
    if (al >= max.waarde) bezwaren.push({ persoon: v.persoon, regel: 'draagt-structureel',
      uitleg: 'Deze collega dekte de afgelopen ' + venster.waarde + ' dagen al ' + al + ' keer extra.' });
  }
  const hard = bezwaren.filter(b => !b.onbekend);
  return { stand: hard.length ? 'UNFAIR' : bezwaren.length ? 'UNKNOWN' : 'FAIR', bezwaren };
}

module.exports = { SOORTEN_GEBEURTENIS, rotatie, vrijheidsVolgorde, oneerlijkeOverdracht };
