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
module.exports = function maakIdem({ d, save, naam, bijeen, duurzaam }) {
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

  return async function metIdem(sleutel, afdruk, werk, opties) {
    /* GEEN SLEUTEL IS GEEN VERZOEK -- op de handelingen die geld verplaatsen.

       `if (!sleutel) return werk()` was hier de hele regel: stuurt een client
       geen sleutel, dan gebeurt het werk gewoon. Voor het meeste in dit huis is
       dat de juiste afweging, maar de kale ronde van de idemproef mat achttien
       geldroutes waar een woordelijk gelijke herhaling ZONDER sleutel het werk
       opnieuw deed -- /api/bank/overboek boekte twee keer, /api/bank/sepa
       stuurde twee keer het huis uit. Een dubbeltik op een trage verbinding is
       precies dat verzoek, twee keer.

       WAAROM HIER EN NIET IN DE HTTP-POORT. Daar heeft het gestaan, en het was
       fout: server/lib/idem-poort.js draait VOOR de bewakers, dus een lid dat de
       rekening van een ander probeerde kreeg 400 in plaats van 404, en twee
       toetsen die juist die eigendomsgrens meten zagen hem niet meer. Hier staat
       de weigering NA de eigenaarscontrole van de aanroeper (zie
       ../kern/bank/overboeken.js: `if (!eigenaar(...)) return 404` staat boven de
       metIdem-aanroep) en VOOR het werk. Dat is de enige plek waar allebei waar
       is.

       De aanroeper verklaart het, met een reden die in de weigering terechtkomt.
       Geen lijst van paden hier: deze laag kent geen routes, en een tweede lijst
       naast de aanroepplek loopt uit elkaar. */
    if (!sleutel && opties && opties.geld) {
      return { status: 400, code: 'IDEMPOTENTIESLEUTEL_VERPLICHT',
        error: 'Deze opdracht verplaatst geld en vraagt een idempotentiesleutel. ' +
          'Stuur een `idem` mee en gebruik bij een herhaling dezelfde waarde.',
        waarom: String(opties.geld) };
    }
    if (!sleutel) return werk();
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
    /* `duurzaam` maakt van deze bundel een duurzame commit: boeking én
       idem-sleutel staan pas vast als de opslag het heeft bevestigd, en pas
       daarna keert de aanroeper terug. Zonder dat is de bundel wel ATOMAIR maar
       niet DUURZAAM -- en dan blijft de fout bestaan die de ketenronde vond:
       bevestigd aan de klant, na een herstart weg. Zie GELDLAT.md. */
    if (bijeen) await bijeen(doeWerkEnLegVast, duurzaam ? { duurzaam: true } : undefined);
    else await doeWerkEnLegVast();
    inVlucht.delete(sleutel);
    klaar(fout ? { status: 500, error: 'De vorige poging met deze sleutel mislukte.' } : r);
    if (fout) throw fout;
    return r;
  };
};
