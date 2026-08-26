/* RTG KOSTPRIJS -- de endpoints. Drie lezers, één bron (kern/kosten/).

     het LID           ziet wat het zelf kost, en wie dat betaalt
     de ZAAK           hetzelfde, op zijn zaakcode
     het KANTOOR       alle gebruikers, de dekking, en de doorbelasting

   WAT HET KANTOOR ZIET ZIJN GEEN NAMEN. De lijst draait op sessiesleutels,
   zaakcodes en gezinscodes -- dezelfde handvatten waar de facturen al mee
   werken. Wie de naam achter een codenaam wil, gaat langs de identiteitskluis,
   met de reden en het inzagejournaal die daar horen. Deze routes zijn geen
   achterdeur daaromheen.

   EEN LID ZIET ALTIJD ZIJN EIGEN REGEL EN NOOIT DIE VAN EEN ANDER. De drager
   komt uit de SESSIE en nooit uit het lichaam van het verzoek; er is met opzet
   geen parameter om iemand anders op te vragen. Zonder die regel zou dit
   endpoint het verbruik van elk lid uitleesbaar maken met een gok naar een
   sleutel.

   ALLEEN DE BOARDROOM ZET TARIEVEN EN GEEFT VRIJ. Een tarief bepaalt wat er op
   andermans rekening komt, en vrijgeven zet die rekening klaar; dat is geen
   handeling voor een gewone kantoormedewerker. Vandaar boardroomAuth en niet
   officeAuth. */
module.exports = (kern) => {
  const { app, auth, geenGast, supplierAuth, boardroomAuth, boardroomWie, kosten } = kern;

  const maand = (b) => {
    const p = String((b && b.periode) || '').trim();
    return /^\d{4}-\d{2}$/.test(p) ? p : kosten.periodeVan();
  };

  /* Het eigen beeld, voor een lid of voor een zaak. Eén functie, want het
     verschil tussen die twee is alleen de drager -- en twee kopieën van dit
     antwoord zouden op een dag iets anders zeggen over hetzelfde. */
  function eigenBeeld(drager, periode) {
    const o = kosten.voorDrager(periode, drager);
    const dek = kosten.dekkingVoor(periode, drager);
    /* Alleen de stand van DEZE gebruiker, en niet het hele voorstel waar hij
       uitgevist wordt: dat laatste rekent bij elke paginaweergave de maand van
       alle gebruikers door. */
    const stand = kosten.standVoor(periode, drager);
    return {
      ok: true, periode, overzicht: o, dekking: dek,
      wieBetaalt: { stand: stand.stand, uitleg: stand.uitleg, opDeRekening: !!stand.factureren,
        waaromNiet: stand.waaromNiet },
      /* Wat dit overzicht NIET zegt, staat er even groot bij. Een kostenbeeld
         dat alleen zijn eigen getallen toont, leest als volledig -- en dat is
         het niet zolang er soorten zijn die niemand meet. */
      zegtNiet: {
        nietGemeten: o.nietGemeten,
        toegerekend: 'Elektriciteit en serverhuur zijn niet per gebruiker te meten. Wat daarvan bij u staat, is een verdeling van de echte nota naar uw gemeten verbruik, en draagt daarom de graad "vermoed".'
      }
    };
  }

  // ---------- het lid ----------
  app.post('/api/kosten/mij', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const p = maand(req.body);
    res.json(eigenBeeld(kosten.drager('lid', req.session.key), p));
  });

  // ---------- de zaak ----------
  app.post('/api/supplier/kosten', supplierAuth, (req, res) => {
    const p = maand(req.body);
    res.json(eigenBeeld(kosten.drager('zaak', req.supplier.code), p));
  });

  // ---------- het kantoor ----------
  /* Het huisbeeld: wie kost wat, dekt het zichzelf, en klopt onze eigen
     optelsom met de nota's die we echt hebben betaald. Die laatste is de
     zelfcontrole en staat er met opzet in hetzelfde antwoord: een kostenbeeld
     zonder afstemming vertelt je niet dat het misschien de helft mist. */
  app.post('/api/office/kosten/overzicht', boardroomAuth, (req, res) => {
    const p = maand(req.body);
    res.json({ ok: true, periode: p, perioden: kosten.perioden(),
      gebruikers: kosten.alleDragers(p),
      dekking: kosten.dekkingHuis(p),
      afstemming: kosten.afstemming(p),
      verdeling: kosten.verdeling(p).regels,
      nietGemeten: kosten.nietGemeten(p),
      ontbreekt: { tarieven: kosten.ontbrekendeTarieven(), nota: kosten.ontbrekendeNota(p) } });
  });

  app.post('/api/office/kosten/gebruiker', boardroomAuth, (req, res) => {
    const drager = String((req.body || {}).drager || '').trim();
    if (!drager) return res.status(400).json({ error: 'Geen gebruiker opgegeven.' });
    res.json(eigenBeeld(drager, maand(req.body)));
  });

  app.post('/api/office/kosten/tarieven', boardroomAuth, (req, res) => {
    res.json({ ok: true, tarieven: kosten.tarieven(), soorten: kosten.SOORTEN, graden: kosten.GRAAD });
  });

  app.post('/api/office/kosten/tarief/zet', boardroomAuth, (req, res) => {
    const b = req.body || {};
    const r = kosten.tariefZet(b.soort, b.perEenheid, b.bron, boardroomWie(req));
    res.status(r.status || 200).json(r);
  });

  app.post('/api/office/kosten/nota', boardroomAuth, (req, res) => {
    const p = maand(req.body);
    res.json({ ok: true, periode: p, posten: kosten.posten(p), ontbreekt: kosten.ontbrekendeNota(p) });
  });

  app.post('/api/office/kosten/nota/zet', boardroomAuth, (req, res) => {
    const b = req.body || {};
    const r = kosten.postZet(maand(b), b.soort, b.centen, b.bron, boardroomWie(req));
    res.status(r.status || 200).json(r);
  });

  app.post('/api/office/kosten/beleid', boardroomAuth, (req, res) => {
    res.json({ ok: true, beleid: kosten.beleid(), drempelCenten: kosten.DREMPEL_CENTEN });
  });

  app.post('/api/office/kosten/beleid/zet', boardroomAuth, (req, res) => {
    const b = req.body || {};
    const r = kosten.beleidZet(b.pas, b.stand, b.reden, boardroomWie(req));
    res.status(r.status || 200).json(r);
  });

  app.post('/api/office/kosten/voorstel', boardroomAuth, (req, res) => {
    res.json(Object.assign({ ok: true }, kosten.voorstel(maand(req.body))));
  });

  /* Vrijgeven: hier gaat er echt iets naar de rekening van een mens. Daarom een
     aparte route met een eigen handeling, de naam van wie het deed eronder, en
     één keer per maand. Dit is het moment waar GELD.md par. 3 over gaat: de
     machine zet klaar, een mens bevestigt. */
  app.post('/api/office/kosten/vrijgeven', boardroomAuth, (req, res) => {
    const r = kosten.vrijgeven(maand(req.body), boardroomWie(req));
    res.status(r.status || 200).json(r);
  });
};
