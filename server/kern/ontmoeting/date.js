/* Ontmoeting (deelmodule): de date zelf: aanmaken met contract, tekenen,
   het samen-zijn met GPS, de SOS-keten naar kantoor, signalen en de
   staten voor lid en kantoor. Krijgt de gedeelde context een keer bij het
   opstarten vanuit kern/ontmoeting.js. */
module.exports = (ctx) => {
  const { db, save, crypto, accounts, leeftijdVan, notify, sseToCustomer, sseToOffice,
    connectieTussen, verbActief, zijnVrienden, codenaamVan, haversine,
    RADIUS_M, POS_TTL_MS, VOORSTEL_TTL_MS, MIN_LEEFTIJD, ACTIVITEITEN, ACT_IDS,
    lijsten, accountVanKey, memberState, geslachtVan, mag, staatAan, zet, pos, versePositie, id, nu, paar } = ctx;
  const { radar, lopendVoorstel, lopendeDate, verlopenVoorstel, beslisActiviteit, contractTekst, actLabel, actIcon } = ctx;
  function maakDate(a, b, activiteit, voorstelId) {
    const d = {
      id: id(), a, b, activiteit, voorstelId,
      status: 'wacht-op-tekenen', at: nu(),
      contract: { tekst: contractTekst(activiteit), ondertekend: {} },
      posities: {}, sos: [], afgerondAt: null
    };
    db.data.ontmoetDates.unshift(d);
    db.data.ontmoetDates = db.data.ontmoetDates.slice(0, 4000);
    return d;
  }
  function dateVoor(key, dateId) {
    lijsten();   // borgt db.data.ontmoetDates ook als die collectie nog nooit is opgeslagen (Postgres-boot)
    const d = db.data.ontmoetDates.find(x => x.id === dateId);
    if (!d || (d.a !== key && d.b !== key)) return null;
    return d;
  }
  function teken(key, dateId) {
    lijsten();
    const d = dateVoor(key, dateId);
    if (!d) return { status: 404, error: 'Afspraak niet gevonden.' };
    if (d.status !== 'wacht-op-tekenen') return { status: 409, error: 'Deze afspraak is al gestart of afgerond.' };
    const m = mag(key); if (!m.ok) return { status: 403, error: m.reden };
    d.contract.ondertekend[key] = nu();
    const ander = d.a === key ? d.b : d.a;
    if (d.contract.ondertekend[d.a] && d.contract.ondertekend[d.b]) {
      d.status = 'actief'; d.gestartAt = nu();
      for (const k of [d.a, d.b]) { sseToCustomer(k, 'sync', { scope: 'ontmoeting' }); notify(k, { icon: '✅', title: 'Afspraak gestart', body: 'Het veiligheidscontract is getekend. RTG kijkt mee voor jullie veiligheid.', scope: 'ontmoeting' }); }
      sseToOffice('sync', { scope: 'ontmoeting' });
    } else {
      sseToCustomer(ander, 'sync', { scope: 'ontmoeting' });
      notify(ander, { icon: '✍️', title: 'Contract getekend', body: codenaamVan(key) + ' tekende het veiligheidscontract. Teken jij ook om te starten?', scope: 'ontmoeting' });
    }
    save();
    return { status: 200, ok: true, status2: d.status };
  }
  // live-positie tijdens een lopende afspraak (gaat naar RTG-kantoor)
  function dateHier(key, dateId, lat, lng) {
    lijsten();
    const d = dateVoor(key, dateId);
    if (!d) return { status: 404, error: 'Afspraak niet gevonden.' };
    if (!['actief', 'noodgeval'].includes(d.status)) return { status: 409, error: 'Deze afspraak is niet actief.' };
    if (Number.isFinite(lat) && Number.isFinite(lng)) d.posities[key] = { lat, lng, at: nu() };
    save();
    sseToOffice('sync', { scope: 'ontmoeting' });
    return { status: 200, ok: true };
  }
  function stop(key, dateId) {
    lijsten();
    const d = dateVoor(key, dateId);
    if (!d) return { status: 404, error: 'Afspraak niet gevonden.' };
    if (['afgerond', 'geannuleerd'].includes(d.status)) return { status: 200, ok: true, status2: d.status };
    const gestart = d.status === 'actief' || d.status === 'noodgeval';
    d.status = gestart ? 'afgerond' : 'geannuleerd';
    d.afgerondAt = nu();
    if (!d.sos.some(x => !x.ok)) d.posities = {};   // locatie wissen tenzij er een open SOS is
    const ander = d.a === key ? d.b : d.a;
    sseToCustomer(ander, 'sync', { scope: 'ontmoeting' });
    sseToOffice('sync', { scope: 'ontmoeting' });
    notify(ander, { icon: '\u{1F3C1}', title: 'Afspraak beeindigd', body: codenaamVan(key) + ' heeft de afspraak afgerond.', scope: 'ontmoeting' });
    save();
    return { status: 200, ok: true, status2: d.status };
  }

  /* ---- SOS tijdens een afspraak ---- */
  function sos(key, dateId, bericht, lat, lng) {
    lijsten();
    const d = dateVoor(key, dateId);
    if (!d) return { status: 404, error: 'Afspraak niet gevonden.' };
    if (!['actief', 'noodgeval'].includes(d.status)) return { status: 409, error: 'SOS kan alleen tijdens een lopende afspraak.' };
    const s = { id: id(), door: key, codenaam: codenaamVan(key), bericht: String(bericht || '').replace(/[<>]/g, '').slice(0, 200) || 'Noodsignaal', at: nu(), ok: null, camera: false };
    if (Number.isFinite(lat) && Number.isFinite(lng)) { s.lat = lat; s.lng = lng; d.posities[key] = { lat, lng, at: nu() }; }
    d.sos.unshift(s);
    d.status = 'noodgeval';
    save();
    // RTG-kantoor: rood alarm, mag meeluisteren/meekijken en 112 bellen (contract punt 2)
    sseToOffice('ontmoeting-sos', { dateId: d.id, sosId: s.id, codenaam: s.codenaam, bericht: s.bericht });
    sseToOffice('sync', { scope: 'ontmoeting' });
    // de andere deelnemer weet dat er een SOS loopt
    const ander = d.a === key ? d.b : d.a;
    sseToCustomer(ander, 'sync', { scope: 'ontmoeting' });
    notify(ander, { icon: '\u{1F6A8}', title: 'SOS', body: s.codenaam + ' heeft een noodsignaal gegeven. RTG-kantoor kijkt nu mee.', scope: 'ontmoeting' });
    sseToCustomer(key, 'sync', { scope: 'ontmoeting' });
    return { status: 200, ok: true, sosId: s.id };
  }
  // RTG-kantoor handelt een SOS af
  function sosAf(dateId, sosId, door) {
    lijsten();
    const d = db.data.ontmoetDates.find(x => x.id === dateId);
    if (!d) return { status: 404, error: 'Afspraak niet gevonden.' };
    const s = d.sos.find(x => x.id === sosId);
    if (!s) return { status: 404, error: 'SOS niet gevonden.' };
    s.ok = { door: String(door || 'RTG-kantoor').slice(0, 60), at: nu() };
    if (!d.sos.some(x => !x.ok) && d.status === 'noodgeval') d.status = 'actief';
    save();
    for (const k of [d.a, d.b]) sseToCustomer(k, 'sync', { scope: 'ontmoeting' });
    sseToOffice('sync', { scope: 'ontmoeting' });
    return { status: 200, ok: true };
  }
  // WebRTC-signaal doorgeven (lid <-> kantoor) voor het live meekijken bij een SOS
  function signaalNaarKantoor(key, dateId, payload) {
    const d = dateVoor(key, dateId);
    if (!d) return { status: 404, error: 'Afspraak niet gevonden.' };
    sseToOffice('ontmoeting-signaal', { dateId: d.id, van: key, codenaam: codenaamVan(key), payload });
    return { status: 200, ok: true };
  }
  function signaalNaarLid(dateId, naarKey, payload) {
    const d = dateVoor(naarKey, dateId);   // zelfde controle, met de lijsten()-borging (geen crash op een lege collectie)
    if (!d) return { status: 404, error: 'Afspraak niet gevonden.' };
    sseToCustomer(naarKey, 'ontmoeting-signaal', { dateId, vanKantoor: true, payload });
    return { status: 200, ok: true };
  }

  /* ---- overzichten ---- */
  function opschonen() {
    lijsten();
    let veranderd = false;
    for (const v of db.data.ontmoetVoorstellen) if (v.status === 'open' && verlopenVoorstel(v)) { v.status = 'verlopen'; veranderd = true; }
    if (veranderd) save();
  }
  function publiekVoorstel(v, key) {
    const ander = v.a === key ? v.b : v.a;
    return { id: v.id, met: codenaamVan(ander), status: v.status, mijnKeuze: v.keuzes[key] || null, anderKoos: !!v.keuzes[ander], at: v.at, vervalt: v.vervalt, activiteit: v.activiteit || null, dateId: v.dateId || null };
  }
  function publiekeDate(d, key) {
    const ander = d.a === key ? d.b : d.a;
    return {
      id: d.id, met: codenaamVan(ander), activiteit: d.activiteit,
      activiteitLabel: actLabel(d.activiteit), icon: actIcon(d.activiteit), status: d.status,
      ikTekende: !!d.contract.ondertekend[key], anderTekende: !!d.contract.ondertekend[ander],
      contract: d.contract.tekst, at: d.at,
      sos: d.sos.filter(s => !s.ok).map(s => ({ id: s.id, door: s.codenaam, bericht: s.bericht, at: s.at, vanMij: s.door === key }))
    };
  }
  // alles wat een lid nu ziet: aan/uit, of het mag, en open voorstellen + lopende afspraken
  function mijnState(key) {
    lijsten(); opschonen();
    const m = mag(key);
    const voorstellen = db.data.ontmoetVoorstellen.filter(v => (v.a === key || v.b === key) && v.status === 'open').map(v => publiekVoorstel(v, key));
    const dates = db.data.ontmoetDates.filter(d => (d.a === key || d.b === key) && ['wacht-op-tekenen', 'actief', 'noodgeval'].includes(d.status)).map(d => publiekeDate(d, key));
    return { aan: staatAan(key), mag: m.ok, reden: m.ok ? null : m.reden, geslachtBekend: geslachtVan(key) != null, activiteiten: ACTIVITEITEN, voorstellen, dates };
  }
  // RTG-kantoor: alle lopende afspraken met live-locatie, plus de open SOS-en
  function kantoorState() {
    lijsten(); opschonen();
    const lopend = db.data.ontmoetDates.filter(d => ['wacht-op-tekenen', 'actief', 'noodgeval'].includes(d.status));
    const dates = lopend.map(d => ({
      id: d.id, activiteit: d.activiteit, activiteitLabel: actLabel(d.activiteit), icon: actIcon(d.activiteit),
      status: d.status, at: d.at, gestartAt: d.gestartAt || null,
      deelnemers: [d.a, d.b].map(k => ({ codenaam: codenaamVan(k), getekend: !!d.contract.ondertekend[k], pos: d.posities[k] || null })),
      sos: d.sos.filter(s => !s.ok).map(s => ({ id: s.id, door: s.codenaam, bericht: s.bericht, at: s.at, lat: s.lat, lng: s.lng }))
    }));
    const alarmen = dates.filter(d => d.sos.length).length;
    return { totaal: dates.length, alarmen, dates };
  }

  return { maakDate, dateVoor, teken, dateHier, stop, sos, sosAf, signaalNaarKantoor, signaalNaarLid, opschonen, publiekVoorstel, publiekeDate, mijnState, kantoorState };
};
