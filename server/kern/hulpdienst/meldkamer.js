/* De hulpdiensten-toren, deelbestand "meldkamer": de eenheden (land, water, lucht,
   heli) en de meldkamer van politie/brandweer/ambulance. Meldingen met prioriteit,
   eenheden toewijzen, de statusketen gemeld -> toegewezen -> ter plaatse -> afgerond,
   en bijstand vragen aan een ander korps (special forces alleen via de politie).
   Krijgt de gedeelde ctx van kern/hulpdienst/index.js. */
module.exports = (ctx) => {
  const { crypto, save, nu, schoonTekst, findSupplier, isHulp, eenhedenVan, meldingVan, logboek, bak,
    EENHEID_SOORTEN, PRIOS } = ctx;

  /* ---------- eenheden: land, water, lucht en de heli ---------- */
  function eenheidMaak(code, naam, soort) {
    const n = schoonTekst(naam, 40);
    if (!n) return { status: 400, error: 'Hoe heet de eenheid?' };
    if (!EENHEID_SOORTEN.includes(soort)) return { status: 400, error: 'Kies land, water, lucht of heli.' };
    const rij = eenhedenVan(code);
    if (rij.length >= 40) return { status: 400, error: 'Veertig eenheden is het plafond van dit bord.' };
    const e = { id: crypto.randomBytes(4).toString('hex'), naam: n, soort, status: 'vrij' };
    rij.push(e);
    save();
    return { ok: true, eenheid: e };
  }
  function eenheidZet(code, id, status) {
    const e = eenhedenVan(code).find(x => x.id === id);
    if (!e) return { status: 404, error: 'Deze eenheid staat niet op het bord.' };
    if (!['vrij', 'buiten-dienst'].includes(status)) return { status: 400, error: 'Handmatig kan alleen vrij of buiten-dienst; de rest volgt de melding.' };
    e.status = status;
    save();
    return { ok: true, eenheid: e };
  }

  /* ---------- de meldkamer ---------- */
  function meldingMaak(code, b) {
    const s = findSupplier(code);
    if (!s || !isHulp(s)) return { status: 403, error: 'Alleen een hulpdienst heeft een meldkamer.' };
    if (s.type === 'specials') return { status: 403, error: 'Special forces nemen geen eigen meldingen aan; zij komen in actie via een bijstandsverzoek van de politie.' };
    const tekst = schoonTekst(b.tekst, 300);
    if (!tekst) return { status: 400, error: 'Wat is er gemeld?' };
    const prio = PRIOS.includes(Number(b.prio)) ? Number(b.prio) : 2;
    const m = {
      id: crypto.randomBytes(4).toString('hex'), korps: code, tekst,
      plek: schoonTekst(b.plek, 80), prio, status: 'nieuw',
      eenheidId: null, bijstand: [], logboek: [], at: nu()
    };
    logboek(m, 'Melding aangenomen (prio ' + prio + ')');
    bak().meldingen.unshift(m);
    if (bak().meldingen.length > 2000) bak().meldingen.pop();
    save();
    return { ok: true, melding: m };
  }
  function meldingWijs(code, meldingId, eenheidId) {
    const m = meldingVan(code, meldingId);
    if (!m) return { status: 404, error: 'Deze melding staat niet op uw bord.' };
    if (m.status === 'afgerond') return { status: 409, error: 'Deze melding is al afgerond.' };
    const e = eenhedenVan(code).find(x => x.id === eenheidId);
    if (!e) return { status: 404, error: 'Deze eenheid staat niet op het bord.' };
    if (e.status !== 'vrij') return { status: 409, error: e.naam + ' is niet vrij (' + e.status + ').' };
    e.status = 'onderweg';
    m.status = 'toegewezen';
    m.eenheidId = e.id;
    logboek(m, e.naam + ' (' + e.soort + ', ' + code + ') is onderweg');
    save();
    return { ok: true, melding: m };
  }
  function meldingStatus(code, meldingId, status) {
    const m = meldingVan(code, meldingId);
    if (!m) return { status: 404, error: 'Deze melding staat niet op uw bord.' };
    if (!['ter-plaatse', 'afgerond'].includes(status)) return { status: 400, error: 'Kies ter-plaatse of afgerond.' };
    m.status = status;
    logboek(m, status === 'ter-plaatse' ? 'Eenheid ter plaatse' : 'Melding afgerond');
    // bij afronden komen de eenheden van ALLE betrokken korpsen weer vrij
    if (status === 'afgerond') {
      for (const kc of [m.korps, ...(m.bijstand || [])])
        for (const e of eenhedenVan(kc)) if (e.status === 'onderweg' || e.status === 'ter-plaatse') e.status = 'vrij';
    } else if (m.eenheidId) {
      const e = eenhedenVan(m.korps).find(x => x.id === m.eenheidId);
      if (e) e.status = 'ter-plaatse';
    }
    save();
    return { ok: true, melding: m };
  }
  /* Bijstand: een korps deelt een melding met een ander korps; die ziet hem
     op het eigen bord en wijst er eigen eenheden aan toe. Special forces
     zijn ALLEEN via de politie op te roepen. */
  function bijstandVraag(code, meldingId, naarCode) {
    const m = meldingVan(code, meldingId);
    if (!m || m.korps !== code) return { status: 404, error: 'Deze melding staat niet op uw eigen bord.' };
    const doel = findSupplier(naarCode);
    if (!doel || !isHulp(doel)) return { status: 404, error: 'Dit korps kennen we niet.' };
    if (doel.type === 'specials' && (findSupplier(code) || {}).type !== 'politie')
      return { status: 403, error: 'Special forces worden uitsluitend door de politie om bijstand gevraagd.' };
    if (m.bijstand.includes(doel.code)) return { status: 409, error: 'Dit korps staat al op de melding.' };
    m.bijstand.push(doel.code);
    logboek(m, 'Bijstand gevraagd aan ' + doel.name);
    save();
    return { ok: true, melding: m };
  }

  return { eenheidMaak, eenheidZet, meldingMaak, meldingWijs, meldingStatus, bijstandVraag };
};
