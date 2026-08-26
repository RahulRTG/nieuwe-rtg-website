/* DE STAND VAN HET BELEID: wat er per pas geldt, en wie dat verzet heeft.

   Afgesplitst van ./doorbelasting.js toen dat bestand door de omvangsgrens
   ging, en de naad ligt op een echt verschil. Dit bestand beantwoordt "wat is
   de afspraak"; het andere beantwoordt "wat gebeurt er deze maand". Het eerste
   verandert een paar keer per jaar en raakt de belofte aan elk lid op die pas;
   het tweede draait elke maand.

   De kaart zelf (welke pas welke stand heeft) staat in ./beleidkaart.js en is
   een tabel zonder logica. Hier staat alleen wat het KANTOOR daarvan mag
   verzetten, en wat het daarvoor moet opschrijven. */
'use strict';

const { BELEID, STANDEN, VAST } = require('./beleidkaart');

module.exports = (ctx) => {
  const { d, save, nu } = ctx;

  function overschrijvingen() {
    const k = d();
    if (!k.beleid || typeof k.beleid !== 'object') k.beleid = {};
    return k.beleid;
  }
  const standVan = (pas) => {
    const o = overschrijvingen()[pas];
    return (o && o.stand) || (BELEID[pas] || BELEID.gratis).stand;
  };

  const beleid = () => Object.keys(BELEID).map(pas => {
    const o = overschrijvingen()[pas];
    return Object.assign({ pas }, BELEID[pas], {
      stand: standVan(pas), bestaatNog: BELEID[pas].bestaatNog !== false,
      vast: !!VAST[pas], waaromVast: VAST[pas] || null,
      verzet: o ? { van: BELEID[pas].stand, naar: o.stand, reden: o.reden, op: o.op, door: o.door } : null });
  });

  /* Een stand verzetten. Met een reden, want dit verandert wat een lid op zijn
     rekening krijgt; een verandering daarin zonder opgeschreven waarom is over
     een half jaar niet meer te verdedigen tegenover het lid dat hem betaalt. */
  function beleidZet(pas, stand, reden, wie) {
    const p = String(pas || '');
    if (!BELEID[p]) return { status: 400, error: 'Onbekende pas.' };
    if (VAST[p]) return { status: 403, error: VAST[p] };
    if (!STANDEN.includes(String(stand))) return { status: 400, error: 'Onbekende stand.' };
    if (stand === 'rtfoundation' || stand === 'huis') return { status: 400, error: 'Die stand hoort bij een gezin of bij het huis, niet bij een pas.' };
    const r = String(reden == null ? '' : reden).trim().slice(0, 300);
    if (r.length < 8) return { status: 400, error: 'Noem de reden; een pas die opeens verbruik doorbelast verandert de rekening van elk lid erop.' };
    const naam = String(wie || '').trim().slice(0, 80);
    if (!naam) return { status: 400, error: 'Zonder wie gebeurt dit niet.' };
    overschrijvingen()[p] = { stand: String(stand), reden: r, op: nu(), door: naam };
    save();
    return { status: 200, ok: true, beleid: beleid().find(b => b.pas === p) };
  }


  return { beleid, beleidZet, standVan };
};
