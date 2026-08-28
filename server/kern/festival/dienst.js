/* RTG Festival (deelmodule): DE DIENST. Wie waar staat, en wanneer.

   ZERO-SEARCH IS DE HELE OPGAVE (FESTIVAL.md par. 8, fase 4). Een medewerker
   die zijn dienst opent, hoort niet te hoeven zoeken naar iets wat het systeem
   al weet: welke dienst is van mij, waar is dat, wie staat er nog meer, en wat
   moet ik weten voor ik begin. mijnDienst() is die ene vraag.

   WAT DIT NIET IS, EN DAT IS DE BELANGRIJKSTE ZIN HIER.

   HET IS GEEN TWEEDE KLOK. In- en uitklokken gebeurt waar dat al gebeurt
   (kern/personeel.js, klokVan). Deze laag zegt WAAR iemand hoort te staan; hoe
   lang hij er stond, telt het bestaande systeem. Twee klokken naast elkaar
   leveren twee urenstaten op, en dan is er een die niet klopt bij de loonrun.

   HET IS GEEN TWEEDE ROOSTER VOOR DE BEVEILIGING. Dat staat in
   kern/beveiliging/rooster/, met zijn eigen posten, budget en autoplanner, en
   het festival LEEST dat via een partnerband (./signalen.js). Deze diensten
   gaan over de EIGEN ploeg van de organisatie: de bar, de kassa, de garderobe.

   EN ER KOMT GEEN SCORE OP EEN MENS. Geen stiptheidscijfer, geen ranglijst van
   wie het snelst inklokt, geen "betrouwbaarheid". Dat is dezelfde grens die
   LIFE.md trekt voor het leven tussen mensen en die CLAUDE.md trekt voor de
   progressielaag: meten mag, maar niet iemands waarde uitrekenen.

   WAT ER WEL WORDT AFGEDWONGEN: niemand staat op twee plekken tegelijk. Een
   rooster waarin dat kan, is geen rooster maar een verlanglijst -- en op de dag
   zelf staat er dan een bar zonder mensen terwijl het rooster groen is. */
'use strict';

