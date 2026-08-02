/* RTF-kantoor, deel "codedeuren": de zes routes die binnenlaten op alleen een
   CODE in het lijf -- het clubportaal, de clubberichten en de vier
   stadsraad-routes van de partner.

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
  const { app, veilig, rtfclubs, stadsraad } = ctx;

  const codeVan = req => String((req.body && req.body.code) || '').trim().slice(0, 40).toUpperCase();
  const ipRem = rem({ windowMs: 60000, limit: 20, key: req => 'rtfcode-ip|' + String(req.ip) });
  const codeRem = rem({ windowMs: 60000, limit: 60, key: req => 'rtfcode|' + codeVan(req) });

  // het clubportaal: de club zelf, op de eigen clubcode (alleen het eigen dossier)
  app.post('/api/rtf/club/portaal', ipRem, codeRem, (req, res) => veilig(res, () => rtfclubs.portaal(req.body.code)));
  app.post('/api/rtf/club/bericht', ipRem, codeRem, (req, res) => veilig(res, () => rtfclubs.berichtClub(req.body.code, req.body.naam, req.body.tekst)));

  // het partnerportaal: op raadcode; de partner stemt namens zijn stad
  const metPartner = (req, res, werk) => {
    const p = stadsraad.vindCode(req.body.code);
    if (!p) return res.status(404).json({ error: 'Deze raadcode kennen we niet. Vraag het RTF-kantoor om de code.' });
    veilig(res, () => werk(p));
  };
  app.post('/api/rtf/partner/raad', ipRem, codeRem, (req, res) => veilig(res, () => stadsraad.portaal(req.body.code)));
  app.post('/api/rtf/partner/besluit-start', ipRem, codeRem, (req, res) => metPartner(req, res, p => stadsraad.besluitStart(req.body.projectId, req.body.voorstel, p.naam + ' (' + p.stad + ')', 'partner')));
  app.post('/api/rtf/partner/stem', ipRem, codeRem, (req, res) => metPartner(req, res, p => stadsraad.stem(String(req.body.besluitId || ''), 'partner', p.naam + ' (' + p.stad + ')', req.body.voor === true)));
  app.post('/api/rtf/partner/besluit-sluit', ipRem, codeRem, (req, res) => metPartner(req, res, () => stadsraad.besluitSluit(String(req.body.besluitId || ''))));
};
