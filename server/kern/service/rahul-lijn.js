/* ============================================================================
   HET CONTROLESPOOR VAN RAHUL AI -- alleen de uitkomst, nooit de gesprekstekst.

   De gewone serviceloop bezit de tijdlijn. Deze kleine naad bepaalt uitsluitend
   welke velden van een opgevraagd Rahul-advies daarin mogen landen, zodat een
   auditregel niet ongemerkt een tweede kopie van klantinhoud wordt.
   ========================================================================== */
'use strict';

module.exports = function maakRahulLijn({ vind, kort, schoon, noteer, save }) {
  return function legRahulAdviesVast(id, { door, soort, versie, volgendeStap } = {}) {
    const z = vind(id);
    if (!z) return { status: 404, error: 'Deze zaak kennen wij niet.' };
    noteer(z, { wat: 'rahulAdvies', door: schoon(door, 60) || 'onbekend',
      soort: schoon(soort, 20) || 'advies', versie: schoon(versie, 40),
      volgendeStap: schoon(volgendeStap, 300) || null });
    save();
    return { ok: true, zaak: kort(z) };
  };
};
