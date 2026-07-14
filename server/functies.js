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

   PER DOELGROEP. Naast de globale aan/uit-knop kan elke functie ook per
   doelgroep worden bijgestuurd: wel voor de RTG-leden maar niet voor de
   Lifestyle-leden, wel voor de leveranciers maar niet voor de leden, enzovoort.
   Elke functie noemt de doelgroepen die zij bedient; de eigenaar zet de functie
   dan per doelgroep aan of uit. De doelgroep van een verzoek volgt uit het pad
   (leveranciers, personeel, backoffice, foundation) of uit de pas van het lid
   (RTG, Lifestyle, Business).

   De stand staat in db.data.techniek.functies:
     { id: { aan, storing, perDoelgroep:{lifestyle:false}, perLand:{NL:false}, perPersoon:{'user-12':false} } }
   Wat er niet in staat valt terug op de standaard (alles staat standaard AAN,
   zodat het platform draait zoals altijd tot je bewust iets omzet). Een
   doelgroep/land/persoon zonder eigen stand volgt de globale aan/uit.

   DRIE FIJNE ASSEN naast globaal. Een functie kan globaal aan staan maar toch
   gericht uit voor:
   - een PAS (doelgroep: rtg/lifestyle/business, en leverancier/personeel/...),
   - een LAND (landcode van het lid, bijv. NL/ES; alleen als het lid een land
     heeft ingevuld),
   - een PERSOON (een specifiek account, op sleutel 'user-<id>').
   Elke expliciete `false` op welke as dan ook blokkeert; anders is de functie
   beschikbaar. */

// Volgorde van de categorieën zoals ze op het bord verschijnen.
const CATEGORIEEN = [
  'Leden (RTG-app)',
  'Genres & diensten',
  'Sociaal (De Salon)',
  'Partners (leveranciers)',
  'RTG-Backoffice',
  'RTFoundation',
  'Betalen & verificatie',
  'Personeel & integraties'
];

/* De doelgroepen: wie een functie kan gebruiken. Klein en helder gehouden zodat
   de controlekamer niet overweldigt. synoniemen dienen de AI-hulp (vrije taal). */
const DOELGROEPEN = [
  { id: 'rtg',         naam: 'RTG-leden',    emoji: '🟢', kleur: '#3BA55D', uitleg: 'Leden met de RTG Pass.',                              synoniemen: ['rtg', 'rtg-leden', 'rtg leden', 'gewone leden'] },
  { id: 'lifestyle',   naam: 'Lifestyle',    emoji: '🟣', kleur: '#A46BD6', uitleg: 'Leden met de Lifestyle Pass.',                       synoniemen: ['lifestyle', 'lifestyle-leden', 'lifestyle mensen'] },
  { id: 'business',    naam: 'Business',     emoji: '🔵', kleur: '#4B8DC9', uitleg: 'Leden met de Business Pass (zakelijk).',             synoniemen: ['business', 'zakelijk', 'business pass'] },
  { id: 'leverancier', naam: 'Leveranciers', emoji: '🟠', kleur: '#D6A32E', uitleg: 'Partners en hun personeel in de partner-app.',       synoniemen: ['leverancier', 'leveranciers', 'partner', 'partners', 'zaak', 'zaken'] },
  { id: 'personeel',   naam: 'Personeel',    emoji: '🟤', kleur: '#B07B4E', uitleg: 'Medewerkers in de personeels-app (PDA).',            synoniemen: ['personeel', 'medewerker', 'medewerkers', 'pda', 'staff'] },
  { id: 'foundation',  naam: 'Foundation',   emoji: '🎓', kleur: '#5AB4C9', uitleg: 'Gezinnen, leerlingen en scholen in de RTF-app.',     synoniemen: ['foundation', 'rtf', 'rtfoundation', 'school', 'scholen', 'onderwijs', 'gezin', 'gezinnen', 'leerling'] },
  { id: 'intern',      naam: 'RTG intern',   emoji: '⚫', kleur: '#8A8681', uitleg: 'De RTG-backoffice en integraties (intern).',         synoniemen: ['intern', 'backoffice', 'kantoor', 'rtg zelf'] }
];
const DOELGROEP_IDS = DOELGROEPEN.map(d => d.id);
const DOELGROEP_OP_ID = Object.fromEntries(DOELGROEPEN.map(d => [d.id, d]));

