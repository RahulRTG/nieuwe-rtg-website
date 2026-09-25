/* WANNEER WAS DIT LID VOOR HET LAATST HIER -- een dag, en verder niets.

   Besluit van de eigenaar (25 september 2026): retentie wordt op twee manieren
   gemeten, als WAARDE (een geslaagde uitkomst in de periode) en als AANWEZIGHEID.
   Voor die tweede is dit het spoor. De vorm is met opzet het minimum:

     - per lid EEN dag (JJJJ-MM-DD), overschreven bij het eerste bezoek van een
       nieuwe dag. Geen tijd, geen route, geen apparaat, geen journaal: wie wil
       weten WAT iemand deed, heeft hier niets te zoeken;
     - op codenaam, net als de ledengids waarnaast hij wordt aangeraakt
       (kern/gids.js dirTouch -- hetzelfde keelgat, zodat "aanwezig" niet op twee
       deuren iets anders betekent);
     - na dertien maanden zonder bezoek weg (server/bewaarbeleid-operationeel.js):
       genoeg voor een retentie over 30, 90 en 365 dagen, en niet meer.

   Wat de kostenmeter al weet (verzoeken per drager per MAAND, kern/kosten/meter.js)
   blijft daar; dit bestand voegt alleen de dag toe die de eigenaar vroeg. */
'use strict';

const BEWAAR_DAGEN = 395;

/* DE LATE BINDING. De ledengids (kern/gids.js) wordt eerder gebouwd dan deze
   module (server/opzet/kernlaag4.js), dus hij raakt de aanwezigheid via `raak`
   hieronder: zolang er nog geen instantie is, gebeurt er niets. Een instantie
   meldt zich bij het bouwen aan als de actieve. */
let actief = null;
const NAAM = 'laatstActief';

/* De opslag is een kaart { codenaam: [{ dag }] } en schrijft via
   ./eigentransactie.js: bij het eerste bezoek van de dag schrijven vele leden
   tegelijk, en in de PostgreSQL-stand met meer instanties botst een gedeelde
   lijst dan in de requestcommit. De ene rij per lid staat in een lijstje zodat
   de bewaarveger hem op zijn dag kan laten verlopen (vorm mapVanLijsten, met
   `leegWeg`: een verlopen lid verdwijnt ook als sleutel). */
function maakAanwezigheid({ db, save, bewerkCollectie, nu }) {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/aanwezigheid', bezit: { [NAAM]: 'kaart' } });
  const schrijf = require('./eigentransactie')({ naam: NAAM, eigen, save, bewerkCollectie });
  const klok = typeof nu === 'function' ? nu : Date.now;
  /* Wat dit proces vandaag al heeft laten schrijven. Zonder dit gaat elk verzoek
     van een lid tot de commit zichtbaar is opnieuw een transactie in. */
  let vandaag = null, gezien = new Set();

  function raakAanwezig(codenaam) {
    if (!codenaam) return false;
    const cn = String(codenaam);
    const dag = new Date(klok()).toISOString().slice(0, 10);
    if (dag !== vandaag) { vandaag = dag; gezien = new Set(); }
    if (gezien.has(cn)) return false;
    const r = eigen.kijk(NAAM)[cn];
    gezien.add(cn);
    if (Array.isArray(r) && r[0] && r[0].dag === dag) return false;
    schrijf(kaart => { kaart[cn] = [{ dag }]; });
    return true;
  }

  function laatstActief() {
    const kaart = eigen.kijk(NAAM), uit = [];
    for (const cn of Object.keys(kaart || {}))
      if (Array.isArray(kaart[cn]) && kaart[cn][0]) uit.push({ codenaam: cn, dag: kaart[cn][0].dag });
    return uit;
  }

  const api = { raakAanwezig, laatstActief, BEWAAR_DAGEN };
  actief = api;
  return api;
}

module.exports = maakAanwezigheid;
module.exports.raak = (codenaam) => (actief ? actief.raakAanwezig(codenaam) : false);
