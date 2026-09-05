/* Sociaal (deelmodule): DE LEVENDE CONTACTCODE -- de QR die verloopt.

   Het probleem dat dit oplost is het probleem dat de BlackBerry-pin altijd
   heeft gehad: hij is voor eeuwig. Zet je hem een keer in een groepsapp, dan
   ben je daar voor altijd op te vinden, en je merkt dat pas als er iemand
   aanklopt die je niet kent. Vernieuwen kan (./pin.js), maar dat vraagt dat je
   het doorhebt.

   Voor het geval waarin een pin het vaakst wordt afgegeven -- twee mensen die
   tegenover elkaar staan -- is een blijvend adres ook helemaal niet nodig. Daar
   past een code die hooguit drie kwartier van een minuut leeft:

   - hij DRAAGT JE PIN NIET, en ook je sleutel niet. In de code zit een verse,
     willekeurige verwijzing die alleen deze server kan omzetten naar een mens.
     Wie de QR fotografeert, houdt een string over die naar niets meer wijst;
     wie hem uit elkaar haalt, vindt geen enkel blijvend gegeven.
   - hij VERLOOPT (45 seconden) en wordt ondertekend door kern/dyncode.js. In
     productie gebruikt die een gedeeld, domeingescheiden geheim, zodat een QR
     achter een load balancer niet toevallig alleen op de uitgevende node werkt.
   - hij is EENMALIG: Redis claimt hem met een atomisch GET+DEL-commando. Twee
     gelijktijdige scanners op twee processen kunnen dus nooit allebei winnen.
   - hij ROTEERT: een verse code trekt de vorige van dezelfde uitgever meteen
     in. In Redis staat alleen een HMAC-sleutel, nooit de rauwe verwijzing.

   Waarom niet gewoon /api/code/dyn, dat dit al doet? Omdat de kop van
   server/routes/code.js zegt wat daar geldt: "de code zelf is geen geheim; de
   echte controle zit bij het afrekenen/inchecken". Hier IS de code de hele
   controle -- hij wijst een mens aan. Dezelfde ondertekening, een eigen deur.

   Productie bewaart de verwijzing alleen kort in Redis: geen back-up, wel een
   gedeelde en atomische waarheid. De lokale Map is uitsluitend de synchrone
   ontwikkel-/unitvariant. */
const klok = require('../../lib/klok');

