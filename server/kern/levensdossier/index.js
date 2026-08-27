/* ============================================================================
   HET LEVENSDOSSIER, DE MACHINERIE. De veldenlijst met per veld zijn eigenaar,
   en de doctrine erachter, staan in ./velden.js -- daar hoort de vraag "wie
   gaat waarover" thuis. Hier staat alleen wat die lijst DOET.

   OPGEKNIPT OMDAT HET MOEST: samen waren ze 12.800 byte en keuringsregel 13
   trekt de grens op 10.240. De naad is de natuurlijke: het besluit (welk domein
   bezit welk veld) tegenover de uitvoering (aanmaken, weigeren, lezen). Wie de
   verdeling wil weten, hoeft de machinerie niet te lezen; wie de machinerie
   wijzigt, verandert niets aan de verdeling.
   ========================================================================== */
'use strict';

const { VELDEN, DOMEINEN, NIET_GEBOUWD, COLLECTIE, LEEG } = require('./velden');

module.exports = function maakLevensdossier({ db }) {
  if (!db || !db.data) throw new Error('levensdossier: zonder db.data is er niets om te bewaren');

  /* De container. De ENIGE plek waar db.data.lifestyle ontstaat. */
  function alle() {
    const c = db.data[COLLECTIE];
    if (!c || typeof c !== 'object' || Array.isArray(c)) db.data[COLLECTIE] = {};
    return db.data[COLLECTIE];
  }

  /* Het dossier van een lid. Ook dit maakt niets aan boven de lege map: welke
     velden erin horen, bepaalt de eigenaar van dat veld en niet deze laag. */
  function heel(key) {
    const c = alle();
    const k = String(key == null ? '' : key);
    if (!c[k] || typeof c[k] !== 'object' || Array.isArray(c[k])) c[k] = {};
    return c[k];
  }

  /* HET DOSSIER LEZEN ZONDER HET AAN TE MAKEN. Dit is de tegenhanger van heel()
     en het onderscheid is de hele pointe: een lezer die aanmaakt, laat de
     collectie groeien met een rij per lid dat er EEN KEER naar heeft gekeken.
     test/bureau.test.js bewaakt dat met zoveel woorden -- en ving de eerste
     versie van dit bestand, waarin leesVeld() nog via heel() ging. */
  function leesRecord(key) {
    const c = db.data[COLLECTIE];
    if (!c || typeof c !== 'object' || Array.isArray(c)) return {};
    const d = c[String(key == null ? '' : key)];
    return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
  }

  const klopt = (soort, w) => soort === 'lijst'
    ? Array.isArray(w)
    : (w && typeof w === 'object' && !Array.isArray(w));

  function spec(naam) {
    const s = VELDEN[naam];
    if (!s) {
      throw new Error('levensdossier: "' + naam + '" staat niet in de veldenlijst. ' +
        'Een veld toevoegen is een besluit over wie erover gaat -- zet het erbij, met eigenaar en vorm.');
    }
    return s;
  }

  /* Een handvat voor EEN domein. Alles loopt hierlangs, zodat elke aanroep
     zegt namens wie hij komt. */
  function voor(domein) {
    if (!DOMEINEN.includes(domein)) {
      throw new Error('levensdossier: "' + domein + '" is geen erkend domein. ' +
        'De lijst is gesloten; wie erbij wil, neemt daar een besluit over.');
    }
    return {
      domein,

      /* JE EIGEN VELD. `zaai` vult de binnenvorm bij het AANMAKEN -- wat er in
         een `maison` of een `attenties` hoort is domeinkennis en blijft dus bij
         de aanroeper. */
      veld(key, naam, zaai) {
        const s = spec(naam);
        if (s.eigenaar !== domein) {
          throw new Error('levensdossier: "' + naam + '" is van ' + s.eigenaar + ' en ' + domein +
            ' schrijft er niet in. Lezen kan met leesVeld(); schrijven hoort bij de eigenaar.');
        }
        const d = heel(key);
        if (!klopt(s.soort, d[naam])) {
          d[naam] = LEEG[s.soort]();
          if (typeof zaai === 'function') zaai(d[naam]);
        }
        return d[naam];
      },

      /* JE EIGEN VELD VERVANGEN, voor de plekken die een nieuwe lijst maken in
         plaats van de bestaande te muteren. Dezelfde eigenaarscontrole en
         dezelfde vormcontrole als veld(); zonder die twee zou dit de achterdeur
         zijn waarlangs het contract alsnog lekt. */
      zetVeld(key, naam, waarde) {
        const s = spec(naam);
        if (s.eigenaar !== domein) {
          throw new Error('levensdossier: "' + naam + '" is van ' + s.eigenaar + ' en ' + domein +
            ' schrijft er niet in.');
        }
        if (!klopt(s.soort, waarde)) {
          throw new Error('levensdossier: "' + naam + '" hoort een ' + s.soort + ' te zijn.');
        }
        heel(key)[naam] = waarde;
        return waarde;
      },

      /* EEN VELD VAN EEN ANDER. Geeft terug wat er staat, of de lege vorm als
         de eigenaar nog niets heeft neergezet -- en maakt hem NIET aan: een
         lezer die een veld aanmaakt, is een schrijver met een ander woord. */
      leesVeld(key, naam) {
        const s = spec(naam);
        const w = leesRecord(key)[naam];
        return klopt(s.soort, w) ? w : LEEG[s.soort]();
      },

      /* HET HELE DOSSIER, LEZEND EN NOOIT AANMAKEND. Voor wie er een beeld
         overheen legt in plaats van een sectie te beheren -- vandaag
         kern/levensgraaf, die de knopen elke keer opnieuw bouwt en niets
         bewaart.

         DAT NIET-AANMAKEN IS DE HELE POINTE, en het staat al als waarschuwing
         in kern/levensgraaf/graaf.js: een lezer die het dossier aanmaakt, laat
         db.data.lifestyle groeien met een rij per lid dat er EEN KEER naar heeft
         gekeken. Vandaar dat heel() (die wel aanmaakt) niet naar buiten komt:
         hij is er voor veld(), en een schrijver kent zijn eigen bedoeling. */
      lees: leesRecord,

      /* ALLE dossiers, lezend. Ook deze maakt de container niet aan. */
      alleLezend() {
        const c = db.data[COLLECTIE];
        return (c && typeof c === 'object' && !Array.isArray(c)) ? c : {};
      }
    };
  }

  return { voor, VELDEN, DOMEINEN, NIET_GEBOUWD };
};

module.exports.VELDEN = VELDEN;
module.exports.DOMEINEN = DOMEINEN;
module.exports.NIET_GEBOUWD = NIET_GEBOUWD;
