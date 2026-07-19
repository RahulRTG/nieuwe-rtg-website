/* RTG Vonk, deelbestand "match": het hart van de date. Een like (of voorbij);
   wederzijds is een match, waarna de chatlijn opengaat en RTG automatisch een tafel
   klaarzet bij de partner het dichtst bij het geografische MIDDEN van de twee
   woonplaatsen. Betalen (EUR 10 p.p.: EUR 5 RTG, EUR 5 aanbetaling bij de zaak) via
   RTG Pay; pas als beiden betaald hebben komt de echte reservering. Plus de chat, de
   eigen matches, en blokkeren/melden. Krijgt de gedeelde ctx van kern/vonk/index.js. */
module.exports = (ctx) => {
  const { db, save, schoon, id, nu, d, mag, likeVan, codenaamVan, keyVanCodenaam, haversine,
    reserveerTafel, pay, notify, sseToCustomer, sseToOffice, PRIJS_CENTEN, RTG_CENTEN } = ctx;

  /* ---- like / voorbij; wederzijds = match + automatisch een tafel in het midden ---- */
  async function like(key, codenaam, aan) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const t = keyVanCodenaam ? await keyVanCodenaam(String(codenaam || '').trim()) : null;
    const doel = t && t.key;
    if (!doel || !d().profielen[doel]) return { status: 404, error: 'Geen Vonk-profiel met die codenaam.' };
    if (doel === key) return { status: 400, error: 'Uzelf liken hoeft niet.' };
    d().likes = d().likes.filter(l => !(l.van === key && l.naar === doel));
    if (aan === false) { d().likes.push({ van: key, naar: doel, nee: true, at: nu() }); save(); return { status: 200, ok: true }; }
    d().likes.push({ van: key, naar: doel, at: nu() });
    const terug = likeVan(doel, key);
    if (!terug || terug.nee) { save(); return { status: 200, ok: true, match: false }; }
    // wederzijds: de match, de chatlijn en de tafel in het midden
    const m = { id: id(), a: key, b: doel, at: nu(), berichten: [], betaald: {}, status: 'wacht-op-betaling' };
    m.tafel = tafelInHetMidden(d().profielen[key], d().profielen[doel]);
    d().matches.unshift(m);
    save();
    for (const wie of [key, doel]) {
      const ander = wie === key ? doel : key;
      try { notify(wie, { icon: '🔥', title: 'Een vonk!', body: 'U en ' + codenaamVan(ander) + ' liken elkaar. ' + (m.tafel ? 'Er staat een tafel klaar bij ' + m.tafel.supplierName + '; bevestig met EUR 10 p.p.' : 'De chatlijn is open.') }); } catch (e) {}
      try { sseToCustomer(wie, 'vonk', { kind: 'match', id: m.id }); } catch (e) {}
    }
    return { status: 200, ok: true, match: true, id: m.id, tafel: m.tafel };
  }
  // de partner met tafels het dichtst bij het geografische midden van de twee steden
  function tafelInHetMidden(pa, pb) {
    if (!pa || !pb || !isFinite(pa.lat) || !isFinite(pb.lat)) return null;
    const mid = { lat: (pa.lat + pb.lat) / 2, lng: (pa.lng + pb.lng) / 2 };
    let beste = null, besteAf = Infinity;
    for (const s of Object.values(db.data.suppliers || {})) {
      if (!(s.tables || []).length || !s.loc || !isFinite(s.loc.lat)) continue;
      if (s.settings && s.settings.reservationsOpen === false) continue;
      const af = haversine(mid.lat, mid.lng, s.loc.lat, s.loc.lng);
      if (af < besteAf) { besteAf = af; beste = s; }
    }
    if (!beste) return null;
    const dag = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    return { supplierCode: beste.code, supplierName: beste.name, plek: (beste.loc && beste.loc.label) || beste.city || '',
      datum: dag, tijd: '19:30', prijsPP: PRIJS_CENTEN / 100, rtgDeel: RTG_CENTEN / 100 };
  }

  /* ---- betalen (EUR 10 p.p.) en dan echt reserveren ---- */
  async function betaal(key, mid) {
    const m = d().matches.find(x => x.id === mid && (x.a === key || x.b === key));
    if (!m) return { status: 404, error: 'Deze match bestaat niet.' };
    if (!m.tafel) return { status: 409, error: 'Er is geen tafel om te bevestigen; spreek zelf iets af in de chat.' };
    if (m.betaald[key]) return { status: 200, ok: true, al: true, status2: m.status };
    const codenaam = codenaamVan(key);
    // EUR 5 naar RTG en EUR 5 als aanbetaling bij de zaak, in een keer uit de wallet
    const r1 = pay.boek({ van: 'lid:' + codenaam, naar: 'extern:vonk-rtg', centen: RTG_CENTEN, soort: 'vonk', oms: 'Vonk-date, deel RTG', ref: m.id });
    if (r1 && r1.error) return { status: 402, error: r1.error };
    const r2 = pay.boek({ van: 'lid:' + codenaam, naar: 'partner:' + m.tafel.supplierCode, centen: PRIJS_CENTEN - RTG_CENTEN, soort: 'vonk', oms: 'Vonk-date, aanbetaling zaak', ref: m.id });
    if (r2 && r2.error) return { status: 402, error: r2.error };
    m.betaald[key] = nu();
    const ander = m.a === key ? m.b : m.a;
    if (m.betaald[ander]) {
      // allebei betaald: nu pas de echte reservering (op beide codenamen)
      const res = reserveerTafel({ key, tier: 'rtg' }, codenaamVan(m.a) + ' & ' + codenaamVan(m.b),
        { supplierCode: m.tafel.supplierCode, datum: m.tafel.datum, tijd: m.tafel.tijd, personen: 2, notitie: 'Vonk-date (aanbetaling voldaan)' });
      m.status = res && res.ok ? 'bevestigd' : 'betaald';
      m.reserveringId = res && res.ok ? res.reservering.id : null;
      for (const wie of [m.a, m.b]) { try { notify(wie, { icon: '🥂', title: 'De date staat', body: m.tafel.supplierName + ', ' + m.tafel.datum + ' ' + m.tafel.tijd + '. Veel plezier!' }); } catch (e) {} }
    }
    save();
    return { status: 200, ok: true, status2: m.status };
  }

  /* ---- de chatlijn (pas na een match) + blokkeren en melden ---- */
  function bericht(key, mid, tekst) {
    const m = d().matches.find(x => x.id === mid && (x.a === key || x.b === key));
    if (!m) return { status: 404, error: 'Deze match bestaat niet.' };
    const t = schoon(tekst, 300);
    if (!t) return { status: 400, error: 'Zeg iets liefs.' };
    m.berichten.push({ van: codenaamVan(key), tekst: t, at: nu() });
    m.berichten = m.berichten.slice(-200);
    save();
    const ander = m.a === key ? m.b : m.a;
    try { sseToCustomer(ander, 'vonk', { kind: 'bericht', id: m.id }); } catch (e) {}
    return { status: 200, ok: true };
  }
  function mijn(key) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const rijen = d().matches.filter(m => m.a === key || m.b === key).slice(0, 50).map(m => ({
      id: m.id, met: codenaamVan(m.a === key ? m.b : m.a), at: m.at, status: m.status,
      tafel: m.tafel, ikBetaalde: !!m.betaald[key], anderBetaalde: !!m.betaald[m.a === key ? m.b : m.a],
      berichten: m.berichten.slice(-30)
    }));
    return { status: 200, matches: rijen };
  }
  async function blokkeer(key, codenaam, meld) {
    const t = keyVanCodenaam ? await keyVanCodenaam(String(codenaam || '').trim()) : null;
    const doel = t && t.key;
    if (!doel) return { status: 404, error: 'Geen lid met die codenaam.' };
    const p = d().profielen[key];
    if (p && !p.blokkade.includes(doel)) p.blokkade.push(doel);
    d().matches = d().matches.filter(m => !((m.a === key && m.b === doel) || (m.a === doel && m.b === key)));
    if (meld) {
      d().meldingen.unshift({ id: id(), van: codenaamVan(key), over: codenaamVan(doel), reden: schoon(meld, 200), at: nu(), status: 'open' });
      d().meldingen = d().meldingen.slice(0, 500);
      try { sseToOffice('sync', { scope: 'vonk' }); } catch (e) {}
    }
    save();
    return { status: 200, ok: true };
  }

  return { vonkLike: like, vonkBetaal: betaal, vonkBericht: bericht, vonkMijn: mijn, vonkBlokkeer: blokkeer,
    vonkMeldingen: () => ({ status: 200, meldingen: d().meldingen.slice(0, 50) }) };
};
