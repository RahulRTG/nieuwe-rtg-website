/* Guest OS (deellaag): DE CLUB -- polsbandtegoed en minimum spend.

   HIER WAS BIJNA NIETS NIEUWS NODIG, en dat is het interessante resultaat. Een
   polsband IS in deze code al een tegoedbon (horeca/club.js maakt hem met
   `bonMaak`), en betalen met een tegoed liep al langs `bonBoek`. De gastkant
   kon dus vanaf dag een met een band afrekenen -- alleen wist niemand dat, want
   je kon je saldo niet zien.

   WAT ER WEL BIJ MOEST: HET BEWIJS DAT DE BAND VAN JOU IS. Aan de bar geef je
   hem af; dat is het bewijs. Vanaf een telefoon bestaat dat niet, en een
   bandNUMMER is geen geheim -- het staat groot op de band en is te raden. De
   boncode is dat wel: acht willekeurige tekens die de zaak nergens toont. Die
   staat dus als QR op de band, en wie hem scant heeft hem in handen gehad.

   Dat is dezelfde redenering als bij de tafel en de kamer, voor de vierde keer:
   niet "wie ben je" maar "wat heb je in handen". Alleen is het bewijs hier geen
   sticker op meubilair maar een polsband die je omkrijgt bij de kassa. */
'use strict';

module.exports = (kern) => {
  const { app, schoon, horeca, gastAuth } = kern;
  const { H, heleCenten } = horeca;

  /* ---------- mijn polsband ----------
     Op saldo vragen kan alleen met de boncode, dus met de band in je hand. Het
     antwoord noemt bewust het NUMMER niet terug: wie de code heeft weet welke
     band het is, en wie hem raadt hoort er geen nummer bij te krijgen dat hij
     kan gebruiken om aan de bar te doen alsof. */
  app.post('/api/gast/band', gastAuth, (req, res) => {
    const { zaakcode } = req.gast;
    const code = schoon((req.body || {}).bonCode, 40);
    if (!code) return res.status(400).json({ error: 'Scan de code op je polsband.', code: 'band-leeg' });
    const h = H(zaakcode);
    const bon = Object.prototype.hasOwnProperty.call(h.bonnen, code) ? h.bonnen[code] : null;
    if (!bon || bon.soort !== 'tegoed') return res.status(404).json({
      error: 'Deze code hoort niet bij een polsband van deze zaak.', code: 'band-onbekend' });
    res.json({ ok: true, saldo: bon.saldo, uitgegeven: bon.uitgegeven,
      naam: bon.naam || null, geldigTot: bon.geldigTot || null,
      let: 'Wat er op je band staat kan niet onder nul, en wat je overhoudt krijg je terug aan de kassa.' });
  });

  /* ---------- minimum spend van mijn tafel ----------
     Een afspraak, geen automatische bijboeking: het scherm toont wat er te gaan
     is. Dat staat zo in de zaakkant en hoort aan de gastkant niet anders te
     werken -- een gast die denkt dat het verschil vanzelf van zijn band gaat,
     komt bedrogen uit. */
  app.post('/api/gast/club/tafel', gastAuth, (req, res) => {
    const { zaakcode, rekening } = req.gast;
    const h = H(zaakcode);
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
