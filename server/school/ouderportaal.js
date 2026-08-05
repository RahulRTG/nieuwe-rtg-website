/* School (deelmodule): de ouder- en leerlingkant van de enterprise-laag --
   toestemmingsformulieren, afspraken met de leraar, en het ene overzicht waarin
   een gezin ziet wat er over hem bekend is.

   Het bestaande `/school/mijn` blijft de dagelijkse kant (rooster, huiswerk,
   cijfers, berichten). Dit bestand zet daar het zwaardere naast: geld,
   aanwezigheid, rapporten, verlof en toestemming.

   Toestemming is hier een echt AVG-mechanisme en geen vinkje: er staat bij
   waarvoor het is, ja EN nee zijn allebei een antwoord, en INTREKKEN kan
   altijd -- ook als het eerder ja was. Een toestemming die je niet kunt
   intrekken is geen toestemming. Niet antwoorden geldt nooit als ja: wat niet
   beantwoord is, telt als geen toestemming, en dat is precies wat er in het
   overzicht van de school staat. */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, K, S, eigenVeld, poort, gezinSessie, leerlingSleutel } = sctx;

  const T = (sch) => { if (!sch.toestemmingen) sch.toestemmingen = []; return sch.toestemmingen; };
  const A = (sch) => { if (!sch.afspraken) sch.afspraken = []; return sch.afspraken; };
  const openBedrag = (f) => Math.max(0, f.centen - (f.betaald || 0) + (f.terugbetaald || 0));
  const mijnSleutels = (s) => Object.values(s.g.profielen || {}).map(p => leerlingSleutel(s.g.code, p.id));

  /* ---------- toestemmingsformulieren ---------- */
  router.post('/school/toestemming/vraag', (req, res) => {
    const g = poort(req, res, 'leerling'); if (!g) return;
    const titel = schoon(req.body.titel, 100), uitleg = schoon(req.body.uitleg, 800);
    if (!titel || !uitleg) return res.status(400).json({ error: 'Geef de vraag een titel en leg uit waarvoor de toestemming is.' });
    const klasCode = String(req.body.klasCode || '').trim().toUpperCase();
    const k = klasCode ? eigenVeld(K(), klasCode) : null;
    if (klasCode && (!k || k.schoolCode !== g.sch.code)) return res.status(404).json({ error: 'Die klas hoort niet bij deze school.' });
    const t = { id: rid(5), titel, uitleg, klasCode: k ? k.code : null, soort: schoon(req.body.soort, 40) || 'algemeen',
      tot: schoon(req.body.tot, 10) || null, at: nu(), door: g.p.naam, antwoorden: {} };
    T(g.sch).unshift(t); g.sch.toestemmingen = T(g.sch).slice(0, 500);
    save();
    res.json({ ok: true, toestemming: { id: t.id, titel: t.titel, klasCode: t.klasCode },
      uitleg: 'Geen antwoord telt als GEEN toestemming; dat staat ook zo in het overzicht.' });
  });

  router.post('/school/toestemming/antwoord', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    if (!s.beheerder) return res.status(403).json({ error: 'Toestemming geeft een ouder of verzorger.' });
    let gevonden = null, school = null;
    for (const sch of Object.values(S())) { const t = T(sch).find(x => x.id === String(req.body.toestemmingId || '')); if (t) { gevonden = t; school = sch; break; } }
    if (!gevonden) return res.status(404).json({ error: 'Die vraag kennen we niet.' });
    const profielId = String(req.body.profielId || '');
    const sleutel = leerlingSleutel(s.g.code, profielId);
    const k = gevonden.klasCode ? eigenVeld(K(), gevonden.klasCode) : null;
    if (k && !(k.leerlingen || []).some(l => l.sleutel === sleutel)) return res.status(403).json({ error: 'Dit kind zit niet in die klas.' });
    const antwoord = req.body.antwoord;
    if (antwoord !== true && antwoord !== false && antwoord !== null)
      return res.status(400).json({ error: 'Antwoord met true (ja), false (nee) of null (intrekken).' });
    gevonden.antwoorden[sleutel] = { antwoord, door: schoon(s.p.naam, 60), at: nu() };
    save();
    res.json({ ok: true, toestemming: gevonden.id, antwoord,
      uitleg: antwoord === null ? 'De toestemming is ingetrokken.' : 'U kunt dit later altijd intrekken.',
      school: school.naam });
  });

  router.post('/school/toestemming/overzicht', (req, res) => {
    const g = poort(req, res, 'leerling'); if (!g) return;
    const rijen = T(g.sch).map(t => {
      const k = t.klasCode ? eigenVeld(K(), t.klasCode) : null;
      const leerlingen = k ? (k.leerlingen || []) : [];
      const gegeven = leerlingen.filter(l => (t.antwoorden[l.sleutel] || {}).antwoord === true);
      const geweigerd = leerlingen.filter(l => (t.antwoorden[l.sleutel] || {}).antwoord === false);
      const ingetrokken = leerlingen.filter(l => Object.prototype.hasOwnProperty.call(t.antwoorden, l.sleutel) && t.antwoorden[l.sleutel].antwoord === null);
      return { id: t.id, titel: t.titel, klasCode: t.klasCode, tot: t.tot, at: t.at,
        toestemming: gegeven.map(l => l.naam), geweigerd: geweigerd.length, ingetrokken: ingetrokken.length,
        geenAntwoord: leerlingen.length - gegeven.length - geweigerd.length - ingetrokken.length };
    });
    res.json({ ok: true, toestemmingen: rijen.slice(0, 200),
      uitleg: 'Alleen wie ja heeft gezegd, staat bij toestemming. Geen antwoord is geen toestemming.' });
  });

  /* ---------- afspraken met de leraar ----------
     De leraar zet momenten klaar, het gezin kiest er een. Wie het eerst komt;
     er is geen voorrang te koop en geen ranglijst van ouders. */
  router.post('/school/afspraak/momenten', (req, res) => {
    const g = poort(req, res); if (!g) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k || k.schoolCode !== g.sch.code) return res.status(404).json({ error: 'Die klas hoort niet bij deze school.' });
    const nieuwe = (Array.isArray(req.body.momenten) ? req.body.momenten : []).slice(0, 60)
      .map(m => ({ id: rid(4), klasCode: k.code, leraar: g.p.naam, datum: schoon(m && m.datum, 10), tijd: schoon(m && m.tijd, 5),
        minuten: Math.max(5, Math.min(60, Number(m && m.minuten) || 10)), plek: schoon(m && m.plek, 60) || null,
        bezet: null, at: nu() }))
      .filter(m => m.datum && m.tijd);
    if (!nieuwe.length && !req.body.alleen) return res.status(400).json({ error: 'Geef minstens een moment op (datum en tijd).' });
    A(g.sch).unshift(...nieuwe); g.sch.afspraken = A(g.sch).slice(0, 2000);
    save();
    res.json({ ok: true, klaargezet: nieuwe.length,
      momenten: A(g.sch).filter(m => m.klasCode === k.code).slice(0, 100) });
  });

  router.post('/school/afspraak/boek', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    if (!s.beheerder) return res.status(403).json({ error: 'Een afspraak met de leraar maakt een ouder of verzorger.' });
    let moment = null, school = null;
    for (const sch of Object.values(S())) { const m = A(sch).find(x => x.id === String(req.body.momentId || '')); if (m) { moment = m; school = sch; break; } }
    if (!moment) return res.status(404).json({ error: 'Dat moment kennen we niet.' });
    const k = eigenVeld(K(), moment.klasCode);
    const mijn = mijnSleutels(s);
    const kind = (k ? (k.leerlingen || []) : []).find(l => mijn.includes(l.sleutel));
    if (!kind) return res.status(403).json({ error: 'U hebt geen kind in deze klas.' });
    if (moment.bezet) return res.status(409).json({ error: 'Dat moment is net geboekt. Kies een ander.' });
    moment.bezet = { gezinCode: s.g.code, naam: schoon(s.p.naam, 60), kind: kind.naam, at: nu() };
    save();
    res.json({ ok: true, afspraak: { datum: moment.datum, tijd: moment.tijd, minuten: moment.minuten, leraar: moment.leraar, plek: moment.plek, school: school.naam } });
  });

  return { toestemmingen: T, afspraken: A, openBedrag, mijnSleutels };
};
