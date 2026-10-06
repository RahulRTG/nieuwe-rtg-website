/* RTG Vonk, deelbestand "match": het hart van de date. Een like (of voorbij);
   wederzijds is een match, waarna de chatlijn opengaat en RTG automatisch een tafel
   klaarzet bij de partner het dichtst bij het geografische MIDDEN van de twee
   woonplaatsen. Betalen (EUR 10 p.p.: EUR 5 RTG, EUR 5 aanbetaling bij de zaak) via
   RTG Pay; pas als beiden betaald hebben komt de echte reservering. Plus de chat, de
   eigen matches, en blokkeren/melden. Krijgt de gedeelde ctx van kern/vonk/index.js. */
const { plekVan } = require('./vak');
module.exports = (ctx) => {
  const { db, save, schoon, id, nu, d, mag, likeVan, codenaamVan, keyVanCodenaam, haversine, niveauVan,
    reserveerTafel, pay, notify, sseToCustomer, sseToOffice, PRIJS_CENTEN, RTG_CENTEN,
    kenmerkenVan, wanneerMet, optiesVoor, partnerEligible, geblokkeerd, connectionBlocking, Projection, profileMedia, communication } = ctx;

  const volgendeDatum = () => new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  /* Like/voorbij; wederzijds opent match, chat en tafel. */
  async function like(key, codenaam, aan) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const t = keyVanCodenaam ? await keyVanCodenaam(String(codenaam || '').trim()) : null;
    const doel = t && t.key;
    if (!doel || !d().profielen[doel]) return { status: 404, error: 'Geen Vonk-profiel met die codenaam.' };
    if (doel === key) return { status: 400, error: 'Uzelf liken hoeft niet.' };
    if (geblokkeerd(key, doel)) return { status: 403, error: 'Dit contact is geblokkeerd.' };
    if (d().matches.some(m => (m.a === key && m.b === doel) || (m.a === doel && m.b === key)))
      return { status: 409, code: 'INVALID_PRODUCT_TRANSITION', error: 'Deze verbinding is al een match.' };
    d().likes = d().likes.filter(l => !(l.van === key && l.naar === doel));
    if (aan === false) { d().likes.push({ van: key, naar: doel, nee: true, at: nu() }); save(); return { status: 200, ok: true }; }
    d().likes.push({ van: key, naar: doel, at: nu() });
    const terug = likeVan(doel, key);
    if (!terug || terug.nee) { save(); return { status: 200, ok: true, match: false }; }
    // wederzijds: de match, de chatlijn en de tafel in het midden
    const m = { id: id(), a: key, b: doel, at: nu(), berichten: [], betaald: {}, status: 'wacht-op-betaling' };
    const planning = { date: volgendeDatum(), time: '19:30' };
    m.tafel = tafelInHetMidden(plekVan(d().profielen[key]), plekVan(d().profielen[doel]), planning);
    /* Meet Halfway (./halfweg + ./kiezen): drie plekken van verschillende soort
       rond hetzelfde midden. De automatische tafel hierboven blijft de bodem --
       kiest niemand, dan staat er nog steeds iets. */
    m.halfweg = { ...(optiesVoor(d().profielen[key], d().profielen[doel], planning) || { opties: [], waarom: null }), keuzes: {} };
    d().matches.unshift(m);
    save();
    for (const wie of [key, doel]) {
      const ander = wie === key ? doel : key;
      try { notify(wie, { icon: 'ster', title: 'Een vonk!', body: 'U en ' + codenaamVan(ander) + ' liken elkaar. ' + (m.tafel ? 'Er staat een tafel klaar bij ' + m.tafel.supplierName + '; bevestig met EUR 10 p.p.' : 'De chatlijn is open.') }); } catch (e) {}
      try { sseToCustomer(wie, 'vonk', { kind: 'match', id: m.id }); } catch (e) {}
    }
    return { status: 200, ok: true, match: true, id: m.id,
      tafel: m.tafel ? Projection.project(Projection.NAMES.VONK_MEET, m.tafel) : null };
  }
  /* De dichtstbijzijnde partner rond het geografische midden. Haversine krijgt
     twee punten; een zaak zonder meetbare afstand doet niet mee. */
  function tafelInHetMidden(pa, pb, planning) {
    if (!pa || !pb || !isFinite(pa.lat) || !isFinite(pa.lng) || !isFinite(pb.lat) || !isFinite(pb.lng)) return null;
    const mid = { lat: (pa.lat + pb.lat) / 2, lng: (pa.lng + pb.lng) / 2 };
    let beste = null, besteAf = Infinity;
    for (const s of Object.values(db.data.suppliers || {})) {
      if (!(s.tables || []).length || !s.loc || !isFinite(s.loc.lat) || !isFinite(s.loc.lng)) continue;
      if (s.settings && s.settings.reservationsOpen === false) continue;
      if (!partnerEligible(s.code, { date: planning.date, time: planning.time, service: 'diner' })) continue;
      const af = haversine(mid, { lat: s.loc.lat, lng: s.loc.lng });
      if (af == null) continue;
      if (af < besteAf) { besteAf = af; beste = s; }
    }
    if (!beste) return null;
    return { supplierCode: beste.code, supplierName: beste.name, plek: (beste.loc && beste.loc.label) || beste.city || '',
      /* De afstand maakt "rond het midden" narekenbaar. */
      middenAfstandKm: Math.round(besteAf / 100) / 10,
      datum: planning.date, tijd: planning.time, prijsPP: PRIJS_CENTEN / 100, rtgDeel: RTG_CENTEN / 100 };
  }

  const betaal = require('./payment')({ d, save, nu, geblokkeerd, codenaamVan, pay, reserveerTafel, partnerEligible,
    notify, PRIJS_CENTEN, RTG_CENTEN });

  /* ---- de chatlijn (pas na een match) + blokkeren en melden ---- */
  function bericht(key, mid, tekst) {
    const m = d().matches.find(x => x.id === mid && (x.a === key || x.b === key));
    if (!m) return { status: 404, error: 'Deze match bestaat niet.' };
    if (geblokkeerd(key, m.a === key ? m.b : m.a)) return { status: 403, error: 'Dit contact is geblokkeerd.' };
    const gedeeld = communication ? communication.sendText(key, { id: mid }, tekst) : null;
    if (gedeeld && gedeeld.error) return gedeeld;
    if (!communication) {
      const t = schoon(tekst, 300);
      if (!t) return { status: 400, error: 'Schrijf eerst een bericht.' };
      m.berichten.push({ van: codenaamVan(key), tekst: t, at: nu() });
      m.berichten = m.berichten.slice(-200); save();
    }
    const ander = m.a === key ? m.b : m.a;
    try { sseToCustomer(ander, 'vonk', { kind: 'bericht', id: m.id }); } catch (e) {}
    return { status: 200, ok: true };
  }
  function mijn(key) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const rijen = d().matches.filter(m => (m.a === key || m.b === key)
      && !geblokkeerd(key, m.a === key ? m.b : m.a)).slice(0, 50).map(m => Projection.project(Projection.NAMES.VONK_MATCH, {
      /* Ook bij een match, en niet alleen in de dagselectie: dit is het moment
         waarop er een tafel wordt geboekt en twee mensen elkaar echt gaan
         zien. Zie de uitleg bij `publiek` in ./index.js. */
      id: m.id, met: codenaamVan(m.a === key ? m.b : m.a), at: m.at, status: m.status,
      betrouwbaarheid: niveauVan ? niveauVan(m.a === key ? m.b : m.a) : null,
      tafel: m.tafel, reservering: m.reservationEvidence &&
        { reference: m.reserveringId || null, ...m.reservationEvidence },
      ikBetaalde: !!m.betaald[key], anderBetaalde: !!m.betaald[m.a === key ? m.b : m.a],
      berichten: communication ? (communication.status(key, { id: m.id }).messages || []).map(b => ({
        van: b.mine ? codenaamVan(key) : codenaamVan(m.a === key ? m.b : m.a), tekst: b.text || '', at: b.at,
        kind: b.kind, media: b.media
      })) : m.berichten.slice(-30),
      // hier gaan de assen open die het lid op 'pas na een match' had gezet
      kenmerken: kenmerkenVan(m.a === key ? m.b : m.a),
      media: profileMedia ? profileMedia.projecteer(key, m.a === key ? m.b : m.a, 'match') : [],
      /* En hier pas de beschikbaarheid: EEN dagdeel dat u allebei aankruiste,
         of niets. Nooit de hokjes van de ander (../beschikbaar.js). */
      wanneer: wanneerMet(key, m.a === key ? m.b : m.a)
    }));
    return { status: 200, matches: rijen };
  }
  async function blokkeer(key, codenaam, meld) {
    const t = keyVanCodenaam ? await keyVanCodenaam(String(codenaam || '').trim()) : null;
    const doel = t && t.key;
    if (!doel) return { status: 404, error: 'Geen lid met die codenaam.' };
    const p = d().profielen[key];
    if (p && !p.blokkade.includes(doel)) p.blokkade.push(doel);
    const openMatch = d().matches.find(m => (m.a === key && m.b === doel) || (m.a === doel && m.b === key));
    if (communication && openMatch) communication.terminatePair(key, doel, 'BLOCKED');
    if (connectionBlocking) connectionBlocking.blokkeer(key, doel, 'vonk');
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
    vonkMeldingen: () => ({ status: 200,
      meldingen: Projection.projectList(Projection.NAMES.BACKOFFICE_SAFETY, d().meldingen.slice(0, 50)) }) };
};
