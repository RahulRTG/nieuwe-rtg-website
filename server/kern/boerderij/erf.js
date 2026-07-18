/* Boerderij (deelmodule): gewasfasen, publieke weergaven, de dagbriefing en het overzicht.
   Krijgt de gedeelde context een keer bij het opstarten vanuit kern/boerderij.js. */
module.exports = (ctx) => {
  const { db, save, crypto, findSupplier, anthropic, schoon,
    BTYPES, GEWASSEN, DIEREN,
    isBoer, ensure, voegAanVoorraad, seizoen, SEIZOEN_LABEL, id, nu, vandaag, scho, getal } = ctx;
  function gewasFase(p) {
    const g = GEWASSEN[p.gewas];
    if (!p.gewas || !g || !p.gezaaidOp) return { fase: 'leeg', voortgang: 0, restDagen: null };
    if (p.geoogstOp) return { fase: 'geoogst', voortgang: 1, restDagen: 0 };
    const dagen = Math.max(0, Math.round((Date.now() - new Date(p.gezaaidOp).getTime()) / 86400000));
    const voortgang = Math.min(1, dagen / g.groeidagen);
    const restDagen = Math.max(0, g.groeidagen - dagen);
    let fase = 'groeit';
    if (voortgang >= 1) fase = 'te-oogsten';
    else if (voortgang < 0.15) fase = 'gezaaid';
    return { fase, voortgang, restDagen };
  }
  function perceelPubliek(p) {
    const f = gewasFase(p);
    const g = GEWASSEN[p.gewas];
    return {
      id: p.id, naam: p.naam, ha: p.ha, gewas: p.gewas || null,
      gewasLabel: g ? g.label : null, eenheid: g ? g.eenheid : null,
      gezaaidOp: p.gezaaidOp || null, oogstVerwacht: p.oogstVerwacht || null, geoogstOp: p.geoogstOp || null,
      opbrengst: p.opbrengst || 0, laatsteWater: p.laatsteWater || null,
      fase: f.fase, voortgang: Math.round(f.voortgang * 100), restDagen: f.restDagen,
      verwachtKg: g ? Math.round((p.ha || 0) * g.perHa) : 0
    };
  }
  function dierPubliek(d) {
    const k = DIEREN[d.soort];
    return {
      id: d.id, soort: d.soort, soortLabel: k ? k.label : d.soort, aantal: d.aantal || 0,
      stal: d.stal || null, opbrengstSoort: k ? k.opbrengst : null, eenheid: k ? k.eenheid : null,
      dagopbrengst: d.dagopbrengst != null ? d.dagopbrengst : (k ? Math.round((d.aantal || 0) * k.perDier) : 0),
      voerKgPerDag: Math.round((d.aantal || 0) * (k ? k.voerKg : 0)),
      gezondheid: d.gezondheid || 'goed', laatsteVoer: d.laatsteVoer || null
    };
  }

  /* ---- de Vandaag-briefing: wat vraagt nu aandacht? (seizoensbewust) ---- */
  function briefing(s) {
    const b = ensure(s);
    const seiz = seizoen();
    const punten = [];
    // oogstklare percelen
    const teOogsten = b.percelen.filter(p => gewasFase(p).fase === 'te-oogsten');
    if (teOogsten.length) punten.push({ soort: 'oogst', urgentie: 'hoog', tekst: teOogsten.length + ' perceel(en) klaar om te oogsten: ' + teOogsten.map(p => p.naam).join(', ') + '.' });
    // pas gezaaid, water geven bij warm weer
    if (seiz === 'zomer') {
      const droog = b.percelen.filter(p => { const f = gewasFase(p); return (f.fase === 'groeit' || f.fase === 'gezaaid') && (!p.laatsteWater || (Date.now() - new Date(p.laatsteWater).getTime()) > 2 * 86400000); });
      if (droog.length) punten.push({ soort: 'water', urgentie: 'midden', tekst: 'Warm seizoen: ' + droog.length + ' perceel(en) langer dan 2 dagen niet beregend.' });
    }
    // dieren: voer + gezondheid
    const nietGevoerd = b.dieren.filter(d => !d.laatsteVoer || d.laatsteVoer.slice(0, 10) !== vandaag());
    if (nietGevoerd.length) punten.push({ soort: 'voer', urgentie: 'hoog', tekst: nietGevoerd.length + ' diergroep(en) vandaag nog niet gevoerd.' });
    const ziek = b.dieren.filter(d => d.gezondheid && d.gezondheid !== 'goed');
    if (ziek.length) punten.push({ soort: 'gezondheid', urgentie: 'hoog', tekst: ziek.length + ' diergroep(en) met een aandachtspunt voor de gezondheid.' });
    // open taken voor vandaag / te laat
    const open = b.taken.filter(t => !t.klaar);
    const teLaat = open.filter(t => t.voor && t.voor < vandaag());
    if (teLaat.length) punten.push({ soort: 'taak', urgentie: 'hoog', tekst: teLaat.length + ' taak/taken over de einddatum.' });
    else if (open.length) punten.push({ soort: 'taak', urgentie: 'laag', tekst: open.length + ' open taak/taken op het bord.' });
    // seizoensadvies: wat kun je nu zaaien?
    const m = new Date().getMonth() + 1;
    const nuZaaien = Object.keys(GEWASSEN).filter(k => (GEWASSEN[k].zaaiMnd || []).includes(m)).map(k => GEWASSEN[k].label);
    if (nuZaaien.length) punten.push({ soort: 'seizoen', urgentie: 'laag', tekst: 'Goede maand om te zaaien/planten: ' + nuZaaien.slice(0, 6).join(', ') + '.' });
    return { seizoen: seiz, seizoenLabel: SEIZOEN_LABEL[seiz], punten };
  }

  function stats(b) {
    const totMelk = b.dieren.reduce((n, d) => n + (DIEREN[d.soort] && DIEREN[d.soort].opbrengst === 'melk' ? (dierPubliek(d).dagopbrengst || 0) : 0), 0);
    const totEieren = b.dieren.reduce((n, d) => n + (DIEREN[d.soort] && DIEREN[d.soort].opbrengst === 'eieren' ? (dierPubliek(d).dagopbrengst || 0) : 0), 0);
    return {
      percelen: b.percelen.length,
      hectare: Math.round(b.percelen.reduce((n, p) => n + (p.ha || 0), 0) * 10) / 10,
      teOogsten: b.percelen.filter(p => gewasFase(p).fase === 'te-oogsten').length,
      dierGroepen: b.dieren.length,
      dieren: b.dieren.reduce((n, d) => n + (d.aantal || 0), 0),
      melkPerDag: Math.round(totMelk), eierenPerDag: Math.round(totEieren),
      voerPerDag: b.dieren.reduce((n, d) => n + dierPubliek(d).voerKgPerDag, 0),
      openTaken: b.taken.filter(t => !t.klaar).length
    };
  }

  // Het volledige dashboard voor de boer-app.
  function overzicht(s) {
    const b = ensure(s);
    const t = b.type ? BTYPES[b.type] : null;
    return {
      opgezet: b.opgezet, type: b.type, typeLabel: t ? t.label : null, kind: t ? t.kind : null, typeIcon: t ? t.icon : null,
      types: Object.keys(BTYPES).map(k => ({ id: k, label: BTYPES[k].label, labelEn: BTYPES[k].labelEn, icon: BTYPES[k].icon, kind: BTYPES[k].kind })),
      gewaskeuze: t ? (t.gewassen || Object.keys(GEWASSEN)).map(k => ({ id: k, label: GEWASSEN[k].label })) : Object.keys(GEWASSEN).map(k => ({ id: k, label: GEWASSEN[k].label })),
      dierkeuze: t ? (t.dieren || Object.keys(DIEREN)).map(k => ({ id: k, label: DIEREN[k].label })) : Object.keys(DIEREN).map(k => ({ id: k, label: DIEREN[k].label })),
      percelen: b.percelen.map(perceelPubliek), dieren: b.dieren.map(dierPubliek),
      taken: b.taken.slice().sort((a, c) => (a.klaar - c.klaar) || String(a.voor || '').localeCompare(String(c.voor || ''))),
      producten: b.producten.map(p => ({ id: p.id, naam: p.naam, eenheid: p.eenheid, prijs: p.prijs || 0, voorraad: p.voorraad || 0, bron: p.bron || 'handmatig', teKoop: !!(p.prijs > 0 && p.voorraad > 0), inSalon: !!p.inSalon })),
      stats: stats(b), briefing: briefing(s)
    };
  }

  // Producten beheren (naam/prijs/voorraad/eenheid); oogst vult de voorraad zelf.
  return { gewasFase, perceelPubliek, dierPubliek, briefing, stats, overzicht };
};
