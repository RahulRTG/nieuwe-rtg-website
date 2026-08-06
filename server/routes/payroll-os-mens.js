/* Routes van Payroll OS: DE MEDEWERKER over zichzelf.

   Zijn eigen loonstroken met de uitleg erbij, zijn eigen dossier ("waarom kreeg
   ik dit bedrag") en zijn eigen inzagespoor (wie vroeg mijn papieren op, en
   waarom).

   DE GRENS DIE HIER NIET MAG VERVAGEN: het personeelsnummer komt uit de
   KOPPELING met zijn RTG-account en nooit uit het verzoek. Anders is andermans
   loonstrook een kwestie van een ander getal invullen.

   Afgesplitst van ./payroll-os-zaak.js, dat over de 10 KB ging. */
'use strict';

module.exports = (kern) => {
  const { app, auth, payrollOS, accounts, findSupplier } = kern;
  if (!payrollOS) return;

  /* Zijn eigen stroken, en de uitleg erbij. Het personeelsnummer komt uit de
     koppeling met het RTG-account, niet uit het verzoek. */
  app.post('/api/member/loonstroken', auth, (req, res) => {
    const lid = req.session && req.session.account ? req.session.account : null;
    if (!lid) return res.status(403).json({ error: 'Meld u aan met uw eigen RTG-account.' });
    const uit = [];
    for (const s of (accounts.staffPositions ? accounts.staffPositions(lid.id) : [])) {
      /* De naam van de zaak komt uit findSupplier en niet uit de personeelsrij:
         die draagt alleen supplier_code. Er stond `s.supplier_naam`, en dat veld
         bestaat niet -- dus viel het altijd terug op de code en las de
         medewerker "MERIDIAAN" boven zijn loonstrook in plaats van
         "Meridiaan Toren". Stil fout, want een code IS een string. */
      const zaak = findSupplier ? findSupplier(s.supplier_code) : null;
      for (const st of payrollOS.run.strokenVan(s.supplier_code, s.id)) {
        uit.push(Object.assign({ zaak: (zaak && zaak.name) || s.supplier_code }, st,
          { uitleg: legUit(st.strook) }));
      }
    }
    res.json({ ok: true, stroken: uit });
  });

  /* HET DOSSIER VAN DE MEDEWERKER ZELF. "Waarom kreeg ik dit bedrag" is zijn
     vraag en niet die van de accountant; het is dezelfde vraag 1 van de vier.
     Het personeelsnummer komt uit zijn koppeling en niet uit het verzoek --
     anders is andermans dossier een kwestie van een ander getal invullen. */
  app.post('/api/member/dossier', auth, (req, res) => {
    const lid = req.session && req.session.account ? req.session.account : null;
    if (!lid) return res.status(403).json({ error: 'Meld u aan met uw eigen RTG-account.' });
    const runId = String((req.body || {}).runId || '');
    const mijn = (accounts.staffPositions ? accounts.staffPositions(lid.id) : []);
    for (const s of mijn) {
      const d = payrollOS.dossier.vanMedewerker(runId, s.id);
      if (d && d.ok) return res.json(d);
    }
    res.status(404).json({ error: 'Deze loonstrook staat niet op uw naam.' });
  });

  /* WIE HEEFT ER IN MIJN PAPIEREN GEKEKEN. De opvraagkant bestond al (de
     werkgever ziet ja/nee en kan om gegevens of een kopie vragen, met reden),
     en elke opvraag werd genoteerd -- maar de betrokkene kon er nergens bij.
     Een spoor dat alleen de aanvrager kan lezen is geen spoor maar een archief.

     De reden gaat mee, en dat is met opzet: "er is naar uw paspoort gekeken"
     zonder waarom is alleen verontrustend. */
  app.post('/api/member/identiteit/verzoeken', auth, (req, res) => {
    const lid = req.session && req.session.account ? req.session.account : null;
    if (!lid) return res.status(403).json({ error: 'Meld u aan met uw eigen RTG-account.' });
    /* De code omzetten naar de naam van de zaak. Een medewerker herkent
       "Bistro Nova", niet "SUP-4471". */
    const verzoeken = payrollOS.identiteit.mijnVerzoeken(lid.id).map(v => {
      const z = findSupplier ? findSupplier(v.bedrijf) : null;
      return Object.assign({}, v, { bedrijfNaam: (z && z.name) || v.bedrijf });
    });
    res.json({ ok: true, verzoeken });
  });

  /* "Je nettoloon is deze periode hoger door 12 nachturen en vakantiegeld."
     Een loonstrook die alleen bedragen toont, laat mensen raden; een zin die
     zegt WAAROM is het verschil tussen een pdf en een antwoord. */
  /* TWEE SOORTEN BASIS, want er zijn twee soorten contract. Wie op uren werkt
     leest "160 gewerkte uren"; wie een maandsalaris heeft leest "uw vaste
     loon". Hier stond alleen de eerste, en toen de loonrun eindelijk ook vast
     loon ging uitbetalen las een vaste kracht: "Dit bedrag komt uit uw vaste
     loon, plus basissalaris (2400,00)" -- zijn salaris twee keer genoemd, een
     keer als naam en een keer als bedrag. */
  const BASISSEN = ['gewerkte_uren', 'basissalaris'];

  function legUit(strook) {
    const zinnen = [];
    for (const r of strook.regels) {
      if (r.soort !== 'bruto' || BASISSEN.includes(r.component)) continue;
      zinnen.push(r.aantal != null
        ? r.aantal + ' ' + r.naam.toLowerCase() + ' (' + (r.centen / 100).toFixed(2) + ')'
        : r.naam.toLowerCase() + ' (' + (r.centen / 100).toFixed(2) + ')');
    }
    const uren = strook.regels.find(r => r.component === 'gewerkte_uren');
    const salaris = strook.regels.find(r => r.component === 'basissalaris');
    const kop = uren ? uren.aantal + ' gewerkte uren'
      : salaris ? 'uw vaste loon' : 'uw loon';
    return zinnen.length
      ? 'Dit bedrag komt uit ' + kop + ', plus ' + zinnen.join(' en ') + '. Daarvan gaat de loonheffing af.'
      : 'Dit bedrag komt uit ' + kop + '. Daarvan gaat de loonheffing af.';
  }
};
