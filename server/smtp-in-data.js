/* SMTP ONTVANGEN, deelbestand: de DATA-fase en wat er daarna met het bericht
   gebeurt. Het commando-gesprek staat in ./smtp-in.js.

   Afgesplitst toen dat bestand over de tien kilobyte ging, en de knip loopt
   langs een echte grens: hierboven gaat het over de ENVELOP (wie stuurt, aan
   wie, mag dat) en hier over de INHOUD (de bytes verzamelen, en het antwoord
   dat de verzendende server krijgt).

   TWEE DINGEN DIE HIER MAKKELIJK FOUT GAAN, en daarom met naam staan:

   1. DOT-STUFFING. Een regel die met een punt begint heeft de verzender
      verdubbeld (RFC 5321, 4.5.2), want een losse punt betekent "einde
      bericht". Halen we die extra punt er niet af, dan komt elke regel die met
      een punt begon verminkt aan -- en dat merk je zelden, want de meeste post
      heeft geen zin die met een punt begint.

   2. DE GRENS STOPT HET BEWAREN, NIET HET LEZEN. Bij te veel bytes gooien we de
      inhoud weg maar blijven we regels aannemen tot de punt. De andere kant zit
      midden in een bericht; wie de verbinding daar dichtgooit, laat hem het hele
      bericht straks gewoon opnieuw sturen. */
'use strict';

/* Waarom dit getal: een gewoon bericht met een bijlage blijft ruim onder de
   25 MB die de meeste providers aanhouden, en kern/mailinkomend.js heeft er zelf
   ook een grens onder. Hij staat in de EHLO-aankondiging (SIZE), zodat een
   verzender het weet voordat hij begint. */
const MAX_BYTES = 26214400;

/* Een lopende ontvangst: regels erin, en aan het eind het hele bericht eruit.
   Eigen toestand per bericht, want een verbinding mag er meer dan een sturen. */
function maakOntvangst() {
  const regels = [];
  let bytes = 0, teGroot = false;
  return {
    regel(lijn) {
      if (lijn === '.') return { klaar: true, ruw: regels.join('\r\n'), teGroot };
      const r = lijn.startsWith('..') ? lijn.slice(1) : lijn;
      bytes += r.length + 2;
      if (bytes > MAX_BYTES) { teGroot = true; regels.length = 0; return null; }
      regels.push(r);
      return null;
    }
  };
}

/* De uitkomst van kern/mailaanname.js vertaald naar een SMTP-antwoordcode, en
   die keuze doet ertoe:

     5xx  definitief. De andere kant vertelt het zijn afzender en probeert het
          nooit meer. Hoort bij "dit adres bestaat hier niet" en bij een bericht
          dat wij niet kunnen ontleden -- opnieuw sturen helpt daar niet.
     4xx  tijdelijk. Hij bewaart het bericht en probeert het later opnieuw.
          Hoort bij alles wat ONVERWACHT misging: dan ligt het aan ons, en dan
          hoort andermans post niet verloren te gaan omdat wij een fout hadden.

   De verkeerde kant op kiezen kost echt iets. 4xx waar 5xx hoort, laat een
   verzender dagen doorproberen op een adres dat nooit gaat bestaan; 5xx waar
   4xx hoort, gooit post weg omdat onze database even klemzat. */
function antwoordCode(r) {
  if (!r) return 451;
  if (r.status === 550) return 550;
  if (r.status === 400) return 550;
  return 451;
}

module.exports = { MAX_BYTES, maakOntvangst, antwoordCode };
