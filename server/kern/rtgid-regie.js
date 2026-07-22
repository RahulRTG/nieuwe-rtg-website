/* RTG iD, deel "regie": inzage (het inzagelog, de actieve sessies en de
   machtigingen), toegang per dienst intrekken en de mantelzorg-machtigingen
   (tijdelijk, per dienst, herroepbaar). Afgesplitst uit rtgid.js zodat elk
   deel klein blijft; de gedeelde interne helpers komen via het context-object
   binnen (S, logVan, cap, ... blijven zo een bron van waarheid). */
module.exports = (ctx) => {
  const { S, save, nu, iso, schoon, keyVanCodenaam, crypto, codenaamUit, logVan, cap, ATTRIBUTEN, MAX_LOG } = ctx;

  /* ---- inzage en regie: het log, actieve sessies en intrekken ---- */
  function inzage(key) {
    const s = S();
    const t = nu();
    return { status: 200,
      log: logVan(key).slice(0, MAX_LOG),
      sessies: s.sessies.filter(x => x.memberKey === key && !x.ingetrokken && t <= x.verloopt)
        .map(x => ({ dienst: x.dienst, attributen: x.attributen, namens: x.namens || null, verloopt: iso(x.verloopt) })),
      machtigingen: s.machtigingen.filter(m => (m.vanKey === key || m.naarKey === key) && !m.ingetrokken && t <= m.tot)
        .map(m => ({ id: m.id, van: codenaamUit(m.vanKey), naar: codenaamUit(m.naarKey), dienst: m.dienst, tot: iso(m.tot), ik: m.vanKey === key ? 'geef' : 'krijg' })),
      attributen: ATTRIBUTEN };
  }
  function intrek(key, dienst) {
    const s = S();
    const d = schoon(dienst, 60);
    let n = 0;
    for (const x of s.sessies) if (x.memberKey === key && x.dienst === d && !x.ingetrokken) { x.ingetrokken = true; n++; }
    const log = logVan(key);
    log.unshift({ om: iso(), dienst: d, attributen: [], soort: 'toegang ingetrokken' });
    cap(log, MAX_LOG); save();
    return { status: 200, ok: true, ingetrokken: n };
  }

  /* ---- machtigen (mantelzorg): tijdelijk, per dienst, herroepbaar ---- */
  async function machtig(key, b) {
    const s = S();
    const dienst = schoon(b.dienst, 60);
    const dagen = Math.round(Number(b.dagen));
    if (!dienst) return { status: 400, error: 'Voor welke dienst geldt de machtiging?' };
    if (!(dagen >= 1 && dagen <= 90)) return { status: 400, error: 'Een machtiging geldt 1 tot 90 dagen.' };
    let doelKey = null;
    try { const t = keyVanCodenaam ? await keyVanCodenaam(schoon(b.codenaam, 60)) : null; doelKey = t && t.key; } catch (e) {}
    if (!doelKey) return { status: 404, error: 'Geen lid gevonden met die codenaam.' };
    if (doelKey === key) return { status: 400, error: 'Uzelf machtigen hoeft niet.' };
    const m = { id: 'm' + crypto.randomBytes(5).toString('hex'), vanKey: key, naarKey: doelKey,
      dienst, gemaakt: iso(), tot: nu() + dagen * 86400000, ingetrokken: false };
    s.machtigingen.unshift(m); cap(s.machtigingen, 200);
    const log = logVan(key);
    log.unshift({ om: iso(), dienst, attributen: [], soort: 'machtiging aan ' + codenaamUit(doelKey) + ' (' + dagen + ' dagen)' });
    cap(log, MAX_LOG); save();
    return { status: 200, ok: true, machtiging: { id: m.id, naar: codenaamUit(doelKey), dienst, tot: iso(m.tot) } };
  }
  function machtigIntrek(key, mId) {
    const s = S();
    const m = s.machtigingen.find(x => x.id === String(mId || ''));
    if (!m || (m.vanKey !== key && m.naarKey !== key)) return { status: 404, error: 'Machtiging niet gevonden.' };
    m.ingetrokken = true;
    // ook de lopende sessies die er op draaien gaan dicht
    for (const x of s.sessies) if (x.memberKey === m.vanKey && x.namens && !x.ingetrokken) x.ingetrokken = true;
    save();
    return { status: 200, ok: true };
  }

  return { inzage, intrek, machtig, machtigIntrek };
};
