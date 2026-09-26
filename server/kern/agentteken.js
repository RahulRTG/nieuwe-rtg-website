/* WIE HANDELT: DE MENS, OF DE AI NAMENS DE MENS? -- AUTHORITY.md besluit A5.

   Rahul (kern/stuur.js) voert een handeling uit door de route intern opnieuw aan
   te roepen met het token van de gebruiker. Dat is goed voor de BEVOEGDHEID (de
   AI kan nooit meer dan de mens die hem iets vraagt) en slecht voor het SPOOR:
   in de envelop stond daarna een klik van het lid, en niemand kon zien dat een
   machine het deed.

   Besluit A5: een agent handelt onder een eigen identiteit, NAMENS een mens, en
   het spoor noemt beide. De mens blijft `actor.id` -- die sleutel is op meer
   plekken een datasleutel dan een naam (envelop.wie in salonapp, muziek, de
   zware poort) -- en de agent komt ernaast als `actor.agent`.

   HET KENMERK IS NIET TE VERVALSEN, en daarom geen gewone kop. Een kop die
   iedereen kan meesturen, laat een mens een handeling op naam van de AI zetten
   (of de AI op naam van niemand). Het kenmerk draagt een geheim dat alleen in dit
   PROCES bestaat: de interne aanroep gaat naar 127.0.0.1 en dus naar hetzelfde
   proces, en een geheim dat nooit de schijf of het netwerk raakt, is buiten dit
   proces niet te kennen. Een verkeerd of ontbrekend geheim is gewoon geen agent
   -- nooit een fout, want het verzoek zelf is dan een gewone menselijke aanroep.

   WAT DIT NIET DOET: bevoegdheid veranderen. De agent krijgt geen enkele deur
   meer of minder; hij wordt alleen ZICHTBAAR. Wat hij mag, blijft de doorsnede
   die kern/stuur/beleid.js en de gewone poorten al bepalen. */
'use strict';

const crypto = require('crypto');

const KOP = 'x-rtg-agent';
const GEHEIM = crypto.randomBytes(24).toString('hex');
/* De agents die dit huis kent. Een onbekende naam is geen agent. */
const NAMEN = Object.freeze(['rahul']);

/* Voor de interne aanroep: de waarde van de kop. */
function kop(naam) {
  if (!NAMEN.includes(naam)) throw new Error('agentteken: onbekende agent ' + naam);
  return naam + '.' + GEHEIM;
}

/* Voor de envelop: 'ai:<naam>' als het kenmerk echt uit dit proces komt, anders null. */
function agentVan(req) {
  try {
    const w = String((req && typeof req.get === 'function' && req.get(KOP)) || '');
    const i = w.lastIndexOf('.');
    if (i < 1) return null;
    const naam = w.slice(0, i), geheim = Buffer.from(w.slice(i + 1));
    const echt = Buffer.from(GEHEIM);
    if (!NAMEN.includes(naam) || geheim.length !== echt.length) return null;
    return crypto.timingSafeEqual(geheim, echt) ? 'ai:' + naam : null;
  } catch (e) { return null; }
}

/* Het antwoord zegt het terug (server/effectbon.js roept dit aan bij res.end):
   alleen als de envelop een agent draagt, en dan alleen de agentnaam. */
function meld(req, res) {
  const ag = req && req.envelop && req.envelop.actor && req.envelop.actor.agent;
  if (ag && res && !res.headersSent) res.setHeader('X-RTG-Handelaar', ag);
}

module.exports = { KOP, kop, agentVan, meld, NAMEN };
