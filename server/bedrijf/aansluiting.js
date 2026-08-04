/* RTG Werk OS (deellaag): de aansluitingen op wat er al staat.

   Deze laag beloofde vanaf golf 1 in zijn eigen kop dat hij GEEN tweede
   agenda, chat, documentenmap of loonrun bouwt maar de bestaande lagen
   aansluit. Tot nu toe was dat een belofte in tekst: de blokken agenda,
   berichten en documenten stonden bij `nietGemeten` en er liep geen draad
   naartoe. LAT-regel 6 zegt dat een belofte in tekst een belofte in code is.
   Dit bestand is die draad.

   HOE DE KOPPELING WERKT. Een werkruimtelid is niet automatisch een RTG-lid;
   het zijn twee identiteiten, en dat blijft zo. Wie zijn RTG-account wil zien
   op zijn werkstartscherm, KOPPELT het een keer: hij stuurt zijn eigen
   RTG-sessie mee (de gewone auth-poort) plus zijn lid-token van deze
   werkruimte. Daarna leest het startscherm zijn agenda, zijn postvak en zijn
   kluis -- via de bestaande modules, zonder een byte over te schrijven.

   TWEE DINGEN DIE HIER BEWUST NIET GEBEUREN:

   1. NIEMAND KOPPELT EEN ANDER. De sessie en het lid-token moeten allebei van
      dezelfde persoon komen; de beheerder kan dit niet namens iemand doen.
      Anders leest een werkgever het privepostvak van een medewerker.
   2. DE WERKRUIMTE KRIJGT DE INHOUD NIET. Er reizen TELLINGEN en titels mee,
      geen berichten en geen bestanden. Het werkstartscherm zegt "drie
      ongelezen", niet wat erin staat -- en de koppeling is met een knop weer
      los te maken. */
'use strict';

module.exports = (sctx) => {
  const { app, save, nu, werkPoort, eigenVeld, kern } = sctx;
  const { auth } = kern;

  function codenaamVan(sessie) {
    if (sessie && sessie.account && sessie.account.codename) return sessie.account.codename;
    const p = kern.PERSONAS && sessie ? kern.PERSONAS[sessie.tier] : null;
    return p ? p.codename : null;
  }

  /* Koppelen: de RTG-sessie komt uit de auth-poort (dus uit de kop), het
     lid-token uit het lijf. Twee sleutels van dezelfde persoon. */
  app.post('/api/bedrijf/lid/koppel', auth, (req, res) => {
    const s = sctx.lidVan(req, res); if (!s) return;
    const key = req.session.key;
    if (!key) return res.status(403).json({ error: 'Geen RTG-sessie gevonden.' });
    const anders = Object.values(s.w.leden).find(l => l.rtgKey === key && l.id !== s.l.id);
    if (anders) return res.status(409).json({ error: 'Dit RTG-account is in deze werkruimte al gekoppeld aan ' + anders.naam + '.' });
    s.l.rtgKey = key;
    s.l.rtgCodenaam = codenaamVan(req.session);
    s.l.gekoppeldAt = nu();
    save();
    res.json({ ok: true, gekoppeld: true, codenaam: s.l.rtgCodenaam,
      let: 'Uw agenda, postvak en kluis blijven waar ze staan. Op het werkstartscherm komen alleen TELLINGEN en titels; de inhoud niet. Losmaken kan met /api/bedrijf/lid/ontkoppel.' });
  });

  app.post('/api/bedrijf/lid/ontkoppel', (req, res) => {
    const s = sctx.lidVan(req, res); if (!s) return;
    if (!s.l.rtgKey) return res.status(409).json({ error: 'Er is niets gekoppeld.' });
    s.l.rtgKey = null; s.l.rtgCodenaam = null; s.l.gekoppeldAt = null;
    save();
    res.json({ ok: true, gekoppeld: false });
  });

  app.post('/api/bedrijf/koppeling', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    const l = g.directie ? null : g.l;
    res.json({ ok: true, gekoppeld: !!(l && l.rtgKey), codenaam: l ? l.rtgCodenaam || null : null,
      bronnen: ['agenda', 'berichten', 'documenten'],
      let: 'De werkruimte ziet uw codenaam en tellingen, nooit de inhoud van uw agenda, postvak of kluis.' });
  });

  /* ---------- de drie blokken ----------
     Elk blok leest de BESTAANDE module. Faalt er een, dan verdwijnt dat blok
     en blijft de rest staan; een kapotte koppeling hoort geen startscherm te
     slopen (en het blok komt dan gewoon weer bij nietGemeten terecht). */
  const veilig = (fn) => { try { return fn(); } catch (e) { return null; } };

  sctx.startBron('agenda', null, (g) => {
    if (!g.l || !g.l.rtgKey || !kern.agenda) return null;
    return veilig(() => {
      const items = kern.agenda.lijst(g.l.rtgKey) || [];
      const open = items.filter(i => !i.gedaan);
      return { openItems: kern.agenda.telling(g.l.rtgKey),
        eerstvolgend: open.slice(0, 5).map(i => ({ titel: i.titel, datum: i.datum, tijd: i.tijd })),
        bron: 'RTG Agenda' };
    });
  });

  sctx.startBron('berichten', null, (g) => {
    if (!g.l || !g.l.rtgCodenaam || !kern.rtmail) return null;
    return veilig(() => {
      const adres = kern.rtmail.adresVoor('lid', g.l.rtgCodenaam);
      if (!adres) return null;
      return { ongelezen: kern.rtmail.ongelezen(adres), adres, bron: 'RTMAIL' };
    });
  });

  sctx.startBron('documenten', null, (g) => {
    if (!g.l || !g.l.rtgKey || !kern.bestanden) return null;
    return veilig(() => {
      const b = kern.bestanden.bestandenLijst(g.l.rtgKey);
      if (!b) return null;
      return { bestanden: (b.items || []).length, gedeeld: (b.gedeeld || []).length,
        documenten: (b.office || []).slice(0, 5).map(d => ({ titel: d.titel, soort: d.soort })),
        bron: 'RTG Bestanden en RTG Office' };
    });
  });
};
