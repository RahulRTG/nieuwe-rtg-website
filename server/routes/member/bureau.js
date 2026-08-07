/* Member-submodule: Het Privékantoor -- de ENE app van de Lifestyle Pass.
   Gated op de Lifestyle Pass (Business erft mee als hoger niveau). Alleen routes;
   de logica woont in kern/bureau/. Gemount vanuit routes/member.js.

   Dezelfde poort als de rest van de suite, en met opzet dezelfde VORM: één eis()
   bovenaan, elke route erlangs. Een poort die per route opnieuw wordt bedacht is
   een poort die er op een dag bij eentje niet staat. */
module.exports = (kern) => {
  const { app, auth } = kern;
  /* Alles van dit kantoor zit onder EEN kern-naam (zie kern/bureau/index.js):
     vierentwintig losse namen maakten de kern onnodig breed. */
  const B = kern.bureau;

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
  route('overzicht', (k) => B.overzicht(k));
  route('nu', (k) => B.nu(k));
  route('ai', (k, b) => B.ai(k, b.vraag));

  // de Control Tower
  route('tower', (k) => B.tower(k));
  route('termijnen', (k) => ({ status: 200, termijnen: B.termijnen(k) }));

  /* De Life Graph. Het lid ziet zijn EIGEN kring en dus alles -- de filtering op
     'rechterhand'/'kantoor' bestaat voor de andere kant van de lijn, niet voor
     hem. Dat staat hier expliciet en niet als weggelaten argument, want een
     standaardwaarde die toevallig goed uitpakt is geen besluit. */
  route('graaf', (k) => ({ status: 200, graaf: B.graaf(k, 'lid') }));
  route('knoop', (k, b) => B.knoop(k, String(b.id || '')));
  route('kamers', (k) => B.kamers(k));

  // delegatie: wat mag het kantoor zelf
  route('delegatie', (k) => B.delegatie(k));
  route('delegatie/zet', (k, b) => B.delegatieZet(k, b));

  /* De orkestratie: "wij gaan zes weken weg" -- wat raakt dat nog meer? Los van
     een zaak opvraagbaar, want het lid wil eerst weten wat het raakt en dan pas
     beslissen of hij ons erop zet. */
  route('raakvlak', (k, b) => B.raakvlak(k, b));
  // de ochtend- en avondbriefing: een bericht per keer, geen zevenendertig
  route('briefing', (k, b) => B.briefing(k, b.moment === 'avond' ? 'avond' : 'ochtend'));

  /* De woningtweeling: ruimtes en installaties onder een woning uit uw register.
     Hun onderhouds- en garantiedatums lopen langs dezelfde Control Tower als al
     het andere; deze routes vullen hem alleen. */
  route('twin', (k, b) => B.twin(k, String(b.huisId || '')));
  route('twin/ruimte', (k, b) => B.twinRuimte(k, b));
  route('twin/ruimte/weg', (k, b) => B.twinRuimteWeg(k, b));
  route('twin/installatie', (k, b) => B.twinInstallatie(k, b));
  route('twin/installatie/weg', (k, b) => B.twinInstallatieWeg(k, b));
  route('twin/beurt', (k, b) => B.twinBeurt(k, b));

  // zaken (cases)
  route('zaken', (k) => B.cases(k));
  route('zaak/open', (k, b) => B.caseOpen(k, b));
  route('zaak/beslis', (k, b) => B.caseBeslis(k, String(b.id || ''), b.akkoord === true));
  route('zaak/intrek', (k, b) => B.caseIntrek(k, String(b.id || '')));
};
