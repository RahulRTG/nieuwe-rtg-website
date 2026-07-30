/* Idempotentie met verzoek-binding: gedeeld door RTG Pay en RTG Bank.

   Dezelfde knop twee keer indrukken (dubbeltik, haperend netwerk, retry) moet
   exact hetzelfde antwoord geven en nooit dubbel boeken. Dat deel is oud.

   Nieuw is de BINDING aan het verzoek. Alleen de sleutel onthouden is niet
   genoeg: komt dezelfde sleutel terug met een ANDER verzoek, dan gaf de oude
   opzet stil het bewaarde antwoord terug en kreeg de client "gelukt" voor iets
   wat nooit is geboekt. En dat is geen theorie -- de apps bouwden hun sleutel uit
   Date.now(), dus twee acties in dezelfde milliseconde kregen echt dezelfde
   sleutel. Nu bewaren we per sleutel ook een afdruk van de geld-bepalende velden
   en wijkt die af, dan is het een 409.

   Twee bewuste keuzes:
   - Vrije tekst hoort NIET in de afdruk: een andere omschrijving is geen ander
     verzoek en mag dus geen conflict opleveren.
   - Een bewaarde sleutel ZONDER afdruk komt uit een database van voor deze
     binding. Die laten we door zoals voorheen, anders zou een upgrade lopende
     idem-sleutels breken.

   De Rust-motor (motor/src/pay.rs) gebruikt dezelfde afdrukvorm, zodat beide
   engines dezelfde verzoeken als gelijk zien. */
'use strict';

const MAX = 20000; // ring: zoveel sleutels houden we vast

/* `naam` is de sleutel in de database, bijv. 'payIdem' of 'bankIdem'; de
   afdrukken staan naast in '<naam>Afdruk'. `d` geeft het datablok, `save`
   schrijft het weg -- zo blijft deze module vrij van kennis over de opslag. */
module.exports = function maakIdem({ d, save, naam }) {
  function store() {
    if (!d()[naam] || typeof d()[naam] !== 'object') d()[naam] = { _keys: [] };
    if (!Array.isArray(d()[naam]._keys)) d()[naam]._keys = [];
    return d()[naam];
  }
  function afdrukStore() {
    const k = naam + 'Afdruk';
    if (!d()[k] || typeof d()[k] !== 'object') d()[k] = {};
    return d()[k];
  }

  return async function metIdem(sleutel, afdruk, werk) {
    if (!sleutel) return werk();
    const s = store();
    const a = afdrukStore();
    if (sleutel in s && sleutel !== '_keys') {
      if (afdruk && typeof a[sleutel] === 'string' && a[sleutel] !== afdruk) {
        return { status: 409, error: 'Deze idem-sleutel is al gebruikt voor een ander verzoek.' };
      }
      return Object.assign({}, s[sleutel], { herhaald: true });
    }
    const r = await werk();
    if (r && r.ok) {
      s._keys.push(sleutel);
      if (s._keys.length > MAX) {
        for (const weg of s._keys.splice(0, s._keys.length - MAX)) { delete s[weg]; delete a[weg]; }
      }
      s[sleutel] = r;
      if (afdruk) a[sleutel] = afdruk;
      save();
    }
    return r;
  };
};
