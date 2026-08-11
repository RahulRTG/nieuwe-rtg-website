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
  /* De paden staan voluit en niet als '/api/member/bureau/' + pad. Een opgebouwd pad
     ziet scripts/schakelbaar.js niet, en wat die census niet ziet is vanuit de
     boardroom niet uit te zetten en niet per stad te sluiten (scripts/check.js
     regel 45). De pas-eis en het vangnet blijven op EEN plek; alleen de
     registratie is uitgeschreven. */
  const doe = (werk) => async (req, res) => {
    if (!eis(req, res)) return;
    try { stuur(res, await werk(req.session.key, req.body || {})); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };

  // het openingsscherm: kop, regels, vensters, plattegrond
  app.post('/api/member/bureau/overzicht', auth, doe((k) => B.overzicht(k)));
  app.post('/api/member/bureau/nu', auth, doe((k) => B.nu(k)));
  app.post('/api/member/bureau/ai', auth, doe((k, b) => B.ai(k, b.vraag)));

  // de Control Tower
  app.post('/api/member/bureau/tower', auth, doe((k) => B.tower(k)));
  app.post('/api/member/bureau/termijnen', auth, doe((k) => ({ status: 200, termijnen: B.termijnen(k) })));

  /* De Life Graph. Het lid ziet zijn EIGEN kring en dus alles -- de filtering op
     'rechterhand'/'kantoor' bestaat voor de andere kant van de lijn, niet voor
     hem. Dat staat hier expliciet en niet als weggelaten argument, want een
     standaardwaarde die toevallig goed uitpakt is geen besluit. */
  app.post('/api/member/bureau/graaf', auth, doe((k) => ({ status: 200, graaf: B.graaf(k, 'lid') })));
  app.post('/api/member/bureau/knoop', auth, doe((k, b) => B.knoop(k, String(b.id || ''))));
  app.post('/api/member/bureau/kamers', auth, doe((k) => B.kamers(k)));

  // delegatie: wat mag het kantoor zelf
  app.post('/api/member/bureau/delegatie', auth, doe((k) => B.delegatie(k)));
  app.post('/api/member/bureau/delegatie/zet', auth, doe((k, b) => B.delegatieZet(k, b)));

  /* De orkestratie: "wij gaan zes weken weg" -- wat raakt dat nog meer? Los van
     een zaak opvraagbaar, want het lid wil eerst weten wat het raakt en dan pas
     beslissen of hij ons erop zet. */
  app.post('/api/member/bureau/raakvlak', auth, doe((k, b) => B.raakvlak(k, b)));
  // de ochtend- en avondbriefing: een bericht per keer, geen zevenendertig
  app.post('/api/member/bureau/briefing', auth, doe((k, b) => B.briefing(k, b.moment === 'avond' ? 'avond' : 'ochtend')));

  /* De woningtweeling: ruimtes en installaties onder een woning uit uw register.
     Hun onderhouds- en garantiedatums lopen langs dezelfde Control Tower als al
     het andere; deze routes vullen hem alleen. */
  app.post('/api/member/bureau/twin', auth, doe((k, b) => B.twin(k, String(b.huisId || ''))));
  app.post('/api/member/bureau/twin/ruimte', auth, doe((k, b) => B.twinRuimte(k, b)));
  app.post('/api/member/bureau/twin/ruimte/weg', auth, doe((k, b) => B.twinRuimteWeg(k, b)));
  app.post('/api/member/bureau/twin/installatie', auth, doe((k, b) => B.twinInstallatie(k, b)));
  app.post('/api/member/bureau/twin/installatie/weg', auth, doe((k, b) => B.twinInstallatieWeg(k, b)));
  app.post('/api/member/bureau/twin/beurt', auth, doe((k, b) => B.twinBeurt(k, b)));

  /* ---- De zes kamers die er als laatste bij kwamen ----
     Beveiliging, reputatie en dieren waren de drie die op de plattegrond nog als
     "in aanbouw" stonden; collectie, relaties en reisdek maken drie kamers af
     die er wel waren maar dun. Alle zes leveren hun datums in bij dezelfde
     Control Tower; deze routes vullen hem alleen. */
  app.post('/api/member/bureau/beveiliging', auth, doe((k) => B.beveiliging(k)));
  app.post('/api/member/bureau/beveiliging/post', auth, doe((k, b) => B.bvPost(k, b)));
  app.post('/api/member/bureau/beveiliging/post/weg', auth, doe((k, b) => B.bvPostWeg(k, String(b.id || ''))));
  app.post('/api/member/bureau/beveiliging/risico', auth, doe((k, b) => B.bvRisico(k, b)));
  app.post('/api/member/bureau/beveiliging/risico/weg', auth, doe((k, b) => B.bvRisicoWeg(k, String(b.id || ''))));
  app.post('/api/member/bureau/beveiliging/digitaal', auth, doe((k, b) => B.bvDigitaal(k, b)));
  app.post('/api/member/bureau/beveiliging/digitaal/weg', auth, doe((k, b) => B.bvDigitaalWeg(k, String(b.id || ''))));
  // een incident wordt een warroom-zaak; zie kern/bureau/beveiliging.js
  app.post('/api/member/bureau/beveiliging/incident', auth, doe((k, b) => B.bvIncident(k, b)));

  app.post('/api/member/bureau/reputatie', auth, doe((k) => B.reputatie(k)));
  app.post('/api/member/bureau/reputatie/optreden', auth, doe((k, b) => B.rpOptreden(k, b)));
  app.post('/api/member/bureau/reputatie/optreden/weg', auth, doe((k, b) => B.rpOptredenWeg(k, String(b.id || ''))));
  app.post('/api/member/bureau/reputatie/lijn', auth, doe((k, b) => B.rpLijn(k, b)));
  app.post('/api/member/bureau/reputatie/lijn/weg', auth, doe((k, b) => B.rpLijnWeg(k, String(b.id || ''))));
  app.post('/api/member/bureau/reputatie/woordvoerder', auth, doe((k, b) => B.rpWoordvoerder(k, b)));
  app.post('/api/member/bureau/reputatie/woordvoerder/weg', auth, doe((k, b) => B.rpWoordvoerderWeg(k, String(b.id || ''))));
  app.post('/api/member/bureau/reputatie/vermelding', auth, doe((k, b) => B.rpVermelding(k, b)));
  app.post('/api/member/bureau/reputatie/vermelding/weg', auth, doe((k, b) => B.rpVermeldingWeg(k, String(b.id || ''))));

  app.post('/api/member/bureau/dieren', auth, doe((k) => B.dieren(k)));
  app.post('/api/member/bureau/dieren/dier', auth, doe((k, b) => B.drDier(k, b)));
  app.post('/api/member/bureau/dieren/dier/weg', auth, doe((k, b) => B.drDierWeg(k, String(b.id || ''))));
  app.post('/api/member/bureau/dieren/document', auth, doe((k, b) => B.drDocument(k, b)));
  app.post('/api/member/bureau/dieren/document/weg', auth, doe((k, b) => B.drDocumentWeg(k, b)));
  app.post('/api/member/bureau/dieren/zorg', auth, doe((k, b) => B.drZorg(k, b)));
  app.post('/api/member/bureau/dieren/zorg/weg', auth, doe((k, b) => B.drZorgWeg(k, b)));

  app.post('/api/member/bureau/collectie', auth, doe((k, b) => B.collectie(k, String(b.bezitId || ''))));
  app.post('/api/member/bureau/collectie/herkomst', auth, doe((k, b) => B.colHerkomst(k, b)));
  app.post('/api/member/bureau/collectie/herkomst/weg', auth, doe((k, b) => B.colHerkomstWeg(k, b)));
  app.post('/api/member/bureau/collectie/taxatie', auth, doe((k, b) => B.colTaxatie(k, b)));
  app.post('/api/member/bureau/collectie/taxatie/weg', auth, doe((k, b) => B.colTaxatieWeg(k, b)));
  app.post('/api/member/bureau/collectie/conditie', auth, doe((k, b) => B.colConditie(k, b)));
  app.post('/api/member/bureau/collectie/bruikleen', auth, doe((k, b) => B.colBruikleen(k, b)));
  app.post('/api/member/bureau/collectie/terug', auth, doe((k, b) => B.colTerug(k, b)));

  app.post('/api/member/bureau/relaties', auth, doe((k, b) => B.relaties(k, String(b.relatieId || ''))));
  app.post('/api/member/bureau/relaties/band', auth, doe((k, b) => B.relBand(k, b)));
  app.post('/api/member/bureau/relaties/band/weg', auth, doe((k, b) => B.relBandWeg(k, b)));
  app.post('/api/member/bureau/relaties/ontmoeting', auth, doe((k, b) => B.relOntmoeting(k, b)));
  app.post('/api/member/bureau/relaties/ontmoeting/weg', auth, doe((k, b) => B.relOntmoetingWeg(k, b)));
  app.post('/api/member/bureau/relaties/context', auth, doe((k, b) => B.relContext(k, b)));

  app.post('/api/member/bureau/reisdek', auth, doe((k, b) => B.reisdek(k, String(b.reisId || ''))));
  app.post('/api/member/bureau/reisdek/verstoring', auth, doe((k, b) => B.rdVerstoring(k, b)));
  app.post('/api/member/bureau/reisdek/verstoring/weg', auth, doe((k, b) => B.rdVerstoringWeg(k, b)));
  app.post('/api/member/bureau/reisdek/gevolg', auth, doe((k, b) => B.rdGevolg(k, b)));
  app.post('/api/member/bureau/reisdek/bon', auth, doe((k, b) => B.rdBon(k, b)));
  app.post('/api/member/bureau/reisdek/vergeten', auth, doe((k, b) => B.rdVergeten(k, b)));
  app.post('/api/member/bureau/reisdek/punten', auth, doe((k, b) => B.rdPunten(k, b)));

  // zaken (cases)
  app.post('/api/member/bureau/zaken', auth, doe((k) => B.cases(k)));
  app.post('/api/member/bureau/zaak/open', auth, doe((k, b) => B.caseOpen(k, b)));
  app.post('/api/member/bureau/zaak/beslis', auth, doe((k, b) => B.caseBeslis(k, String(b.id || ''), b.akkoord === true)));
  app.post('/api/member/bureau/zaak/intrek', auth, doe((k, b) => B.caseIntrek(k, String(b.id || ''))));
};
