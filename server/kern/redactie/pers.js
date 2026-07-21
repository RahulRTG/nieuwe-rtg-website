/* Redactie, deelbestand "pers": de drukkerij (edities samenstellen uit
   GEPUBLICEERDE artikelen, de drukstraat die maar een kant op draait en de
   drukproef als tekstblad), het redactie-overzicht en het gepubliceerde
   nieuws voor de Nieuws-app. Krijgt de gedeelde ctx van ./index.js. */
module.exports = (ctx) => {
  const { save, scho, id, nu, R, vind, RUBRIEKEN, ARTIKEL_STATUS, EDITIE_STATUS } = ctx;

  /* ---------- de drukkerij: edities samenstellen en drukken ---------- */
  function editieMaak(data) {
    data = data || {};
    const titel = scho(data.titel, 100);
    if (!titel) return { status: 400, error: 'Geef de editie een titel.' };
    const soort = data.soort === 'magazine' ? 'magazine' : 'krant';
    const ids = (Array.isArray(data.artikelIds) ? data.artikelIds : [])
      .filter(aid => { const a = vind(aid); return a && a.status === 'gepubliceerd'; }).slice(0, 60);
    if (!ids.length) return { status: 400, error: 'Kies minstens een GEPUBLICEERD artikel voor de editie.' };
    const e = { id: id('ed'), soort, titel, datum: nu().slice(0, 10), artikelIds: ids,
      oplage: Math.max(1, Math.min(1000000, Math.round(Number(data.oplage) || 1000))), status: 'samenstellen', at: nu() };
    R().edities.unshift(e);
    R().edities = R().edities.slice(0, 2000);
    save();
    return { ok: true, editie: e };
  }
  function editieStatus(eid, status) {
    const e = R().edities.find(x => x.id === eid);
    if (!e) return { status: 404, error: 'Editie niet gevonden.' };
    if (!EDITIE_STATUS.includes(status)) return { status: 400, error: 'Onbekende status.' };
    // de drukstraat gaat een kant op: samenstellen -> ter-perse -> gedrukt
    if (EDITIE_STATUS.indexOf(status) < EDITIE_STATUS.indexOf(e.status)) return { status: 409, error: 'De drukstraat draait niet achteruit.' };
    e.status = status;
    if (status === 'gedrukt') e.gedruktAt = nu();
    save();
    return { ok: true, editie: e };
  }
  // de drukproef: de hele editie als tekstblad (zoals het lookbook van de studio)
  function drukproef(eid) {
    const e = R().edities.find(x => x.id === eid);
    if (!e) return { status: 404, error: 'Editie niet gevonden.' };
    const regels = ['=== ' + (e.soort === 'magazine' ? 'RTG MAGAZINE' : 'RTG COURANT') + ' · ' + e.titel + ' · ' + e.datum + ' ===',
      'Oplage: ' + e.oplage + ' · status: ' + e.status, ''];
    for (const aid of e.artikelIds) {
      const a = vind(aid);
      if (!a) continue;
      regels.push('[' + a.rubriek.toUpperCase() + '] ' + a.kop, 'door ' + a.auteur, a.intro || '', a.tekst, '', '---', '');
    }
    return { ok: true, blad: regels.join('\n') };
  }

  /* ---------- het overzicht + het gepubliceerde nieuws (voor de Nieuws-app) ---------- */
  function overzicht() {
    const r = R();
    const perStatus = {}, perRubriek = {};
    for (const a of r.artikelen) {
      perStatus[a.status] = (perStatus[a.status] || 0) + 1;
      perRubriek[a.rubriek] = (perRubriek[a.rubriek] || 0) + 1;
    }
    return { ok: true, artikelen: r.artikelen.slice(0, 200), edities: r.edities.slice(0, 40),
      perStatus, perRubriek, rubrieken: RUBRIEKEN, artikelStatus: ARTIKEL_STATUS, editieStatus: EDITIE_STATUS };
  }
  function nieuws(rubriek) {
    let lijst = R().artikelen.filter(a => a.status === 'gepubliceerd');
    if (rubriek && RUBRIEKEN.includes(rubriek)) lijst = lijst.filter(a => a.rubriek === rubriek);
    lijst = lijst.slice().sort((a, b) => String(b.publicatieAt).localeCompare(String(a.publicatieAt)));
    return { ok: true, rubrieken: RUBRIEKEN, artikelen: lijst.slice(0, 60).map(a => ({
      id: a.id, kop: a.kop, rubriek: a.rubriek, intro: a.intro, auteur: a.auteur, at: a.publicatieAt })) };
  }
  function nieuwsArtikel(aid) {
    const a = vind(aid);
    if (!a || a.status !== 'gepubliceerd') return { status: 404, error: 'Dit artikel is er niet (meer).' };
    return { ok: true, artikel: { id: a.id, kop: a.kop, rubriek: a.rubriek, intro: a.intro, tekst: a.tekst, auteur: a.auteur, at: a.publicatieAt } };
  }

  return { editieMaak, editieStatus, drukproef, overzicht, nieuws, nieuwsArtikel };
};
