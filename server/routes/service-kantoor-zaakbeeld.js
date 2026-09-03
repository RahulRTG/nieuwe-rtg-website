/* ============================================================================
   MET WIE PRAAT HET KANTOOR, EN WAT STAAT ER VAN DIE ZAAK OPEN.

   Uit ./service-kantoor.js getild op een echte naad: dit is het enige stuk dat
   de leverancierslaag aanraakt, en het draagt de eerste echte POORT van de
   machtigingslaag. Apart houdt het allebei aanwijsbaar -- en het scheelt dat
   bestand de omvangsgrens van keuringsregel 13.
   ========================================================================== */
'use strict';

module.exports = function maakZaakbeeld({ findSupplier, serviceMachtiging }) {

  /* WIE MELDT DIT, ALS HET GEEN LID IS. Een zaak hoeft zijn eigen nummer niet op
     te zoeken om hulp te vragen: de melder draagt `zaak-<code>`, en dat is genoeg
     om te weten met wie u praat.

     Veld voor veld en nooit publicSupplier(): dat is de KLANTweergave, met
     menu's, foto's, kamers en evenementen erin. Een medewerker die een storing
     onderzoekt heeft daar niets aan, en alles wat hier binnenkomt is meteen ook
     alles wat er in de wachtrij te zien is. Vijf velden, en de partnerstand
     erbij omdat een geschorste zaak een ander gesprek is. */
  function zaakprofiel(melder) {
    const m = String(melder || '');
    if (!m.startsWith('zaak-') || typeof findSupplier !== 'function') return null;
    const code = m.slice(5);
    let s = null;
    try { s = findSupplier(code); } catch (e) { s = null; }
    if (!s) return { code, gevonden: false, let: 'Deze zaakcode kennen wij niet meer; de melding blijft staan.' };
    return { code: s.code, naam: s.name || null, soort: s.type || null, stad: s.city || null,
      partnerStand: s.partnerStatus || 'actief', gevonden: true };
  }

  /* DE EERSTE ECHTE POORT VAN DEZE LAAG, EN DAT WAS HARD NODIG.

     `serviceMachtiging.magNu()` had NUL aanroepers: de machtiging legde
     toestemming vast en opende niets -- niet voor een AI, en ook niet voor een
     mens. Dat is precies het gebrek dat CONTROLPLANE.md benoemt ("geen
     capability zonder caller") en dat scripts/capabilityroepers.js meet. Een
     bevoegdheidslaag zonder poort is een register van goede voornemens.

     Hier gaat er dus echt iets doorheen. Het BASISprofiel (wie belt er) blijft
     open -- een medewerker moet weten met wie hij praat zonder eerst iets te
     vragen. Wat achter de poort ligt is de OPERATIONELE stand van die zaak, en
     dat is niet iets wat je terloops opent omdat er iemand belt.

     Zonder machtiging staat er niet niets, maar de REDEN: een leeg vak wordt
     ingevuld met iemands eigen aanname. */
  function zaakstand(profiel, zaakId, machtigingId, wie) {
    if (!profiel || !profiel.gevonden) return null;
    if (!machtigingId) {
      return { open: false, waarom: 'Alleen het basisprofiel staat open. Voor de operationele stand van ' +
        'deze zaak is een machtiging nodig, en die vraagt een bevestiging van de zaak zelf.' };
    }
    const oordeel = serviceMachtiging.magNu(machtigingId, 'organisatie.stand', { zaakId });
    if (!oordeel.mag) return { open: false, waarom: oordeel.waarom };
    let s = null;
    try { s = findSupplier(profiel.code); } catch (e) { s = null; }
    if (!s) return { open: false, waarom: 'Deze zaakcode kennen wij niet meer.' };
    /* Veld voor veld, en alleen wat een storing helpt verklaren. */
    return { open: true, door: wie,
      bestellingenOpen: !s.settings || s.settings.ordersOpen !== false,
      reserverenOpen: !s.settings || s.settings.reservationsOpen !== false,
      afdelingen: (s.depts || s.departments || []).length || null,
      medewerkers: (s.staff || []).length || null };
  }

  function zaakprofiel(melder) {
    const m = String(melder || '');
    if (!m.startsWith('zaak-') || typeof findSupplier !== 'function') return null;
    const code = m.slice(5);
    let s = null;
    try { s = findSupplier(code); } catch (e) { s = null; }
    if (!s) return { code, gevonden: false, let: 'Deze zaakcode kennen wij niet meer; de melding blijft staan.' };
    return { code: s.code, naam: s.name || null, soort: s.type || null, stad: s.city || null,
      partnerStand: s.partnerStatus || 'actief', gevonden: true };
  }

  /* DE EERSTE ECHTE POORT VAN DEZE LAAG, EN DAT WAS HARD NODIG.

     `serviceMachtiging.magNu()` had NUL aanroepers: de machtiging legde
     toestemming vast en opende niets -- niet voor een AI, en ook niet voor een
     mens. Dat is precies het gebrek dat CONTROLPLANE.md benoemt ("geen
     capability zonder caller") en dat scripts/capabilityroepers.js meet. Een
     bevoegdheidslaag zonder poort is een register van goede voornemens.

     Hier gaat er dus echt iets doorheen. Het BASISprofiel (wie belt er) blijft
     open -- een medewerker moet weten met wie hij praat zonder eerst iets te
     vragen. Wat achter de poort ligt is de OPERATIONELE stand van die zaak, en
     dat is niet iets wat je terloops opent omdat er iemand belt.

     Zonder machtiging staat er niet niets, maar de REDEN: een leeg vak wordt
     ingevuld met iemands eigen aanname. */
  function zaakstand(profiel, zaakId, machtigingId, wie) {
    if (!profiel || !profiel.gevonden) return null;
    if (!machtigingId) {
      return { open: false, waarom: 'Alleen het basisprofiel staat open. Voor de operationele stand van ' +
        'deze zaak is een machtiging nodig, en die vraagt een bevestiging van de zaak zelf.' };
    }
    const oordeel = serviceMachtiging.magNu(machtigingId, 'organisatie.stand', { zaakId });
    if (!oordeel.mag) return { open: false, waarom: oordeel.waarom };
    let s = null;
    try { s = findSupplier(profiel.code); } catch (e) { s = null; }
    if (!s) return { open: false, waarom: 'Deze zaakcode kennen wij niet meer.' };
    /* Veld voor veld, en alleen wat een storing helpt verklaren. */
    return { open: true, door: wie,
      bestellingenOpen: !s.settings || s.settings.ordersOpen !== false,
      reserverenOpen: !s.settings || s.settings.reservationsOpen !== false,
      afdelingen: (s.depts || s.departments || []).length || null,
      medewerkers: (s.staff || []).length || null };
  }



  return { zaakprofiel, zaakstand };
};
