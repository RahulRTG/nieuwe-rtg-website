/* RTG iD, deel "regie": inzage (het inzagelog, de actieve sessies en de
   machtigingen), toegang per dienst intrekken en de mantelzorg-machtigingen
   (tijdelijk, per dienst, herroepbaar). Afgesplitst uit rtgid.js zodat elk
   deel klein blijft; de gedeelde interne helpers komen via het context-object
   binnen (S, logVan, cap, ... blijven zo een bron van waarheid). */
module.exports = (ctx) => {
  const { metStaat, nu, iso, schoon, keyVanCodenaam, crypto, codenaamUit,
    accountVanKey, logVan, cap, ATTRIBUTEN, MAX_LOG } = ctx;

  /* ---- inzage en regie: het log, actieve sessies en intrekken ---- */
  function inzage(key) {
    return metStaat(s => {
      const t = nu();
      return { status: 200,
        log: (s.logs[key] || []).slice(0, MAX_LOG),
        sessies: s.sessies.filter(x => x.memberKey === key && !x.ingetrokken && t <= x.verloopt)
        /* Hoe vaak deze dienst uw gegevens heeft OPGEHAALD binnen de lopende
           sessie. Een inlog is een deur; dit is hoeveel er doorheen is gelopen,
           en dat stond nergens. */
        .map(x => ({ dienst: x.dienst, attributen: x.attributen, namens: x.namens || null,
          verloopt: iso(x.verloopt), opgehaald: x.opgehaald || 0 })),
        machtigingen: s.machtigingen.filter(m => (m.vanKey === key || m.naarKey === key) && !m.ingetrokken && t <= m.tot)
          .map(m => ({ id: m.id, van: codenaamUit(m.vanKey), naar: codenaamUit(m.naarKey), dienst: m.dienst, tot: iso(m.tot), ik: m.vanKey === key ? 'geef' : 'krijg' })),
        attributen: ATTRIBUTEN };
    });
  }
  function intrek(key, dienst) {
    const d = schoon(dienst, 60);
    return metStaat(s => {
      let n = 0;
      for (const x of s.sessies) if (x.memberKey === key && x.dienst === d && !x.ingetrokken) {
        x.ingetrokken = true; n++;
      }
      const log = logVan(key, s);
      log.unshift({ om: iso(), dienst: d, attributen: [], soort: 'toegang ingetrokken' });
      cap(log, MAX_LOG);
      return { status: 200, ok: true, ingetrokken: n };
    });
  }

  /* ---- machtigen (mantelzorg): tijdelijk, per dienst, herroepbaar ---- */
  async function machtig(key, b) {
    const dienst = schoon(b.dienst, 60);
    const dagen = Math.round(Number(b.dagen));
    if (!dienst) return { status: 400, error: 'Voor welke dienst geldt de machtiging?' };
    if (!(dagen >= 1 && dagen <= 90)) return { status: 400, error: 'Een machtiging geldt 1 tot 90 dagen.' };
    let doelKey = null;
    try { const t = keyVanCodenaam ? await keyVanCodenaam(schoon(b.codenaam, 60)) : null; doelKey = t && t.key; } catch (e) {}
    if (!doelKey) return { status: 404, error: 'Geen lid gevonden met die codenaam.' };
    if (doelKey === key) return { status: 400, error: 'Uzelf machtigen hoeft niet.' };
    return metStaat(s => {
      /* De codenaamzoeker liep vóór het collectieslot. Controleer daarom de
         gevonden identiteit opnieuw in de autoritatieve fase; verdwijnen of
         blokkeren tijdens die await mag nooit alsnog een machtiging maken. */
      if (typeof accountVanKey === 'function' && !accountVanKey(doelKey))
        return { status: 404, error: 'Geen lid gevonden met die codenaam.' };
      const m = { id: 'm' + crypto.randomBytes(16).toString('hex'), vanKey: key, naarKey: doelKey,
        dienst, gemaakt: iso(), tot: nu() + dagen * 86400000, ingetrokken: false };
      s.machtigingen.unshift(m); cap(s.machtigingen, 200);
      const log = logVan(key, s);
      log.unshift({ om: iso(), dienst, attributen: [],
        soort: 'machtiging aan ' + codenaamUit(doelKey) + ' (' + dagen + ' dagen)' });
      cap(log, MAX_LOG);
      return { status: 200, ok: true,
        machtiging: { id: m.id, naar: codenaamUit(doelKey), dienst, tot: iso(m.tot) } };
    });
  }
  function machtigIntrek(key, mId) {
    return metStaat(s => {
      const m = s.machtigingen.find(x => x.id === String(mId || ''));
      if (!m || (m.vanKey !== key && m.naarKey !== key))
        return { status: 404, error: 'Machtiging niet gevonden.' };
      m.ingetrokken = true;
    /* Alleen de sessies die op DEZE machtiging draaien gaan dicht.

       Hier stond `x.memberKey === m.vanKey && x.namens`, en dat sloot elke
       namens-sessie van de principaal -- ook die van een ANDERE gemachtigde bij
       een ANDERE dienst. Wie zijn accountant de toegang tot de belastingdienst
       ontnam, gooide daarmee de lopende sessie van zijn mantelzorger bij de
       gemeente eruit. Dat is geen strengheid maar een verkeerde deur.

       De terugval vangt sessies van voor deze ronde op, die de machtiging nog
       niet dragen: die worden herkend aan de gemachtigde EN de dienst samen.
       Een sessie leeft twintig minuten, dus die terugval is vanzelf tijdelijk
       -- hij staat er omdat een openstaande sessie die dicht hoort erger is
       dan een regel die over een halfuur niets meer doet. */
      const naarCodenaam = codenaamUit(m.naarKey);
      for (const x of s.sessies) {
        if (x.ingetrokken || x.memberKey !== m.vanKey || !x.namens) continue;
        const vanDeze = x.machtigingId
          ? x.machtigingId === m.id
          : (x.namens === naarCodenaam && x.dienst === m.dienst);
        if (vanDeze) x.ingetrokken = true;
      }
      return { status: 200, ok: true };
    });
  }

  return { inzage, intrek, machtig, machtigIntrek };
};
