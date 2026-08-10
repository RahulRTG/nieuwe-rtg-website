/* Kantoren, deel "bank-bevoegd": wat er onderweg is naar buiten, en wat RTG
   zelf mag. Twee vragen die bij elkaar horen en niet bij de regie.

   De RECONCILIATIE (de betaalopdrachten) staat hier omdat ze over dezelfde
   grens gaat als de bevoegdheid: die tussen RTG en de buitenwereld. De
   sluitcontrole in ./bank.js kijkt naar binnen -- kloppen de boekingen
   onderling -- en kan per definitie niet zien of er ook echt geld is vertrokken;
   een boeking naar extern:sepa sluit ook als de rail hem nooit heeft
   aangenomen. Wie hier een oplopend getal ziet, kijkt naar een storing bij de
   rail en niet naar een fout in de boekhouding.

   De BEVOEGDHEID is bewust een REGISTRATIE en geen knop: wie een vergunning kan
   aanzetten alsof het een instelling is, heeft geen vergunning maar een
   instelling. Vastleggen staat daarom achter de boardroom (een persoon), lezen
   achter de kantoorcode (het werk).

   `naam(req)` komt uit ./bank.js mee via de context: wie er handelt komt uit de
   sessie, nooit uit req.body. Zie de toelichting daar. */
module.exports = (ctx) => {
  const { app, officeAuth, boardroomAuth, veilig, afdelingen, sseToOffice, kern, naam } = ctx;
  const bank = kern.bank;
  const sync = () => sseToOffice('sync', { scope: 'bank' });

  app.post('/api/office/bank/opdrachten', officeAuth, (req, res) => veilig(res, () => ({
    ...bank.bankOpdrachten({ limit: Number(req.body.limit) || 50, status: req.body.status, bron: req.body.bron }),
    open: bank.bankOpdrachtenOpen()
  })));
  // met de hand een ronde draaien (de tik doet dit vanzelf elke minuut)
  app.post('/api/office/bank/opdrachten/ronde', officeAuth, async (req, res) => {
    const r = await bank.bankOpdrachtenRonde({});
    if (r.gedaan) afdelingen.audit(naam(req), 'RTG Bank opdrachtenronde met de hand: ' + r.gedaan + ' ingediend, ' + r.opgegeven + ' opgegeven');
    res.json(r);
  });
  /* Een opgegeven opdracht opnieuw indienen. Dat is een BESLUIT van het
     kantoor -- de automaat heeft het al zes keer geprobeerd en het geld is
     teruggeboekt -- dus hij komt in het auditlog en niet stil door. */
  app.post('/api/office/bank/opdrachten/opnieuw', officeAuth, async (req, res) => {
    const r = await bank.bankOpdrachtOpnieuw(String(req.body.id || ''));
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    afdelingen.audit(naam(req), 'RTG Bank betaalopdracht ' + r.id + ' met de hand opnieuw ingediend (' + r.status + ')');
    sync();
    res.json(r);
  });

  app.post('/api/office/bank/bevoegdheid', officeAuth, (req, res) => veilig(res, () => kern.bevoegd.matrix({ land: req.body.land })));
  app.post('/api/office/bank/vergunning', boardroomAuth, (req, res) => veilig(res, () => {
    const r = kern.bankVergunningZet({ soort: req.body.soort, nummer: req.body.nummer, entiteit: req.body.entiteit,
      landen: req.body.landen, tot: req.body.tot, wie: naam(req) });
    if (r.ok) {
      afdelingen.audit(naam(req), r.vergunning
        ? 'RTG Bank-vergunning vastgelegd: ' + r.vergunning.soort + ' (' + (r.vergunning.nummer || 'zonder nummer') + ')'
        : 'RTG Bank-vergunning INGETROKKEN -- de eigen rails clearen niet meer');
      sync();
    }
    return r;
  }));
  app.post('/api/office/bank/partnerrail', officeAuth, (req, res) => veilig(res, () => {
    const r = kern.bankPartnerRailZet({ rail: String(req.body.rail || ''), aan: req.body.aan === true });
    if (r.ok) { afdelingen.audit(naam(req), 'Partnerrail ' + req.body.rail + ' ' + (req.body.aan === true ? 'aan' : 'uit')); sync(); }
    return r;
  }));
};
