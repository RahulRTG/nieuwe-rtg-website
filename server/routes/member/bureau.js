/* Member-submodule: Het Privékantoor -- de ENE app van de Lifestyle Pass.
   Gated op de Lifestyle Pass (Business erft mee als hoger niveau). Alleen routes;
   de logica woont in kern/bureau/. Gemount vanuit routes/member.js.

   Dezelfde poort als de rest van de suite, en met opzet dezelfde VORM: één eis()
   bovenaan, elke route erlangs. Een poort die per route opnieuw wordt bedacht is
   een poort die er op een dag bij eentje niet staat. */
module.exports = (kern) => {
  const { app, auth,
    bureauOverzicht, bureauAI, bureauNu, bureauKnoop, bureauTower, bureauTermijnen,
    bureauGraaf, bureauKamers, bureauDelegatie, bureauDelegatieZet,
    bureauCases, bureauCaseOpen, bureauCaseBeslis, bureauCaseIntrek } = kern;

  function eis(req, res) {
    if (['lifestyle', 'business'].includes(req.session.tier)) return true;
    res.status(403).json({ error: 'Het Privékantoor is onderdeel van de Lifestyle Pass.' });
    return false;
  }
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  function route(pad, werk) {
    app.post('/api/member/bureau/' + pad, auth, async (req, res) => {
      if (!eis(req, res)) return;
      try { stuur(res, await werk(req.session.key, req.body || {})); }
      catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
    });
  }

  // het openingsscherm: kop, regels, vensters, plattegrond
  route('overzicht', (k) => bureauOverzicht(k));
  route('nu', (k) => bureauNu(k));
  route('ai', (k, b) => bureauAI(k, b.vraag));

  // de Control Tower
  route('tower', (k) => bureauTower(k));
  route('termijnen', (k) => ({ status: 200, termijnen: bureauTermijnen(k) }));

  /* De Life Graph. Het lid ziet zijn EIGEN kring en dus alles -- de filtering op
     'rechterhand'/'kantoor' bestaat voor de andere kant van de lijn, niet voor
     hem. Dat staat hier expliciet en niet als weggelaten argument, want een
     standaardwaarde die toevallig goed uitpakt is geen besluit. */
  route('graaf', (k) => ({ status: 200, graaf: bureauGraaf(k, 'lid') }));
  route('knoop', (k, b) => bureauKnoop(k, String(b.id || '')));
  route('kamers', (k) => bureauKamers(k));

  // delegatie: wat mag het kantoor zelf
  route('delegatie', (k) => bureauDelegatie(k));
  route('delegatie/zet', (k, b) => bureauDelegatieZet(k, b));

  // zaken (cases)
  route('zaken', (k) => bureauCases(k));
  route('zaak/open', (k, b) => bureauCaseOpen(k, b));
  route('zaak/beslis', (k, b) => bureauCaseBeslis(k, String(b.id || ''), b.akkoord === true));
  route('zaak/intrek', (k, b) => bureauCaseIntrek(k, String(b.id || '')));
};
