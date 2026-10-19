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
/* De handeling waarin een boeking valt: ./idem-handeling.js. */
const { handeling, volgendeStap } = require('./idem-handeling');
const { zonderSleutelPad, nietVastgelegd, vergeetSleutel } = require('./idem-zondersleutel');

/* `naam` is de sleutel in de database, bijv. 'payIdem' of 'bankIdem'; de
   afdrukken staan naast in '<naam>Afdruk'. `d` geeft het datablok, `save`
   schrijft het weg -- zo blijft deze module vrij van kennis over de opslag.

   `bijeen` (optioneel, db.bijeen): bundelt de saves van het werk en van de
   idem-registratie tot EEN commit. Zonder die bundel staat er in de
   sqlite-stand tussen de geld-flush (in het werk) en de idem-flush (hier) een
   toestand op schijf waarin de boeking bestaat en de sleutel niet -- en een
   kill -9 precies daar plus de retry waar idem-sleutels voor bestaan, boekt
   dubbel. Zo gevonden, met een echte dubbele boeking van 137 centen. Geef
   bijeen alleen mee als het werk geen echte I/O afwacht (zie db/index.js).

   STAAT ER AL EEN BUNDEL OPEN BIJ DE AANROEPER, dan doet deze commit daarin
   mee. Dat wordt hier NIET geregeld: `bijeen()` zelf sluit sinds 12 september
   aan op een openstaande bundel die dezelfde belofte doet (db/bijeen.js). Dat
   is met opzet daar en niet hier -- anders zou elke aanroeper van een commit
   die vraag apart moeten stellen, en de eerste die hem vergeet doet dat stil.

   `sleutelPlicht` (optioneel, een functie): geeft hij true, dan is een handeling
   ZONDER sleutel en buiten een andere handeling een weigering -- ook als de
   aanroeper geen `geld` verklaarde. RTG Pay zet hem in motorstand: daar draagt
   elke boeking een sleutel, en zonder sleutel van de client is die er niet.
   Hier en niet bij de boeking, want de boeking komt NA zorgSaldo, en dan kan
   er al geld van een kaart zijn gegaan.

   `poort` (optioneel, een functie): de vrijgavepoort voor NIEUW werk -- na de
   herhaling, voor het werk. Wat dat betekent en waarom juist daar, staat in
   ./idem-nieuwwerk.js. */
function maakIdem({ d, save, naam, bijeen, duurzaam, sleutelPlicht, poort }) {
  const poortVoorNieuwWerk = require('./idem-nieuwwerk').maakPoortVoorNieuwWerk(poort);
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
    /* Alles zonder sleutel woont in ./idem-zondersleutel.js: de weigering op
       geld en de sleutelplicht, de vrijgavepoort, en het werk zelf -- in een
       duurzame laag door dezelfde bundel als met sleutel. */
    if (!sleutel) return zonderSleutelPad({ opties, werk, bijeen, duurzaam, naam, sleutelPlicht, poortVoorNieuwWerk,
      inHandeling: () => !!handeling.getStore() });
    /* `_keys` is de ring en `__proto__` het prototype: geen sleutel, en nooit
       een plek om een antwoord neer te zetten (test/idem-sleutelnaam.test.js). */
    if (sleutel === '_keys' || sleutel === '__proto__') {
      return { status: 400, code: 'IDEMPOTENTIESLEUTEL_ONGELDIG', error: 'Deze idem-sleutel is niet bruikbaar.' };
    }
    const s = store();
    const a = afdrukStore();
    if (Object.hasOwn(s, sleutel)) {
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
    /* Geen herhaling en geen lopende vlucht: dit is NIEUW werk. Pas hier de
       vrijgavepoort (zie de kop van maakIdem). */
    const dicht = poortVoorNieuwWerk(opties);
    if (dicht) return dicht;
    let klaar;
    inVlucht.set(sleutel, { afdruk: afdruk || '', belofte: new Promise(res => { klaar = res; }) });
    let r = null, fout = null;
    /* Het werk en de vastlegging van de sleutel horen als EEN geheel op schijf
       te landen (zie de kop): met bijeen flusht de save() hieronder ook de
       saves die het werk zelf deed, in een commit. */
    const doeWerkEnLegVast = async () => {
      try { r = await handeling.run({ naam, sleutel, stappen: 0 }, werk); }
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
    // bevestigt de opslag niet: 503 en geen hangende vlucht (de worp liep langs inVlucht.delete en klaar() heen)
    let opslagFout = null;
    try {
      if (bijeen) await bijeen(doeWerkEnLegVast, duurzaam ? { duurzaam: true } : undefined);
      else await doeWerkEnLegVast();
    } catch (e) { opslagFout = e; }
    inVlucht.delete(sleutel);
    if (opslagFout && !fout) { vergeetSleutel(s, a, sleutel); const nee = nietVastgelegd(naam, opslagFout); klaar(nee); return nee; }
    klaar(fout ? { status: 500, error: 'De vorige poging met deze sleutel mislukte.' } : r);
    if (fout) throw fout;
    return r;
  };
}

module.exports = maakIdem;
module.exports.volgendeStap = volgendeStap;