module.exports = (ctx) => {
const { crypto, sociaalRate, socialVerbind, pinKijk, dyncodeGeef, pinBevroren,
  pinBeveiligingNoteer, pinIntentMaak, pinIntentGebruik, pinIntentSluit, codenaamVan } = ctx;

const TTL_MS = 45 * 1000;
const UUR = 60 * 60 * 1000;
const MAX_OPEN = 20000;
const opslag = require('./pin-live-opslag')({ crypto, ttlMs: TTL_MS, maxOpen: MAX_OPEN });
const open = opslag.open;
const volg = (waarde, goed, fout) => waarde && typeof waarde.then === 'function'
  ? waarde.then(goed, fout) : goed(waarde);
const nietBeschikbaar = () => ({ status: 503,
  error: 'De tijdelijke contactcode is nu niet veilig beschikbaar. Probeer het later opnieuw.' });

/* De ondertekenaar komt later in de opbouw dan deze laag (kern/dyncode.js wordt
   in kernlaag1 gezet, de sociale kern staat daarvoor), dus halen we hem OP in
   plaats van hem vast te houden -- zelfde patroon en dezelfde reden als bij
   commDm in ../sociaal.js. Ontbreekt hij, dan zegt dat het eerlijk in plaats van
   stilletjes een code zonder handtekening te maken. */
function dyn() {
  const d = typeof dyncodeGeef === 'function' ? dyncodeGeef() : null;
  if (!d) return null;
  return d;
}

/* Een verse code. Elke aanroep geeft een NIEUWE verwijzing: het scherm ververst
   zichzelf net voor het verval, en twee codes van dezelfde persoon horen niets
   met elkaar gemeen te hebben -- anders is de reeks alsnog een blijvend
   kenmerk. */
function liveMaak(handle) {
  const d = dyn();
  if (!d) return { status: 503, error: 'De codelaag draait hier niet.' };
  if (!handle) return { status: 400, error: 'Onbekend lid.' };
  if (pinBevroren(handle)) return { status: 423, error: 'Je RTG PIN staat in het noodslot. Zet het slot uit om een tijdelijke code te tonen.' };
  if (!sociaalRate(handle, 'pinlive', 240, UUR))
    return { status: 429, error: 'Te veel codes achter elkaar. Probeer het later opnieuw.' };
  const nu = klok.nu();
  const verwijzing = crypto.randomBytes(16).toString('base64url');
  const c = d.maak({ soort: 'contact', code: verwijzing, ttlMs: TTL_MS });
  return volg(opslag.plaats(handle, verwijzing, nu), () => {
    pinBeveiligingNoteer(handle, 'livecode_gemaakt', { bron: 'live', uitkomst: 'getoond' });
    return { status: 200, token: c.token, exp: c.exp, ttlMs: c.ttlMs, doel: 'contact' };
  }, nietBeschikbaar);
}

/* Van een gescande code naar de handle erachter. Geeft null bij elke reden --
   vreemde code, gemanipuleerd, verlopen, al opgebruikt -- want ook hier hoort
   het verschil niets te verklappen. */
function losOp(token) {
  const d = dyn();
  if (!d) return null;
  const r = d.lees(token);
  if (!r.ok || r.soort !== 'contact') return null;
  return volg(opslag.kijk(r.code, klok.nu()), v => v
    ? { handle: v.uitgever, verwijzing: r.code } : null);
}

/* Kijken wie het is -- en NIET verbinden. Dezelfde volgorde als bij de vaste
   pin: eerst zegt het scherm wie er tegenover je staat, dan pas is er een knop.
   De code wordt hier bewust nog NIET opgebruikt; dat gebeurt pas bij het
   verbinden, want anders is een blik op de verkeerde persoon genoeg om de code
   van iemand anders te verbranden.

   De sleutel gaat hier niet mee terug. Bij de vaste pin moet dat (het scherm
   zoekt op pin en verbindt op sleutel), maar deze weg draagt de code zelf als
   bewijs -- dus hoeft het scherm nooit te weten hoe iemand heet in de database. */
function liveKijk(mij, token) {
  if (pinBevroren(mij)) return { status: 423, error: 'Je RTG PIN staat in het noodslot.' };
  if (!sociaalRate(mij, 'pinzoek', 30, UUR))
    return { status: 429, error: 'Te veel codes geprobeerd. Probeer het over een uur opnieuw.' };
  return volg(losOp(token), uit => {
    if (!uit) return { status: 404, error: 'Deze code is verlopen of hoort bij niemand. Laat een verse code tonen.' };
    if (uit.handle === mij) return { status: 400, error: 'Dat is je eigen code.' };
    const kaart = pinKijk(mij, uit.handle);
    if (!kaart) return { status: 404, error: 'Deze code is verlopen of hoort bij niemand. Laat een verse code tonen.' };
    const intent = pinIntentMaak({ actor: mij, doel: uit.handle, bron: 'live', referentie: uit.verwijzing });
    pinBeveiligingNoteer(uit.handle, 'livecode_bekeken', { bron: 'live', uitkomst: 'getoond', doel: codenaamVan(mij) });
    return { status: 200, codename: kaart.codename, tier: kaart.tier, st: kaart.st,
      bevestiging: intent.token, bevestigingVervalt: intent.exp };
  }, nietBeschikbaar);
}

/* En dan pas versturen. 'code' gaat als herkomst mee, zodat de ontvanger op
   zijn verzoek het verschil ziet met een verzoek via zijn vaste pin -- dat
   eerste deed hij zelf, dat tweede kan van een pin komen die ergens rondslingert.
   Pas hier gaat de code op. */
async function liveVerbind(mij, token, bevestiging) {
  if (pinBevroren(mij)) return { status: 423, error: 'Je RTG PIN staat in het noodslot.' };
  let uit;
  try { uit = await losOp(token); } catch (e) { return nietBeschikbaar(); }
  if (!uit) return { status: 404, error: 'Deze code is verlopen. Laat een verse code tonen.' };
  const intent = await pinIntentGebruik(bevestiging, { actor: mij, bron: 'live', referentie: uit.verwijzing });
  if (!intent || intent.doel !== uit.handle)
    return { status: 409, error: 'De bevestiging is verlopen. Scan de tijdelijke code opnieuw en controleer de ontvanger.' };
  let ingenomen;
  try { ingenomen = await opslag.neem(uit.verwijzing, klok.nu()); }
  catch (e) { return nietBeschikbaar(); }
  if (!ingenomen || ingenomen.uitgever !== uit.handle)
    return { status: 409, error: 'Deze tijdelijke code is al gebruikt of vernieuwd. Scan de verse code opnieuw.' };
  const kaart = pinKijk(mij, uit.handle);
  if (!kaart) return { status: 404, error: 'Deze code is verlopen of hoort bij niemand. Laat een verse code tonen.' };
  const r = await socialVerbind(mij, uit.handle, false, 'code');
  if (r.error) return r;
  pinBeveiligingNoteer(mij, 'livecode_bevestigd', { bron: 'live', uitkomst: 'verzoek', doel: kaart.codename });
  pinBeveiligingNoteer(uit.handle, 'pin_verzoek', { bron: 'live', uitkomst: 'ontvangen', doel: codenaamVan(mij) });
  return { ...r, codename: kaart.codename };
}

const liveTrekIn = handle => opslag.trekIn(handle);
const liveSluit = async () => {
  await opslag.sluit();
  if (pinIntentSluit) await pinIntentSluit();
};
return { liveMaak, liveKijk, liveVerbind, liveTrekIn, liveSluit,
  liveOpen: open, LIVE_TTL_MS: TTL_MS };
};
