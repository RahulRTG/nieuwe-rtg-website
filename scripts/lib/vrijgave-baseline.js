/* DE V1-BASELINE IN DE RELEASE-UITSPRAAK (server/kern/vrijgave/baseline.js).

   Een release van RTG is pas klaar als de capabilities die de eigenaar in de
   baseline zette BESCHIKBAAR zijn -- alle assen, uitgerekend door dezelfde
   evaluator die een route bij een verzoek vraagt -- en de capabilities die hij
   erbuiten hield aantoonbaar DICHT. Dit is geen waarschuwing: een baseline die
   niet klopt, is een blokkade in de go-live-keuring (scripts/golive.js) en
   daarmee in de productiestatus (scripts/lib/productie-oordeel.js) en in
   `npm run release:gate:productie`.

   DE RELEASECONFIGURATIE, en niet die van wie het draait. Het oordeel wordt
   geveld met NODE_ENV=production, wat de omgeving van de aanroeper ook zegt:
   de lokale sandboxregel (server/kern/vrijgave/lokaal.js) bestaat dan niet, en
   een stand die niemand vastlegde is `disabled`. Een ontwikkelaar die dit op
   zijn machine draait, ziet dus wat PRODUCTIE zou zien en niet zijn eigen
   sandbox.

   TWEE BRONNEN, en ze zeggen niet hetzelfde.
     --url (of RTG_VRIJGAVE_URL)  de draaiende releasekandidaat, via
                                  /api/office/vrijgave: met de bevoegdheidslaag
                                  en de besluiten van die installatie. Dit is de
                                  bron die een release kan laten slagen.
     in dit proces                de stand en het bewijs van deze datamap, maar
                                  ZONDER bevoegdheidslaag (die leeft in de
                                  kern-tas van een server). Een capability die op
                                  een bevoegdheidsvermogen rust, staat dan op
                                  niet-geautoriseerd met die reden erbij -- de
                                  veilige kant, en een release die zo wordt
                                  gekeurd zakt eerlijk. */
'use strict';
const path = require('node:path');

const SERVER = path.join(__dirname, '..', '..', 'server', 'kern', 'vrijgave');

function releaseEnv(env) {
  return Object.assign({}, env || process.env, { NODE_ENV: 'production' });
}

async function haalOverzicht({ env = process.env, url, token } = {}) {
  const adres = url || env.RTG_VRIJGAVE_URL || '';
  if (adres) {
    const t = token || env.RTG_VRIJGAVE_TOKEN || '';
    const r = await fetch(String(adres).replace(/\/+$/, '') + '/api/office/vrijgave', { method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: '{}' });
    if (r.status !== 200) throw new Error('de releasekandidaat gaf ' + r.status + ' op /api/office/vrijgave');
    return { bron: adres, overzicht: await r.json() };
  }
  const { maakVrijgave } = require(SERVER);
  const v = maakVrijgave({ env: releaseEnv(env) });
  return { bron: 'dit proces, releaseconfiguratie (NODE_ENV=production), zonder bevoegdheidslaag', overzicht: v.overzicht() };
}

/* Het oordeel. `zonderRail`: een bewuste release ZONDER kaartrail (besluit
   B2a, READY_ZONDER_RAIL). Dan geldt de baseline niet -- die belooft Stripe --
   maar het strengere: GEEN ENKELE geldcapability mag beschikbaar zijn. */
function oordeel(overzicht, { zonderRail = false } = {}) {
  const B = require(path.join(SERVER, 'baseline'));
  if (!zonderRail) return Object.assign({ modus: 'baseline' }, B.beoordeel(overzicht));
  const fouten = [];
  const caps = (overzicht && overzicht.capabilities) || [];
  if (!caps.length) fouten.push('er is geen vrijgaveoverzicht om te beoordelen');
  for (const c of caps) {
    const open = c.beschikbaarVoorRechthebbende === true ||
      (c.perProvider && Object.values(c.perProvider).some(x => x && x.beschikbaarVoorRechthebbende === true));
    if (open) fouten.push(c.id + ': is BESCHIKBAAR in een release zonder kaartrail');
  }
  return { modus: 'zonder-rail', ok: fouten.length === 0, fouten, baseline: B.NAAM, regels: [] };
}

async function beoordeelRelease(opties = {}) {
  let o;
  try { o = await haalOverzicht(opties); }
  catch (e) { return { ok: false, bron: null, fouten: ['vrijgaveoverzicht niet op te halen: ' + e.message], regels: [] }; }
  return Object.assign({ bron: o.bron }, oordeel(o.overzicht, opties));
}

module.exports = { releaseEnv, haalOverzicht, oordeel, beoordeelRelease };
