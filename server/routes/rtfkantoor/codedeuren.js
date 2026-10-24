/* RTF-kantoor, deel "codedeuren": de zes routes die binnenlaten op een CODE in
   het lijf -- het clubportaal, de clubberichten en de vier stadsraad-routes van
   de partner -- en sinds 19 oktober 2026 ook een account vragen, plus de twee
   kantoorroutes die die codes roteren.

   Waarom apart: dit zijn de enige publieke deuren van dit domein, en de rem
   eromheen heeft meer uitleg nodig dan de routes zelf. Afgesplitst toen
   index.js de 10 KB passeerde; de rest van het RTF-kantoor zit achter de
   office-inlog en heeft met dit bestand niets te maken.

   ---------- DE REM ----------

   Deze routes hadden geen enkele rem, dus de sterkte hing volledig aan de
   LENGTE van de code. Gevonden bij het dichten van keuringsregel 28, waar ze
   als "publiek met reden" op de lijst kwamen.

   WAT DE CODE WAARD IS ZONDER REM. CLUB-/RAAD- plus zes tekens uit een alfabet
   van 32 is 32^6 = ruim een miljard. Klinkt veilig, maar raden gaat niet tegen
   EEN code: elke poging wordt getoetst aan ALLE clubs tegelijk (vindCode zoekt
   in de lijst). Bij honderd clubs is de kans per poging dus honderd keer zo
   groot en heb je gemiddeld ~10,7 miljoen pogingen nodig. Met tweeduizend
   verzoeken per seconde is dat anderhalf uur.

   TWEE REMMEN, EN ZE DOEN NIET HETZELFDE.

   1. PER BRON (twintig per minuut). Dit is de rem die het afgrazen stopt: die
      10,7 miljoen pogingen worden er twintig per minuut, oftewel een jaar per
      bron. Bewust NIET per ip+code -- dat was mijn eerste versie en die was
      precies verkeerd om: wie elke poging een andere code gebruikt krijgt dan
      voor elke poging een verse bak, en dat is nou juist de aanvaller die je
      wilde vangen. Een sleutel mag niet meebewegen met wat de aanvaller
      varieert. (De mutatie die dat aantoont staat in test/rtfcoderem.test.js:
      zet de sleutel terug op ip+code en twee toetsen zakken.)
   2. PER CODE (zestig per minuut). Deze begrenst het omgekeerde: veel bronnen
      op EEN code. Dat mag hier op de code alleen staan, anders dan bij een
      inlog: wie de clubcode kent is al binnen, dus er valt niemand buiten te
      sluiten die er wel bij hoort. Regel 7 gaat over de grendel op het doel;
      hier is de code het doel EN het geheim tegelijk, en daarom heeft hij
      allebei de tellers nodig.

   Twintig per minuut is ruim voor een portaal dat je een keer opent en krap
   voor een raadmachine.

   WAT GEEN VAN BEIDE REMMEN TEGENHOUDT: een botnet van duizend adressen dat
   samen twintigduizend verse codes per minuut probeert. Daar is de rem het
   verkeerde gereedschap voor; dat vraagt om intrekbare codes met een
   vervaldatum, en dat staat op de lijst (taak 22) en niet in dit bestand. */
const rem = require('../../rem');

module.exports = (ctx) => {
  const { app, auth, officeAuth, boardroomWie, db, save, veilig, rtfclubs, stadsraad } = ctx;
  /* EEN ACCOUNT EN EEN CODE (eigenaarsbesluit 19 oktober 2026: gebruiken vraagt
     een account). De club en de stadsraadpartner maken een gratis account; de
     code koppelt dat account de eerste keer aan het dossier en is daarna een
     extra sleutel naast de sessie, nooit in plaats ervan (kern/codekoppel.js). */
  const koppel = require('../../kern/codekoppel')({ db, save });

  const codeVan = req => String((req.body && req.body.code) || '').trim().slice(0, 40).toUpperCase();
  const ipRem = rem({ windowMs: 60000, limit: 20, key: req => 'rtfcode-ip|' + String(req.ip) });
  const codeRem = rem({ windowMs: 60000, limit: 60, key: req => 'rtfcode|' + codeVan(req) });

  // het clubportaal: de club zelf, op de eigen clubcode (alleen het eigen dossier)
  app.post('/api/rtf/club/portaal', auth, ipRem, codeRem, (req, res) =>
    veilig(res, () => koppel.met(req, 'club', codeVan(req), () => rtfclubs.portaal(req.body.code))));
  app.post('/api/rtf/club/bericht', auth, ipRem, codeRem, (req, res) =>
    veilig(res, () => koppel.met(req, 'club', codeVan(req), () => rtfclubs.berichtClub(req.body.code, req.body.naam, req.body.tekst))));

  // het partnerportaal: op raadcode; de partner stemt namens zijn stad
  const metPartner = (req, res, werk) => {
    const p = stadsraad.vindCode(req.body.code);
    if (!p) return res.status(404).json({ error: 'Deze raadcode kennen we niet. Vraag het RTF-kantoor om de code.' });
    veilig(res, () => koppel.met(req, 'raad', codeVan(req), () => werk(p)));
  };
  app.post('/api/rtf/partner/raad', auth, ipRem, codeRem, (req, res) =>
    veilig(res, () => koppel.met(req, 'raad', codeVan(req), () => stadsraad.portaal(req.body.code))));
  app.post('/api/rtf/partner/besluit-start', auth, ipRem, codeRem, (req, res) => metPartner(req, res, p => stadsraad.besluitStart(req.body.projectId, req.body.voorstel, p.naam + ' (' + p.stad + ')', 'partner')));
  app.post('/api/rtf/partner/stem', auth, ipRem, codeRem, (req, res) => metPartner(req, res, p => stadsraad.stem(String(req.body.besluitId || ''), 'partner', p.naam + ' (' + p.stad + ')', req.body.voor === true)));
  app.post('/api/rtf/partner/besluit-sluit', auth, ipRem, codeRem, (req, res) => metPartner(req, res, () => stadsraad.besluitSluit(String(req.body.besluitId || ''))));

  /* ROTEREN (eigenaarsbesluit 19 oktober 2026): een kantoormens OP NAAM geeft een
     nieuwe club- of raadcode; de gedeelde kantoorcode niet, net als bij een stem
     in de stadsraad. De oude code gaat dicht voor iedereen, en de koppeling die
     eraan hing vervalt. */
  const opNaam = (req, res, werk) => {
    if (!boardroomWie(req)) return res.status(403).json({ error: 'Een code roteren doet een mens op naam, niet de gedeelde kantoorcode. Log in met uw eigen RTG-account.' });
    veilig(res, werk);
  };
  app.post('/api/rtfkantoor/club/code/roteren', officeAuth, (req, res) => opNaam(req, res, () => {
    const id = String((req.body || {}).id || ''); const oud = rtfclubs.codeVan(id);
    const r = rtfclubs.codeRoteer(id); if (r && r.ok) koppel.vervalt('club', oud); return r;
  }));
  app.post('/api/rtfkantoor/stadsraad/partner-code/roteren', officeAuth, (req, res) => opNaam(req, res, () => {
    const id = String((req.body || {}).id || ''); const oud = stadsraad.partnerCodeVan(id);
    const r = stadsraad.partnerCodeRoteer(id); if (r && r.ok) koppel.vervalt('raad', oud); return r;
  }));
};
