/* ============================================================================
   DE ROL-SCHEIDING, HARDER GETOETST DAN "GEEN 2XX".

   De gauntlet meet dat een verkeerd-rol token nooit een 2xx krijgt. Dat is een
   goede ondergrens en het is niet genoeg. Drie dingen die er niet mee zijn
   uitgesloten:

   1. EEN 4XX DIE ALSNOG GEGEVENS MEEGEEFT. "403 Verboden -- dit dossier is van
      Rahul Imran Ismail" is een correcte statuscode en een lek. Hetzelfde geldt
      voor een 404 die het verschil verraadt tussen "bestaat niet" en "bestaat
      wel maar niet voor jou", en voor een validatiefout die het veld terugcitéért
      met andermans waarde erin.

   2. EEN ACTIE DIE HALF IS UITGEVOERD. Een handler die eerst schrijft en daarna
      pas de rechten controleert, geeft keurig een 403 terug terwijl de mutatie
      al is gebeurd. De statuscode klopt dan en de database niet.

   3. EN DE STILSTE: DE AUTORISATIE WORDT NIET EENS BEREIKT. De gauntlet stuurt
      ROMMEL (emoji, gigastrings, diep genest). Die wordt door de validatie
      geweigerd voordat de rechten aan de beurt zijn -- dus een 400 op een
      rommelverzoek bewijst niets over autorisatie. Deze proef stuurt daarom
      PLAUSIBELE invoer: een bedrag dat een bedrag is, een datum die een datum
      is. Pas dan kom je bij de poort die je wilt beproeven.

   De opzet is een gericht experiment en geen storm: momentopname van de
   waarneembare toestand, alle schrijfroutes met alle verkeerde rollen, en daarna
   dezelfde momentopname. Wat er dan verschilt, is door een verkeerde rol
   veroorzaakt.
   ========================================================================== */
'use strict';

/* Wat er NOOIT in een antwoord aan een verkeerde rol hoort te staan. Bewust
   ruim: liever een vals alarm dat je met de hand wegstreept dan een lek dat je
   nooit ziet. De echte naam en het eigenaarsadres staan erin omdat die de
   duidelijkste kanaries zijn -- codenamen mogen naar buiten, echte namen nooit
   (dat is de kern van de identiteitskluis). */
const LEKMERKERS = [
  { naam: 'e-mailadres', re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i },
  { naam: 'IBAN', re: /\b[A-Z]{2}\d{2}[A-Z]{4}\d{6,10}\b/ },
  { naam: 'echte naam uit de kluis', re: /\b(Rahul|Imran|Ismail|roellie)\b/i },
  { naam: 'geheim veld', re: /"(wachtwoord|password|hash|secret|sleutel|apiKey|token|pin)"\s*:\s*"[^"]{6,}/i },
  { naam: 'telefoonnummer', re: /\b06[-\s]?\d{8}\b/ }
];

/* Een plausibel lijf. Niet slim, wel geloofwaardig: de velden die de meeste
   routes vragen, met waarden die door een gewone validatie heen komen. Het doel
   is de POORT bereiken, niet het endpoint echt bedienen. */
function plausibelLijf(pad) {
  const vandaag = new Date().toISOString().slice(0, 10);
  return {
    naam: 'Proefwaarde', titel: 'Proefwaarde', tekst: 'proef', omschrijving: 'proef',
    bedrag: 100, centen: 100, bedragCenten: 100, aantal: 1, prijs: 100,
    datum: vandaag, van: '09:00', tot: '10:00', tijd: '09:00',
    id: 'proef-' + Math.random().toString(36).slice(2, 8),
    code: 'PROEF', status: 'open', soort: 'proef', type: 'proef',
    aan: 'PROEF', email: 'proef@voorbeeld.test', pas: 'rtg', rol: 'lid',
    // sommige routes willen een expliciete bevestiging voor geld
    bevestig: true, akkoord: true
  };
}

