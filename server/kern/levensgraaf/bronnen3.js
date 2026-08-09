/* Het Privekantoor, deelbestand "graaf-bronnen3": de zes kamers die er als
   laatste bij kwamen.

   Beveiliging, reputatie, dieren, de collectiedossiers, de relatiekring en het
   reisdek. Zie ./bronnen.js voor hoe een bron werkt; hier staat alleen wat
   deze zes inleveren.

   DE REDEN DAT ZE HIER STAAN EN NIET IN HUN EIGEN MODULE: een kamer die zijn
   eigen waarschuwingen bouwt, is een kamer die op een dag anders waarschuwt dan
   de rest. Een vaccinatie die verloopt hoort precies zo te voelen als een polis
   die afloopt -- zelfde venster, zelfde volgorde, zelfde kop. Vandaar dat elke
   nieuwe kamer maar een ding doet: knopen met een datum inleveren, en verder
   zwijgen.

   Wat opvalt als je ze naast elkaar zet: het zijn allemaal dingen die je pas
   mist als het te laat is. Een bruikleen die niet terugkomt, een dierenpaspoort
   dat verloopt tijdens de reis, een embargo dat je vergeet, een jas die in een
   hotel blijft hangen. Precies het soort dat nooit urgent voelt en altijd duur
   uitpakt. */
'use strict';

const H = require('./hulp');
const { OPEN, PERSOONLIJK, VERTROUWELIJK, isDatum, straks, lijst, obj } = H;

