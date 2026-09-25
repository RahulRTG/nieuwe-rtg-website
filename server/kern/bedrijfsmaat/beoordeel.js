/* VAN MAAT EN BEWIJS NAAR STAND -- de afleiding, los van de gegevens.

   `klopt(citaat)` komt van buiten (scripts/bedrijfsmaat.js leest de bron) en zegt
   per citaat ja of nee. Alles wat hier gebeurt is rekenen op die antwoorden: een
   element bestaat als al zijn citaten kloppen, een maat bestaat als alle vier de
   elementen bestaan, en een keten is gegrond als al zijn schakels bestaan.

   EEN CITAAT DAT NIET KLOPT IS GEEN KLEIN GEBREK. Het element telt dan als
   afwezig en het citaat komt op de lijst `verworpen`: de catalogus beweerde iets
   wat de code niet zegt. Een gevonden naam telt niet als bestaande maat. */
'use strict';

module.exports = ({ MATEN, ELEMENTEN, GATEN, STATUS, KETENS, KLASSEN, opId }) => function inventaris(klopt) {
  const ids = opId(), klaar = new Map(), verworpen = [];

  const element = (m, e, bronVanDeps) => {
    const v = m[e], reden = (m.waarom || {})[e] || null;
    if (e === 'bron' && v === 'afgeleid') {
      const zonder = m.afhankelijk.filter(a => !bronVanDeps(a));
      return { aanwezig: !zonder.length, afgeleid: true, citaten: [],
        reden: zonder.length ? 'afgeleid, maar zonder bron in: ' + zonder.join(', ') : null };
    }
    if (!Array.isArray(v)) return { aanwezig: false, citaten: [], reden };
    const citaten = v.map(x => ({ bestand: x.bestand, citaat: x.citaat, klopt: klopt(x, e) === true }));
    for (const x of citaten) if (!x.klopt) verworpen.push({ maat: m.id, element: e, bestand: x.bestand, citaat: x.citaat });
    const aanwezig = citaten.every(x => x.klopt);
    return { aanwezig, citaten, reden: aanwezig ? null : (reden || 'een citaat staat niet in zijn bestand') };
  };

  function beoordeel(id) {
    if (klaar.has(id)) return klaar.get(id);
    const m = ids.get(id);
    klaar.set(id, null); // een kring is door vormfouten() al gemeld
    for (const a of m.afhankelijk) beoordeel(a); // eerst wat eronder ligt
    const bronVan = (a) => { const d = klaar.get(a); return !!(d && d.elementen.bron.aanwezig); };
    const elementen = {};
    for (const e of ELEMENTEN) elementen[e] = element(m, e, bronVan);
    const gaten = ELEMENTEN.filter(e => !elementen[e].aanwezig).map(e => GATEN[e]);
    const status = m.onbekend ? STATUS.onbekend
      : !gaten.length ? STATUS.bestaat : !elementen.bron.aanwezig ? STATUS.ontbreekt : STATUS.half;
    const klasse = KLASSEN[m.privacy] || {};
    const grens = klasse.optellend ? Math.max(klasse.grens, m.minGroep || 0) : null;
    const gg = Array.isArray(m.groepsgrens) ? m.groepsgrens.map(x => ({ bestand: x.bestand, citaat: x.citaat, klopt: klopt(x, 'groepsgrens') === true })) : [];
    for (const x of gg) if (!x.klopt) verworpen.push({ maat: m.id, element: 'groepsgrens', bestand: x.bestand, citaat: x.citaat });
    const afgedwongen = gg.length > 0 && gg.every(x => x.klopt);
    /* De keten erboven: alles waar deze maat op rust, transitief. */
    const boven = new Set(), stapel = [...m.afhankelijk];
    while (stapel.length) { const a = stapel.pop(); if (boven.has(a) || !ids.has(a)) continue; boven.add(a); stapel.push(...ids.get(a).afhankelijk); }
    const zwak = [...boven].filter(a => { const d = klaar.get(a); return !d || d.status !== STATUS.bestaat; }).sort();
    const uit = {
      id: m.id, versie: m.versie || 1, domein: m.domein, betekenis: m.betekenis, wereld: m.wereld,
      bronnen: Array.isArray(m.bron) ? m.bron.map(x => x.bestand) : [], berekening: m.berekening, eenheid: m.eenheid,
      graad: elementen.bewijs.aanwezig ? m.graad : 'onbekend', actualiteit: m.actualiteit,
      minimaleGroep: grens, privacyklasse: m.privacy,
      eigenaar: m.eigenaar || null, eigenaarReden: m.eigenaar ? null : ((m.waarom || {}).eigenaar || null),
      afhankelijk: m.afhankelijk.slice(), status, gaten, elementen,
      groepsgrens: { vereist: !!klasse.optellend, afgedwongen: klasse.optellend ? afgedwongen : null, citaten: gg,
        reden: klasse.optellend && !afgedwongen ? ((m.waarom || {}).groepsgrens || null) : null },
      keten: { gegrond: !zwak.length && status === STATUS.bestaat, zwakkeSchakels: zwak }
    };
    klaar.set(id, uit);
    return uit;
  }

  const maten = MATEN.map(m => beoordeel(m.id));
  const per = new Map(maten.map(m => [m.id, m]));
  const ketens = KETENS.map(k => {
    const schakels = k.schakels.map(s => ({ id: s, status: per.get(s).status, gaten: per.get(s).gaten }));
    const breuk = schakels.find(s => s.status !== STATUS.bestaat) || null;
    return { id: k.id, naam: k.naam, gegrond: !breuk, eersteBreuk: breuk ? breuk.id : null,
      bestaand: schakels.filter(s => s.status === STATUS.bestaat).length, van: schakels.length, schakels };
  });
  const kanten = [];
  for (const m of maten) for (const a of m.afhankelijk) kanten.push({ van: a, naar: m.id, gegrond: per.get(a).status === STATUS.bestaat });
  /* Ontbrekende schakels: maten die BESTAAN maar op een maat rusten die dat niet
     doet. Een conclusie daarover heeft geen bewezen keten, ook al is het getal er. */
  const rustOpGat = maten.filter(m => m.status === STATUS.bestaat && m.keten.zwakkeSchakels.length)
    .map(m => ({ id: m.id, zwakkeSchakels: m.keten.zwakkeSchakels }));
  const privacyGaten = maten.filter(m => m.groepsgrens.vereist && m.elementen.projectie.aanwezig && !m.groepsgrens.afgedwongen)
    .map(m => ({ id: m.id, grens: m.minimaleGroep, reden: m.groepsgrens.reden }));
  return { maten, ketens, graaf: { knopen: maten.map(m => ({ id: m.id, status: m.status, domein: m.domein })), kanten },
    rustOpGat, privacyGaten, verworpen };
};
