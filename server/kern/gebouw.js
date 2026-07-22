/* RTG Zuidas: het complete systeem van EEN heel kantoorgebouw, van de plint
   tot het dak. Verdiepingen en huurders, vergaderzalen met boekingen,
   toegangspassen, de bezoekersstroom langs de receptie, facilitaire
   meldingen (schoonmaak, onderhoud, catering), valet-parkeren en daar
   bovenop de luxe jetset-laag: concierge, chauffeur, jet-transfer en de
   executive lounge. De manager ziet alles in de leverancier-app; receptie,
   security, facilitair en de concierge werken vanaf de PDA.
   Opslag per gebouw in db.data.gebouw[code]; nette demo-toren als start. */

const ZAAL_VOORZ = ['scherm', 'video', 'whiteboard', 'catering'];
const MELDING_SOORTEN = ['schoonmaak', 'onderhoud', 'catering'];
const JETSET_SOORTEN = {
  concierge: 'Concierge-verzoek', chauffeur: 'Chauffeur met wagen',
  'jet-transfer': 'Jet-transfer via RTG Aviation', lounge: 'Executive lounge'
};
const MAX_LIJST = 200, MAX_JETSET = 100;

module.exports = ({ db, save, crypto, schoon }) => {
  const nu = () => new Date().toISOString();
  const vandaag = () => nu().slice(0, 10);
  const id = p => p + crypto.randomBytes(3).toString('hex');

  const bouwDemoToren = require('./gebouw-demo'); // de voorbeeldtoren (data)
  const demoToren = () => bouwDemoToren(nu, vandaag);
  const G = () => { if (!db.data.gebouw) db.data.gebouw = {}; return db.data.gebouw; };
  function torenVan(code) {
    const g = G();
    if (!g[code]) { g[code] = demoToren(); save(); }
    return g[code];
  }
  const cap = (lijst, max) => { if (lijst.length > max) lijst.length = max; };

  function overzicht(code) {
    const t = torenVan(code);
    const verhuurd = new Set(); for (const h of t.huurders) for (const v of h.verdiepingen) verhuurd.add(v);
    const d = vandaag();
    return {
      naam: t.naam, vloeren: t.vloeren, huurders: t.huurders, zalen: t.zalen,
      boekingen: t.boekingen.filter(b => b.datum >= d).slice(0, 60),
      bezoekers: t.bezoekers.slice(0, 40), meldingen: t.meldingen.slice(0, 40),
      valet: t.valet.slice(0, 20), jetset: t.jetset.slice(0, 30),
      soorten: { melding: MELDING_SOORTEN, jetset: JETSET_SOORTEN, voorzieningen: ZAAL_VOORZ },
      kpi: {
        huurders: t.huurders.length,
        bezetting: Math.round(verhuurd.size / Math.max(1, t.vloeren - 1) * 100),
        zalenVandaag: t.boekingen.filter(b => b.datum === d).length,
        openMeldingen: t.meldingen.filter(m => m.status !== 'klaar').length,
        bezoekersBinnen: t.bezoekers.filter(b => b.status === 'binnen').length,
        jetsetOpen: t.jetset.filter(j => j.status !== 'afgerond').length
      }
    };
  }

  /* ---- vergaderzalen: boeken zonder dubbele boekingen ---- */
  const TIJD = /^([01]\d|2[0-3]):[0-5]\d$/;
  function zaalBoek(code, b) {
    const t = torenVan(code);
    const zaal = t.zalen.find(z => z.id === String(b.zaalId || ''));
    if (!zaal) return { status: 404, error: 'Deze zaal bestaat niet.' };
    const huurder = schoon(b.huurder, 60), titel = schoon(b.titel, 80);
    const datum = String(b.datum || '').slice(0, 10), van = String(b.van || ''), tot = String(b.tot || '');
    if (!huurder) return { status: 400, error: 'Voor welke huurder is de zaal?' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return { status: 400, error: 'Kies een datum.' };
    if (!TIJD.test(van) || !TIJD.test(tot) || tot <= van) return { status: 400, error: 'Kies een geldig tijdvak (van voor tot).' };
    const botst = t.boekingen.find(x => x.zaalId === zaal.id && x.datum === datum && van < x.tot && tot > x.van);
    if (botst) return { status: 409, error: zaal.naam + ' is dan al geboekt (' + botst.van + ' tot ' + botst.tot + ').' };
    const uren = (Number(tot.slice(0, 2)) * 60 + Number(tot.slice(3)) - Number(van.slice(0, 2)) * 60 - Number(van.slice(3))) / 60;
    const boeking = { id: id('b'), zaalId: zaal.id, zaal: zaal.naam, huurder, titel: titel || 'Vergadering', datum, van, tot,
      prijs: Math.round(uren * zaal.uurprijs * 100) / 100 };
    t.boekingen.unshift(boeking); cap(t.boekingen, MAX_LIJST); save();
    return { ok: true, boeking };
  }
  function zaalWeg(code, boekingId) {
    const t = torenVan(code);
    const voor = t.boekingen.length;
    t.boekingen = t.boekingen.filter(b => b.id !== String(boekingId || ''));
    if (t.boekingen.length === voor) return { status: 404, error: 'Boeking niet gevonden.' };
    save(); return { ok: true };
  }

  /* ---- de receptie: bezoekers aanmelden, binnen, vertrokken ---- */
  function bezoekerMeld(code, b) {
    const t = torenVan(code);
    const naam = schoon(b.naam, 60), voorWie = schoon(b.voorWie, 60);
    if (!naam || !voorWie) return { status: 400, error: 'Wie komt er, en voor welke huurder?' };
    const bez = { id: id('v'), naam, voorWie, moment: schoon(b.moment, 30) || 'vandaag', status: 'verwacht', badge: null, gemeld: nu() };
    t.bezoekers.unshift(bez); cap(t.bezoekers, MAX_LIJST); save();
    return { ok: true, bezoeker: bez };
  }
  function bezoekerStatus(code, bezId, statusWens) {
    const t = torenVan(code);
    const b = t.bezoekers.find(x => x.id === String(bezId || ''));
    if (!b) return { status: 404, error: 'Bezoeker niet gevonden.' };
    if (statusWens === 'binnen') { b.status = 'binnen'; b.badge = 'B-' + crypto.randomBytes(2).toString('hex').toUpperCase(); }
    else if (statusWens === 'vertrokken') { b.status = 'vertrokken'; b.badge = null; }
    else return { status: 400, error: 'Kies binnen of vertrokken.' };
    save(); return { ok: true, bezoeker: b };
  }

  /* ---- security: toegangspassen aanmaken en blokkeren ---- */
  function badgeMaak(code, b) {
    const t = torenVan(code);
    const naam = schoon(b.naam, 60), huurder = schoon(b.huurder, 60);
    if (!naam || !huurder) return { status: 400, error: 'Naam en huurder horen bij elke pas.' };
    const badge = { id: 'P-' + crypto.randomBytes(2).toString('hex').toUpperCase(), naam, huurder, actief: true };
    t.badges.unshift(badge); cap(t.badges, MAX_LIJST); save();
    return { ok: true, badge };
  }
  function badgeZet(code, badgeId, actief) {
    const t = torenVan(code);
    const p = t.badges.find(x => x.id === String(badgeId || ''));
    if (!p) return { status: 404, error: 'Pas niet gevonden.' };
    p.actief = !!actief; save();
    return { ok: true, badge: p };
  }

  /* ---- facilitair: meldingen door het hele gebouw ---- */
  function meldingMaak(code, b) {
    const t = torenVan(code);
    const soort = MELDING_SOORTEN.includes(b.soort) ? b.soort : 'onderhoud';
    const tekst = schoon(b.tekst, 160);
    const verdieping = Math.round(Number(b.verdieping));
    if (!tekst) return { status: 400, error: 'Omschrijf de melding kort.' };
    if (!(verdieping >= 1 && verdieping <= t.vloeren)) return { status: 400, error: 'Kies een verdieping (1 tot ' + t.vloeren + ').' };
    const m = { id: id('m'), soort, verdieping, tekst, status: 'open', gemaakt: nu() };
    t.meldingen.unshift(m); cap(t.meldingen, MAX_LIJST); save();
    return { ok: true, melding: m };
  }
  function meldingStatus(code, mId, statusWens) {
    const t = torenVan(code);
    const m = t.meldingen.find(x => x.id === String(mId || ''));
    if (!m) return { status: 404, error: 'Melding niet gevonden.' };
    if (!['open', 'bezig', 'klaar'].includes(statusWens)) return { status: 400, error: 'Kies open, bezig of klaar.' };
    m.status = statusWens; save();
    return { ok: true, melding: m };
  }

  /* ---- valet: de wagen wordt voorgereden ---- */
  function valetVraag(code, b) {
    const t = torenVan(code);
    const wie = schoon(b.wie, 60);
    if (!wie) return { status: 400, error: 'Voor wie rijden we de wagen voor?' };
    const v = { id: id('w'), wie, wagen: schoon(b.wagen, 40) || 'wagen', status: 'gevraagd', gemaakt: nu() };
    t.valet.unshift(v); cap(t.valet, MAX_LIJST); save();
    return { ok: true, valet: v };
  }
  function valetStatus(code, vId, statusWens) {
    const t = torenVan(code);
    const v = t.valet.find(x => x.id === String(vId || ''));
    if (!v) return { status: 404, error: 'Valet-aanvraag niet gevonden.' };
    if (!['voorgereden', 'klaar'].includes(statusWens)) return { status: 400, error: 'Kies voorgereden of klaar.' };
    v.status = statusWens; save();
    return { ok: true, valet: v };
  }

  /* ---- de jetset-laag: concierge, chauffeur, jet-transfer, lounge ----
     De concierge bevestigt en rondt af; een jet-transfer is hier een
     dienstverzoek aan RTG Aviation, nooit een bevestigde vlucht. */
  function jetsetVraag(code, b) {
    const t = torenVan(code);
    if (!JETSET_SOORTEN[b.soort]) return { status: 400, error: 'Kies concierge, chauffeur, jet-transfer of lounge.' };
    const voorWie = schoon(b.voorWie, 60), wens = schoon(b.wens, 160);
    if (!voorWie || !wens) return { status: 400, error: 'Voor wie is het, en wat is de wens?' };
    const j = { id: id('j'), soort: b.soort, voorWie, wens, moment: schoon(b.moment, 30) || 'in overleg',
      status: 'aangevraagd', notitie: '', gemaakt: nu() };
    t.jetset.unshift(j); cap(t.jetset, MAX_JETSET); save();
    return { ok: true, aanvraag: j };
  }
  function jetsetStatus(code, jId, statusWens, notitie) {
    const t = torenVan(code);
    const j = t.jetset.find(x => x.id === String(jId || ''));
    if (!j) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (!['bevestigd', 'afgerond'].includes(statusWens)) return { status: 400, error: 'Kies bevestigd of afgerond.' };
    j.status = statusWens;
    if (notitie != null) j.notitie = schoon(notitie, 160);
    save(); return { ok: true, aanvraag: j };
  }

  return { gebouw: { overzicht, zaalBoek, zaalWeg, bezoekerMeld, bezoekerStatus, badgeMaak, badgeZet,
    meldingMaak, meldingStatus, valetVraag, valetStatus, jetsetVraag, jetsetStatus } };
};
