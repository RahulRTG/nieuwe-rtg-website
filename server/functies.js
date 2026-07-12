/* Functieschakelaars ("feature flags") voor het beveiligde Backoffice-techniekbord.

   Anders dan de zekeringen (die springen bij een storing) zijn dit bewuste
   aan/uit-knoppen per functionaliteit van het hele platform. Zo kun je het
   systeem functie voor functie openzetten of juist iets tijdelijk sluiten,
   netjes geordend per categorie.

   Elke functie bewaakt een of meer pad-prefixen (bijv. /api/supplier/pos). Een
   verzoek wordt getoetst aan de MEEST SPECIFIEKE functie die op het pad past
   (langste prefix wint). Zo kan een brede functie uit staan terwijl een
   deelfunctie eronder aan blijft, en andersom, precies wat je wilt om het
   systeem "een voor een" open te zetten.

   De aan/uit-stand staat in db.data.techniek.functies ({ id: { aan } }); wat er
   niet in staat valt terug op de standaard (alles staat standaard AAN, zodat het
   platform draait zoals altijd tot je bewust iets omzet). */

// Volgorde van de categorieën zoals ze op het bord verschijnen.
const CATEGORIEEN = [
  'Leden (RTG-app)',
  'Sociaal (De Salon)',
  'Partners (leveranciers)',
  'RTG-Backoffice',
  'RTFoundation',
  'Betalen & verificatie',
  'Personeel & integraties'
];

// De catalogus. standaard: true = de functie staat normaal aan.
const FUNCTIES = [
  // ---- Leden (RTG-app) ----
  { id: 'member', categorie: 'Leden (RTG-app)', naam: 'Leden-app (algemeen)', standaard: true,
    uitleg: 'Alle ledenfuncties in de RTG-app. Zet je dit uit, dan valt de hele ledenkant stil (behalve wat hieronder apart aan staat).', paden: ['/api/member'] },
  { id: 'member-dm', categorie: 'Leden (RTG-app)', naam: 'Directe berichten (DM)', standaard: true,
    uitleg: 'Privéberichten tussen leden onderling.', paden: ['/api/member/dm'] },
  { id: 'member-snaps', categorie: 'Leden (RTG-app)', naam: 'Snaps & 24-uurs verhalen', standaard: true,
    uitleg: 'Foto-snaps en verhalen die na 24 uur verdwijnen.', paden: ['/api/member/snap', '/api/member/story'] },
  { id: 'member-connect', categorie: 'Leden (RTG-app)', naam: 'Vrienden verbinden', standaard: true,
    uitleg: 'Vriendschapsverzoeken en de vriendengraaf tussen leden.', paden: ['/api/member/connect'] },
  { id: 'member-werk', categorie: 'Leden (RTG-app)', naam: 'Vacatures & solliciteren (leden)', standaard: true,
    uitleg: 'Leden solliciteren met hun cv op vacatures bij partners.', paden: ['/api/member/apply'] },
  { id: 'zakelijk', categorie: 'Leden (RTG-app)', naam: 'RTG Zakelijk (professioneel netwerk)', standaard: true,
    uitleg: 'De LinkedIn-laag van de Business Pass: zakelijk profiel, gids, verbinden, feed en aanbevelingen.', paden: ['/api/zakelijk'] },

  // ---- Sociaal (De Salon) ----
  { id: 'social', categorie: 'Sociaal (De Salon)', naam: 'Sociale laag (RTG + RTF)', standaard: true,
    uitleg: 'De gedeelde sociale laag: zoeken, verbinden, DM, snaps, verhalen en bellen op codenaam. De kinderbescherming (t/m 15 gesloten) blijft altijd gelden.', paden: ['/api/rtf/social'] },
  { id: 'rtf-contacten', categorie: 'Sociaal (De Salon)', naam: 'RTF contacten & familiekoppeling', standaard: true,
    uitleg: 'De contactenlaag van de RTFoundation: gezinnen koppelen, kanalen en meldingen tussen leden.', paden: ['/api/rtf'] },

  // ---- Partners (leveranciers) ----
  { id: 'supplier', categorie: 'Partners (leveranciers)', naam: 'Partner-app (algemeen)', standaard: true,
    uitleg: 'Alle leveranciersfuncties. Uit = partners kunnen niets meer doen (behalve wat hieronder apart aan staat).', paden: ['/api/supplier', '/api/partner'] },
  { id: 'supplier-pos', categorie: 'Partners (leveranciers)', naam: 'Kassa (POS)', standaard: true,
    uitleg: 'Het kassascherm per sector: afrekenen en RTG-code innen.', paden: ['/api/supplier/pos'] },
  { id: 'supplier-salon', categorie: 'Partners (leveranciers)', naam: 'Partner-Salon (marketing)', standaard: true,
    uitleg: 'Het bedrijfsprofiel op De Salon: posts, aanbiedingen, polls en volgers.', paden: ['/api/supplier/salon'] },
  { id: 'supplier-events', categorie: 'Partners (leveranciers)', naam: 'Events & mise-en-place', standaard: true,
    uitleg: 'Eventkeuken, menukeuze met allergenen en de mise-en-place-planner.', paden: ['/api/supplier/event', '/api/supplier/mep'] },
  { id: 'supplier-finance', categorie: 'Partners (leveranciers)', naam: 'Financiën & AI-boekhouder', standaard: true,
    uitleg: 'Dagcijfers, btw per genre/land en de AI-boekhouder van de zaak.', paden: ['/api/supplier/finance', '/api/supplier/accountant'] },
  { id: 'supplier-rooms', categorie: 'Partners (leveranciers)', naam: 'Kamers & slimme deuren (hotel)', standaard: true,
    uitleg: 'Hotelkamers, housekeeping en de app-bediende deuren.', paden: ['/api/supplier/room', '/api/supplier/door'] },
  { id: 'supplier-ride', categorie: 'Partners (leveranciers)', naam: 'Ritten & vloot (vervoer)', standaard: true,
    uitleg: 'Taxi- en jetritten accepteren en de vloot beheren.', paden: ['/api/supplier/ride', '/api/supplier/rides', '/api/supplier/fleet'] },
  { id: 'supplier-apply', categorie: 'Partners (leveranciers)', naam: 'Sollicitaties bij partners', standaard: true,
    uitleg: 'Vacatures uitzetten en sollicitaties ontvangen bij de partner.', paden: ['/api/supplier/apply', '/api/supplier/vacature'] },

  // ---- RTG-Backoffice ----
  { id: 'office', categorie: 'RTG-Backoffice', naam: 'Backoffice (algemeen)', standaard: true,
    uitleg: 'Het RTG-actiecentrum: orders, ritten, prestaties, verificaties en partneraanvragen.', paden: ['/api/office'] },
  { id: 'office-school', categorie: 'RTG-Backoffice', naam: 'Schoolgoedkeuring (RTF School)', standaard: true,
    uitleg: 'Scholen goedkeuren of afwijzen voordat ze personeel en klassen kunnen aanmaken.', paden: ['/api/office/school'] },

  // ---- RTFoundation ----
  { id: 'foundation', categorie: 'RTFoundation', naam: 'RTFoundation-app (onderwijs)', standaard: true,
    uitleg: 'De gratis onderwijs-app: live schoolbord, leerling-schrift en de AI-bijleshulp.', paden: ['/api/foundation'] },
  { id: 'foundation-school', categorie: 'RTFoundation', naam: 'RTF School (scholen & leraren)', standaard: true,
    uitleg: 'Het schoolkanaal: klassen, rooster, huiswerk, cijfers, ziekmelden en berichten met de leraar.', paden: ['/api/foundation/school'] },
  { id: 'werk-rtf', categorie: 'RTFoundation', naam: 'Vacatures & solliciteren (RTF)', standaard: true,
    uitleg: 'De vacature- en sollicitatielaag binnen de RTFoundation-app.', paden: ['/api/rtf/apply', '/api/rtf/vacatures', '/api/rtf/solliciteer'] },

  // ---- Betalen & verificatie ----
  { id: 'betalen', categorie: 'Betalen & verificatie', naam: 'Betaalverkeer', standaard: true,
    uitleg: 'Betalingen (demo of Stripe). Uit = er kan tijdelijk niet betaald worden.', paden: ['/api/betaal'] },
  { id: 'verificatie', categorie: 'Betalen & verificatie', naam: 'Identiteitsverificatie (KYC)', standaard: true,
    uitleg: 'Leden uploaden hun identiteitsbewijs en RTG beoordeelt het.', paden: ['/api/verify'] },

  // ---- Personeel & integraties ----
  { id: 'staff', categorie: 'Personeel & integraties', naam: 'Personeels-app (PDA)', standaard: true,
    uitleg: 'De personeels-app: rooster, klokken, verlof/ziek, taken, team en de vertrouwenspersoon.', paden: ['/api/staff'] },
  { id: 'whatsapp', categorie: 'Personeel & integraties', naam: 'WhatsApp-integratie', standaard: true,
    uitleg: 'De WhatsApp-lijn (inkomende webhook en uitgaande berichten).', paden: ['/api/whatsapp'] }
];

