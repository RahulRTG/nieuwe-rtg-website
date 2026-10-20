/* Vlootprojectie zonder ritstart, codeclaim, betaling of lijnbeheer. */
module.exports = (ctx) => {
  const { data, ensureOv, nu, versVoertuig, SOORTEN } = ctx;
  /* ---- het zaakoverzicht: live vloot, reizigers en omzet vandaag ---- */
  function overzicht(s) {
    ensureOv();
    const vandaag = nu().slice(0, 10);
    const ritten = data().ovRitten.filter(r => r.code === s.code && String(r.in.at).slice(0, 10) === vandaag);
    const operaties = (data().ovOperaties || []).filter(o => ['gereed-voor-boeken', 'in-regie', 'gereed', 'onderweg'].includes(o.status));
    const operatieBeeld = {
      actief: operaties.length,
      segmenten: operaties.reduce((n, o) => n + (o.segmenten || []).length, 0),
      personen: operaties.reduce((n, o) => n + (o.personen || 0), 0),
      aandacht: operaties.reduce((n, o) => n + (o.segmenten || []).filter(x => ['aangevraagd', 'offerte'].includes(x.status)).length, 0),
      // bewust alleen operationele totalen: geen naam, route, rollen of hoofdgast
      modi: Object.entries(operaties.flatMap(o => o.segmenten || []).reduce((a, x) => { a[x.modus] = (a[x.modus] || 0) + 1; return a; }, {}))
        .map(([modus, aantal]) => ({ modus, aantal }))
    };
    return { status: 200,
      voertuigen: data().ovVoertuigen.filter(v => v.code === s.code && versVoertuig(v))
        .map(v => ({ id: v.id, naam: v.naam, lijnId: v.lijnId, soort: v.soort, lat: v.lat, lng: v.lng, door: v.door })),
      reizigersVandaag: ritten.length, aanBoord: ritten.filter(r => r.status === 'in').length,
      omzetVandaag: ritten.reduce((n, r) => n + (r.prijs || 0), 0),
      lijnen: (s.lijnen || []).map(l => ({ id: l.id, naam: l.naam, soort: l.soort, icoon: SOORTEN[l.soort],
        reizigers: ritten.filter(r => r.lijnId === l.id).length })), operaties: operatieBeeld };
  }

  return overzicht;
};