module.exports = (ctx) => {
  const { save, crypto, schoon, editieVind, dagVind, offset, plekVind, plekPad } = ctx;

  const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

  const bak = (e) => {
    if (!e.diensten || typeof e.diensten !== 'object') e.diensten = {};
    return e.diensten;
  };

  /* Twee vensters op dezelfde dag, in minuten na opening -- zo werkt het ook
     over middernacht heen (kern/festival/model.js). */
  function overlapt(dag, a, b) {
    const av = offset(dag, a.van), at = offset(dag, a.tot);
    const bv = offset(dag, b.van), bt = offset(dag, b.tot);
    if ([av, at, bv, bt].some(x => x === null)) return false;
    return av < bt && bv < at;
  }

  function dienstZet(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const dag = dagVind(e, d.dag);
    if (!dag) return { status: 404, error: 'Deze dag staat niet in de editie.' };
    const plek = plekVind(e, d.plek);
    if (!plek) return { status: 404, error: 'Deze plek bestaat niet.' };
    const wie = schoon(d.wie, 60);
    if (!wie) return { status: 400, error: 'Wie draait deze dienst?' };
    if (!HHMM.test(String(d.van || '')) || !HHMM.test(String(d.tot || '')))
      return { status: 400, error: 'Geef begin en eind als uu:mm.' };
    const van = String(d.van), tot = String(d.tot);
    if (offset(dag, van) === null || offset(dag, tot) === null)
      return { status: 400, error: 'Die tijden vallen buiten de openingstijden van deze dag.' };
    if (offset(dag, van) >= offset(dag, tot))
      return { status: 400, error: 'Een dienst eindigt niet voor of op zijn begin.' };

    const b = bak(e);
    const nieuw = { dag: dag.id, plek: plek.id, wie, van, tot };
    /* NIEMAND STAAT OP TWEE PLEKKEN TEGELIJK. Dit is de enige regel die een
       rooster van een verlanglijst onderscheidt. */
    for (const x of Object.values(b)) {
      if (x.id === String(d.id || '')) continue;
      if (x.dag !== dag.id || x.wie !== wie) continue;
      if (overlapt(dag, x, nieuw)) {
        return { status: 409, error: wie + ' staat dan al op ' + (plekVind(e, x.plek) || {}).naam
          + ' (' + x.van + '-' + x.tot + ').' };
      }
    }

    const velden = { ...nieuw, rol: schoon(d.rol, 40) || null, briefing: schoon(d.briefing, 400) || null,
      pauze: HHMM.test(String(d.pauze || '')) ? String(d.pauze) : null };
    if (d.id) {
      const x = b[String(d.id)];
      if (!x) return { status: 404, error: 'Deze dienst bestaat niet.' };
      Object.assign(x, velden);
      save();
      return { ok: true, dienst: x };
    }
    if (Object.keys(b).length >= 20000) return { status: 400, error: 'Er staan te veel diensten op deze editie.' };
    const x = { id: 'dnst' + crypto.randomBytes(4).toString('hex'), ...velden };
    b[x.id] = x;
    save();
    return { ok: true, dienst: x };
  }

  function dienstWeg(fid, eid, id) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const x = bak(e)[String(id || '')];
    if (!x) return { status: 404, error: 'Deze dienst bestaat niet.' };
    delete e.diensten[x.id];
    save();
    return { ok: true };
  }

  /* Alles op een dag, voor wie het rooster maakt. */
  function dienstenVan(fid, eid, dagId) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const uit = Object.values(e.diensten || {})
      .filter(x => x.dag === String(dagId || ''))
      .map(x => ({ ...x, plekNaam: (plekVind(e, x.plek) || {}).naam || null }))
      .sort((a, b) => a.van.localeCompare(b.van) || String(a.plekNaam).localeCompare(String(b.plekNaam)));
    return { ok: true, diensten: uit };
  }

  /* DE ENE VRAAG: wat is er van mij, nu? Geeft de lopende dienst en de
     eerstvolgende. Alles wat een mens nodig heeft voor hij begint zit erin, en
     er staat niets bij wat hij niet nodig heeft. */
  function mijnDienst(fid, eid, vraag) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const v = vraag || {};
    const wie = schoon(v.wie, 60);
    if (!wie) return { status: 400, error: 'Voor wie?' };
    const dag = dagVind(e, v.dag);
    if (!dag) return { ok: true, nu: null, straks: null, geenDag: true };
    const nu = HHMM.test(String(v.tijd || '')) ? offset(dag, String(v.tijd)) : null;

    const mijne = Object.values(e.diensten || {})
      .filter(x => x.dag === dag.id && x.wie === wie)
      .sort((a, b) => offset(dag, a.van) - offset(dag, b.van));

    const beeld = (x) => {
      if (!x) return null;
      const plek = plekVind(e, x.plek);
      const pad = plek ? (plekPad(e, plek.id) || []) : [];
      return {
        id: x.id, van: x.van, tot: x.tot, rol: x.rol, briefing: x.briefing, pauze: x.pauze,
        plek: plek ? plek.naam : null,
        /* DE WEG ERHEEN is de keten van plekken van buiten naar binnen --
           "Terrein > Weide > Bar Lima". Dat is wat iemand nodig heeft die er
           nog nooit is geweest, en het komt uit de boom die er al is. */
        weg: pad.slice().reverse().map(p => p.naam),
        collegas: Object.values(e.diensten || {})
          .filter(y => y.dag === dag.id && y.plek === x.plek && y.wie !== wie && overlapt(dag, y, x))
          .map(y => ({ wie: y.wie, rol: y.rol, van: y.van, tot: y.tot }))
      };
    };

    const lopend = nu === null ? null
      : mijne.find(x => offset(dag, x.van) <= nu && nu < offset(dag, x.tot)) || null;
    const volgend = nu === null ? mijne[0]
      : mijne.find(x => offset(dag, x.van) > nu) || null;
    return { ok: true, dag: dag.id, datum: dag.datum, nu: beeld(lopend), straks: beeld(volgend) };
  }

  return { dienstZet, dienstWeg, dienstenVan, mijnDienst };
};
