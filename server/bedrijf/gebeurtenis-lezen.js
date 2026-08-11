/* RTG Werk OS: DE DRIE VRAGEN AAN DE GEBEURTENISLAAG.

   ./gebeurtenis.js is de schrijfkant. Dit is de leeskant, en hij beantwoordt
   precies drie vragen -- niet meer, want alles daarbuiten zou een afleiding
   zijn die deze laag niet kan waarmaken:

     1. BESTOND HET?        uit `at` op de rij zelf; een gemeten gegeven.
     2. WAT WAS DE TOESTAND? de huidige waarde, met elke gebeurtenis van NA die
                             dag teruggedraaid.
     3. HOE IS HET DAAR GEKOMEN? het wijzigingspad, met actor en reden.

   Die derde is waar het om begonnen is. "Status vertraagd" is een feit; "op 12
   februari op vertraagd gezet door Lisa, omdat leverancier X drie dagen
   vertraging meldde" is een geschiedenis. Het eerste kun je uit de huidige
   toestand lezen, het tweede alleen hieruit.

   TERUG EN NIET VOORUIT. De reconstructie start bij de huidige waarde -- die is
   zeker -- en draait terug. Vooruit opbouwen vanaf niets zou eisen dat het log
   compleet is vanaf het ontstaan van het object, en dat is voor alles wat vóór
   deze laag is aangemaakt niet zo. Wie vooruit opbouwt zonder dat te weten,
   toont een lege organisatie als een feit.

   HET VANGNET, EN WAAROM HET HIER STAAT EN NIET OP EEN TIMER. Een
   gebeurtenislaag die elke schrijfplek moet aanroepen is bij de volgende
   schrijfplek al niet meer compleet, en dan LIEGT de reconstructie: een
   ontbrekende gebeurtenis leest als "er is niets veranderd". Daarom vergelijkt
   `meetOngemeten()` bij elke lezing de huidige velden met de laatst bekende
   stand.

   EEN WIJZIGING ZONDER GESCHIEDENIS IS VANAF DEZE LAAG EEN FOUT, en op de vier
   gemigreerde families wordt hij dus ook als FOUT gerapporteerd (`defect`) en
   niet als een gewone regel. Voor de rest van het Werk OS is hij een
   waarschuwing: die modules zijn nog niet omgezet, en dat is bekend.

   Wat het vangnet NIET doet is een tijdstip verzinnen. De oude waarde weten we
   (die stond in de stand), het moment niet. Elke reconstructie die over zo'n
   gat kijkt geeft `zeker: false` met de reden erbij. */
'use strict';

const { FAMILIES, plat, standSleutel, stand, bak } = require('./gebeurtenis');

const IDENTITEIT = new Set(['id', 'naam', 'titel']);

/* Welke velden als toestand tellen, AFGELEID uit de soort. Elke soort in
   kern/werkcommand/soorten.js draagt al een `zoek`-lijst: de velden waarop je
   hem vindt, en dat zijn zijn kenmerken. Daar gaan de identiteitsvelden af.
   Een eigen lijst hier zou de tweede waarheid zijn -- een nieuw veld in
   soorten.js zou dan stil buiten de gebeurtenislaag vallen. */
function volgVelden(so) {
  return (so && Array.isArray(so.zoek) ? so.zoek : []).filter(v => !IDENTITEIT.has(v));
}

/* ---- 3. HET PAD ---- */
function gebeurtenissenVan(w, objectType, objectId) {
  return bak(w)
    .filter(g => g.objectType === objectType && String(g.objectId) === String(objectId))
    .slice()
    .sort((a, b) => String(a.occurredAt || '').localeCompare(String(b.occurredAt || '')));
}

/* Het wijzigingspad, oud naar nieuw: de bedrijfsgeschiedenis van dit object.
   Regels zonder tijdstip (door het vangnet gevonden) staan apart en niet
   tussen de gedateerde in -- ze een plek in de volgorde geven zou een moment
   suggereren dat wij niet kennen. */
