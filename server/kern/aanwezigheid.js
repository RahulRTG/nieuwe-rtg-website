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

function maakAanwezigheid({ db, save, nu }) {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/aanwezigheid', bezit: { laatstActief: 'lijst' } });
  const klok = typeof nu === 'function' ? nu : Date.now;
  /* Een index op codenaam, gebonden aan de LIJST waaruit hij is gebouwd. Vervangt
     de bewaarveger of een externe wijziging de lijst, dan hoort de index daar
     niet meer bij en wordt hij opnieuw gebouwd -- anders schrijft raak() in een
     object dat al uit de opslag is gevallen. */
  let index = null, vanLijst = null;
  function idx(lijst) {
    if (index && vanLijst === lijst) return index;
    index = new Map(); vanLijst = lijst;
    for (const r of lijst) if (r && r.codenaam) index.set(r.codenaam, r);
    return index;
  }

  function raakAanwezig(codenaam) {
    if (!codenaam) return false;
    const dag = new Date(klok()).toISOString().slice(0, 10);
    const lijst = eigen.bak('laatstActief');
    const i = idx(lijst);
    const r = i.get(codenaam);
    if (r && r.dag === dag) return false;
    if (r) r.dag = dag;
    else { const n = { codenaam: String(codenaam), dag }; lijst.push(n); i.set(n.codenaam, n); }
    save();
    return true;
  }

  const laatstActief = () => eigen.kijk('laatstActief');

  const api = { raakAanwezig, laatstActief, BEWAAR_DAGEN };
  actief = api;
  return api;
}

module.exports = maakAanwezigheid;
module.exports.raak = (codenaam) => (actief ? actief.raakAanwezig(codenaam) : false);
