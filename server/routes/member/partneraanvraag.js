/* Member-submodule: DE PARTNERAANVRAAG -- een bedrijf vraagt een plek.

   Uit ./partnerkanaal.js geknipt op de 10 kB-grens, en op een echte naad: dat
   bestand gaat over BOEKEN via een partnerlink (een niet-lid dat een reis
   afneemt), dit over de AANVRAAG van een bedrijf dat zelf partner wil worden.
   Twee kanten van hetzelfde kanaal die om verschillende redenen veranderen.

   DE POORT VRAAGT EEN CAPABILITY EN GEEN PAS-ID (kern/commercie/capaciteiten.js).
   Hier stond een rechtstreekse vergelijking met het pas-id van de Business Pass,
   en sinds de pasladder sloot die precies de klant buiten voor wie dit kanaal
   bedoeld is. Komt er een trede bij, dan hoeft deze regel niet mee te
   veranderen -- en dat is het hele punt. */
'use strict';

const caps = require('../../kern/commercie/capaciteiten');
const ladder = require('../../kern/pasladder');

module.exports = (kern) => {
  const { app, db, save, crypto, schoon, resolveSession, mail, sseToOffice } = kern;

  app.post('/api/partner/apply', (req, res) => {
    const b = req.body || {};
    /* DE TOEGANGSEIS: EEN PAS, EN VERDER GEEN VOORWAARDE.

       Hier stond: alleen met een actieve BUSINESS PASS. Dat was een verkeerde
       gelijkstelling van twee dingen die niets met elkaar te maken hebben. De
       Business Pass is een lidmaatschapsniveau -- de duurste, met de zakelijke
       kant erbij -- en geen vergunning om een bedrijf te hebben. Wie met een
       gewone RTG Pass een zaak runt, is niet minder ondernemer; hij kon alleen
       zijn bedrijf niet aanmelden. Dat is precies de vorm van de grens die
       CONCERN.md al verbiedt aan de werknemerskant: niemand koopt hier een pas
       om te mogen werken.

       Wat blijft is dat er een LID achter de aanvraag staat. Een partnerplek is
       een zakelijke relatie met RTG, met een bedrijfscode en een beheer-inlog;
       die geven we niet uit aan een anonieme post. De gratis gast-laag (zonder
       pas) valt er daarom buiten -- dezelfde grens als overal elders in de app.

       Hier stond ooit sessionFor(). Die kent alleen de sessies uit /api/login --
       de demopassen. Een ECHT ledenaccount komt via accounts.verifyToken binnen
       en staat daar helemaal niet in. resolveSession() kent allebei de wegen,
       net als de gewone auth-middleware in server.js. */
    const passToken = String(b.passToken || (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || '');
    const passSess = passToken ? resolveSession(passToken) : null;
    /* DE POORT VRAAGT EEN CAPABILITY, GEEN PAS-ID. Hier stond een rechtstreekse
       vergelijking van de sessie-tier met het pas-id van de Business Pass.
       Sinds de ladder is de Business Pass vanaf
       5.000 euro per maand, en daarmee sloot die regel precies de klant buiten
       voor wie het partnerkanaal bedoeld is: het restaurant met acht man uit
       MARKT.md. De ladder had dat gat zelf gemaakt.

       `can_be_partner` hoort bij Business Lite en Business
       (kern/commercie/capaciteiten.js). Komt er ooit een trede bij, dan hoeft
       deze regel niet mee te veranderen -- en dat is het hele punt van
       capabilities: de vraag "mag deze klant dit" wordt op EEN plek beantwoord
       en niet in zevenenzeventig bestanden opnieuw. */
    if (!passSess || !caps.mag(passSess.tier, 'can_be_partner'))
      return res.status(403).json({ error: 'Een partnerplek vraagt u aan met een zakelijke pas (' +
        caps.tredenMet('can_be_partner').map(t => (ladder.trede(t) || {}).naam || t).join(' of ') +
        '). Log op dit apparaat in op die app en probeer het opnieuw.' });
    // schoon(): strip < en > uit vrije tekst. De bedrijfsnaam en plaats komen later
    // in andermans schermen (De Salon, backoffice), dus nooit als opmaak laten landen.
    const company = schoon(b.company, 80);
    const type = String(b.type || '').trim();
    const city = schoon(b.city, 60);
    const contactName = schoon(b.contactName, 60);
    const email = String(b.email || '').trim().toLowerCase().slice(0, 80);
    const phone = String(b.phone || '').trim().slice(0, 30);
    const note = schoon(b.note, 500);
    if (!db.data.supplierTypes[type]) return res.status(400).json({ error: 'Kies een geldig type bedrijf.' });
    /* EN DE GENREPOORT, want die gold hier niet. Deze route keek alleen OF een
       genre bestond; het register zegt van acht genres dat een partner ze niet
       aanvraagt ('intern': gemeente, luchthaven, ov, rijk, politie, brandweer,
       ambulance, marechaussee) en van andere dat ze alleen op uitnodiging
       opengaan. Iemand kon zich dus via dit formulier als gemeente aanmelden,
       terwijl het register iets anders beweerde -- dezelfde waarheid op twee
       plekken (LAT-regel 4), met een belofte in tekst die niet werd gehandhaafd
       (regel 6). De aanmeldingsstroom en de onderneming-intake vroegen deze
       poort al; nu deze deur ook. De uitleg komt uit het register zelf, zodat
       er geen tweede formulering ontstaat.

       Interne genres komen binnen langs de boardroom (kern/instelling.js). */
    const poort = require('../../seed/genres').genreToegang(type);
    if (!poort.ok) return res.status(403).json({ error: poort.uitleg });
    if (!company || !city || !contactName) return res.status(400).json({ error: 'Vul de bedrijfsnaam, plaats en contactpersoon in.' });
    // juridisch vereist: uitdrukkelijk akkoord met de partnervoorwaarden,
    // inclusief de verwerkersafspraken en het verplichte Salon-account
    if (req.body.akkoord !== true) return res.status(400).json({ error: 'Ga akkoord met de partnervoorwaarden (inclusief de verwerkersafspraken) om een partnerplek aan te vragen.' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Vul een geldig e-mailadres in.' });
    if (db.data.partnerApplications.some(a => a.status === 'nieuw' && a.email === email && a.company.toLowerCase() === company.toLowerCase()))
      return res.status(409).json({ error: 'Deze aanvraag staat al open. We nemen contact met u op.' });
    const entry = {
      id: crypto.randomBytes(4).toString('hex'),
      company, type, city, contactName, email, phone, note,
      // vastlegging van het akkoord (bewijs): wat en wanneer
      akkoord: { partnervoorwaarden: true, verwerkersafspraken: true, at: new Date().toISOString() },
      /* HET LEDENBEWIJS. Zonder dit keurt het kantoor niets goed.

         DIT VELD HEEFT DRIE VORMEN GEHAD EN DAT IS EEN KEER TE VAAK. Het heette
         `businessPass: {key, at}` toen de poort DE Business Pass eiste; op
         18 augustus werd dat `pas: {tier, key, at}`, omdat de eis toen niet meer
         over die ene pas ging; en op 20 augustus kwam de trede erbij, maar in de
         oude naam en met een andere binnennaam (`businessPass.pas`). Drie
         schrijvers, twee lezers, en routes/office/partners.js las er nog maar
         een van goed -- het abonnement van de zaak landde niet.

         Het is nu EEN vorm: `pas`, met `tier` erin. De trede hoort erbij en niet
         alleen "er was een zakelijke pas": zonder dat gegeven weet niemand na
         goedkeuring waar de zaak op zit en is het capability-profiel een folder.
         Zie kern/commercie/zaakabonnement.js. Oude aanvragen met `businessPass`
         blijven leesbaar; het kantoor leest allebei. */
      pas: { tier: passSess.tier, key: passSess.key, at: new Date().toISOString() },
      status: 'nieuw', at: new Date().toISOString()
    };
    db.data.partnerApplications.unshift(entry);
    db.data.partnerApplications = db.data.partnerApplications.slice(0, 200);
    save();
    mail.send(email, 'Uw partner-aanvraag bij Rahul Travel Group',
      'Beste ' + contactName + ',\n\nWe hebben uw aanvraag voor ' + company + ' (' + city + ') ontvangen. ' +
      'We beoordelen elke partner persoonlijk en komen binnen twee werkdagen bij u terug.\n\nRahul Travel Group');
    sseToOffice('sync', { scope: 'team' });
    res.json({ ok: true });
  });
};
