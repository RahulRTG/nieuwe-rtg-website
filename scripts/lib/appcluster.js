/* ============================================================================
   ROOD CLUSTEREN -- van honderden rode cellen naar een handvol oorzaken.

   APPWERKT.json heeft per onderdeel uit MAPPEN acht bewijzen, en het merendeel
   staat niet op BEWEZEN. Wie dat per app gaat oplossen, lost dezelfde oorzaak
   tientallen keren op. Deze module groepeert elke cel die niet BEWEZEN is op zijn
   OORZAAK: de reden, genormaliseerd zodat wat per app verschilt (getallen, paden,
   aangehaalde tekst) wegvalt en wat gedeeld is overblijft.

   DRIE REGELS, alle drie uit een fout die in dit huis al eens is gemaakt:

   1. PER STAND, NOOIT OPGETELD. GEEN_FIXTURE, NIET_GETEST, GEBLOKKEERD_DOOR_CONFIG
      en GEBLOKKEERD_DOOR_DEFECT vragen vier verschillende handelingen (een
      wereld bouwen, een proef laten draaien, de omgeving aanvullen, code
      repareren). Een cluster draagt daarom altijd een stand, en een oorzaak die
      in twee standen voorkomt is twee clusters.
   2. PER BEWIJS. "voltooibaar ontbreekt" en "bevoegd ontbreekt" hebben dezelfde
      stand en een andere oplossing.
   3. DE NORMALISATIE IS GROF EN ZEGT DAT. Een cluster is een KANDIDAAT-oorzaak:
      twee redenen die na normalisatie gelijk zijn, delen hun vorm en vrijwel
      altijd hun oplossing, maar dat laatste is niet bewezen. Daarom draagt elk
      cluster de apps bij naam en een ongewijzigd voorbeeld van de reden, zodat
      een mens het na kan lopen.

   Er komt met opzet geen totaalcijfer uit ("437 failures, 31 oorzaken"). Dat
   zou precies het samengestelde getal zijn waar BEWIJSMACHINE.md voor waarschuwt:
   het verbergt welke stand bewoog.
   ========================================================================== */
'use strict';

const STANDEN = ['GEBLOKKEERD_DOOR_DEFECT', 'GEBLOKKEERD_DOOR_CONFIG', 'NIET_GETEST', 'GEEN_FIXTURE'];

/* Wat per app verschilt, en dus niet bij de oorzaak hoort. In deze volgorde:
   eerst aangehaalde tekst (die kan cijfers en paden bevatten), dan paden, dan
   getallen. */
function normaliseer(reden) {
  return String(reden || '')
    .replace(/\{[^}]*\}/g, '{…}')
    /* Een uitsplitsing tussen haakjes ("3x intercepts pointer events, 1x ...")
       verschilt per scherm in samenstelling en niet in soort. */
    .replace(/\([^()]*\)/g, '(…)')
    .replace(/"[^"]*"/g, '"…"')
    .replace(/(\/api\/[a-z0-9-]+\/[a-z0-9-]+)[^\s)]*/gi, '$1/…')
    .replace(/\/apps\/[^\s)]*/gi, '/apps/…')
    .replace(/\d+x /g, '#x ')
    .replace(/\d+/g, '#')
    /* En de tellingen die een bedieningsreden erbij noemt: hoeveel er niet aan
       te tikken of overgeslagen was, is uitsplitsing en geen oorzaak. */
    .replace(/, # (?:niet aan te tikken \(…\)|overgeslagen omdat ze onomkeerbaar zijn|x geweigerd met een reden \(…\))/g, '')
    /* Een bedieningsreden noemt de knop die niet aan te tikken was; welke knop
       dat is verschilt per app, de SOORT (een laag die de tik onderschept) niet. */
    .replace(/; niet aan te tikken: .*?(intercepts pointer events|element is not visible|element is outside of the viewport|element is not stable|element is not enabled|reden niet gemeld).*$/, '; niet aan te tikken: … $1')
    .replace(/: [^:]{80,}$/, ': …')
    .replace(/\s+/g, ' ')
    .trim();
}

function cluster(register) {
  const bak = new Map();
  for (const r of register.regels || []) {
    for (const [bewijs, b] of Object.entries(r.bewijzen || {})) {
      if (!b || b.status === 'BEWEZEN') continue;
      const oorzaak = normaliseer(b.reden);
      const sleutel = b.status + '\u0000' + bewijs + '\u0000' + oorzaak;
      if (!bak.has(sleutel)) bak.set(sleutel, { stand: b.status, bewijs, oorzaak, voorbeeld: b.reden, apps: [] });
      bak.get(sleutel).apps.push(r.app);
    }
  }
  const perStand = {};
  for (const s of STANDEN) perStand[s] = [];
  for (const c of bak.values()) (perStand[c.stand] = perStand[c.stand] || []).push(c);
  for (const s of Object.keys(perStand)) perStand[s].sort((a, b) => b.apps.length - a.apps.length || a.oorzaak.localeCompare(b.oorzaak));
  return perStand;
}

/* DE REGISTERCONFLICTEN: rijen waar de proef met een andere persona mat dan
   SCHERMEIGENAAR.json als doelgroep noemt (`personaAfwijking`). Geen bewijsstand
   en dus nooit bij de clusters hierboven: het is een tegenspraak tussen twee
   registers, en welke van de twee gelijk heeft is een besluit. Gegroepeerd op
   `gebruikt -> verwacht`, zodat een structurele oorzaak (een hele wereld die met
   de verkeerde persona gemeten wordt) als EEN groep zichtbaar is en niet als
   dertien losse apps. */
function conflicten(register) {
  const bak = new Map();
  for (const r of register.regels || []) {
    const a = r.personaAfwijking;
    if (!a) continue;
    const sleutel = r.wereld + ': ' + a.gebruikt + ' -> ' + a.verwacht;
    if (!bak.has(sleutel)) bak.set(sleutel, { wereld: r.wereld, gebruikt: a.gebruikt, verwacht: a.verwacht,
      bronGebruikt: a.bronGebruikt, bronVerwacht: a.bronVerwacht, apps: [] });
    bak.get(sleutel).apps.push(r.app);
  }
  return [...bak.values()].sort((x, y) => y.apps.length - x.apps.length || (x.wereld + x.verwacht).localeCompare(y.wereld + y.verwacht));
}

module.exports = { STANDEN, normaliseer, cluster, conflicten };
