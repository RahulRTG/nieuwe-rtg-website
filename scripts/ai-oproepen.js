/* Vindt elke plek die het taalmodel aanroept (anthropic.messages.create) en
   zegt per plek of daar de GEDEELDE promptbasis van Rahul onder ligt.

   Waarom dit bestaat: CLAUDE.md stelt een harde regel -- de AI belooft nooit
   zelf toegang tot de Lifestyle- of Business Pass, bevestigt nooit een boeking
   als verwerkt, en voert geen echte hotel-/luchtvaartmerken op als partner. Die
   regel staat in de gedeelde basis (RAHUL_BASIS -> RAHUL_LEAD, en de per-pas
   aiSystemPrompt): "je belooft niets wat je niet zeker kunt waarmaken (geen
   toegang, geen goedkeuring...)". Wie een nieuwe AI-ingang bouwt en die basis
   NIET gebruikt, schrijft de regel opnieuw of vergeet hem -- en dan lekt de
   belofte terug die de vorige rondes eruit gehaald hebben.

   Deze scanner dwingt niets af; hij inventariseert. check.js (poort 21) legt de
   uitkomst naast een lijst van bewust-erkende uitzonderingen, zodat er geen
   ONGEZIENE AI-ingang zonder de basis kan bijkomen. Zelfde ratel-gedachte als
   NORM.json: niet onmogelijk maken, wel zichtbaar.

   Gebruik:
     const { scan } = require('./ai-oproepen');
     scan(ROOT) -> [{ bestand, draagtRegel }]
*/
const fs = require('fs');
const path = require('path');

// de transportlaag zelf is geen aanroep-plek: die stuurt de al-opgebouwde prompt
// door naar de aanbieder(s), en hoort geen persona te kennen.
const TRANSPORT = new Set(['ai.js', 'anthropic.js', 'openai.js', 'gemini.js', 'local-ai.js']);

// Twee geldige manieren om de toegangsregel te dragen:
//  1) de gedeelde basis eronder (RAHUL_BASIS -> RAHUL_LEAD, of de per-pas aiSystemPrompt);
//  2) de regel letterlijk in dit bestand (zoals kern/stuur/lus.js doet).
const BASIS = /RAHUL_LEAD|RAHUL_BASIS|rahulLeadVoor|aiSystemPrompt/;
const REGEL = /Lifestyle of Business|geen toegang|geen goedkeuring|nooit toegang|belooft nooit|beloof nooit|nooit een pas|nooit een baan/i;
function draagtRegel(code) { return BASIS.test(code) || REGEL.test(code); }

function zonderCommentaar(bron) {
  return String(bron).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function scan(root) {
  const uit = [];
  const wortel = path.join(root, 'server');
  (function loop(dir) {
    for (const naam of fs.readdirSync(dir)) {
      const vol = path.join(dir, naam);
      const st = fs.statSync(vol);
      if (st.isDirectory()) { if (!/node_modules|^data$/.test(naam)) loop(vol); continue; }
      if (!naam.endsWith('.js')) continue;
      const rel = path.relative(wortel, vol).replace(/\\/g, '/');
      if (TRANSPORT.has(rel)) continue;
      const code = zonderCommentaar(fs.readFileSync(vol, 'utf8'));
      if (!/messages\.create\s*\(/.test(code)) continue;
      uit.push({ bestand: rel, draagtRegel: draagtRegel(code) });
    }
  })(wortel);
  uit.sort((a, b) => a.bestand.localeCompare(b.bestand));
  return uit;
}

module.exports = { scan, draagtRegel, BASIS, REGEL, TRANSPORT };
