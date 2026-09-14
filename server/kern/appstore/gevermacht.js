/* ============================================================================
   WAT HET LID ZELF MAG -- de bron `geverEffectief` van de doorsnede.

   Dit is de helft van REP-03 die per DOMEIN verschilt. De wet zelf
   (effectief = gevraagd ∩ geverEffectief ∩ beleid ∩ context) woont in
   kern/namens/versmalling.js en weet niets van apps; wat een lid van de App
   Store zelf mag, weet alleen deze laag. Die scheiding is met opzet: zou de
   gedeelde laag machtiging-id's gaan kennen, dan is hij geen invariant meer
   maar het begin van een supermandaat-object.

   WAAROM HET EEN EIGEN BESTAND IS EN GEEN REGEL IN ./winkel.js. Twee routes
   verlenen (`installeer` en `verleen`) en ze moeten aantoonbaar dezelfde snede
   maken. Staat de berekening in allebei, dan is de tweede die iemand later
   aanpast de plek waar ze uiteenlopen -- dezelfde reden waarom
   kern/spellen/grens.js een bestand van twee regels is.

   FAIL-CLOSED OP EEN ONBEKENDE EIS, en dat is de enige keuze die hier veilig
   is. Zet iemand in ./machtigingen.js een `eistVanLid` neer waarvoor hier geen
   toets staat, dan valt die machtiging WEG in plaats van door te glippen. Een
   onbekende eis die als "geen eis" wordt gelezen, is precies het gat waar zo'n
   verklaring doorheen lekt -- dezelfde bodem als in ./bereik.js, waar een
   onbekende machtiging naar de ZWAARSTE klasse valt en niet naar de lichtste.
   ========================================================================== */
'use strict';

const { MACHTIGINGEN, lidEis } = require('./machtigingen');

function maakGeverMacht({ progressieMag }) {
  /* De toetsen, op sleutel. Er is er vandaag één; de vorm is die van een map
     zodat een tweede eis erbij een regel is en geen if-ladder. */
  const TOETSEN = {
    progressie: (key) => !!(typeof progressieMag === 'function' && progressieMag(key))
  };

  /* Wat dit lid op DIT moment zelf kan, en wat niet -- met per weggevallen
     machtiging de SLEUTEL van de eis en niet de zin erbij. De zin woont in
     ./machtigingen.js; hem hier meegeven en straks opslaan zou dezelfde tekst
     op twee plekken zetten (LAT-regel 4), en de opgeslagen kopie loopt dan
     achter zodra iemand de uitleg verbetert. */
  function geverEffectief(key) {
    const lijst = [], weg = [];
    for (const m of MACHTIGINGEN) {
      if (!m.eistVanLid) { lijst.push(m.id); continue; }
      const toets = Object.prototype.hasOwnProperty.call(TOETSEN, m.eistVanLid) ? TOETSEN[m.eistVanLid] : null;
      if (!toets) { weg.push({ id: m.id, eis: m.eistVanLid, onbekendeEis: true }); continue; }
      if (toets(key)) lijst.push(m.id);
      else weg.push({ id: m.id, eis: m.eistVanLid, onbekendeEis: false });
    }
    return { lijst, weg };
  }

  /* De opgeslagen vorm: machtiging -> eissleutel, en alleen voor wat het lid
     werkelijk PROBEERDE te geven. Wat hij niet aanvinkte is niet versmald maar
     gewoon niet gevraagd, en die twee door elkaar halen maakt van deze kaart
     een lijst van alles wat een lid niet mag. */
  function versmaldeVan(weg, getikt) {
    const uit = {};
    const g = new Set(Array.isArray(getikt) ? getikt : []);
    for (const w of weg) if (g.has(w.id)) uit[w.id] = w.eis;
    return uit;
  }

  /* Wat een scherm of de brug erover zegt. Geeft `null` bij een eis die deze
     laag niet kent -- liever geen zin dan een verzonnen zin. */
  const uitleg = (eis) => lidEis(eis);

  /* De opgeslagen kaart terug naar iets wat een mens leest. De zin komt hier
     pas bij, uit ./machtigingen.js, en nooit uit de opslag -- dat is de andere
     helft van waarom er een sleutel wordt bewaard en geen tekst. */
  function toonVersmald(kaart) {
    const uit = [];
    for (const [id, eis] of Object.entries(kaart || {})) {
      const m = MACHTIGINGEN.find(x => x.id === id);
      uit.push({ id, label: m ? m.label : id, eis, waarom: uitleg(eis) });
    }
    return uit;
  }

  return { geverEffectief, versmaldeVan, toonVersmald, uitleg, TOETSEN: Object.keys(TOETSEN) };
}

module.exports = { maakGeverMacht };
