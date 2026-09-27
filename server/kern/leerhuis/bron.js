/* ============================================================================
   HET LEERHUIS -- besluit B2: waar een relatie vandaan komt.

   Met een bron is de relatie in het leerhuis een AFGELEIDE. Hij wordt per vraag
   bij de bron nagevraagd en nergens gekopieerd: een kopie van een dienstverband
   is binnen een dag een tweede waarheid (ARBEID.md par. 3, de drie
   werkrelatiemodellen die elkaar niet lezen). De brug loopt een kant op: het
   leerhuis leest de bron en schrijft er nooit in.

     entiteit  haar eigenaar, of een LOPEND dienstverband (kern/concern). Een
               mandaat telt niet: dat is inzage of bevoegdheid, geen werken hier.
     zaak      een actieve plek in het personeel (supplier_staff, via accounts).
     rtf-stad  een zetel in die stad, of een ACTIEVE vrijwilliger die zijn
               dossier zelf aan zijn account koppelde, met zijn eigen code
               (stap B2b, kern/rtfos/vrijwilligeraccount.js).

   Een sleutel buiten lid: kan geen bron bevestigen, en een bron die gooit is
   geen ja (fail closed).
   ========================================================================== */
'use strict';

function maakBronToets({ accounts, employmentVanPersoon, entiteitVind, rtfInStad }) {
  return function bronToets(bron, persoon) {
    const m = /^lid:(\d+)$/.exec(String(persoon || ''));
    if (!m || !bron) return false;
    const key = 'user-' + m[1];
    try {
      if (bron.soort === 'zaak') return !!(accounts && accounts.staffByMember(bron.id, Number(m[1])));
      if (bron.soort === 'entiteit') {
        const e = typeof entiteitVind === 'function' ? entiteitVind(bron.id) : null;
        if (!e) return false;
        if (e.eigenaar === key) return true;
        return (employmentVanPersoon(key) || []).some(x => x.entiteit === bron.id && x.soort === 'employment');
      }
      if (bron.soort === 'rtf-stad') return typeof rtfInStad === 'function' && rtfInStad(key, bron.id) === true;
    } catch (e) { return false; }
    return false;
  };
}

module.exports = { maakBronToets };
