/* ============================================================================
   HET OPSLAGCONTRACT VAN CONNECT -- de enige deur van dit domein naar db.data.

   Vier bestanden van deze laag raakten db.data rechtstreeks aan: de horizon,
   het leerdossier, de naklank en (buiten dit domein) de werkherkomst. Dat zijn
   vier doorgangen waar er een hoort te zijn, en de ratel `dbDeuren` in NORM.json
   telde ze prompt -- die staat er juist omdat zevenhonderd van zulke doorgangen
   ooit betekenden dat er geen andere opslag meer onder dit huis paste. De
   volgorde die werkt is eerst het contract en dan de opslag; zonder contract is
   een verhuizing een herschrijving.

   Dezelfde vorm als kern/payroll/opslag.js en kern/concern/opslag.js, en met
   opzet niet een eigen variant ervan.

   DRIE COLLECTIES, EN GEEN ERBIJ. `bak()` weigert een naam die niet in het
   register staat: een collectie die niemand heeft opgeschreven, is een collectie
   die niemand kan verhuizen. Wie hier een vierde wil, schrijft hem eerst op.

   PEILEN EN PAKKEN ZIJN TWEE DINGEN, en dat is de duurste les van deze laag.
   `bak()` MAAKT de collectie aan omdat er zo meteen in geschreven wordt;
   `peil()` kijkt alleen. Hier stond alleen de eerste, en daarmee schreef elke
   LEESroute in db.data -- zonder save(), dus onzichtbaar tot een andere
   handeling toevallig opsloeg. Een route die `leest: true` heet en de opslag
   laat groeien, klopt niet met zijn eigen mutatiecontract en niemand zou het
   merken. Dezelfde faalvorm sloeg later nog twee keer toe: bij een geweigerde
   naklank en bij een geweigerde werkaanmelding, allebei gevonden door een toets
   die ernaar zocht in plaats van door het gedrag.

   WAT DIT BESTAND MET OPZET NIET DOET: geen schema's, geen bevoegdheid, geen
   bewaartermijn. Die horen in een contract thuis en zijn hier niet verzonnen --
   een veld dat er staat maar nergens wordt afgedwongen is de duurste vorm van
   LAT-regel 6, want elk scherm dat hem leest gaat zich ernaar gedragen.
   ========================================================================== */
'use strict';

const REGISTER = {
  horizon:  { soort: 'kaart', wat: 'per codenaam: de schuif en de onderwerpen die de mens ZELF heeft aangeklikt',
    gevoelig: 'voorkeur -- nooit een gevoelig gegeven, zie GEEN_SIGNAAL in ./horizon.js' },
  dossier:  { soort: 'kaart', wat: 'per codenaam: de regels van het leerdossier, chronologisch en aangroeiend',
    gevoelig: 'persoonsgegeven op codenaam -- de vierde voorwaarde van het besluit van 14 september' },
  naklank:  { soort: 'kaart', wat: 'per ding: wie welke naklank gaf, zodat hij terug te nemen is',
    gevoelig: 'persoonsgegeven op codenaam -- de AANTALLEN worden hieruit afgeleid en niet apart geteld' }
};

module.exports = ({ db, save }) => {
  const wortel = () => {
    const d = db.data || (db.data = {});
    if (!d.connect || typeof d.connect !== 'object') d.connect = {};
    return d.connect;
  };

  /* PAKKEN: maakt aan. Alleen aanroepen als er geschreven gaat worden. */
  function bak(naam) {
    const def = REGISTER[naam];
    if (!def) throw new Error('kern/connect/opslag: onbekende collectie "' + naam + '" -- zet hem eerst in het REGISTER');
    const w = wortel();
    if (!w[naam] || typeof w[naam] !== 'object') w[naam] = {};
    return w[naam];
  }

  /* PEILEN: maakt NIETS aan. De enige weg voor een lezer. */
  function peil(naam) {
    if (!REGISTER[naam]) throw new Error('kern/connect/opslag: onbekende collectie "' + naam + '"');
    const d = db && db.data && db.data.connect;
    return (d && d[naam] && typeof d[naam] === 'object') ? d[naam] : null;
  }

  return { bak, peil, bewaar: save, REGISTER };
};
