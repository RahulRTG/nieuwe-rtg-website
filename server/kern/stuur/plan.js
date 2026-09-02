/* DE PLANCOMPILER -- van een reeks losse acties naar een keten die je kunt WEGEN
   voordat er iets gebeurt. EXECUTIE.md blok 3.

   WAT ER VANDAAG GEBEURT. De tool-lus (./lus.js) doet actie, actie, actie: elke
   stap wordt bedacht, uitgevoerd en pas daarna zie je wat eruit kwam. Bij een
   opdracht van twintig handelingen betekent dat, dat niemand -- ook de gebruiker
   niet -- vooraf kan zien wat RTG van plan is. Een plan dat je pas kent terwijl
   het draait, kun je niet weigeren.

   PLAN BEZIT NIETS, en dat is de dragende regel van dit bestand. Een stap draagt
   vier dingen: welke capability, welke invoer, waar hij van afhangt, en wat de
   bedoelde uitkomst is. Al het andere wordt AANGEVULD door lagen die er al zijn:

     bestaat het?      de allowlist van ./beleid.js
     mag deze rol?     beleidVoor() -- LIVE, en nooit uit EXECUTION_MAP.json
     welke frictie?    hetzelfde beleidsniveau: lezen/klein/voorstel
     hoe hard staat het bewijs?  de vervalstaat die beleid.js al meeneemt

   Zou PLAN die dingen zelf bezitten, dan was hij de zesde gezagsschaal en de
   tweede allowlist tegelijk. Hij rekent daarom niets uit dat elders al bestaat.

   DE AUTORITEIT KOMT LIVE, NOOIT UIT DE PROJECTIE. EXECUTION_MAP.json weet
   hetzelfde, maar hij is een bouwartefact: hij kan een commit achterlopen. Een
   plan dat op de kaart vertrouwt, kan een route toestaan die vanochtend van de
   lijst is gehaald. test/stuur-plan.test.js verandert de kaart met opzet en eist
   dat het oordeel niet meebeweegt.

   HIJ VOERT NIETS UIT. Er zit geen fetch in dit bestand, geen aanroep van
   stuurRoep, geen enkele weg naar een effect. Uitvoeren blijft bij de bestaande
   keten: een voorstel dat een MENS buiten het model bevestigt. Wat de compiler
   toevoegt is dat je vooraf ziet hoeveel van die bevestigingen er gaan komen.

   EEN AFGEWEZEN STAP LAAT HET HELE PLAN ZAKKEN. Hij wordt niet stil overgeslagen:
   een keten waarvan stap 5 wegvalt, is een andere keten dan de gebruiker las. */
'use strict';
const { beleidVoor, NIVEAUS } = require('./beleid');

const MAX_STAPPEN = 24;   // hetzelfde budget als de zware taak in ./lus.js
const MAX_INVOER = 4000;  // een planstap is een bedoeling, geen gegevensdump

/* Welke stappen mogen tegelijk? Alles wat geen afhankelijkheid meer open heeft.
   Dit is een volgorde en GEEN uitvoering: wie deze golven gebruikt om parallel
   te draaien, blijft zelf verantwoordelijk voor de bevestigingen erin. */
function golven(stappen, afhankelijk) {
  const klaar = new Set(), uit = [];
  let over = stappen.map(s => s.id);
  while (over.length) {
    const nu = over.filter(id => (afhankelijk.get(id) || []).every(d => klaar.has(d)));
    if (!nu.length) return { fout: 'kringloop', rest: over };
    nu.forEach(id => klaar.add(id));
    uit.push(nu);
    over = over.filter(id => !klaar.has(id));
  }
  return { golven: uit };
}

function leesStappen(ruw) {
  const fouten = [];
  const stappen = [];
  const gezien = new Set();
  (Array.isArray(ruw) ? ruw : []).forEach((s, i) => {
    const id = String((s && s.id) || ('s' + (i + 1)));
    if (gezien.has(id)) { fouten.push({ id, reden: 'twee stappen dragen hetzelfde kenmerk' }); return; }
    gezien.add(id);
    const capability = String((s && s.capability) || '').trim();
    let invoer = (s && s.invoer) || {};
    let tekst = '';
    try { tekst = JSON.stringify(invoer); } catch (e) { invoer = {}; tekst = '{}'; }
    if (tekst.length > MAX_INVOER) { fouten.push({ id, reden: 'de invoer van deze stap is te groot' }); return; }
    stappen.push({ id, capability, invoer,
      afhankelijkVan: Array.isArray(s && s.afhankelijkVan) ? s.afhankelijkVan.map(String) : [],
      uitkomst: String((s && s.uitkomst) || '').slice(0, 200) });
  });
  return { stappen, fouten };
}

