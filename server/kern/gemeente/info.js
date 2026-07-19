/* Gemeente-domein "info": pijler 4, afval/belasting/bestuur. De afvalkalender per
   postcode, grofvuil op afspraak, de gemeentelijke aanslagen (OZB, afvalstoffen-
   en rioolheffing; deterministisch per inwoner, betalen via de geld-drempel) en de
   bekendmakingen. Plus het regie-dashboard van de medewerker. Krijgt de gedeelde
   ctx van kern/gemeente/index.js. */
module.exports = (ctx) => {
  const { db, save, nu, vandaag, id, ref, schoon, seed, deGemeente, sseToSupplier, publiekeMelding, FRACTIES } = ctx;

  function afvalVoor(postcode) {
    seed();
    const g = deGemeente();
    const pat = (g && g.gemeente && g.gemeente.afval && g.gemeente.afval.patroon) || { rest: 2, gft: 5, papier: 4, pmd: 1 };
    // de postcode schuift het patroon een paar dagen op, zodat wijken verschillen
    const off = [...String(postcode || '00000')].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % 7;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const uit = {};
    for (const [fr, wd] of Object.entries(pat)) {
      const doel = (wd + off) % 7;
      const data = [];
      for (let i = 0; i < 28 && data.length < 3; i++) {
        const d = new Date(start.getTime() + i * 86400000);
        if (d.getDay() !== doel) continue;
        // papier tweewekelijks
        if (fr === 'papier' && g && g.gemeente.afval.biweekPapier && Math.floor((d - start) / (7 * 86400000)) % 2 === 1) continue;
        data.push(d.toISOString().slice(0, 10));
      }
      uit[fr] = { label: FRACTIES[fr], data };
    }
    return { ok: true, postcode: String(postcode || '').toUpperCase().slice(0, 8) || null, fracties: uit };
  }
  function grofvuilAanvraag(sess, codenaam, data) {
    seed();
    data = data || {};
    const wat = schoon(data.wat, 300);
    if (wat.length < 3) return { status: 400, error: 'Omschrijf wat er opgehaald moet worden.' };
    const g = deGemeente();
    const m = {
      id: id(), ref: ref('M'), gemeente: g ? g.code : 'GEMEENTE', categorie: 'afval', categorieLabel: 'Grofvuil op afspraak',
      tekst: 'Grofvuil: ' + wat, locatie: schoon(data.adres, 160) || null, lat: null, lng: null,
      melderKey: sess.key, melder: codenaam, status: 'gepland', ploeg: 'reiniging',
      updates: [{ tekst: 'Aangevraagd; de reiniging plant een ophaalmoment in.', at: nu(), door: 'systeem' }], at: nu()
    };
    db.data.gemeenteMeldingen.unshift(m);
    save();
    if (g && sseToSupplier) sseToSupplier(g.code, 'sync', { scope: 'gemeente' });
    return { ok: true, aanvraag: publiekeMelding(m) };
  }

  /* De gemeentelijke aanslagen. In de demo staan er voorbeeldaanslagen klaar per
     inwoner (OZB, afvalstoffenheffing, rioolheffing), deterministisch afgeleid
     van de sleutel zodat de bedragen stabiel blijven. Betalen loopt via de
     geld-drempel (de AI vraagt eerst bevestiging); nooit de belofte dat een
     betaling al bij de belastingdienst verwerkt is voordat een mens dat ziet. */
  const BELASTINGEN = [
    { soort: 'OZB', basis: 180, spreiding: 520 },
    { soort: 'Afvalstoffenheffing', basis: 240, spreiding: 120 },
    { soort: 'Rioolheffing', basis: 150, spreiding: 90 }
  ];
  function hash(s) { let h = 0x811c9dc5 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
  function ensureAanslagen(key) {
    if (!key) return;
    const jaar = new Date().getFullYear();
    if ((db.data.gemeenteAanslagen || []).some(a => a.key === key && a.jaar === jaar)) return;
    const h = hash(String(key) + jaar);
    BELASTINGEN.forEach((b, i) => {
      const bedrag = b.basis + ((h >>> (i * 5)) % (b.spreiding + 1));
      db.data.gemeenteAanslagen.unshift({ id: id(), key, soort: b.soort, jaar, bedrag, betaald: false, at: nu() });
    });
    db.data.gemeenteAanslagen = db.data.gemeenteAanslagen.slice(0, 20000);
    save();
  }
  function belastingMijn(key) {
    seed(); ensureAanslagen(key);
    return (db.data.gemeenteAanslagen || []).filter(a => a.key === key)
      .map(a => ({ id: a.id, soort: a.soort, jaar: a.jaar, bedrag: a.bedrag, betaald: !!a.betaald }));
  }
  function belastingBetaal(key, aid) {
    const a = (db.data.gemeenteAanslagen || []).find(x => x.id === String(aid || '') && x.key === key);
    if (!a) return { status: 404, error: 'Aanslag niet gevonden.' };
    if (a.betaald) return { status: 409, error: 'Deze aanslag is al betaald.' };
    a.betaald = true; a.betaaldAt = nu();
    save();
    return { ok: true, aanslag: { id: a.id, soort: a.soort, jaar: a.jaar, bedrag: a.bedrag, betaald: true } };
  }
  function bekendmakingen() {
    seed();
    return { ok: true, bekendmakingen: (db.data.gemeenteBekend || []).slice(0, 40).map(b => ({ id: b.id, titel: b.titel, tekst: b.tekst, soort: b.soort, at: b.at })) };
  }

  /* ---- gemeente-medewerkers ---- */
  function bekendmakingMaak(actor, data) {
    seed();
    data = data || {};
    const titel = schoon(data.titel, 120), tekst = schoon(data.tekst, 800);
    if (titel.length < 3 || tekst.length < 3) return { status: 400, error: 'Vul een titel en tekst in.' };
    const soort = ['algemeen', 'raad', 'verkeer', 'vergunning'].includes(data.soort) ? data.soort : 'algemeen';
    const b = { id: id(), gemeente: (deGemeente() || {}).code || 'GEMEENTE', titel, tekst, soort, door: actor || 'gemeente', at: nu() };
    db.data.gemeenteBekend.unshift(b);
    db.data.gemeenteBekend = db.data.gemeenteBekend.slice(0, 500);
    save();
    return { ok: true, bekendmaking: { id: b.id, titel, tekst, soort, at: b.at } };
  }
  function regie() {
    seed();
    const M = db.data.gemeenteMeldingen || [], A = db.data.gemeenteAfspraken || [], G = db.data.gemeenteVergunningen || [];
    const open = M.filter(m => !['opgelost', 'afgewezen'].includes(m.status));
    const perPloeg = {};
    for (const m of open) perPloeg[m.ploeg] = (perPloeg[m.ploeg] || 0) + 1;
    return {
      ok: true,
      meldingenOpen: open.length,
      meldingenPerPloeg: perPloeg,
      afsprakenVandaag: A.filter(a => a.datum === vandaag() && a.status === 'gepland').length,
      vergunningenOpen: G.filter(v => ['ingediend', 'in behandeling'].includes(v.status)).length,
      bekendmakingen: (db.data.gemeenteBekend || []).length
    };
  }

  return { afvalVoor, grofvuilAanvraag, belastingMijn, belastingBetaal, bekendmakingen, bekendmakingMaak, regie };
};
