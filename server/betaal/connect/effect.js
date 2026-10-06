/* DE STAND EN ZIJN EFFECT: een overgang langs de tabel (./toestand.js), en het
   economische effect dat bij de nieuwe stand hoort -- hoogstens een keer per
   sleutel (./sleutel.js). Apart van ./afrekening.js omdat beide kanten het
   nodig hebben: het indienen (wat RTG laat gebeuren) en de melding
   (./melding.js, wat Stripe meldt dat er gebeurde). */
'use strict';
const T = require('./toestand');
const S = require('./sleutel');
const { fout } = require('./fout');

module.exports = function maakEffect({ opslag, boekEffect, audit, iso }) {
  /* De koppeling mag een functie zijn, of een haak `{ boek }` die de geldlaag
     later vult (./index.js koppelGrootboek); hij wordt per gebruik opgehaald. */
  const boek = () => typeof boekEffect === 'function' ? boekEffect
    : (boekEffect && typeof boekEffect.boek === 'function' ? boekEffect.boek : null);


  /* HET EFFECT DAT BIJ EEN STAND HOORT, hoogstens een keer per sleutel. Ook bij
     een herhaalde melding opnieuw nagelopen: viel het proces om tussen de stand
     en het effect, dan haalt de volgende melding of veeg het in. */
  function effect(rec, soort) {
    const sleutel = S.economisch(rec.id, soort);
    if (opslag.effecten()[sleutel]) return opslag.effecten()[sleutel];
    if (!boek()) throw fout('Er is geen grootboekkoppeling voor partnerafrekeningen.', 'GROOTBOEK_NIET_GEKOPPELD', 503);
    const uitslag = boek()({ sleutel, soort, afrekening: rec.id, partner: rec.partner, centen: rec.centen, valuta: rec.valuta });
    return opslag.effect(sleutel, { soort, op: iso(), uitslag: uitslag === undefined ? null : uitslag });
  }
  function effectVoorStand(rec) {
    const heeft = soort => !!opslag.effecten()[S.economisch(rec.id, soort)];
    if (!heeft('reservering')) return;          // nooit gereserveerd: er valt niets af te rekenen of terug te boeken
    if (rec.stand === 'betaald') effect(rec, 'afgerekend');
    if (rec.stand === 'teruggedraaid') effect(rec, 'teruggeboekt');
    /* Mislukt of geannuleerd VOOR de transfer: het geld is nooit vertrokken en
       de reservering komt terug. NA de transfer niet -- dan staat het bij de
       partner (./toestand.js), en dat is een bevinding en geen boeking. */
    if ((rec.stand === 'mislukt' || rec.stand === 'geannuleerd') && !rec.transferId) effect(rec, 'teruggeboekt');
  }

  /* Een stand zetten, langs de tabel. Een overgang die niet bestaat wordt een
     BEVINDING en verandert niets: een te late of vervalste melding mag een
     afgerekend bedrag niet terug in beweging zetten. */
  function zetStand(rec, naar, bron, reden) {
    const m = T.mag(rec.stand, naar);
    if (!m.mag) {
      opslag.bevinding({ soort: 'overgang-geweigerd', afrekening: rec.id, van: rec.stand, naar, bron, reden: m.reden });
      return false;
    }
    if (!m.zelfde) {
      rec.geschiedenis.push({ op: iso(), van: rec.stand, naar, bron, reden: reden || null });
      rec.stand = naar;
      opslag.bewaar(rec);
      try { audit('systeem:connect', 'Partnerafrekening ' + rec.id + ' -> ' + naar + ' (' + bron + ')'); } catch (e) { /* het record staat er al */ }
      if ((naar === 'mislukt' || naar === 'geannuleerd') && rec.transferId)
        opslag.bevinding({ soort: 'saldo-bij-partner', afrekening: rec.id, stand: naar,
          uitleg: 'De transfer is gedaan; het bedrag staat op het Stripe-saldo van de partner en niet op zijn bank.' });
    }
    effectVoorStand(rec);
    return true;
  }


  return { boek, effect, effectVoorStand, zetStand };
};