/* DE COMPILER. `plan` is het kandidaatplan (van een model, een script of een
   mens); `wereld` is de rol waarvoor het zou draaien. Geeft een gewogen plan of
   een afwijzing, en nooit een effect. */
function compileer(plan, wereld, opties) {
  const o = opties || {};
  const doel = String((plan && plan.doel) || '').slice(0, 300);
  const { stappen, fouten } = leesStappen(plan && plan.stappen);
  const bezwaren = fouten.slice();

  if (!stappen.length) return afwijzing(doel, bezwaren.concat([{ reden: 'een plan zonder stappen is geen plan' }]));
  if (stappen.length > MAX_STAPPEN)
    return afwijzing(doel, bezwaren.concat([{ reden: 'een plan van meer dan ' + MAX_STAPPEN + ' stappen wordt niet gewogen; ' +
      'splits het op, zodat een mens het nog kan lezen' }]));

  const bekend = new Set(stappen.map(s => s.id));
  const afhankelijk = new Map();
  for (const s of stappen) {
    const open = s.afhankelijkVan.filter(d => !bekend.has(d));
    if (open.length) bezwaren.push({ id: s.id, reden: 'hangt af van een stap die niet in dit plan staat: ' + open.join(' ') });
    if (s.afhankelijkVan.includes(s.id)) bezwaren.push({ id: s.id, reden: 'hangt van zichzelf af' });
    afhankelijk.set(s.id, s.afhankelijkVan.filter(d => bekend.has(d)));
  }

  /* De weging per stap. Alles hier komt uit beleid.js; er wordt niets bedacht. */
  const gewogen = stappen.map(s => {
    const b = beleidVoor(s.capability, wereld);
    const rij = { id: s.id, capability: s.capability, uitkomst: s.uitkomst,
      afhankelijkVan: afhankelijk.get(s.id) || [], niveau: b.niveau, waarom: b.reden || null };
    if (b.vervalstaat) rij.bewijs = b.vervalstaat;
    if (b.niveau === NIVEAUS.verboden) {
      rij.bezwaar = b.reden || 'deze capability bestaat niet voor deze rol';
      bezwaren.push({ id: s.id, reden: rij.bezwaar });
    }
    rij.bevestigingNodig = b.niveau === NIVEAUS.voorstel;
    return rij;
  });

  const g = golven(stappen, afhankelijk);
  if (g.fout) bezwaren.push({ reden: 'de stappen wijzen in een kringloop naar elkaar: ' + g.rest.join(' ') });

  if (bezwaren.length) return afwijzing(doel, bezwaren, gewogen);

  const bevestigingen = gewogen.filter(r => r.bevestigingNodig);
  return {
    uitvoerbaar: true, doel, stappen: gewogen, golven: g.golven,
    bevestigingen: bevestigingen.length,
    samenvatting: stappen.length + ' stappen in ' + g.golven.length + ' golf(ven); ' +
      (bevestigingen.length
        ? bevestigingen.length + ' daarvan vragen uw bevestiging (' + bevestigingen.map(r => r.capability).join(', ') + ')'
        : 'geen enkele vraagt een bevestiging'),
    grens: 'Dit plan is gewogen, niet uitgevoerd. De plancompiler voert niets uit: elke stap die uw ' +
      'bevestiging vraagt, loopt langs het gewone voorstel-en-bevestig-pad buiten het model. ' +
      (opties && opties.uitProjectie ? '' : 'Het oordeel komt live uit het beleid en niet uit EXECUTION_MAP.json.')
  };
}

function afwijzing(doel, bezwaren, gewogen) {
  return { uitvoerbaar: false, doel, bezwaren,
    stappen: gewogen || [],
    samenvatting: 'Dit plan is niet uitvoerbaar: ' + bezwaren.length + ' bezwaar(en).',
    grens: 'Een afgewezen stap wordt NIET overgeslagen. Een keten waarvan een stap wegvalt is een ' +
      'andere keten dan u las; pas het plan aan of vraag om de volledige lijst capabilities.' };
}

module.exports = { compileer, golven, MAX_STAPPEN, MAX_INVOER };
