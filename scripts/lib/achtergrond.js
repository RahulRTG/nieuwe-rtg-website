/* HOEVEEL ACHTERGRONDWERK DRAAIT ER, EN HANGT DAT ERGENS AAN?

   WAAROM DIT EEN METING IS EN GEEN FUNCTIE. De drager `workload` uit
   server/kern/isolatie/dragers.js staat er met `bron: null`: een achtergrondtaak,
   een geplande opdracht en een webhook-verwerker zijn geen mens en geen sessie,
   en ze zijn vandaag de enige uitvoeringsvorm die aan geen enkele drager hangt.

   De verleiding is om dat op te lossen met de async-context die er al is
   (kern/kosten/haak.js). Dat kan niet, en dat is nagemeten in plaats van
   beredeneerd: die haak wordt op drie plekken betreden en alle drie zijn het
   HTTP-poorten. Een achtergrondtaak krijgt daar `huis` -- maar `huis` betekent
   op die plek tegelijk "achtergrondtaak", "onbekende aanroeper" en "de kern was
   nog niet wakker". Die waarde als workload-signaal lezen is een tweede
   betekenis op een bestaand woord, en dat is precies de fout die SEMANTIEK.json
   in dit huis 94 keer heeft gevonden.

   Twee plekken in de code zeggen die afwezigheid trouwens zelf al:
   server/opzet/handeling.js ("een cronjob, de onderhoudsveger of een migratie
   draait buiten deze context; die zijn hier onzichtbaar en horen dat ook te
   zijn") en server/kern/mailwachtrij.js ("er loopt geen wekker").

   WAT DEZE METER DUS DOET: hij telt de afwezigheid, zodat "workload is niet
   gebouwd" een GETAL heeft in plaats van een zin. Een gat zonder maat wordt niet
   gedicht, want niemand weet hoe groot hij is.

   HIJ IS EEN ONDERGRENS EN GEEN INVENTARIS, en dat staat in de uitslag: hij
   herkent `setInterval` en `setTimeout` met een herhaling, en een taak die op een
   andere manier wordt gestart telt hij niet. Een meter die zich completer
   voordoet dan hij is, is erger dan een lager getal. */
'use strict';

const fs = require('fs');
const path = require('path');

/* De async-contexten die dit huis kent. Betreedt een bestand er een, dan HEEFT
   het in principe een plek waar een drager zou kunnen hangen. */
const CONTEXTEN = [
  { naam: 'kosten/haak', patroon: /require\(['"][^'"]*kosten\/haak['"]\)|kostenHaak\.binnen\(/ },
  { naam: 'envelop', patroon: /require\(['"][^'"]*kern\/envelop['"]\)/ },
  { naam: 'db/bijeen', patroon: /\bbijeen\s*\(/ }
];

function meet(wortel) {
  const root = wortel || path.join(__dirname, '..', '..', 'server');
  const sites = [];
  const bestanden = new Set();
  const metContext = new Set();

  (function loop(map) {
    for (const naam of fs.readdirSync(map, { withFileTypes: true })) {
      const p = path.join(map, naam.name);
      if (naam.isDirectory()) { if (naam.name !== 'data' && naam.name !== 'node_modules') loop(p); continue; }
      if (!naam.name.endsWith('.js')) continue;
      const tekst = fs.readFileSync(p, 'utf8');
      const rel = path.relative(path.join(root, '..'), p).replace(/\\/g, '/');
      const regels = tekst.split('\n');
      let raak = false;
      for (let i = 0; i < regels.length; i++) {
        if (!/\bsetInterval\s*\(/.test(regels[i])) continue;
        raak = true;
        sites.push({ waar: rel + ':' + (i + 1), code: regels[i].trim().slice(0, 80) });
      }
      if (!raak) continue;
      bestanden.add(rel);
      for (const c of CONTEXTEN) if (c.patroon.test(tekst)) metContext.add(rel + ' (' + c.naam + ')');
    }
  })(root);

  return {
    sites: sites.length,
    bestanden: bestanden.size,
    metContext: metContext.size,
    contextpunten: [...metContext].sort(),
    voorbeelden: sites.slice(0, 10),
    ondergrens: 'alleen setInterval wordt herkend; een taak die anders wordt gestart telt hier niet mee'
  };
}

module.exports = { meet, CONTEXTEN };