/* De momentopname. Bewust GETALLEN en geen hele JSON-blobs: een tijdstempel of
   een teller die uit zichzelf loopt zou elke vergelijking laten mislukken, en
   een proef die altijd rood staat wordt binnen een week uitgezet. Wat hier staat
   verandert alleen als er echt iets is geschreven. */
async function vingerafdruk(post, tok) {
  const tel = (d, ...paden) => {
    for (const p of paden) {
      const v = p.split('.').reduce((o, k) => (o == null ? o : o[k]), d);
      if (Array.isArray(v)) return v.length;
      if (typeof v === 'number') return v;
    }
    return null;
  };
  const uit = {};
  try { const r = await post('/api/pay/overzicht', {}, tok.member); uit.saldo = tel(r.data, 'saldo'); } catch (e) {}
  try { const r = await post('/api/boekingen/mijn', {}, tok.member); uit.boekingen = tel(r.data, 'boekingen', 'items', 'lijst'); } catch (e) {}
  try { const r = await post('/api/verkoop/mijn', {}, tok.member); uit.verkoop = tel(r.data, 'items', 'verkopen', 'lijst'); } catch (e) {}
  try { const r = await post('/api/office/state', {}, tok.office); uit.officeLeden = tel(r.data, 'state.leden', 'leden', 'aantalLeden'); } catch (e) {}
  try { const r = await post('/api/supplier/backoffice', {}, tok.supplier); uit.supplierOrders = tel(r.data, 'orders', 'state.orders'); } catch (e) {}
  return uit;
}

/* De proef zelf. `routes` zijn de schrijfroutes uit de routekaart; `rolVan` geeft
   de juiste rol van een route; `tokensVoor` levert een levend token per rol.
   Alles wat afwijkt komt terug als bevinding, met genoeg context om het na te
   lopen. */
async function draaiRolproef({ post, routes, tokensVoor, maxPerRol }) {
  const bevindingen = { tweexx: [], lekken: [], gewijzigd: [] };
  const rollen = ['member', 'supplier', 'office'];
  const voor = await vingerafdruk(post, tokensVoor());

  let gedaan = 0;
  for (const r of routes) {
    if (r.method === 'GET') continue;                 // schrijfroutes: dit gaat over mutaties
    if (r.rol === 'open' || !r.rol) continue;         // publiek: geen rol om te kruisen
    if (r.schakel) continue;                          // de schakelkast zou de hele proef vergiftigen
    for (const rol of rollen) {
      if (rol === r.rol) continue;                    // alleen de VERKEERDE rollen
      if (maxPerRol && gedaan >= maxPerRol) break;
      const tk = tokensVoor()[rol];
      if (!tk) continue;
      const st = await post(r.pad, plausibelLijf(r.pad), Array.isArray(tk) ? tk[0] : tk);
      gedaan++;
      const s = st.status;
      if (s >= 200 && s < 300) { bevindingen.tweexx.push(r.method + ' ' + r.pad + ' [' + rol + ' -> ' + s + ']'); continue; }
      /* Het LIJF van de weigering. Hier hoort een foutmelding te staan en verder
         niets: geen adres, geen echte naam, geen rekeningnummer. */
      const lijf = typeof st.data === 'string' ? st.data : JSON.stringify(st.data || {});
      for (const m of LEKMERKERS) {
        if (m.re.test(lijf)) {
          bevindingen.lekken.push(r.method + ' ' + r.pad + ' [' + rol + ' -> ' + s + '] ' + m.naam +
            ': ' + lijf.slice(0, 120).replace(/\s+/g, ' '));
          break;
        }
      }
    }
  }

  const na = await vingerafdruk(post, tokensVoor());
  for (const k of new Set([...Object.keys(voor), ...Object.keys(na)])) {
    if (voor[k] == null && na[k] == null) continue;
    if (voor[k] !== na[k]) bevindingen.gewijzigd.push(k + ': ' + voor[k] + ' -> ' + na[k]);
  }
  return { bevindingen, pogingen: gedaan, voor, na };
}

module.exports = { draaiRolproef, vingerafdruk, plausibelLijf, LEKMERKERS };
