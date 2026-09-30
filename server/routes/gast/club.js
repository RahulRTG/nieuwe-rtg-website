/* Guest OS (deellaag): DE CLUB -- polsbandtegoed en minimum spend.

   HIER WAS BIJNA NIETS NIEUWS NODIG, en dat is het interessante resultaat. Een
   polsband IS in deze code al een tegoedbon (horeca/club.js maakt hem met
   `bonMaak`), en betalen met een tegoed liep al langs `bonBoek`. De gastkant
   kon dus vanaf dag een met een band afrekenen -- alleen wist niemand dat, want
   je kon je saldo niet zien.

   WAT ER WEL BIJ MOEST: HET BEWIJS DAT DE BAND VAN JOU IS. Aan de bar geef je
   hem af; dat is het bewijs. Vanaf een telefoon bestaat dat niet, en een
   bandNUMMER is geen geheim -- het staat groot op de band en is te raden. De
   boncode is dat wel: 128 bits die de zaak een keer ziet. Die staat als QR op
   de band, en wie hem scant KOPPELT hem aan zijn eigen tafelsessie.

   Dat is dezelfde redenering als bij de tafel en de kamer, voor de vierde keer:
   niet "wie ben je" maar "wat heb je in handen". Alleen is het bewijs hier geen
   sticker op meubilair maar een polsband die je omkrijgt bij de kassa. */
'use strict';

module.exports = (kern) => {
  const { app, schoon, horeca, gastAuth } = kern;
  const { Hlees, heleCenten } = horeca;

  /* KIJKEN IS Hlees EN NIET H. Geen van beide routes hieronder zet iets op de
     rekening; het koppelen schrijft alleen in de bon zelf. H() zou de horecadoos van de zaak
     neerzetten zodra iemand ernaar vraagt, ook bij de 404 op een geraden
     boncode, en dan laat een geweigerd verzoek iets achter dat er niet was.
     Bestaat de doos wel -- en dat is hier altijd zo, want gastAuth komt niet
     langs zonder open rekening -- dan geeft Hlees hem ECHT terug. Zie
     kern/horeca.js bij Hlees. */

  /* ---------- mijn bon of polsband: KOPPELEN ----------
     Met de code in de hand (de QR op de band, de code op de bon) bindt de gast
     de bon aan ZIJN tafelsessie; alleen dan kan /api/gast/betaal hem afboeken,
     en zolang deze rekening open is kan geen andere telefoon hem koppelen
     (kern/horeca/bon-beheer.js). Het antwoord noemt het NUMMER van de band niet
     terug, en ook de code niet. Een rem op raden (per adres) staat ervoor, al
     is 128 bits niet te raden: een oude bon van 32 bits wel. */
  app.post('/api/gast/band', gastAuth, async (req, res) => {
    const { zaakcode, rekening, deelnemer } = req.gast;
    const code = schoon((req.body || {}).bonCode, 80);
    if (!code) return res.status(400).json({ error: 'Scan de code op je polsband of bon.', code: 'band-leeg' });
    const emmer = 'gastbon:' + req.ip;
    if (kern.tooManyTries && kern.tooManyTries(res, emmer)) return;
    const h = Hlees(zaakcode);
    const r = await horeca.bonlaag.koppel({ zaak: zaakcode, code, rekeningId: rekening.id,
      deelnemer: deelnemer ? deelnemer.hash : null,
      leeft: b => { const x = (h.rekeningen || {})[b.rekeningId]; return !!(x && x.status === 'open'); } });
    if (!r.ok) {
      if (r.status === 404 && kern.noteFailedTry) kern.noteFailedTry(emmer, req.ip);
      return res.status(r.status || 409).json({ error: r.status === 404
        ? 'Deze code hoort niet bij een bon of polsband van deze zaak.' : r.error,
        code: r.status === 404 ? 'band-onbekend' : r.code });
    }
    res.json({ ok: true, gekoppeld: true, saldo: r.bon.saldo, uitgegeven: r.bon.uitgegeven,
      soort: r.bon.band ? 'polsband' : r.bon.soort, naam: r.bon.band ? null : r.bon.naam, geldigTot: r.bon.geldigTot,
      let: 'Gekoppeld aan deze tafel. Wat erop staat kan niet onder nul, en wat je overhoudt krijg je terug aan de kassa.' });
  });

  /* ---------- minimum spend van mijn tafel ----------
     Een afspraak, geen automatische bijboeking: het scherm toont wat er te gaan
     is. Dat staat zo in de zaakkant en hoort aan de gastkant niet anders te
     werken -- een gast die denkt dat het verschil vanzelf van zijn band gaat,
     komt bedrogen uit. */
  app.post('/api/gast/club/tafel', gastAuth, (req, res) => {
    const { zaakcode, rekening } = req.gast;
    const h = Hlees(zaakcode);
    const club = h.club || {};
    const afspraak = Object.values(club.tafels || {}).find(t =>
      t.rekeningId === rekening.id || (rekening.tafel && t.tafel === rekening.tafel)) || null;
    if (!afspraak) return res.json({ ok: true, minimum: null,
      let: 'Op deze tafel staat geen minimum spend.' });
    const besteed = (rekening.regels || []).reduce((s, r) => s + heleCenten(r.centen * r.aantal), 0);
    res.json({ ok: true, minimum: {
      tafel: afspraak.tafel, personen: afspraak.personen,
      minimumCenten: afspraak.minimumCenten, besteed,
      teGaan: Math.max(0, afspraak.minimumCenten - besteed),
      gehaald: besteed >= afspraak.minimumCenten },
      let: 'Minimum spend is een afspraak: er wordt niets automatisch bijgeboekt.' });
  });
};