const DEEL3 = [
  /* ---- Security Office: posten, reisrisico en de digitale rondes ---- */
  { kamer: 'beveiliging', knopen(l, K) {
    const b = obj(l.beveiliging), uit = [];
    for (const p of lijst(b.posten)) {
      const id = 'post:' + p.id;
      uit.push(K({ id, soort: 'post', naam: p.waar + (p.soort ? ' · ' + p.soort : ''), kamer: 'beveiliging',
        bron: 'Beveiliging', gevoelig: VERTROUWELIJK, deel: 'rechterhand' }));
      for (const [veld, wat] of [['contractTot', 'contract'], ['keuringOp', 'keuring']]) {
        if (!isDatum(p[veld])) continue;
        uit.push(K({ id: id + ':' + wat, soort: 'termijn', naam: wat, kamer: 'beveiliging',
          bron: 'Beveiliging', gevoelig: VERTROUWELIJK, deel: 'rechterhand',
          vervalt: p[veld], vervaltWat: wat, ouder: id }));
      }
    }
    /* Een risico-inschatting VERLOOPT, en dat is de hele reden dat hij een
       houdbaarheid moet hebben: hij hoort achterstallig te worden zodat iemand
       er opnieuw naar kijkt, niet stilletjes te blijven staan. */
    for (const r of lijst(b.reisrisico)) {
      if (!isDatum(r.tot)) continue;
      uit.push(K({ id: 'risico:' + r.id, soort: 'termijn', naam: r.land + ' · ' + r.niveau,
        kamer: 'beveiliging', bron: 'Beveiliging', gevoelig: VERTROUWELIJK, deel: 'rechterhand',
        vervalt: r.tot, vervaltWat: 'risico-inschatting' }));
    }
    for (const d of lijst(b.digitaal)) {
      if (!isDatum(d.volgende)) continue;
      uit.push(K({ id: 'digi:' + d.id, soort: 'termijn', naam: d.wat, kamer: 'beveiliging',
        bron: 'Beveiliging', gevoelig: VERTROUWELIJK, deel: 'rechterhand',
        vervalt: d.volgende, vervaltWat: d.soort || 'controle' }));
    }
    return uit;
  } },

  /* ---- Reputation Office: optredens en hun embargo ---- */
  { kamer: 'reputatie', knopen(l, K) {
    const r = obj(l.reputatie), uit = [];
    for (const o of lijst(r.optredens)) {
      const id = 'optreden:' + o.id;
      uit.push(K({ id, soort: 'optreden', naam: o.wat, kamer: 'reputatie', bron: 'Reputatie',
        gevoelig: PERSOONLIJK, deel: 'rechterhand',
        vervalt: straks(o.datum), vervaltWat: 'optreden' }));
      if (isDatum(o.embargoTot)) {
        uit.push(K({ id: id + ':embargo', soort: 'termijn', naam: 'embargo', kamer: 'reputatie',
          bron: 'Reputatie', gevoelig: VERTROUWELIJK, deel: 'rechterhand',
          vervalt: o.embargoTot, vervaltWat: 'embargo', ouder: id }));
      }
    }
    return uit;
  } },

  /* ---- Pet Office: dieren, hun documenten en hun zorgrondes ---- */
  { kamer: 'dieren', knopen(l, K) {
    const uit = [];
    for (const d of lijst(l.dieren)) {
      const id = 'dier:' + d.id;
      uit.push(K({ id, soort: 'dier', naam: d.naam + (d.soort ? ' · ' + d.soort : ''), kamer: 'dieren',
        bron: 'Dieren', gevoelig: PERSOONLIJK, deel: 'rechterhand' }));
      if (isDatum(d.verzekerdTot)) {
        uit.push(K({ id: id + ':verzekering', soort: 'termijn', naam: 'verzekering', kamer: 'dieren',
          bron: 'Dieren', gevoelig: PERSOONLIJK, deel: 'rechterhand',
          vervalt: d.verzekerdTot, vervaltWat: 'verzekering', ouder: id }));
      }
      for (const doc of lijst(d.documenten)) {
        if (!isDatum(doc.tot)) continue;
        uit.push(K({ id: id + ':doc:' + doc.id, soort: 'termijn', naam: doc.soort || 'document',
          kamer: 'dieren', bron: 'Dieren', gevoelig: PERSOONLIJK, deel: 'rechterhand',
          vervalt: doc.tot, vervaltWat: doc.soort || 'document', ouder: id }));
      }
      // alleen de EERSTVOLGENDE zorgronde; de historie is geen termijn
      const volgende = lijst(d.zorg).map(z => z.volgende).filter(isDatum).sort()[0];
      if (volgende) {
        uit.push(K({ id: id + ':zorg', soort: 'termijn', naam: 'zorgronde', kamer: 'dieren',
          bron: 'Dieren', gevoelig: PERSOONLIJK, deel: 'rechterhand',
          vervalt: volgende, vervaltWat: 'zorg', ouder: id }));
      }
    }
    return uit;
  } },

  /* ---- Collecties: de volgende taxatie, de conditiecontrole en het einde van
     een bruikleen. Ze hangen aan de bezitting uit het register, die door
     graaf-bronnen.js al als knoop is ingeleverd. ---- */
  { kamer: 'collectie', knopen(l, K) {
    const alle = obj(l.collectie), uit = [];
    for (const [bezitId, d] of Object.entries(alle)) {
      const ouder = 'bezit:' + bezitId;
      const tax = lijst(obj(d).taxaties).map(t => t.volgende).filter(isDatum).sort()[0];
      if (tax) uit.push(K({ id: ouder + ':hertaxatie', soort: 'termijn', naam: 'hertaxatie',
        kamer: 'collectie', bron: 'Collectie', gevoelig: PERSOONLIJK, deel: 'rechterhand',
        vervalt: tax, vervaltWat: 'hertaxatie', ouder }));
      const cond = obj(d).conditie || {};
      if (isDatum(cond.volgende)) uit.push(K({ id: ouder + ':conditie', soort: 'termijn',
        naam: 'conditiecontrole', kamer: 'collectie', bron: 'Collectie', gevoelig: PERSOONLIJK,
        deel: 'rechterhand', vervalt: cond.volgende, vervaltWat: 'conditie', ouder }));
      for (const b of lijst(obj(d).bruikleen)) {
        if (b.terug || !isDatum(b.tot)) continue;
        uit.push(K({ id: ouder + ':bruikleen:' + b.id, soort: 'termijn',
          naam: 'terug van ' + (b.aan || 'bruikleen'), kamer: 'collectie', bron: 'Collectie',
          gevoelig: PERSOONLIJK, deel: 'rechterhand', vervalt: b.tot, vervaltWat: 'bruikleen', ouder }));
      }
    }
    return uit;
  } },

  /* ---- Het reisdek: wat er na een reis nog open staat. Een jas die ergens
     hangt is een termijn zolang hij niet terug is. ---- */
  { kamer: 'reizen', knopen(l, K) {
    const uit = [];
    for (const r of lijst(l.reizen)) {
      const nz = obj(r.nazorg);
      for (const v of lijst(nz.vergeten)) {
        if (v.stand === 'terug' || v.stand === 'opgegeven' || !isDatum(v.terugOp)) continue;
        uit.push(K({ id: 'kwijt:' + v.id, soort: 'termijn', naam: v.wat + (v.waar ? ' (' + v.waar + ')' : ''),
          kamer: 'reizen', bron: 'Reisdek', gevoelig: PERSOONLIJK, deel: 'rechterhand',
          vervalt: v.terugOp, vervaltWat: 'achtergelaten', ouder: 'reis:' + r.id }));
      }
    }
    return uit;
  } }
];

module.exports = DEEL3;
