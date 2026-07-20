/* Functiecatalogus, deel "partners e.a." (server/functies/register): de laatste
   vijf categorieen - Partners (leveranciers), RTG-Backoffice, RTFoundation,
   Betalen & verificatie en Personeel & integraties. Verbatim afgesplitst uit
   register.js; de leden-groepen komen uit ./doelgroepen. */
const { LEDEN, LEDEN_GAST } = require('./doelgroepen');

module.exports = [
  // ---- Partners (leveranciers) ----
  { id: 'supplier', categorie: 'Partners (leveranciers)', naam: 'Partner-app (algemeen)', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Alle leveranciersfuncties. Uit = partners kunnen niets meer doen (behalve wat hieronder apart aan staat).', paden: ['/api/supplier', '/api/partner'] },
  { id: 'supplier-pos', categorie: 'Partners (leveranciers)', naam: 'Kassa (POS)', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Het kassascherm per sector: afrekenen en RTG-code innen.', paden: ['/api/supplier/pos'] },
  { id: 'supplier-salon', categorie: 'Partners (leveranciers)', naam: 'Partner-Salon (marketing)', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Het bedrijfsprofiel op De Salon: posts, aanbiedingen, polls en volgers.', paden: ['/api/supplier/salon'] },
  { id: 'supplier-events', categorie: 'Partners (leveranciers)', naam: 'Events & mise-en-place', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Eventkeuken, menukeuze met allergenen en de mise-en-place-planner.', paden: ['/api/supplier/event', '/api/supplier/mep'] },
  { id: 'supplier-finance', categorie: 'Partners (leveranciers)', naam: 'Financiën & AI-boekhouder', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Dagcijfers, btw per genre/land en de AI-boekhouder van de zaak.', paden: ['/api/supplier/finance', '/api/supplier/accountant'] },
  { id: 'supplier-rooms', categorie: 'Partners (leveranciers)', naam: 'Kamers & slimme deuren (hotel)', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Hotelkamers, housekeeping en de app-bediende deuren.', paden: ['/api/supplier/room', '/api/supplier/door'] },
  { id: 'supplier-ride', categorie: 'Partners (leveranciers)', naam: 'Ritten & vloot (vervoer)', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Taxi- en jetritten accepteren en de vloot beheren.', paden: ['/api/supplier/ride', '/api/supplier/rides', '/api/supplier/fleet'] },
  { id: 'supplier-apply', categorie: 'Partners (leveranciers)', naam: 'Sollicitaties bij partners', standaard: true, doelgroepen: ['leverancier'],
    uitleg: 'Vacatures uitzetten en sollicitaties ontvangen bij de partner.', paden: ['/api/supplier/apply', '/api/supplier/vacature'] },

  // ---- RTG-Backoffice ----
  { id: 'office', categorie: 'RTG-Backoffice', naam: 'Backoffice (algemeen)', standaard: true, doelgroepen: ['intern'],
    uitleg: 'Het RTG-actiecentrum: orders, ritten, prestaties, verificaties en partneraanvragen.', paden: ['/api/office'] },
  { id: 'office-school', categorie: 'RTG-Backoffice', naam: 'Schoolgoedkeuring (RTF School)', standaard: true, doelgroepen: ['intern'],
    uitleg: 'Scholen goedkeuren of afwijzen voordat ze personeel en klassen kunnen aanmaken.', paden: ['/api/office/school'] },

  // ---- RTFoundation ----
  { id: 'foundation', categorie: 'RTFoundation', naam: 'RTFoundation-app (onderwijs)', standaard: true, doelgroepen: ['foundation'],
    uitleg: 'De gratis onderwijs-app: live schoolbord, leerling-schrift en de AI-bijleshulp.', paden: ['/api/foundation'] },
  { id: 'foundation-school', categorie: 'RTFoundation', naam: 'RTF School (scholen & leraren)', standaard: true, doelgroepen: ['foundation'],
    uitleg: 'Het schoolkanaal: klassen, rooster, huiswerk, cijfers, ziekmelden en berichten met de leraar.', paden: ['/api/foundation/school'] },
  { id: 'werk-rtf', categorie: 'RTFoundation', naam: 'Vacatures & solliciteren (RTF)', standaard: true, doelgroepen: ['foundation'],
    uitleg: 'De vacature- en sollicitatielaag binnen de RTFoundation-app.', paden: ['/api/rtf/apply', '/api/rtf/vacatures', '/api/rtf/solliciteer'] },

  // ---- Betalen & verificatie ----
  { id: 'betalen', categorie: 'Betalen & verificatie', naam: 'Betaalverkeer', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'Betalingen (demo of Stripe) en de RTG Pay-wallet. Uit = er kan tijdelijk niet betaald worden.', paden: ['/api/betaal', '/api/pay'] },
  { id: 'webauthn', categorie: 'Betalen & verificatie', naam: 'Passkeys (WebAuthn)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Inloggen met vingerafdruk, gezicht of beveiligingssleutel. Wachtwoord-inloggen blijft altijd werken.', paden: ['/api/webauthn'] },
  { id: 'verificatie', categorie: 'Betalen & verificatie', naam: 'Identiteitsverificatie (KYC)', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'Leden uploaden hun identiteitsbewijs en RTG beoordeelt het.', paden: ['/api/verify'] },
  { id: 'paspoort', categorie: 'Betalen & verificatie', naam: 'Paspoort delen (gecontroleerd)', standaard: true, doelgroepen: ['rtg', 'lifestyle', 'business', 'leverancier'],
    uitleg: 'Het toestemmingsgestuurde kanaal waarlangs een partner een identiteit opvraagt (ja/nee, ID-kaart of scan), met melding en weigering voor het lid.', paden: ['/api/paspoort', '/api/supplier/paspoort'] },

  // ---- Personeel & integraties ----
  { id: 'staff', categorie: 'Personeel & integraties', naam: 'Personeels-app (PDA)', standaard: true, doelgroepen: ['personeel'],
    uitleg: 'De personeels-app: rooster, klokken, verlof/ziek, taken, team en de vertrouwenspersoon.', paden: ['/api/staff'] },
  { id: 'stuur', categorie: 'Personeel & integraties', naam: 'Rahul doet het (AI-stuur)', standaard: true,
    doelgroepen: ['rtg', 'lifestyle', 'business', 'gast', 'leverancier', 'personeel'],
    uitleg: 'De AI voert acties uit op elk toegestaan API-pad, met de eigen inlog van wie het vraagt (nooit meer rechten dan de persoon zelf). Geld-acties vragen altijd eerst een bevestiging.',
    paden: ['/api/member/doe', '/api/supplier/doe', '/api/staff/doe'] }
];
