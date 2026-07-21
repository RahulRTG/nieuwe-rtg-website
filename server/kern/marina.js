/* RTG Marina: het complete jachthaven-systeem, naar het model van het
   kantoorgebouw op de Zuidas maar dan op het water. Ligplaatsen met vaste
   liggers en passanten (de havenmeester wijst de eerste passende plaats
   toe), de brandstofsteiger, service en de hellingbaan (hijsen, onderhoud,
   schoonmaak) en de marina-concierge voor de jetset op het water: tender,
   catering aan boord, crew en de charter-transfer. Een verzoek aan de
   concierge is altijd een aanvraag; een mens bevestigt.
   Opslag per haven in db.data.marina[code]. */

const SERVICE_SOORTEN = ['hijs', 'helling', 'onderhoud', 'schoonmaak'];
const CONCIERGE_SOORTEN = {
  tender: 'Tender naar het jacht', catering: 'Catering aan boord',
  crew: 'Crew voor een dag', 'charter-transfer': 'Charter-transfer via RTG Charter'
};
const BRANDSTOF = ['diesel', 'benzine'];
const MAX_LIJST = 200;

module.exports = ({ db, save, crypto, schoon }) => {
  const nu = () => new Date().toISOString();
  const vandaag = () => nu().slice(0, 10);
  const id = p => p + crypto.randomBytes(3).toString('hex');

  function demoHaven() {
    const plaats = (nr, lengteMax, dagprijs) => ({ id: 'L' + String(nr).padStart(2, '0'), lengteMax, dagprijs, vast: false, boot: null });
    const p = [];
    for (let i = 1; i <= 6; i++) p.push(plaats(i, 12, 65));
    for (let i = 7; i <= 10; i++) p.push(plaats(i, 18, 110));
    for (let i = 11; i <= 12; i++) p.push(plaats(i, 30, 240));
    p[0].vast = true; p[0].boot = { naam: 'Mar Blava', lengte: 9, eigenaar: 'Fam. Torres', tot: null };
    p[6].vast = true; p[6].boot = { naam: 'Levante', lengte: 15, eigenaar: 'Vektor Capital', tot: null };
    p[10].vast = true; p[10].boot = { naam: 'Alba Azul', lengte: 24, eigenaar: 'Azul Yacht Charter', tot: null };
    p[2].boot = { naam: 'Petit Nord', lengte: 8, eigenaar: 'J. Berg', tot: vandaag() };
    return {
      naam: 'Marina Portell', ligplaatsen: p,
      brandstof: [], service: [
        { id: 's1', boot: 'Levante', soort: 'schoonmaak', wens: 'Dek en teak voor het weekend.', status: 'open', gemaakt: nu() }
      ],
      concierge: [
        { id: 'c1', soort: 'tender', voorWie: 'Alba Azul', wens: 'Gasten om 12:00 naar de baai brengen.', moment: vandaag() + ' 12:00', status: 'aangevraagd', notitie: '', gemaakt: nu() }
      ]
    };
  }
  const M = () => { if (!db.data.marina) db.data.marina = {}; return db.data.marina; };
  function havenVan(code) {
    const m = M();
    if (!m[code]) { m[code] = demoHaven(); save(); }
    return m[code];
  }
  const cap = (lijst, max) => { if (lijst.length > max) lijst.length = max; };

  function overzicht(code) {
    const h = havenVan(code);
    const bezet = h.ligplaatsen.filter(p => p.boot).length;
    return {
      naam: h.naam, ligplaatsen: h.ligplaatsen,
      brandstof: h.brandstof.slice(0, 30), service: h.service.slice(0, 30),
      concierge: h.concierge.slice(0, 30),
      soorten: { service: SERVICE_SOORTEN, concierge: CONCIERGE_SOORTEN, brandstof: BRANDSTOF },
      kpi: {
        ligplaatsen: h.ligplaatsen.length, bezet,
        vrij: h.ligplaatsen.length - bezet,
        passanten: h.ligplaatsen.filter(p => p.boot && !p.vast).length,
        brandstofOpen: h.brandstof.filter(b => b.status === 'gevraagd').length,
        serviceOpen: h.service.filter(s => s.status !== 'klaar').length,
        conciergeOpen: h.concierge.filter(c => c.status !== 'afgerond').length
      }
    };
  }

  /* ---- passanten: de havenmeester wijst de eerste passende plaats toe ---- */
  function passantMeld(code, b) {
    const h = havenVan(code);
    const naam = schoon(b.naam, 60), eigenaar = schoon(b.eigenaar, 60);
    const lengte = Math.round(Number(b.lengte) * 10) / 10;
    const nachten = Math.max(1, Math.round(Number(b.nachten) || 1));
    if (!naam || !eigenaar) return { status: 400, error: 'De naam van de boot en de eigenaar horen erbij.' };
    if (!(lengte > 0 && lengte <= 60)) return { status: 400, error: 'Hoe lang is de boot (in meters)?' };
    const vrij = h.ligplaatsen.filter(p => !p.boot && p.lengteMax >= lengte)
      .sort((a, x) => a.lengteMax - x.lengteMax)[0];
    if (!vrij) return { status: 409, error: 'Geen vrije ligplaats voor ' + lengte + ' meter; de haven ligt vol.' };
    const tot = new Date(Date.now() + nachten * 86400000).toISOString().slice(0, 10);
    vrij.boot = { naam, lengte, eigenaar, tot };
    save();
    return { ok: true, ligplaats: vrij, prijs: Math.round(nachten * vrij.dagprijs * 100) / 100, nachten };
  }
  function vertrek(code, plaatsId) {
    const h = havenVan(code);
    const p = h.ligplaatsen.find(x => x.id === String(plaatsId || ''));
    if (!p) return { status: 404, error: 'Deze ligplaats bestaat niet.' };
    if (!p.boot) return { status: 409, error: p.id + ' ligt al leeg.' };
    if (p.vast) return { status: 409, error: p.id + ' is een vaste ligger; die meldt zich bij de havenmeester.' };
    p.boot = null; save();
    return { ok: true, ligplaats: p };
  }

  /* ---- de brandstofsteiger ---- */
  function brandstofVraag(code, b) {
    const h = havenVan(code);
    const boot = schoon(b.boot, 60);
    const soort = BRANDSTOF.includes(b.soort) ? b.soort : null;
    const liters = Math.round(Number(b.liters));
    if (!boot) return { status: 400, error: 'Voor welke boot is het?' };
    if (!soort) return { status: 400, error: 'Kies diesel of benzine.' };
    if (!(liters >= 1 && liters <= 20000)) return { status: 400, error: 'Hoeveel liter (1 tot 20.000)?' };
    const o = { id: id('b'), boot, soort, liters, status: 'gevraagd', gemaakt: nu() };
    h.brandstof.unshift(o); cap(h.brandstof, MAX_LIJST); save();
    return { ok: true, order: o };
  }
  function brandstofKlaar(code, oId) {
    const h = havenVan(code);
    const o = h.brandstof.find(x => x.id === String(oId || ''));
    if (!o) return { status: 404, error: 'Order niet gevonden.' };
    o.status = 'getankt'; save();
    return { ok: true, order: o };
  }

  /* ---- service en de hellingbaan ---- */
  function serviceVraag(code, b) {
    const h = havenVan(code);
    const boot = schoon(b.boot, 60), wens = schoon(b.wens, 160);
    const soort = SERVICE_SOORTEN.includes(b.soort) ? b.soort : null;
    if (!boot || !wens) return { status: 400, error: 'Welke boot, en wat moet er gebeuren?' };
    if (!soort) return { status: 400, error: 'Kies hijs, helling, onderhoud of schoonmaak.' };
    const s = { id: id('s'), boot, soort, wens, status: 'open', gemaakt: nu() };
    h.service.unshift(s); cap(h.service, MAX_LIJST); save();
    return { ok: true, verzoek: s };
  }
  function serviceStatus(code, sId, statusWens) {
    const h = havenVan(code);
    const s = h.service.find(x => x.id === String(sId || ''));
    if (!s) return { status: 404, error: 'Verzoek niet gevonden.' };
    if (!['bezig', 'klaar'].includes(statusWens)) return { status: 400, error: 'Kies bezig of klaar.' };
    s.status = statusWens; save();
    return { ok: true, verzoek: s };
  }

  /* ---- de marina-concierge: de jetset op het water; een mens bevestigt ---- */
  function conciergeVraag(code, b) {
    const h = havenVan(code);
    if (!CONCIERGE_SOORTEN[b.soort]) return { status: 400, error: 'Kies tender, catering, crew of charter-transfer.' };
    const voorWie = schoon(b.voorWie, 60), wens = schoon(b.wens, 160);
    if (!voorWie || !wens) return { status: 400, error: 'Voor wie is het, en wat is de wens?' };
    const c = { id: id('c'), soort: b.soort, voorWie, wens, moment: schoon(b.moment, 30) || 'in overleg',
      status: 'aangevraagd', notitie: '', gemaakt: nu() };
    h.concierge.unshift(c); cap(h.concierge, MAX_LIJST); save();
    return { ok: true, aanvraag: c };
  }
  function conciergeStatus(code, cId, statusWens, notitie) {
    const h = havenVan(code);
    const c = h.concierge.find(x => x.id === String(cId || ''));
    if (!c) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (!['bevestigd', 'afgerond'].includes(statusWens)) return { status: 400, error: 'Kies bevestigd of afgerond.' };
    c.status = statusWens;
    if (notitie != null) c.notitie = schoon(notitie, 160);
    save(); return { ok: true, aanvraag: c };
  }

  return { marina: { overzicht, passantMeld, vertrek, brandstofVraag, brandstofKlaar,
    serviceVraag, serviceStatus, conciergeVraag, conciergeStatus } };
};
