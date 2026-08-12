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
   schrijft het weg -- zo blijft deze module vrij van kennis over de opslag.

   `bijeen` (optioneel, db.bijeen): bundelt de saves van het werk en van de
   idem-registratie tot EEN commit. Zonder die bundel staat er in de
   sqlite-stand tussen de geld-flush (in het werk) en de idem-flush (hier) een
   toestand op schijf waarin de boeking bestaat en de sleutel niet -- en een
   kill -9 precies daar plus de retry waar idem-sleutels voor bestaan, boekt
   dubbel. Zo gevonden, met een echte dubbele boeking van 137 centen. Geef
   bijeen alleen mee als het werk geen echte I/O afwacht (zie db/index.js). */
module.exports = function maakIdem({ d, save, naam, bijeen }) {
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

  /* IN VLUCHT: de sleutels die op DIT moment nog draaien.

     De bewaarde sleutel hierboven is een grendel die pas NA het werk dichtvalt.
     Tussen de controle en die vastlegging staat `await werk()`, en daar passen
     twee gelijktijdige verzoeken doorheen: allebei zien een lege store, allebei
     voeren het werk uit, allebei boeken echt. Het venster gaat pas open zodra
     werk() ECHTE I/O doet -- Postgres, de Rust-motor, Stripe -- en dat is precies
     het productiepad, niet het pad van de toetsen.

     Een tweede verzoek met dezelfde sleutel wacht daarom op het eerste en krijgt
     diens antwoord, net als een herhaling na afloop. Mislukt het werk, dan wordt
     er niets bewaard en mag een volgende poging het gewoon opnieuw doen -- dat
     blijft zoals het was. */
  const inVlucht = new Map();

  return async function metIdem(sleutel, afdruk, werk) {
    if (!sleutel) return werk();
    /* EEN TWEEDE SLOT, NIET HET EERSTE -- en dat onderscheid is de moeite waard.

       Wet RTG-038. De echte reparatie staat in server/opzet/lijfpoort.js: daar
       wordt req.body.idem canoniek gemaakt VOORDAT vijftien routes er een sleutel
       mee samenstellen ('oplaad:' + codenaam + ':' + idem).

       Waarom niet hier alleen: de client-sleutel staat MIDDEN in die samenstelling.
       Ik heb deze regel eerst als DE reparatie gebouwd, en toen gemeten dat hij
       niets deed -- 'oplaad:kiek: probe-1 ' trimt aan de buitenkant en houdt de
       spatie binnenin. Het saldo bleef 10000 in plaats van 5000. Canoniseren moet
       dus voor het samenstellen.

       Waarom hij toch blijft staan: deze laag wordt ook aangeroepen met sleutels
       die niet uit een HTTP-body komen, en een tweede slot dat niets kost is geen
       dubbele waarheid maar diepteverdediging. Wat hij WEL alleen doet is een
       samengestelde sleutel weigeren die stuurtekens of onzin bevat; die zou
       anders als "geen sleutel" kunnen doorgaan en het werk ongegrendeld laten
       draaien -- en dan is elke retry een nieuwe boeking. */
    const canon = require('../sleutelvorm').canoniekeSleutel(sleutel);
    if (!canon) return { status: 400, error: 'Ongeldige idem-sleutel (leeg, te lang of met stuurtekens).' };
    sleutel = canon;
    const s = store();
    const a = afdrukStore();
    if (sleutel in s && sleutel !== '_keys') {
      if (afdruk && typeof a[sleutel] === 'string' && a[sleutel] !== afdruk) {
        return { status: 409, error: 'Deze idem-sleutel is al gebruikt voor een ander verzoek.' };
      }
      return Object.assign({}, s[sleutel], { herhaald: true });
    }
    const bezig = inVlucht.get(sleutel);
    if (bezig) {
      if (afdruk && bezig.afdruk && bezig.afdruk !== afdruk) {
        return { status: 409, error: 'Deze idem-sleutel is al gebruikt voor een ander verzoek.' };
      }
      const eerder = await bezig.belofte;
      return (eerder && typeof eerder === 'object') ? Object.assign({}, eerder, { herhaald: true }) : eerder;
    }
    let klaar;
    inVlucht.set(sleutel, { afdruk: afdruk || '', belofte: new Promise(res => { klaar = res; }) });
    let r = null, fout = null;
    /* Het werk en de vastlegging van de sleutel horen als EEN geheel op schijf
       te landen (zie de kop): met bijeen flusht de save() hieronder ook de
       saves die het werk zelf deed, in een commit. */
    const doeWerkEnLegVast = async () => {
      try { r = await werk(); }
      catch (e) { fout = e; }
      /* Vastleggen en pas daarna de vlucht sluiten. Er staat geen await tussen, dus
         een derde verzoek ziet altijd of de bewaarde sleutel of de vlucht -- nooit
         het gat ertussen. */
      if (!fout && r && r.ok) {
        s._keys.push(sleutel);
        if (s._keys.length > MAX) {
          for (const weg of s._keys.splice(0, s._keys.length - MAX)) { delete s[weg]; delete a[weg]; }
        }
        s[sleutel] = r;
        if (afdruk) a[sleutel] = afdruk;
        save();
      }
    };
    if (bijeen) await bijeen(doeWerkEnLegVast); else await doeWerkEnLegVast();
    inVlucht.delete(sleutel);
    klaar(fout ? { status: 500, error: 'De vorige poging met deze sleutel mislukte.' } : r);
    if (fout) throw fout;
    return r;
  };
};
