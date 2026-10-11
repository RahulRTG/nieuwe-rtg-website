/* WELKE CODE SCHREEF DEZE AUDITREGEL? (audit P2-7)

   Een auditregel die zegt WIE iets deed maar niet met WELKE versie van de
   software, laat een vraag open die na een incident de eerste is: gebeurde dit
   voor of na de release met de reparatie? Daarom draagt een regel de commit
   waarmee hij geschreven is, BINNEN de hash, zodat hij er niet achteraf op te
   zetten of af te halen is.

   Waar het getal vandaan komt, in volgorde:
     1. `RTG_RELEASE_COMMIT` -- door de uitrol gezet;
     2. `release-bewijs.json` in de imagewortel (`bron.commit`), het bestand dat
        bij de imagebouw in de alleen-lezen laag komt (zie
        config/foundation-vrijgave.js voor waarom alleen daar).
   Dit is een IDENTITEIT en geen bewijs: de volledige controle of de draaiende
   bytes bij die commit horen, doet config/foundation-vrijgave.js. Wie hier
   niets vindt, krijgt `null` -- nooit een verzonnen versie.

   Eenmaal per proces gelezen: de code verandert niet terwijl hij draait. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

let gelezen = false, waarde = null;
const GELDIG = /^[a-f0-9]{7,64}$/;

function lees(env, root) {
  const uitEnv = String(env.RTG_RELEASE_COMMIT || '').trim().toLowerCase();
  if (GELDIG.test(uitEnv)) return uitEnv.slice(0, 40);
  try {
    const bewijs = JSON.parse(fs.readFileSync(path.join(root, 'release-bewijs.json'), 'utf8'));
    const c = String(bewijs && bewijs.bron && bewijs.bron.commit || '').toLowerCase();
    if (GELDIG.test(c)) return c.slice(0, 40);
  } catch (e) { /* geen bewijs: dan is de versie niet bekend, en dat zegt null */ }
  return null;
}

function release({ env = process.env, root = path.join(__dirname, '..', '..'), vers = false } = {}) {
  if (!gelezen || vers) { waarde = lees(env, root); gelezen = true; }
  return waarde;
}

module.exports = { release };
