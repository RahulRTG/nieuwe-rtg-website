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

  /* ---- De zes kamers die er als laatste bij kwamen ----
     Beveiliging, reputatie en dieren waren de drie die op de plattegrond nog als
     "in aanbouw" stonden; collectie, relaties en reisdek maken drie kamers af
     die er wel waren maar dun. Alle zes leveren hun datums in bij dezelfde
     Control Tower; deze routes vullen hem alleen. */
  route('beveiliging', (k) => B.beveiliging(k));
  route('beveiliging/post', (k, b) => B.bvPost(k, b));
  route('beveiliging/post/weg', (k, b) => B.bvPostWeg(k, String(b.id || '')));
  route('beveiliging/risico', (k, b) => B.bvRisico(k, b));
  route('beveiliging/risico/weg', (k, b) => B.bvRisicoWeg(k, String(b.id || '')));
  route('beveiliging/digitaal', (k, b) => B.bvDigitaal(k, b));
  route('beveiliging/digitaal/weg', (k, b) => B.bvDigitaalWeg(k, String(b.id || '')));
  // een incident wordt een warroom-zaak; zie kern/bureau/beveiliging.js
  route('beveiliging/incident', (k, b) => B.bvIncident(k, b));

  route('reputatie', (k) => B.reputatie(k));
  route('reputatie/optreden', (k, b) => B.rpOptreden(k, b));
  route('reputatie/optreden/weg', (k, b) => B.rpOptredenWeg(k, String(b.id || '')));
  route('reputatie/lijn', (k, b) => B.rpLijn(k, b));
  route('reputatie/lijn/weg', (k, b) => B.rpLijnWeg(k, String(b.id || '')));
  route('reputatie/woordvoerder', (k, b) => B.rpWoordvoerder(k, b));
  route('reputatie/woordvoerder/weg', (k, b) => B.rpWoordvoerderWeg(k, String(b.id || '')));
  route('reputatie/vermelding', (k, b) => B.rpVermelding(k, b));
  route('reputatie/vermelding/weg', (k, b) => B.rpVermeldingWeg(k, String(b.id || '')));

  route('dieren', (k) => B.dieren(k));
  route('dieren/dier', (k, b) => B.drDier(k, b));
  route('dieren/dier/weg', (k, b) => B.drDierWeg(k, String(b.id || '')));
  route('dieren/document', (k, b) => B.drDocument(k, b));
  route('dieren/document/weg', (k, b) => B.drDocumentWeg(k, b));
  route('dieren/zorg', (k, b) => B.drZorg(k, b));
  route('dieren/zorg/weg', (k, b) => B.drZorgWeg(k, b));

  route('collectie', (k, b) => B.collectie(k, String(b.bezitId || '')));
  route('collectie/herkomst', (k, b) => B.colHerkomst(k, b));
  route('collectie/herkomst/weg', (k, b) => B.colHerkomstWeg(k, b));
  route('collectie/taxatie', (k, b) => B.colTaxatie(k, b));
  route('collectie/taxatie/weg', (k, b) => B.colTaxatieWeg(k, b));
  route('collectie/conditie', (k, b) => B.colConditie(k, b));
  route('collectie/bruikleen', (k, b) => B.colBruikleen(k, b));
  route('collectie/terug', (k, b) => B.colTerug(k, b));

  route('relaties', (k, b) => B.relaties(k, String(b.relatieId || '')));
  route('relaties/band', (k, b) => B.relBand(k, b));
  route('relaties/band/weg', (k, b) => B.relBandWeg(k, b));
  route('relaties/ontmoeting', (k, b) => B.relOntmoeting(k, b));
  route('relaties/ontmoeting/weg', (k, b) => B.relOntmoetingWeg(k, b));
  route('relaties/context', (k, b) => B.relContext(k, b));

  route('reisdek', (k, b) => B.reisdek(k, String(b.reisId || '')));
  route('reisdek/verstoring', (k, b) => B.rdVerstoring(k, b));
  route('reisdek/verstoring/weg', (k, b) => B.rdVerstoringWeg(k, b));
  route('reisdek/gevolg', (k, b) => B.rdGevolg(k, b));
  route('reisdek/bon', (k, b) => B.rdBon(k, b));
  route('reisdek/vergeten', (k, b) => B.rdVergeten(k, b));
  route('reisdek/punten', (k, b) => B.rdPunten(k, b));

  // zaken (cases)
  route('zaken', (k) => B.cases(k));
  route('zaak/open', (k, b) => B.caseOpen(k, b));
  route('zaak/beslis', (k, b) => B.caseBeslis(k, String(b.id || ''), b.akkoord === true));
  route('zaak/intrek', (k, b) => B.caseIntrek(k, String(b.id || '')));
};
