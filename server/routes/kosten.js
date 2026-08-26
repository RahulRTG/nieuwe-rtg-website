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
  const { app, auth, geenGast, supplierAuth, kosten } = kern;
  /* Het antwoord zelf staat in ./kosten-beeld.js: een lid, een zaak en het
     kantoor krijgen hetzelfde beeld, alleen de vraag wie erom mag vragen
     verschilt. */
  const eigenBeeld = require('./kosten-beeld')(kosten);

  const maand = (b) => {
    const p = String((b && b.periode) || '').trim();
    return /^\d{4}-\d{2}$/.test(p) ? p : kosten.periodeVan();
  };

  // ---------- het lid ----------
  app.post('/api/kosten/mij', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const p = maand(req.body);
    res.json(eigenBeeld(kosten.drager('lid', req.session.key), p));
  });

  /* WAT WORDT HET DEZE MAAND. Los van /mij, want dit is een andere vraag: dat
     antwoord gaat over wat er GEBEURD is, dit over wat er waarschijnlijk nog
     komt. De band eromheen bestaat alleen als de trefzekerheid gemeten is; zie
     kern/kosten/vooruitblik.js voor waarom dat geen voorzichtigheid is. */
  app.post('/api/kosten/vooruitblik', auth, (req, res) => {
    if (geenGast(req, res)) return;
    res.json(Object.assign({ ok: true },
      kosten.vooruitblik(maand(req.body), kosten.drager('lid', req.session.key))));
  });

  /* "WAAROM BETAAL IK DIT?" -- de keten van dit bedrag terug naar de factuur van
     onze eigen leverancier. De drager komt uit de SESSIE en nooit uit het
     lichaam; er is met opzet geen parameter om die van een ander op te vragen.
     De tegenhanger voor het kantoor staat in ./kosten-kantoor.js. */
  app.post('/api/kosten/herkomst', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    const r = kosten.herkomst(maand(b), kosten.drager('lid', req.session.key), b.soort);
    res.status(r.status || 200).json(r);
  });

  /* DE EIGEN VERBRUIKSGRENS. Een lid zet hem voor zichzelf; het kantoor heeft
     een eigen slot (./kosten-kantoor.js) en de strengste van de twee wint. Wie
     hier de kantoorgrens zou kunnen ophogen, heeft geen kantoorgrens. */
  app.post('/api/kosten/grens', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const drager = kosten.drager('lid', req.session.key);
    res.json({ ok: true, grens: kosten.grensVoor(drager), stand: kosten.grensStand(drager) });
  });

  app.post('/api/kosten/grens/zet', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {};
    const r = kosten.grensZet(kosten.drager('lid', req.session.key),
      { waarschuwCenten: b.waarschuwCenten, plafondCenten: b.plafondCenten }, 'zelf', req.session.key);
    res.status(r.status || 200).json(r);
  });

  // ---------- de zaak ----------
  app.post('/api/supplier/kosten', supplierAuth, (req, res) => {
    const p = maand(req.body);
    res.json(eigenBeeld(kosten.drager('zaak', req.supplier.code), p));
  });
};
