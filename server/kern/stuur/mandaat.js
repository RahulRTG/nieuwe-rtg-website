/* HET MANDAAT -- wat een agent zelfstandig mag, en waarom dat nooit een
   vergunning is. EXECUTIE.md blok 6.

   DE DRAGENDE REGEL, en hij staat in de code en niet in een belofte:

     EEN MANDAAT VERLEENT NOOIT VERMOGEN. Het kan bestaand, al toegestaan
     vermogen alleen VERSMALLEN.

   Daarom is de speelruimte een DOORSNEDE en geen optelsom: wat het beleid
   toestaat, wat het bewijs draagt, wat het mandaat overlaat, en wat de context
   op dit moment toelaat. Zou een mandaat iets kunnen toevoegen, dan was het een
   tweede allowlist -- en dan is de eerste geen waarheid meer.

   GEEN MANDAAT IS GEEN VRIJBRIEF. De afwezigheid van een mandaat betekent dat er
   niets zelfstandig gebeurt, niet dat er niets beperkt is. Dat verschil is de
   klassieke fout in dit soort lagen: een lege regelset die als "alles mag"
   wordt gelezen. Hier is leeg dicht.

   WAT EEN MANDAAT NOOIT KAN, hoeveel er ook in staat:

     1 een niveau ophogen -- wat `voorstel` is, blijft een menselijke bevestiging
       vragen. Geen bedrag, geen looptijd en geen agent verandert dat.
     2 geld autonoom bewegen. GELD.md staat boven alles: geld verlaat het huis
       nooit vanzelf. Een mandaat mag een bestelling laten VOORBEREIDEN en zelfs
       een verplichting laten aangaan binnen een grens; betalen niet.
     3 iets toestaan dat het beleid verbiedt.

   VOORBEREIDEN, VERPLICHTEN EN BETALEN ZIJN DRIE GEBEURTENISSEN, en ze zien er
   als knop uit als een. Deze laag houdt ze uit elkaar omdat de derde een
   vergunningsvraag is en de eerste niet (EXECUTIE.md grens 4).

   EN HIJ VOERT NIETS UIT: geen fetch, geen stuurRoep. Hij zegt alleen wat er
   binnen de speelruimte valt; uitvoeren blijft de bestaande keten. */
'use strict';
const { beleidVoor } = require('./beleid');

/* Wat een mandaat mag begrenzen. Elk budget is een PLAFOND en nooit een recht:
   het zegt tot waar iets nog zelfstandig mag, niet dat het mag. */
const BUDGETSOORTEN = Object.freeze(['centen', 'handelingen', 'berichten']);

/* Paden waar geen enkel mandaat autonomie over geeft. Niet omdat ze gevaarlijk
   klinken, maar omdat er een besluit onder ligt dat elders is genomen: geld dat
   het huis verlaat (GELD.md), en het pasbesluit (CLAUDE.md). */
const NOOIT_AUTONOOM = [
  /^\/api\/(bank|pay)\//,        // geld beweegt nooit vanzelf
  /^\/api\/supplier\/pay\//,
  /^\/api\/aanmelding\//,        // toegang tot een pas is mensenwerk
  /^\/api\/auth\//, /^\/api\/account\//
];

const leeg = () => ({ paden: [], reden: 'er is geen mandaat; zonder mandaat gebeurt er niets zelfstandig' });

function geldig(mandaat, nu) {
  if (!mandaat || typeof mandaat !== 'object')
    return { ok: false, reden: 'er is geen mandaat; zonder mandaat gebeurt er niets zelfstandig -- ' +
      'de afwezigheid van een regel is hier dicht en niet open' };
  if (!Array.isArray(mandaat.capabilities) || !mandaat.capabilities.length)
    return { ok: false, reden: 'het mandaat noemt geen enkele capability; leeg is dicht en niet open' };
  if (mandaat.tot) {
    const eind = Date.parse(mandaat.tot);
    if (!Number.isFinite(eind)) return { ok: false, reden: 'de looptijd van dit mandaat is onleesbaar' };
    if (eind <= (nu || Date.now())) return { ok: false, reden: 'dit mandaat is verlopen op ' + mandaat.tot };
  }
  return { ok: true };
}

const raakt = (patronen, pad) => (patronen || []).some(p => {
  if (typeof p !== 'string' || !p) return false;
  return p.endsWith('*') ? pad.startsWith(p.slice(0, -1)) : pad === p;
});

/* DE SPEELRUIMTE: de doorsnede. `toegestaan` komt uit toegestanePaden() en is
   dus al door het beleid gegaan; deze functie kan hem alleen kleiner maken. */
function speelruimte(toegestaan, wereld, mandaat, opties) {
  const alles = Array.isArray(toegestaan) ? toegestaan.filter(p => typeof p === 'string') : [];
  const g = geldig(mandaat, opties && opties.nu);
  if (!g.ok) return Object.assign(leeg(), { reden: g.reden, aantalVoor: alles.length });

  const uit = [], geweigerd = [];
  for (const pad of alles) {
    const niveau = beleidVoor(pad, wereld).niveau;   // LIVE, nooit uit een projectie
    if (niveau === 'verboden') continue;             // stond er niet in, komt er niet bij
    if (!raakt(mandaat.capabilities, pad)) continue; // buiten het mandaat: geen zelfstandigheid
    if (NOOIT_AUTONOOM.some(re => re.test(pad))) {
      geweigerd.push({ pad, reden: 'hier geeft geen enkel mandaat autonomie: geld en het pasbesluit ' +
        'blijven mensenwerk (GELD.md, CLAUDE.md)' });
      continue;
    }
    if (niveau === 'voorstel') {
      geweigerd.push({ pad, reden: 'dit is een handeling die een mens bevestigt; een mandaat verhoogt ' +
        'geen niveau, het versmalt alleen' });
      continue;
    }
    uit.push(pad);
  }
  return { paden: uit, geweigerd, aantalVoor: alles.length,
    reden: 'van ' + alles.length + ' toegestane paden blijven er ' + uit.length + ' binnen dit mandaat ' +
      'zelfstandig uitvoerbaar; ' + geweigerd.length + ' vallen af met een reden',
    grens: 'Dit is een DOORSNEDE en geen toekenning: alles hierin was al toegestaan. Een mandaat ' +
      'verleent nooit vermogen, het versmalt bestaand vermogen.' };
}

/* Mag deze ene handeling zelfstandig, met dit mandaat en deze omstandigheden?
   Geeft altijd een reden, en bij twijfel nee. */
function magZelfstandig(pad, wereld, mandaat, ctx) {
  const c = ctx || {};
  const ruimte = speelruimte([String(pad || '')], wereld, mandaat, c);
  if (!ruimte.paden.length) {
    const weg = (ruimte.geweigerd || [])[0];
    return { mag: false, reden: weg ? weg.reden : ruimte.reden };
  }
  for (const soort of BUDGETSOORTEN) {
    const plafond = (mandaat.budget || {})[soort];
    if (plafond == null) continue;
    const gebruikt = Number((c.gebruikt || {})[soort] || 0);
    const nodig = Number((c.nodig || {})[soort] || 0);
    if (gebruikt + nodig > Number(plafond))
      return { mag: false, reden: 'dit gaat over het plafond voor ' + soort + ' (' + (gebruikt + nodig) +
        ' van ' + plafond + '); boven een plafond beslist een mens' };
  }
  return { mag: true, reden: 'binnen het mandaat, binnen de plafonds, en het beleid liet deze handeling al toe' };
}

module.exports = { speelruimte, magZelfstandig, geldig, BUDGETSOORTEN, NOOIT_AUTONOOM };
