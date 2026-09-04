/* MASTER DATA, de handelende helft: het gouden record en het samenvoegen.

   ./mdm.js MEET wie op elkaar lijkt; dit bestand doet er iets mee. Die twee
   staan uit elkaar omdat ze een verschillende omgang verdienen: de meting mag
   altijd draaien en verandert niets, het samenvoegen verandert de administratie
   en mag daarom nooit vanzelf.

   SAMENVOEGEN WIST NIETS. De verliezers blijven staan met een verwijzing naar
   het gouden record (mdmSamengevoegdIn). Verwijderen zou elke bestelling, rit
   en factuur die naar zo'n rij wees tot wees maken -- precies wat
   ./kwaliteit.js meet -- en het is niet terug te draaien. Nu is terug()
   dezelfde handeling omgekeerd, en dat is hetzelfde patroon als bij de
   recepten: de oude waarde gaat mee, dus terugdraaien is geen tweede motor. */
'use strict';

const { NIVEAUS } = require('../frictie');

const MAX_RIJEN = 5000;

function maakSamen({ db, save, journaal, PARTIJEN, bedrijven, partijen0, s, opslag }) {
  const rijen = (p) => {
    const v = opslag.vak()[p.collectie] || null;
    return Array.isArray(v) ? v.slice(0, MAX_RIJEN) : [];
  };

  function vind(soort, id) {
    const p = PARTIJEN.find(x => x.type === soort);
    if (!p) return null;
    return rijen(p).find(r => r && s(r[p.sleutel]) === String(id)) || null;
  }

  /* Het gouden record: per veld welke bron wint, en waarom. De meest gevulde
     rij wint als geheel NIET -- per veld wordt gekozen, want een rij die verder
     leeg is kan best de enige zijn met een adres. Waar de rijen elkaar
     tegenspreken staan de alternatieven erbij; dat is precies wat een mens moet
     wegen en wat een automaat niet kan. */
  function gouden(sleutel) {
    const groep = bedrijven().find(g => g.sleutel === sleutel);
    if (!groep) return { error: 'Geen groep met die sleutel.', status: 404 };
    const leden = partijen0().filter(r => r.sleutelNaam === sleutel && !r.samengevoegdIn);
    const velden = {};
    for (const r of leden) {
      for (const [k, v] of Object.entries(r.velden)) {
        if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
        if (!velden[k]) velden[k] = { waarde: v, van: r.soort + ' ' + r.id, alternatieven: [] };
        else if (JSON.stringify(velden[k].waarde) !== JSON.stringify(v)) {
          velden[k].alternatieven.push({ waarde: v, van: r.soort + ' ' + r.id });
        }
      }
    }
    return {
      sleutel, leden: groep.leden, velden,
      strijdig: Object.keys(velden).filter(k => velden[k].alternatieven.length),
      aard: { kandidaten: 'gemeten', velden: 'aangegeven (welk veld de naam en de plaats draagt)' },
      uitleg: 'de eerste gevulde waarde per veld wint; waar de rijen elkaar tegenspreken staan de ' +
        'alternatieven erbij, want dat is wat een mens moet wegen'
    };
  }

  function voegSamen(doel, verliezers, door, reden) {
    const d = doel && vind(doel.soort, doel.id);
    if (!d) return { error: 'Het gouden record bestaat niet.', status: 404 };
    const geraakt = [];
    for (const v of (verliezers || [])) {
      const r = vind(v.soort, v.id);
      if (!r || r === d) continue;
      const was = r.mdmSamengevoegdIn || null;
      r.mdmSamengevoegdIn = { soort: doel.soort, id: String(doel.id),
        at: new Date().toISOString(), door: String(door || '') };
      geraakt.push({ soort: v.soort, id: v.id, was });
    }
    if (!geraakt.length) return { error: 'Er viel niets samen te voegen.', status: 400 };
    save();
    if (journaal) {
      journaal.noteer({ actie: 'partijen samengevoegd', actor: door, niveau: NIVEAUS.hand,
        objectType: doel.soort, objectId: String(doel.id), reden: String(reden || ''),
        na: { samengevoegd: geraakt.length } });
    }
    return { doel, geraakt, terugDraaibaar: true };
  }

  function terug(verliezers, door) {
    const geraakt = [];
    for (const v of (verliezers || [])) {
      const r = vind(v.soort, v.id);
      if (!r || !r.mdmSamengevoegdIn) continue;
      delete r.mdmSamengevoegdIn;
      geraakt.push({ soort: v.soort, id: v.id });
    }
    if (!geraakt.length) return { error: 'Er stond niets samengevoegd.', status: 400 };
    save();
    if (journaal) {
      journaal.noteer({ actie: 'samenvoeging teruggedraaid', actor: door, niveau: NIVEAUS.hand,
        reden: geraakt.length + ' rij(en) staan weer los' });
    }
    return { geraakt };
  }

  return { gouden, voegSamen, terug, vind };
}

module.exports = { maakSamen };