function pad(w, objectType, objectId) {
  const alle = gebeurtenissenVan(w, objectType, objectId);
  const gedateerd = alle.filter(g => g.occurredAt && !g.ongemeten);
  const zonder = alle.filter(g => !g.occurredAt || g.ongemeten);
  return {
    pad: gedateerd.map(g => ({
      op: String(g.occurredAt).slice(0, 10), tijd: g.occurredAt,
      wat: g.eventType, van: g.van, naar: g.naar,
      door: g.actor, reden: g.reden, bron: g.bron })),
    ongedateerd: zonder.length,
    let: zonder.length
      ? zonder.length + ' wijziging(en) zijn buiten de gebeurtenislaag om gegaan; daarvan is de oude waarde bekend en het moment niet.'
      : null
  };
}

/* ---- 2. DE TOESTAND OP EEN DAG ---- */
function toestandOp(w, so, rij, datum) {
  const velden = volgVelden(so);
  const objectType = so.type;
  const toestand = {};
  for (const v of velden) toestand[v] = plat(rij[v]) === undefined ? null : rij[v];

  const grens = datum + 'T23:59:59.999Z';
  const eigen = gebeurtenissenVan(w, objectType, rij.id)
    .slice()
    .sort((a, b) => String(b.occurredAt || '9999').localeCompare(String(a.occurredAt || '9999')));

  let onzeker = 0;
  for (const g of eigen) {
    if (g.ongemeten || !g.occurredAt) { onzeker++; continue; }
    if (String(g.occurredAt) <= grens) continue;
    /* Terugdraaien: de `van` van een gebeurtenis is de toestand van ervoor.
       Alleen velden die deze laag volgt; een gebeurtenis als `project.gekoppeld`
       draagt geen veld en verandert de toestand dus niet. */
    for (const [veld, waarde] of Object.entries(g.van || {})) {
      if (velden.includes(veld)) toestand[veld] = waarde;
    }
  }

  const bestond = !rij.at || String(rij.at) <= grens;
  return { toestand, bestond, onzeker, zeker: onzeker === 0,
    let: onzeker === 0 ? null
      : onzeker + ' wijziging(en) aan dit object zijn buiten de gebeurtenislaag om gegaan; '
        + 'wij weten niet wanneer ze plaatsvonden, dus deze toestand kan afwijken.' };
}

/* ---- HET VANGNET ---- */
function meetOngemeten(w, soorten) {
  if (!w) return { gemeten: 0, ongemeten: 0, defecten: [] };
  const log = bak(w);
  const st = stand(w);
  let gemeten = 0, ongemeten = 0;
  const defecten = [];

  for (const so of (soorten || [])) {
    const velden = volgVelden(so);
    if (!velden.length) continue;
    const b = w[so.veld];
    if (!b || typeof b !== 'object') continue;
    for (const rij of Object.values(b)) {
      if (!rij || typeof rij !== 'object' || !rij.id) continue;
      for (const veld of velden) {
        const huidig = plat(rij[veld]);
        if (huidig === undefined) continue;
        const s = standSleutel(so.type, rij.id, veld);
        const bekend = Object.prototype.hasOwnProperty.call(st, s) ? st[s] : undefined;
        gemeten++;
        /* EEN RIJ DIE JE VOOR HET EERST ZIET IS ONTSTAAN, GEEN WIJZIGING. Zou
           hier wel een regel komen, dan telt elke aanmaak als ongemeten
           wijziging en is het vangnet een ruismachine in plaats van een alarm. */
        if (bekend === undefined) { st[s] = huidig; continue; }
        if (bekend === huidig) continue;

        const familie = FAMILIES.includes(so.type);
        log.push({ id: 'geb_ong_' + so.type + '_' + rij.id + '_' + veld,
          objectType: so.type, objectId: rij.id, eventType: so.type + '.' + veld,
          van: { [veld]: bekend }, naar: { [veld]: huidig },
          actor: null, reden: null, bron: null,
          occurredAt: null, ongemeten: true, defect: familie });
        st[s] = huidig;
        ongemeten++;
        if (familie) {
          defecten.push({ objectType: so.type, objectId: rij.id, veld,
            van: bekend, naar: huidig,
            waarom: 'Deze familie is omgezet naar de gebeurtenislaag; een wijziging buiten werkMutatie() om hoort hier niet meer voor te komen.' });
        }
      }
    }
  }
  return { gemeten, ongemeten, defecten };
}

module.exports = { volgVelden, gebeurtenissenVan, pad, toestandOp, meetOngemeten };