const OP_ID = Object.fromEntries(FUNCTIES.map(f => [f.id, f]));

// Hoeveel tekens van een pad dekt deze prefix af? 0 = geen match. Een prefix
// past alleen op een hele padsegment-grens (/api/supplier past op
// /api/supplier/x maar niet op /api/supplierx).
function prefixLengte(pad, prefix) {
  if (!pad.startsWith(prefix)) return 0;
  const rest = pad.slice(prefix.length);
  return (rest === '' || rest[0] === '/') ? prefix.length : 0;
}

// De meest specifieke functie die dit pad bewaakt (langste prefix wint), of null.
function functieVoorPad(pad) {
  let beste = null, besteLen = 0;
  for (const f of FUNCTIES) {
    for (const p of f.paden) {
      const len = prefixLengte(pad, p);
      if (len > besteLen) { besteLen = len; beste = f; }
    }
  }
  return beste;
}

// Staat deze functie aan volgens de bewaarde stand (of de standaard)?
function functieAan(id, staat) {
  const f = OP_ID[id];
  if (!f) return true; // onbekende id blokkeert nooit
  const s = staat && staat[id];
  return s ? s.aan !== false : f.standaard;
}

/* Kernvraag voor de middleware: is dit pad geblokkeerd? Geeft de blokkerende
   functie terug (met id/naam) of null als het pad vrij is. */
function padGeblokkeerd(pad, staat) {
  const f = functieVoorPad(pad);
  if (!f) return null;               // niet door een functie bewaakt -> altijd vrij
  if (functieAan(f.id, staat)) return null;
  return f;
}

// De volledige catalogus met de huidige stand, geordend per categorie (voor het bord).
function catalogus(staat) {
  return CATEGORIEEN.map(cat => ({
    categorie: cat,
    functies: FUNCTIES.filter(f => f.categorie === cat).map(f => ({
      id: f.id, naam: f.naam, uitleg: f.uitleg, standaard: f.standaard, aan: functieAan(f.id, staat)
    }))
  })).filter(g => g.functies.length);
}

module.exports = { FUNCTIES, CATEGORIEEN, OP_ID, functieVoorPad, functieAan, padGeblokkeerd, catalogus };
