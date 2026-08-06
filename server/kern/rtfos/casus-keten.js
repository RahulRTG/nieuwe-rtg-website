/* Foundation OS, deel "casus-keten": de statusovergangen van een hulpvraag en
   het intrekken van de toestemming.

   HIER STAAN DE GRENDELS VAN DE CASUSMODULE, en ze zijn geen van drieen een
   volgorde-advies:

   1. DE TOESTEMMING WORDT BIJ ELKE STAP OPNIEUW GELEZEN. Niet een keer bij de
      intake afgevinkt, maar bij elke stap die hem nodig heeft (koppelen aan een
      partner, en doorwerken). Dat is wat het verschil maakt tussen een
      toestemming die je kunt intrekken en een vinkje dat er ooit stond.

      DIT IS ER GEKOMEN DOORDAT EEN MUTATIE AFSLOEG. In de eerste versie stond
      de eis alleen bij "gekoppeld", en die stap was alleen bereikbaar vanuit de
      status "toestemming" -- die je alleen bereikte door toestemming vast te
      leggen. De grendel was dus onbereikbaar: de KETEN deed het werk en de
      toets sloeg aan op de ketenfout, niet op de toestemming. Zie de kop van
      test/rtfos.test.js voor de hele redenering.

   2. EEN PARTNER MOET ACTIEF ZIJN. Een opgeschorte of nog niet goedgekeurde
      stichting krijgt geen hulpvragen -- juist bij een opschorting is dat de
      hele bedoeling.

   3. AFRONDEN VRAAGT EEN HULPACTIE IN HET DOSSIER. Een hulpvraag die "afgerond"
      heet terwijl niemand opschreef wat er is gedaan, is administratief
      gesloten en feitelijk open blijven staan.

   Afgesplitst uit casus.js op de 10 KB van keuringsregel 13. */

module.exports = (ctx, eigen) => {
  const { nu, schoon, S, audit, wie, poort, save } = ctx;
  const { vind, beeld, KETEN, EIST_TOESTEMMING, BEWAARDAGEN } = eigen;

  /* De workflow. Twee stappen hebben een eigen voorwaarde, en die staan hier
     als grendel en niet als volgorde-advies:
       - "toestemming" kan alleen als de toestemming ook echt is vastgelegd;
       - "gekoppeld" kan alleen naar een ACTIEVE partner van dezelfde stad. */
  function status(req, id, naar, b) {
    b = b || {};
    const c = vind(id);
    if (!c) return { status: 404, error: 'Deze hulpvraag bestaat niet.' };
    const w = wie(req);
    const g = poort(w, c.stad, 'casus.beheren', 'individual_cases');
    if (!g.ok) return g;
    const st = String(naar || '');
    const mag = KETEN[c.status] || [];
    if (!mag.includes(st)) {
      return { status: 400, error: 'Vanaf "' + c.status + '" kan een hulpvraag naar ' +
        (mag.length ? mag.join(' of ') : 'niets meer') + ', niet naar "' + st + '".' };
    }
    if (st === 'toestemming') {
      const tekst = schoon(b.toestemming, 300);
      if (tekst.length < 5) {
        return { status: 400, error: 'Leg vast waar de hulpvrager toestemming voor geeft: welke gegevens, aan welke partner, en waarvoor.' };
      }
      c.toestemming = { tekst, door: w.key, at: nu() };
    }
    /* De toestemming wordt niet één keer bij de intake afgevinkt maar bij ELKE
       stap opnieuw gelezen. Dat is het verschil dat ertoe doet: wie zijn
       toestemming intrekt, wil dat het stopt -- niet dat het doorloopt omdat
       er ooit een vinkje stond. */
    if (EIST_TOESTEMMING.includes(st) && !c.toestemming) {
      return { status: 403, error: 'Zonder vastgelegde toestemming gaat een hulpvraag niet naar een partner en gaat het werk niet verder. Leg eerst opnieuw vast waar de hulpvrager toestemming voor geeft.' };
    }
    if (st === 'gekoppeld') {
      const p = S().partners.find(x => x.id === String(b.partnerId || ''));
      if (!p) return { status: 404, error: 'Kies de partnerstichting die deze hulpvraag oppakt.' };
      if (p.stad !== c.stad) return { status: 400, error: 'Die partner werkt in een andere stad.' };
      if (p.status !== 'actief') return { status: 400, error: 'Deze partner staat op "' + p.status + '" en krijgt geen hulpvragen.' };
      c.partnerId = p.id;
      const pid = schoon(b.projectId, 20);
      if (pid) {
        const pr = S().projecten.find(x => x.id === pid);
        if (!pr || pr.stad !== c.stad) return { status: 400, error: 'Dat project hoort niet bij deze stad.' };
        c.projectId = pr.id;
      }
    }
    if (st === 'afgerond') {
      const gedaan = (c.stappen || []).some(s => s.soort === 'hulpactie');
      if (!gedaan) return { status: 400, error: 'Er staat nog geen hulpactie in het dossier. Noteer eerst wat er is gedaan.' };
      c.bewaarTot = new Date(Date.now() + BEWAARDAGEN * 86400000).toISOString().slice(0, 10);
    }
    const oud = c.status;
    c.status = st;
    audit(w.key, 'casus.status', c.codenaam, oud + ' -> ' + st);
    save();
    return { ok: true, casus: beeld(c) };
  }

  /* Toestemming intrekken. Dit hoort bij een toestemming die iets waard is: wie
     ja zegt, mag ook nee zeggen, en dan stopt het -- niet "vanaf de volgende
     ronde", maar bij de eerstvolgende stap die toestemming nodig heeft. De
     status blijft staan: wat er is gebeurd, is gebeurd, en dat uitwissen zou
     het dossier onbetrouwbaar maken voor de hulpvrager zelf. */
  function toestemmingWeg(req, id, reden) {
    const c = vind(id);
    if (!c) return { status: 404, error: 'Deze hulpvraag bestaat niet.' };
    const w = wie(req);
    const g = poort(w, c.stad, 'casus.beheren', 'individual_cases');
    if (!g.ok) return g;
    if (!c.toestemming) return { status: 400, error: 'Er staat geen toestemming vastgelegd bij deze hulpvraag.' };
    c.ingetrokken = { was: c.toestemming, door: w.key, reden: schoon(reden, 300), at: nu() };
    c.toestemming = null;
    audit(w.key, 'casus.toestemming-ingetrokken', c.codenaam, schoon(reden, 60));
    save();
    return { ok: true, casus: beeld(c) };
  }

  return { status, toestemmingWeg };
};
