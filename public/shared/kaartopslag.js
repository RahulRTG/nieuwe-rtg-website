/* WAT DEZE BROWSER KAN EN WAT HIJ BELOOFT -- de opslagkant van een kaartpakket.

   Dit stond in ./kaartpakket.js en is eruit geknipt toen dat bestand over de
   10 kB-grens ging. De snede is geen willekeurige helft: hier staat alles wat
   over het TOESTEL gaat (mag ik opslaan, hoeveel ruimte is er, blijft het
   staan, en hoe reken ik een controlegetal uit), en in kaartpakket.js alles wat
   over het PAKKET gaat (wat staat er, haal het, gooi het weg). Twee vragen die
   los van elkaar te beantwoorden zijn.

   DRIE DINGEN DIE EEN BROWSER ANDERS DOET DAN EEN TELEFOON-APP, en ze staan
   hier alle drie hardop:

     1. ZONDER HTTPS IS ER GEEN OPSLAG. `caches` en `crypto.subtle` bestaan
        alleen in een beveiligde context. Op http (behalve localhost) kan het
        dus niet, en dan zegt `kan()` dat met de reden -- geen knop die stil
        niets doet.
     2. DE BROWSER MAG HET WEGGOOIEN. Opslag is niet van ons. We VRAGEN
        `navigator.storage.persist()`, en het antwoord staat op het scherm:
        blijft hij staan, of mag de browser hem opruimen als de schijf vol
        loopt? Beloven dat een kaart offline blijft, kan deze laag niet -- en
        `null` (hij zegt het niet) is een derde uitkomst en geen nee.
     3. EEN STUK BESTAND IS ERGER DAN GEEN BESTAND. Een afgekapte of omgekiepte
        graaf levert geen foutmelding maar een ROUTE: de motor leest onzin uit
        de typed arrays en rekent er een net uitziende weg mee. Vandaar `som()`,
        en vandaar dat een browser zonder `crypto.subtle` hier niets mag
        opslaan.

   DE OPSLAG IS DE CACHE STORAGE en niet IndexedDB: de delen zijn hele
   bestanden achter een adres, en dat is precies waar de Cache API voor is. */
(function (w) {
  'use strict';
  if (w.RTGKaartOpslag) return;

  var BAK = 'rtg-kaart-v1';

  function kan() {
    if (!w.caches || !w.isSecureContext) {
      return { ok: false, reden: 'Deze browser geeft alleen op https opslag vrij voor kaarten. Op een ' +
        'onbeveiligde verbinding kan RTG een kaart dus niet op uw toestel zetten.' };
    }
    if (!(w.crypto && w.crypto.subtle)) {
      return { ok: false, reden: 'Deze browser kan een gedownloade kaart niet controleren, en een halve ' +
        'kaart levert routes op die er goed uitzien. RTG bewaart hem daarom niet.' };
    }
    return { ok: true };
  }

  function som(buffer) {
    return w.crypto.subtle.digest('SHA-256', buffer).then(function (d) {
      var u = new Uint8Array(d), s = '';
      for (var i = 0; i < 16; i++) s += u[i].toString(16).padStart(2, '0');
      return s;
    });
  }

  /* Mag de browser dit opruimen? `persisted()` zegt hoe het NU staat,
     `persist()` vraagt het. Beide kunnen ontbreken, en dan is het antwoord
     `null` -- onbekend, en dat is iets anders dan nee. */
  async function blijftStaan() {
    try {
      if (!navigator.storage) return null;
      if (navigator.storage.persisted && await navigator.storage.persisted()) return true;
      if (navigator.storage.persist) return await navigator.storage.persist();
      return null;
    } catch (e) { return null; }
  }

  async function ruimte() {
    try {
      if (!navigator.storage || !navigator.storage.estimate) {
        return { gebruikt: null, quotum: null, blijft: null,
          reden: 'Deze browser zegt niet hoeveel opslag er vrij is.' };
      }
      var s = await navigator.storage.estimate();
      return { gebruikt: s.usage ?? null, quotum: s.quota ?? null, blijft: await blijftStaan() };
    } catch (e) {
      return { gebruikt: null, quotum: null, blijft: null, reden: 'De opslag is niet te bevragen.' };
    }
  }

  w.RTGKaartOpslag = { kan: kan, som: som, blijftStaan: blijftStaan, ruimte: ruimte, BAK: BAK };
}(window));
