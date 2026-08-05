/* De route van de adresopzoeker: postcode en huisnummer erin, straat,
   woonplaats en land eruit (kern/adresopzoek.js, met de PDOK Locatieserver van
   het Kadaster als bron).

   HET ANTWOORD IS EEN VOORSTEL. Deze route bewaart NIETS. Wat de bron teruggeeft
   gaat naar het scherm, het scherm toont het, en pas als het lid bevestigt gaat
   het via de gewone weg de kluis in (/api/gegevens/zeg voor de adresstap,
   /api/onboarding/opslaan voor de intake). Wie hier ooit een opslag bij zet,
   bewaart iets wat niemand heeft gezien.

   ACHTER DE LEDEN-POORT, want dit is voor leden die een adres invullen -- en
   omdat een open doorgeefluik naar een gratis overheidsdienst vroeg of laat
   iemands scraper wordt.

   TWEE REMMEN, EN ZE DOEN NIET HETZELFDE. Deze hier telt per LID (de
   sessiesleutel, niet het IP: achter een kantoor-NAT delen collega's anders
   ongemerkt een emmer) en houdt een vastgelopen scherm tegen dat in een lus
   blijft opzoeken; toets 18 zet er twee verschillende leden vanaf hetzelfde IP
   op. De tweede zit in de kern en hangt aan de BRON zelf (LAT.md regel 7): een
   account kost hier een e-mailadres, dus wie er tien maakt koopt tien keer de
   rem hieronder, maar niet meer verkeer richting PDOK.

   EEN opzoeker per proces, en met opzet: de cache en het bronbudget zijn maar
   iets waard als iedereen dezelfde gebruikt. Wie deze functie elders nodig heeft
   (Rahul in een gesprek, een ander scherm) haalt hem hier op en maakt geen
   tweede.

   Er komt bewust GEEN gegevenspoort voor: die vraagt gegevens VAN het lid zodra
   er een derde partij bij komt, en hier gaat het precies de andere kant op --
   er wordt niets van het lid gedeeld (alleen de postcode en het huisnummer die
   het net zelf intikte) en er wordt niets besteld, geboekt of bezorgd. */
module.exports = (kern) => {
  const { app, auth } = kern;
  const rem = require('../rem');
  const { log } = require('../log');
  const opzoek = require('../kern/adresopzoek').maakAdresopzoek();
  kern.adresZoek = opzoek.zoek;

  const remmer = rem({
    windowMs: 60000, limit: 20,
    key: req => 'adres:' + ((req.session && req.session.key) || req.ip),
    handler: (req, res) => res.status(429).json({
      gevonden: false, reden: 'druk',
      tekst: 'Even rustig aan met opzoeken. Vul je adres zo nodig met de hand in.'
    })
  });

  app.post('/api/adres/zoek', auth, remmer, async (req, res) => {
    const b = req.body || {};
    try {
      res.json(await opzoek.zoek({ postcode: b.postcode, huisnummer: b.huisnummer }));
    } catch (e) {
      /* De opzoeker gooit niet; komt hier toch iets langs, dan is dat een fout
         van ons en geen antwoord van de bron. Luid melden (LAT.md regel 5, via
         dezelfde weg als de rest van het huis, dus zichtbaar op het techniekbord)
         en het scherm nooit omgooien: met de hand werkt het gesprek gewoon door. */
      log.uitzondering(e instanceof Error ? e : new Error(String(e)), { bron: 'adres-route', p: req.path });
      res.status(500).json({ gevonden: false, reden: 'onbereikbaar', tekst: 'Opzoeken lukte niet. Vul je adres met de hand in.' });
    }
  });
};