// Handige groepen doelgroepen om herhaling te vermijden.
const LEDEN = ['rtg', 'lifestyle', 'business'];
const LEDEN_RTF = ['rtg', 'lifestyle', 'business', 'foundation'];

// De catalogus. standaard: true = de functie staat normaal aan. doelgroepen:
// welke doelgroepen deze functie bedient (en dus apart te schakelen zijn).
const FUNCTIES = [
  // ---- Leden (RTG-app) ----
  { id: 'member', categorie: 'Leden (RTG-app)', naam: 'Leden-app (algemeen)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Alle ledenfuncties in de RTG-app. Zet je dit uit, dan valt de hele ledenkant stil (behalve wat hieronder apart aan staat).', paden: ['/api/member'] },
  { id: 'member-dm', categorie: 'Leden (RTG-app)', naam: 'Directe berichten (DM)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Privéberichten tussen leden onderling.', paden: ['/api/member/dm'] },
  { id: 'member-snaps', categorie: 'Leden (RTG-app)', naam: 'Snaps & 24-uurs verhalen', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Foto-snaps en verhalen die na 24 uur verdwijnen.', paden: ['/api/member/snap', '/api/member/story'] },
  { id: 'member-connect', categorie: 'Leden (RTG-app)', naam: 'Vrienden verbinden', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Vriendschapsverzoeken en de vriendengraaf tussen leden.', paden: ['/api/member/connect'] },
  { id: 'member-werk', categorie: 'Leden (RTG-app)', naam: 'Vacatures & solliciteren (leden)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Leden solliciteren met hun cv op vacatures bij partners.', paden: ['/api/member/apply'] },
  { id: 'zakelijk', categorie: 'Leden (RTG-app)', naam: 'RTG Zakelijk (professioneel netwerk)', standaard: true, doelgroepen: ['lifestyle', 'business'],
    uitleg: 'De LinkedIn-laag van de Lifestyle en Business Pass: zakelijk profiel, gids, verbinden, feed, aanbevelingen en het kansenbord.', paden: ['/api/zakelijk'] },

  // ---- Genres & diensten (leden boeken/kopen per sector) ----
  { id: 'bestellen', categorie: 'Genres & diensten', naam: 'Bestellen & bezorgen', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Bestellen bij een zaak (ophalen of laten bezorgen) met live volgen.', paden: ['/api/order', '/api/orders', '/api/bezorg'] },
  { id: 'tickets', categorie: 'Genres & diensten', naam: 'Tickets & activiteiten', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Tickets kopen met tijdslot en een oplichtende entreecode.', paden: ['/api/tickets'] },
  { id: 'verhuur', categorie: 'Genres & diensten', naam: 'Autoverhuur', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Auto huren met foto\'s voor/na, borg, SOS-knop en live locatie.', paden: ['/api/huur', '/api/verhuur'] },
  { id: 'charter', categorie: 'Genres & diensten', naam: 'Boten & jachten (charter)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Vaartuigen charteren met schipper, borg, SOS op zee en live positie.', paden: ['/api/charter'] },
  { id: 'vastgoed', categorie: 'Genres & diensten', naam: 'Vastgoed', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Panden bekijken, interesse tonen of bieden en keyless bezichtigen.', paden: ['/api/vastgoed'] },
  { id: 'retail', categorie: 'Genres & diensten', naam: 'Mode & retail', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De modecatalogus: wishlist, apart leggen en de paskamer.', paden: ['/api/retail'] },
  { id: 'onderweg', categorie: 'Genres & diensten', naam: 'Onderweg (live locatie)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Het live onderweg-scherm: positie, ETA en verbonden partners.', paden: ['/api/live'] },
  { id: 'contracten', categorie: 'Genres & diensten', naam: 'Contracten (leden tekenen)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Digitale contracten die een lid in de app ondertekent.', paden: ['/api/contract', '/api/contracten'] },

  // ---- Sociaal (De Salon) ----
  { id: 'salon', categorie: 'Sociaal (De Salon)', naam: 'De Salon (feed, volgen, deals)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De Salon-tijdlijn: partner-posts volgen, aanbiedingen claimen, polls en de etalage.', paden: ['/api/salon'] },
  { id: 'ontmoetingen', categorie: 'Sociaal (De Salon)', naam: 'Salon-ontmoetingen (in de buurt)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Wederzijdse connecties die vlakbij zijn spreken veilig af (18+, geverifieerd), met contract, live-locatie naar RTG en SOS.', paden: ['/api/ontmoeten'] },
  { id: 'social', categorie: 'Sociaal (De Salon)', naam: 'Sociale laag (RTG + RTF)', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'De gedeelde sociale laag: zoeken, verbinden, DM, snaps, verhalen en bellen op codenaam. De kinderbescherming (t/m 15 gesloten) blijft altijd gelden.', paden: ['/api/rtf/social'] },
  { id: 'rtf-contacten', categorie: 'Sociaal (De Salon)', naam: 'RTF contacten & familiekoppeling', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'De contactenlaag van de RTFoundation: gezinnen koppelen, kanalen en meldingen tussen leden.', paden: ['/api/rtf'] },

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
  { id: 'betalen', categorie: 'Betalen & verificatie', naam: 'Betaalverkeer', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Betalingen (demo of Stripe). Uit = er kan tijdelijk niet betaald worden.', paden: ['/api/betaal'] },
  { id: 'verificatie', categorie: 'Betalen & verificatie', naam: 'Identiteitsverificatie (KYC)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Leden uploaden hun identiteitsbewijs en RTG beoordeelt het.', paden: ['/api/verify'] },
  { id: 'paspoort', categorie: 'Betalen & verificatie', naam: 'Paspoort delen (gecontroleerd)', standaard: true, doelgroepen: ['rtg', 'lifestyle', 'business', 'leverancier'],
    uitleg: 'Het toestemmingsgestuurde kanaal waarlangs een partner een identiteit opvraagt (ja/nee, ID-kaart of scan), met melding en weigering voor het lid.', paden: ['/api/paspoort', '/api/supplier/paspoort'] },

  // ---- Personeel & integraties ----
  { id: 'staff', categorie: 'Personeel & integraties', naam: 'Personeels-app (PDA)', standaard: true, doelgroepen: ['personeel'],
    uitleg: 'De personeels-app: rooster, klokken, verlof/ziek, taken, team en de vertrouwenspersoon.', paden: ['/api/staff'] }
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

// Staat deze functie GLOBAAL aan volgens de bewaarde stand (of de standaard)?
function functieAan(id, staat) {
  const f = OP_ID[id];
  if (!f) return true; // onbekende id blokkeert nooit
  const s = staat && staat[id];
  return s ? s.aan !== false : f.standaard;
}

// Een gemelde storing op deze functie (of null). Puur een statusvlag: het
// blokkeert het verkeer niet (dat doet de aan/uit-schakelaar), maar kleurt de
// functie oranje op het bord.
function functieStoring(id, staat) {
  const s = staat && staat[id];
  return (s && s.storing) ? s.storing : null;
}
// De stoplicht-status van een functie: 'uit' (rood), 'storing' (oranje) of
// 'aan' (groen). Uit wint van storing: een bewust uitgezette functie is rood.
function functieStatus(id, staat) {
  if (!functieAan(id, staat)) return 'uit';
  if (functieStoring(id, staat)) return 'storing';
  return 'aan';
}

// Staat deze functie aan voor een specifieke doelgroep? Globaal uit = overal uit.
// Anders wint een eigen per-doelgroep-stand; zonder eigen stand geldt de globale.
function functieAanVoor(id, doelgroep, staat) {
  if (!functieAan(id, staat)) return false;
  if (!doelgroep) return true;
  const s = staat && staat[id];
  const pd = s && s.perDoelgroep;
  if (pd && Object.prototype.hasOwnProperty.call(pd, doelgroep)) return pd[doelgroep] !== false;
  return true;
}

// Is deze functie beschikbaar voor een concreet verzoek? ctx = { doelgroep,
// land, persoon }. Elke expliciete false (op welke as dan ook) blokkeert.
// Geeft de reden terug: 'globaal' | 'pas' | 'land' | 'persoon' | null (vrij).
function blokkadeReden(id, staat, ctx) {
  if (!functieAan(id, staat)) return 'globaal';
  const s = staat && staat[id];
  if (!s) return null;
  const c = ctx || {};
  if (c.doelgroep && s.perDoelgroep && s.perDoelgroep[c.doelgroep] === false) return 'pas';
  if (c.land && s.perLand && s.perLand[c.land] === false) return 'land';
  if (c.persoon && s.perPersoon && s.perPersoon[c.persoon] === false) return 'persoon';
  return null;
}
function functieBeschikbaar(id, staat, ctx) { return blokkadeReden(id, staat, ctx) === null; }
// Staan er ergens land-regels? Zo niet, dan hoeft de middleware het land van het
// lid niet op te zoeken (scheelt een opzoeking per verzoek).
function heeftLandRegels(staat) {
  if (!staat) return false;
  for (const id of Object.keys(staat)) { const pl = staat[id] && staat[id].perLand; if (pl && Object.keys(pl).length) return true; }
  return false;
}

/* Kernvraag voor de middleware: is dit pad geblokkeerd (voor dit verzoek)?
   ctx = { doelgroep, land, persoon }. Geeft { functie, reden } terug of null.
   Een simpele string als ctx wordt als doelgroep gelezen (achterwaarts compat). */
function padGeblokkeerd(pad, staat, ctx) {
  const f = functieVoorPad(pad);
  if (!f) return null;                       // niet door een functie bewaakt -> altijd vrij
  if (typeof ctx === 'string') ctx = { doelgroep: ctx };
  const reden = blokkadeReden(f.id, staat, ctx);
  if (!reden) return null;
  return { id: f.id, naam: f.naam, categorie: f.categorie, paden: f.paden, doelgroepen: f.doelgroepen, reden };
}

/* De doelgroep van een verzoek. Expliciete app-paden bepalen de doelgroep,
   ongeacht wie er inlogt (leveranciers, personeel, backoffice, foundation). Op
   de gedeelde leden- en Salon-paden volgt de doelgroep de pas van het account. */
function tierNaarDoelgroep(tier) {
  if (tier === 'lifestyle') return 'lifestyle';
  if (tier === 'business') return 'business';
  if (tier === 'rtg') return 'rtg';
  return null; // guest/onbekend: alleen de globale schakelaar telt
}
function doelgroepVanVerzoek(pad, user) {
  if (pad.startsWith('/api/supplier') || pad.startsWith('/api/partner')) return 'leverancier';
  if (pad.startsWith('/api/staff')) return 'personeel';
  if (pad.startsWith('/api/office')) return 'intern';
  if (pad.startsWith('/api/foundation')) return 'foundation';
  return user ? tierNaarDoelgroep(user.tier) : null;
}

// De volledige catalogus met de huidige stand, geordend per categorie (voor het
// bord). Elke functie toont de globale stand plus haar doelgroepen met eigen stand.
function catalogus(staat) {
  return CATEGORIEEN.map(cat => ({
    categorie: cat,
    functies: FUNCTIES.filter(f => f.categorie === cat).map(f => {
      const s = (staat && staat[f.id]) || {};
      const perLand = s.perLand || {};
      const perPersoon = s.perPersoon || {};
      return {
        id: f.id, naam: f.naam, uitleg: f.uitleg, standaard: f.standaard, aan: functieAan(f.id, staat),
        storing: functieStoring(f.id, staat), status: functieStatus(f.id, staat),
        doelgroepen: (f.doelgroepen || []).map(dg => {
          const meta = DOELGROEP_OP_ID[dg] || { id: dg, naam: dg, emoji: '•' };
          return { id: dg, naam: meta.naam, emoji: meta.emoji, aan: functieAanVoor(f.id, dg, staat) };
        }),
        // actieve beperkingen per land en per persoon (alleen wat expliciet uit staat)
        landUit: Object.keys(perLand).filter(k => perLand[k] === false),
        persoonUit: Object.keys(perPersoon).filter(k => perPersoon[k] === false)
      };
    })
  })).filter(g => g.functies.length);
}

/* Valideer een lijst voorgestelde wijzigingen ({ id, doelgroep, aan }). Alleen
   bestaande functies, en een doelgroep die bij die functie hoort (of leeg =
   globaal). Zo kan de AI-hulp nooit iets onmogelijks voorstellen. */
function valideerVoorstel(arr) {
  if (!Array.isArray(arr)) return [];
  const uit = [];
  for (const w of arr) {
    const f = w && OP_ID[w.id];
    if (!f) continue;
    const aan = w.aan !== false && w.aan !== 'false';
    let dg = w.doelgroep || null;
    if (dg && !(f.doelgroepen || []).includes(dg)) continue;
    uit.push({ id: f.id, naam: f.naam, doelgroep: dg, aan });
  }
  return uit;
}

/* Lokale taal-hulp: begrijp een korte Nederlandse instructie en stel wijzigingen
   voor. Dit is de terugval als er geen AI-sleutel is, en houdt de controlekamer
   ook zonder externe AI bruikbaar. Herkent intentie (aan/uit), doelgroep(en) en
   welke functie(s) of categorie het betreft. */
function duidVoorstel(vraag, staat) {
  const q = ' ' + String(vraag || '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ') + ' ';
  const wilUit = /\b(uit|uitzetten|uitschakelen|uitzet|dicht|sluit|sluiten|blokkeer|blokkeren|stop|stoppen|verberg|verbergen|off|geen)\b/.test(q);
  const wilAan = /\b(aan|aanzetten|inschakelen|aanzet|open|openzetten|activeer|activeren|toestaan|geef|on|wel)\b/.test(q);
  let zetAan = null;
  if (wilUit && !wilAan) zetAan = false; else if (wilAan && !wilUit) zetAan = true;

  // doelgroepen herkennen (leeg = geen specifieke: globaal)
  const dgs = [];
  for (const d of DOELGROEPEN) if (d.synoniemen.some(s => q.includes(' ' + s + ' ') || q.includes(' ' + s + ',') || q.includes(' ' + s + '.'))) dgs.push(d.id);
  if (/\bleden\b/.test(q) && !dgs.some(id => LEDEN.includes(id))) LEDEN.forEach(id => dgs.push(id));
  const doelen = dgs.length ? Array.from(new Set(dgs)) : [null]; // null = globaal

  // functies/categorie herkennen
  const alles = /\b(alles|alle functies|hele platform|het hele systeem|alle apps)\b/.test(q);
  let functies = [];
  if (alles) functies = FUNCTIES.slice();
  else {
    const cat = CATEGORIEEN.find(c => q.includes(' ' + c.toLowerCase().split(' (')[0] + ' '));
    if (cat) functies = FUNCTIES.filter(f => f.categorie === cat);
    // trefwoorden uit de functienaam en id
    for (const f of FUNCTIES) {
      if (functies.includes(f)) continue;
      const woorden = (f.naam.toLowerCase().match(/\p{L}{4,}/gu) || []).concat(f.id.split('-'));
      if (woorden.some(w => w.length >= 4 && q.includes(' ' + w))) functies.push(f);
    }
  }

  // voorstel opbouwen: alleen echte veranderingen, en doelgroep moet bij de functie horen
  const voorstel = [];
  if (zetAan !== null) {
    for (const f of functies) {
      for (const dg of doelen) {
        if (dg && !(f.doelgroepen || []).includes(dg)) continue;
        if (functieAanVoor(f.id, dg, staat) === zetAan) continue; // al zo
        voorstel.push({ id: f.id, naam: f.naam, doelgroep: dg, aan: zetAan });
      }
    }
  }
  const dgNaam = doelen.filter(Boolean).map(id => (DOELGROEP_OP_ID[id] || {}).naam).join(', ');
  let uitleg;
  if (zetAan === null) uitleg = 'Ik kon niet goed uit je vraag halen of iets AAN of UIT moet. Noem duidelijk "aanzetten" of "uitzetten", en voor welke doelgroep.';
  else if (!functies.length) uitleg = 'Ik herkende geen functie of app in je vraag. Noem bijvoorbeeld "de sociale laag", "de kassa" of een categorie.';
  else if (!voorstel.length) uitleg = 'Dat staat al zo ingesteld' + (dgNaam ? ' voor ' + dgNaam : '') + '; er is niets te wijzigen.';
  else uitleg = 'Voorstel: ' + voorstel.length + ' wijziging(en) ' + (zetAan ? 'AAN' : 'UIT') + (dgNaam ? ' voor ' + dgNaam : ' (globaal)') + '. Controleer en vraag ze aan.';
  return { voorstel, uitleg };
}

module.exports = {
  FUNCTIES, CATEGORIEEN, OP_ID, DOELGROEPEN, DOELGROEP_IDS,
  functieVoorPad, functieAan, functieAanVoor, functieBeschikbaar, functieStoring, functieStatus,
  heeftLandRegels, blokkadeReden, padGeblokkeerd, catalogus,
  doelgroepVanVerzoek, tierNaarDoelgroep, valideerVoorstel, duidVoorstel
};
