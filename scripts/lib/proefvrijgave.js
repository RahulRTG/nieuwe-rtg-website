/* DE VRIJGAVEPOORT VOOR EEN PROEFWERELD: een losse RTG Pay (of een losse
   connectlaag) die een toets of een meetscript zelf opbouwt, zonder server.

   WAT ER ONTBREEKT IN ZO'N WERELD, en het enige dat dit bestand toevoegt: de
   BEVOEGDHEIDSLAAG. Die leeft in de kern-tas van een draaiende server
   (server/opzet/kernlaag4b.js); een proefwereld heeft er geen, en dan staat elke
   capability die op een bevoegdheidsvermogen rust (geld.intern_saldo:
   WALLET_SALDO) eerlijk op niet-geautoriseerd. Hier staat er een die ja zegt,
   met `via: 'proefwereld'` als reden.

   WAT HIER NIET WORDT NAGEMAAKT: de stand, het bewijs en de lokale regel. De
   stand is een vers bestand in een eigen map (niets vastgelegd), en de lokale
   sandboxregel (server/kern/vrijgave/lokaal.js) wordt uit de ECHTE omgeving
   gelezen. Een proefwereld werkt dus alleen op een aantoonbaar lokale
   installatie, op de rail zonder echt geld -- en in productie weigert deze
   module te bestaan, zodat hij nooit een deur kan openen die daar dicht hoort.

   Server-code laadt dit bestand NOOIT (test/vrijgave-proefwereld.test.js zakt
   als een bestand onder server/ hem noemt). */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function proefVrijgave({ map, besluiten = [], bevoegd } = {}) {
  if (process.env.NODE_ENV === 'production')
    throw new Error('proefVrijgave bestaat niet in productie: een proefwereld hoort daar niet te draaien.');
  const { maakVrijgave } = require('../../server/kern/vrijgave');
  const { maakStand } = require('../../server/kern/vrijgave/stand');
  const m = map || fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-proefvrijgave-'));
  const v = maakVrijgave({ stand: maakStand({ bestand: path.join(m, 'vrijgave-stand.json') }),
    bevoegd: bevoegd || { mag: () => ({ mag: true, via: 'proefwereld' }) } });
  for (const b of besluiten) {
    const r = v.besluitVastleggen(b, { wie: 'user-1', bron: 'proefwereld-' + b, sha256: 'a'.repeat(64),
      reden: 'besluit in een proefwereld', stapOmhoog: true });
    if (!r.ok) throw new Error('proefVrijgave: besluit ' + b + ' niet vastgelegd: ' + r.error);
  }
  return v;
}

/* Een standbestand voor een ECHTE server in een toets (RTG_DATA_DIR), met
   vastgelegde besluiten. Zo draagt een toetswereld een besluit van de eigenaar
   (bijvoorbeeld B3, elektronisch geld) zoals een echte installatie dat zou doen:
   als feit in de stand, en nergens als vlag in de code. */
function standMetBesluiten(map, besluiten) {
  const { FORMAAT } = require('../../server/kern/vrijgave/stand');
  const op = new Date().toISOString();
  const staat = { formaat: FORMAAT, versie: 1, standen: {}, besluiten: {}, geschiedenis: [] };
  for (const b of besluiten) {
    staat.besluiten[b] = { wie: 'user-1', op, bron: 'toetswereld-' + b, sha256: 'a'.repeat(64), reden: 'besluit in een toetswereld' };
    staat.geschiedenis.push({ op, besluit: b, vastgelegd: true, wie: 'user-1', bron: 'toetswereld-' + b, sha256: 'a'.repeat(64), reden: 'besluit in een toetswereld' });
  }
  fs.mkdirSync(map, { recursive: true });
  fs.writeFileSync(path.join(map, 'vrijgave-stand.json'), JSON.stringify(staat, null, 1) + '\n');
}

module.exports = { proefVrijgave, standMetBesluiten };
