/* Luchthaven, deelbestand "royaal": het charterloket (een lid vraagt een
   privejet of helikopter aan; OPERATIONS beslist, nooit de AI en nooit
   automatisch), de Koninklijke Vleugel (vips onder protocolnaam met het
   vaste protocol) en de lounges (binnen op de boarding pass; de Koninklijke
   Vleugel alleen met een lopend vip-protocol). Krijgt de gedeelde ctx van
   ./index.js. */
module.exports = (ctx) => {
  const { save, crypto, nu, id, schoon, vandaag, L, seed, vluchten, vind, actief,
    plekkenVoor, vipVan, vipRond, publiek, _vluchtMaak, passCheck,
    CATEGORIEEN, LOUNGES, VIP_SOORTEN, VIP_PROTOCOL } = ctx;

  /* ---------- het charterloket: privejets en helikopters op aanvraag ----------
     Bij een bevestiging komt de vlucht meteen op het bord (met vrije stand of
     helipad) en staat de aanvrager erop geboekt; inchecken gaat daarna gewoon
     via de eigen keten. */
  function charterVraag(sess, codenaam, data) {
    data = data || {};
    const soort = ['privejet', 'helikopter'].includes(data.soort) ? data.soort : null;
    if (!soort) return { status: 400, error: 'Kies een privejet of een helikopter.' };
    const bestemming = schoon(data.bestemming, 60);
    if (bestemming.length < 2) return { status: 400, error: 'Waar wilt u heen?' };
    const ch = { id: id('ch'), code: 'CH-' + crypto.randomBytes(3).toString('hex').toUpperCase(), soort, bestemming,
      datum: /^\d{4}-\d{2}-\d{2}$/.test(String(data.datum || '')) ? data.datum : vandaag(),
      tijd: /^\d{2}:\d{2}$/.test(String(data.tijd || '')) ? data.tijd : '12:00',
      key: sess.key, codenaam: schoon(codenaam, 60) || 'Reiziger', status: 'aangevraagd', vluchtId: null, at: nu() };
    L().charters.unshift(ch);
    L().charters = L().charters.slice(0, 20000);
    save();
    return { ok: true, charter: { code: ch.code, soort, bestemming, datum: ch.datum, tijd: ch.tijd, status: ch.status } };
  }
  function charterLijst() {
    seed();
    return { ok: true, charters: L().charters.slice(0, 60).map(c => ({ id: c.id, code: c.code, soort: c.soort,
      icoon: CATEGORIEEN[c.soort], bestemming: c.bestemming, datum: c.datum, tijd: c.tijd, van: c.codenaam, status: c.status })) };
  }
  function charterBeslis(actor, cid, akkoord) {
    const ch = L().charters.find(x => x.id === String(cid || ''));
    if (!ch) return { status: 404, error: 'Charteraanvraag niet gevonden.' };
    if (ch.status !== 'aangevraagd') return { status: 409, error: 'Deze aanvraag is al ' + ch.status + '.' };
    if (!akkoord) { ch.status = 'afgewezen'; save(); return { ok: true, charter: { code: ch.code, status: ch.status } }; }
    // een vrije stand of helipad zoeken voor dat moment
    const plekken = plekkenVoor(ch.soort);
    const plek = plekken.find(p => !vluchten().some(v => actief(v) && v.gate === p && v.datum === ch.datum && v.tijd === ch.tijd));
    if (!plek) return { status: 409, error: 'Geen vrije ' + (ch.soort === 'helikopter' ? 'helipad' : 'stand') + ' op dat moment; stel een andere tijd voor.' };
    const v = _vluchtMaak({ nummer: (ch.soort === 'helikopter' ? 'RH' : 'RJ') + Math.floor(100 + Math.random() * 900),
      soort: 'vertrek', categorie: ch.soort, bestemming: ch.bestemming, datum: ch.datum, tijd: ch.tijd, gate: plek,
      toestel: ch.soort === 'helikopter' ? 'RTG-H1' : 'RTG-J1' });
    v.status = 'inchecken';
    ch.status = 'bevestigd'; ch.vluchtId = v.id; ch.door = actor || 'operations';
    const b = { id: id('bk'), code: 'VL-' + crypto.randomBytes(3).toString('hex').toUpperCase(), vluchtId: v.id,
      key: ch.key, codenaam: ch.codenaam, status: 'geboekt', stoel: null, koffers: 0, at: nu() };
    L().boekingen.unshift(b);
    save();
    return { ok: true, charter: { code: ch.code, status: ch.status }, vlucht: publiek(v), boeking: { code: b.code } };
  }
  function mijnCharters(key) {
    return L().charters.filter(c => c.key === key).slice(0, 10).map(c => {
      const v = c.vluchtId ? vind(c.vluchtId) : null;
      return { code: c.code, soort: c.soort, icoon: CATEGORIEEN[c.soort], bestemming: c.bestemming,
        datum: c.datum, tijd: c.tijd, status: c.status, vlucht: v ? v.nummer : null };
    });
  }

  /* ---------- de Koninklijke Vleugel: vips onder protocolnaam ---------- */
  function vipMaak(actor, data) {
    data = data || {};
    const v = vind(String(data.vlucht || ''));
    if (!v || v.soort !== 'vertrek') return { status: 404, error: 'Vlucht niet gevonden.' };
    if (!actief(v)) return { status: 409, error: 'Deze vlucht is al ' + v.status + '.' };
    if (vipVan(v)) return { status: 409, error: 'Op deze vlucht loopt al een vip-protocol.' };
    const soort = VIP_SOORTEN.includes(data.soort) ? data.soort : 'vip';
    const protocolnaam = schoon(data.protocolnaam, 60);
    if (protocolnaam.length < 2) return { status: 400, error: 'Geef de gast een protocolnaam (nooit de echte naam).' };
    const vip = { id: id('vip'), vluchtId: v.id, protocolnaam, soort,
      suite: soort === 'vip' ? 'Suite Uno' : 'Suite Royale', protocol: {}, door: actor || 'protocol', at: nu() };
    L().vips.unshift(vip);
    L().vips = L().vips.slice(0, 5000);
    save();
    return { ok: true, vip: vipPubliek(vip) };
  }
  function vipPubliek(vip) {
    const v = vind(vip.vluchtId);
    return { id: vip.id, protocolnaam: vip.protocolnaam, soort: vip.soort, suite: vip.suite,
      vlucht: v ? v.nummer : '?', tijd: v ? v.tijd : '', rond: vipRond(vip),
      protocol: VIP_PROTOCOL.map(s => ({ stap: s, klaar: !!vip.protocol[s] })) };
  }
  function vipLijst() {
    seed();
    return { ok: true, soorten: VIP_SOORTEN, vips: L().vips.slice(0, 40).map(vipPubliek) };
  }
  function vipTaak(actor, vid2, stap) {
    const vip = L().vips.find(x => x.id === String(vid2 || ''));
    if (!vip) return { status: 404, error: 'Vip-protocol niet gevonden.' };
    if (!VIP_PROTOCOL.includes(stap)) return { status: 400, error: 'Onbekende protocolstap.' };
    if (vip.protocol[stap]) return { status: 409, error: 'Deze stap is al afgevinkt.' };
    vip.protocol[stap] = { door: actor || 'protocol', at: nu() };
    save();
    return { ok: true, vip: vipPubliek(vip), rond: vipRond(vip) };
  }

  /* ---------- de lounges: gastvrijheid op vertoon van de boarding pass ---------- */
  function loungeIn(actor, loungeId, passCode) {
    const lounge = LOUNGES[String(loungeId || '')];
    if (!lounge) return { status: 400, error: 'Kies een lounge (salon of royal).' };
    const check = passCheck(passCode);
    if (!check.geldig) return { status: 409, error: 'Geen geldige boarding pass: ' + (check.reden || 'onbekend.') };
    const b = L().boekingen.find(x => x.code === String(passCode || '').trim().toUpperCase());
    const v = vind(b.vluchtId);
    if (String(loungeId) === 'royal' && !vipVan(v))
      return { status: 403, error: 'De Koninklijke Vleugel is uitsluitend voor gasten op een vlucht met een vip-protocol.' };
    if (L().lounge.some(g => g.boekingId === b.id && !g.uit))
      return { status: 409, error: 'Deze gast is al binnen.' };
    const binnen = L().lounge.filter(g => g.lounge === loungeId && !g.uit).length;
    if (binnen >= lounge.capaciteit) return { status: 409, error: lounge.naam + ' zit vol (' + lounge.capaciteit + ' plaatsen).' };
    const g = { id: id('lg'), lounge: String(loungeId), boekingId: b.id, codenaam: b.codenaam,
      vlucht: v.nummer, tijd: v.tijd, door: actor || 'lounge', in: nu(), uit: null };
    L().lounge.unshift(g);
    L().lounge = L().lounge.slice(0, 20000);
    save();
    return { ok: true, gast: g, lounge: lounge.naam };
  }
  function loungeUit(actor, gid) {
    const g = L().lounge.find(x => x.id === String(gid || ''));
    if (!g) return { status: 404, error: 'Gast niet gevonden.' };
    if (g.uit) return { status: 409, error: 'Deze gast is al uitgecheckt.' };
    g.uit = nu(); g.uitDoor = actor || 'lounge';
    save();
    return { ok: true, gast: g };
  }
  function loungeStand() {
    seed();
    return { ok: true, lounges: Object.entries(LOUNGES).map(([lid2, l]) => ({
      id: lid2, naam: l.naam, capaciteit: l.capaciteit,
      binnen: L().lounge.filter(g => g.lounge === lid2 && !g.uit).length,
      gasten: L().lounge.filter(g => g.lounge === lid2 && !g.uit).slice(0, 60)
        .map(g => ({ id: g.id, codenaam: g.codenaam, vlucht: g.vlucht, tijd: g.tijd, in: g.in }))
    })) };
  }

  return { charterVraag, charterLijst, charterBeslis, mijnCharters,
    vipMaak, vipLijst, vipTaak, loungeIn, loungeUit, loungeStand };
};
