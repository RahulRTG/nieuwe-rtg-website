/* RTG Festival (deelmodule): DE TELLING. Hoeveel mensen staan waar, en hoe snel
   komen ze erbij.

   DIT IS EEN TELLING EN GEEN SPOOR (FESTIVAL.md par. 5.1). Wat hier uitkomt is
   een AANTAL per plek per moment. Er komt geen route van een bezoeker over het
   terrein uit, en dat is geen beperking maar het ontwerp: voor elke beslissing
   die de cockpit neemt -- deze zone loopt vol, die corridor komt in de knel --
   is een aantal genoeg, en een route levert alleen een dossier op over waar
   iemand met wie stond.

   IEDEREEN WORDT EEN KEER GETELD, EN DAT IS HET ENIGE MOEILIJKE HIER. Wie bij
   de zonepoort scant staat in de zone; wie daarna bij het podium scant staat in
   allebei. Naief optellen telt hem twee keer, en dan meldt een zone 140% terwijl
   het terrein halfleeg is. De regel: een pas telt op zijn DIEPSTE plek, en die
   ene telling rolt omhoog naar alles wat erboven ligt.

   ER WORDT NIETS OPGESLAGEN. Deze laag leest de scans en rekent; dat is de
   graaf-regel uit PLATFORM.md (leest alleen, bezit niets, telt nooit zelf op
   wat een domein al optelt). Een bewaarde teller zou na een herstelde back-up
   of een offline bundel uit de pas lopen met de scans die eronder liggen. */
'use strict';

module.exports = (ctx) => {
  const { editieVind, dagVind, plekVind, plekPad, momentOffset, PLEK_SOORTEN } = ctx;

  /* De toestand per (pas, telplek): de laatste scan van die dag wint.

     `tot` is optioneel en snijdt de dag af op een moment (minuten na opening).
     Zonder dat getal is de uitkomst de stand NU, en dat is wat de cockpit
     vraagt. Mét dat getal is het de stand op dat moment, en dat is wat
     ./geheugen.js nodig heeft om achteraf de piek te vinden. Dat is bewust
     dezelfde functie: een tweede telling die "vroeger" berekent, gaat op de
     eerste de beste wijziging uit de pas lopen met deze (LAT-regel 4). */
  function laatsteStandPer(e, dagId, tot, dag) {
    const stand = new Map();
    for (const s of e.scans || []) {
      if (s.dag !== dagId || !s.telplek) continue;
      if (tot != null) {
        const o = momentOffset(dag, s.datum, s.tijd);
        if (o === null || o > tot) continue;
      }
      stand.set(s.pas + '|' + s.telplek, s.richting);
    }
    return stand;
  }

  /* Waar staat elke pas nu: zijn diepste plek. Geeft een Map plekId -> aantal
     met ALLEEN de diepste plek per pas; het optellen naar boven gebeurt daarna. */
  function diepste(e, dagId, tot, dag) {
    const binnen = new Map();                       // pas -> { plek, diepte }
    for (const [sleutel, richting] of laatsteStandPer(e, dagId, tot, dag)) {
      if (richting !== 'in') continue;
      const [pas, tel] = sleutel.split('|');
      const pad = plekPad(e, tel);
      if (!pad) continue;                           // stukke boom telt niet mee
      const huidig = binnen.get(pas);
      if (!huidig || pad.length > huidig.diepte) binnen.set(pas, { plek: tel, diepte: pad.length });
    }
    const per = new Map();
    for (const v of binnen.values()) per.set(v.plek, (per.get(v.plek) || 0) + 1);
    return per;
  }

  /* De bezetting van elke tellende plek, met de telling van alles wat erin ligt
     erbij opgeteld. */
  function bezetting(fid, eid, dagId, tot) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const dag = dagVind(e, dagId);
    if (!dag) return { status: 404, error: 'Deze dag staat niet in de editie.' };

    const per = diepste(e, dagId, tot == null ? null : tot, dag);
    const totaal = new Map();
    for (const [plekId, n] of per) {
      const pad = plekPad(e, plekId);
      if (!pad) continue;
      for (const voorouder of pad) totaal.set(voorouder.id, (totaal.get(voorouder.id) || 0) + n);
    }

    const uit = [];
    for (const p of Object.values(e.plekken || {})) {
      if (!(PLEK_SOORTEN[p.soort] || {}).telt) continue;
      const n = totaal.get(p.id) || 0;
      const veilig = p.veiligeCapaciteit || p.capaciteit || 0;
      uit.push({ id: p.id, naam: p.naam, soort: p.soort, ouder: p.ouder || null,
        aanwezig: n, capaciteit: p.capaciteit || 0, veiligeCapaciteit: veilig,
        /* Het deel wordt tegen de VEILIGE capaciteit gerekend en niet tegen de
           vergunde. Dat is het getal waar de veiligheidsorganisatie op stuurt;
           tegen de vergunde rekenen geeft een geruststellende 78% op het moment
           dat de zaal eigenlijk al vol is. */
        deel: veilig ? Math.round((n / veilig) * 1000) / 10 : null });
    }
    uit.sort((a, b) => (b.deel || 0) - (a.deel || 0));
    return { ok: true, dag: dagId, tot: tot == null ? null : tot, plekken: uit };
  }

  /* INSTROOM: hoeveel mensen kwamen er de laatste `venster` minuten binnen op
     deze plek (en op alles wat erin ligt). Dit is de afgeleide waar de
     vooruitblik op draait -- zonder snelheid is een bezetting alleen een
     mededeling achteraf.

     Gemeten in scans en niet geschat: als er niets gescand is, is de instroom 0
     en niet "waarschijnlijk iets". Een meter die zijn invoer mist, hoort niets
     te beweren (LAT-regel 3). */
  function instroom(fid, eid, dagId, datum, tot, venster) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const dag = dagVind(e, dagId);
    if (!dag) return { status: 404, error: 'Deze dag staat niet in de editie.' };
    const nu = momentOffset(dag, String(datum || ''), String(tot || ''));
    if (nu === null) return { status: 400, error: 'Dat moment valt buiten deze dag.' };
    const breedte = Math.max(1, Math.min(240, parseInt(venster, 10) || 15));

    const per = new Map();
    for (const s of e.scans || []) {
      if (s.dag !== dagId || s.richting !== 'in' || !s.telplek) continue;
      const o = momentOffset(dag, s.datum, s.tijd);
      if (o === null || o > nu || o <= nu - breedte) continue;
      const pad = plekPad(e, s.telplek);
      if (!pad) continue;
      for (const voorouder of pad) per.set(voorouder.id, (per.get(voorouder.id) || 0) + 1);
    }
    const uit = {};
    for (const [plekId, n] of per) {
      const p = plekVind(e, plekId);
      if (p) uit[plekId] = { naam: p.naam, aantal: n, perMinuut: Math.round((n / breedte) * 100) / 100 };
    }
    return { ok: true, dag: dagId, tot: String(tot), venster: breedte, plekken: uit };
  }

  return { bezetting, instroom };
};
