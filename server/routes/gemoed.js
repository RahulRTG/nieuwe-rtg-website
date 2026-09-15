/* Routes "gemoed": de dagcheck-in (kern/gemoed.js), met TWEE deuren naar
   dezelfde laag.

   DE LEDENDEUR (`auth`) stond er al. Alles daar staat op de sessiesleutel en
   verlaat het account niet: er is geen deelroute en geen kantoorkant. Dat is
   geen omissie maar het ontwerp.

   DE PERSONEELSDEUR (`supplierAuth`) is er in september 2026 bij gekomen, omdat
   ONDERNEMEN.md par. 7 een gat vond: personeel komt binnen op supplierAuth, dus
   een medewerker die geen RTG-lid is kon nergens bij zijn eigen dagcheck-in.

   ZE STAAN IN HETZELFDE BESTAND, en dat is een besluit met een reden. Een tweede
   routebestand dat dezelfde kernnamen leest, telt in scripts/grenzen.js als een
   KOPPELING tussen twee domeinen -- terwijl het hier om een en dezelfde laag met
   een tweede deur gaat. De meter leidt het domein af uit de bestandsnaam, dus
   twee bestanden betekent per definitie twee domeinen. Bij elkaar houden zegt
   dus de waarheid, en het houdt bovendien de privacygrens op EEN plek leesbaar.

   ER KOMT GEEN TWEEDE WELZIJNSLAAG BIJ. Dit bestand bevat geen enkele regel
   logica over stemming: kern/gemoed.js is sleutelgebaseerd (`gemoedVan(key)`) en
   kan dus zonder één letter verandering op een andere sleutel draaien. Zou hier
   iets worden nagebouwd, dan liggen er twee waarheden over hetzelfde dagboek
   (lat-regel 4) en gaat de grens uit zorgniveau.js maar door één ervan.

   DE WERKGEVER ZIET HIER NIETS, EN DAT IS AFDWINGBAAR GEMAAKT EN NIET BELOOFD.

     1. De sleutel is `staff:<zaak>:<staffId>` -- dezelfde vorm als de fluisterlaag
        hiernaast, dus per MENS en niet per zaak. De zaak heeft geen sleutel
        waarop iets van een medewerker staat.
     2. Elke route eist `req.actor.staffId`. Wie met het BEDRIJFSaccount inlogt
        heeft die niet en krijgt 403 -- dezelfde regel als bij de
        vertrouwenspersoon en de inzetbaarheid, en om dezelfde reden: juist de
        vrijstelling voor de baas is de deur waar dit misgaat.
     3. Er is geen route die meerdere mensen tegelijk toont, geen managerweg en
        geen telling. Die afwezigheid IS het ontwerp, niet een nog te bouwen stuk.

   WAT DEZE SLEUTEL NIET DOET, en dat hoort er hardop bij te staan: hij volgt het
   DIENSTVERBAND en niet de mens. Wie bij twee zaken werkt, heeft twee dagboeken,
   en wie later lid wordt krijgt een derde naast zijn ledendagboek. Dat is geen
   nalatigheid maar de enige eerlijke uitkomst: een medewerker die geen lid is
   heeft hier geen identiteit op persoonsniveau, en de twee alsnog aan elkaar
   knopen zou een werkidentiteit aan een privéaccount verbinden -- precies wat
   deze laag niet hoort te doen.

   EN LET OP DE VOLGORDE BIJ HET MONTEREN. opzet/routes.js hangt de staff-routes op VOOR kern/gemoed.js in
   de kern-tas ligt. Een destructuring daar bevriest `gemoedVan` als `undefined`
   op montagemoment -- de fout die CLAUDE.md optekent bij
   `const { openVacatures } = kern`, hier prompt herhaald en pas gevonden door
   een toets tegen een echte server (een 500 in plaats van een antwoord).
*/
module.exports = (kern) => {
  const { app, auth, supplierAuth, gemoedVan, gemoedZet, gemoedWeg } = kern;
  const stuur = (res, r) => { const { status, ...rest } = r; res.status(status || 200).json(rest); };

  /* ---------- de ledendeur ---------- */
  app.post('/api/gemoed', auth, (req, res) => stuur(res, gemoedVan(req.session.key)));
  app.post('/api/gemoed/zet', auth, (req, res) => stuur(res, gemoedZet(req.session.key, req.body || {})));
  app.post('/api/gemoed/weg', auth, (req, res) => stuur(res, gemoedWeg(req.session.key, req.body || {})));

  /* ---------- de personeelsdeur ---------- */

  /* Dezelfde vorm als ./dienst-fluister.js. Hij staat hier apart en wordt niet
     uit dat bestand geleend: twee lagen die toevallig dezelfde sleutel maken,
     horen dat allebei zelf op te schrijven -- anders verschuift de een als de
     ander wordt aangepast. */
  const staffKey = req => 'staff:' + req.supplier.code + ':' + req.actor.staffId;

  /* De persoonlijke login is de poort. Zonder staffId is er geen mens, en dan is
     er ook geen dagboek: het bedrijfsaccount krijgt hier niets, ook geen lege
     lijst -- die zou de indruk wekken dat er iets te zien valt. */
  function mens(req, res) {
    if (!req.actor || !req.actor.staffId) {
      res.status(403).json({ error: 'Alleen met een persoonlijke login. Dit is van jou, niet van de zaak.' });
      return false;
    }
    return true;
  }


  app.post('/api/staff/gemoed', supplierAuth, (req, res) => {
    if (!mens(req, res)) return;
    stuur(res, gemoedVan(staffKey(req)));
  });
  app.post('/api/staff/gemoed/zet', supplierAuth, (req, res) => {
    if (!mens(req, res)) return;
    stuur(res, gemoedZet(staffKey(req), req.body || {}));
  });
  app.post('/api/staff/gemoed/weg', supplierAuth, (req, res) => {
    if (!mens(req, res)) return;
    stuur(res, gemoedWeg(staffKey(req), req.body || {}));
  });
};
