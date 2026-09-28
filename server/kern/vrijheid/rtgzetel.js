/* RTG ZELF ALS WERKGEVER: EEN ZETEL IN DE RTG-ZAAK IS DE KANTOORSLEUTEL.

   Besluit van de eigenaar (27 september 2026, stap twee): wie op zijn EIGEN
   account personeel is van de RTG-zaak en minstens een kamer heeft, komt het
   kantoor binnen op naam -- zonder de gedeelde OFFICE_CODE en zonder een
   uitnodiging. Die twee blijven werken; de uitnodiging is voor wie buiten de
   zaak valt, en de gedeelde code wordt geteld tot hij dicht kan.

   AFGELEID EN NIET OPGESLAGEN, zoals de kantoorsleutel van de eigenaar
   (kern/eenaccount/afgeleid.js): aan iets wat je al BENT valt niets te
   koppelen, en een tweede kopie van "wie werkt bij RTG" loopt uit de pas met
   het origineel. Haalt een leidinggevende iemand uit zijn laatste kamer, of
   gaat hij uit dienst, dan is de sleutel bij de volgende vraag weg.

   ZONDER KAMER GEEN SLEUTEL. Een dienstverband alleen zegt niet dat iemand in
   het kantoor hoort: de kamer is het besluit van een leidinggevende, op naam
   (rtghuis.afdelingZet). Een lege lijst is dicht, zoals in kern/stuur/mandaat.js.

   De kamers gaan mee als SCHADUW (AUTHORITY.md par. 5d): de beleidsmotor telt
   of een kamer werd gebruikt door wie er zit, door iemand die er niet zit, of
   door een sessie zonder toewijzing (de gedeelde code, een uitnodiging). Er
   wordt niemand tegengehouden, en er wordt niet vastgelegd wie. */
'use strict';
const { idVanKey } = require('../../lib/lidsleutel');

module.exports = ({ accounts, rtghuis }) => {
  /* De positie van dit account in de RTG-zaak, of null. Een bron die gooit is
     null: geen sleutel, en dat is de voorzichtige kant. */
  function positie(key) {
    const id = idVanKey(key);
    if (id == null) return null;
    try {
      const zaak = rtghuis.rtgZaak();
      const staff = zaak ? accounts.staffByMember(zaak.code, id) : null;
      return staff ? { zaak, staff } : null;
    } catch (e) { return null; }
  }

  /* De kamers van deze mens, of null als hij geen zetel in de RTG-zaak heeft
     (dat is "geen toewijzing", en dat is iets anders dan een lege lijst). */
  function kamersVan(key) {
    const p = positie(key);
    return p ? rtghuis.afdelingenVan(p.staff.id) : null;
  }

  function zetelVan(key) {
    const p = positie(key);
    if (!p) return null;
    const kamers = rtghuis.afdelingenVan(p.staff.id);
    if (!kamers.length) return null;
    return { rol: 'kantoor', code: null, staffId: null, naam: 'RTG-kantoor', zaakNaam: p.zaak.name || null,
      at: null, viaRtgZaak: true, kamers };
  }

  return { zetelVan, kamersVan };
};
