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
   - hij VERLOOPT (45 seconden) en wordt ondertekend door
     kern/dyncode.js -- HMAC-SHA256 met een sleutel die alleen op deze node
     staat. Zelf een geldige code maken kan dus niet, en een oude code
     opnieuw aanbieden ook niet.
   - hij is EENMALIG: zodra er echt mee verbonden is, is hij op.

   Waarom niet gewoon /api/code/dyn, dat dit al doet? Omdat de kop van
   server/routes/code.js zegt wat daar geldt: "de code zelf is geen geheim; de
   echte controle zit bij het afrekenen/inchecken". Hier IS de code de hele
   controle -- hij wijst een mens aan. Dezelfde ondertekening, een eigen deur.

   De verwijzingen staan in het GEHEUGEN en niet in de database, en dat is de
   juiste kant van die keuze: ze leven seconden, ze horen een herstart niet te
   overleven, en er hoort niets van in een back-up te belanden. Zelfde redenering
   als bij het slot in server/pinslot.js. */
const klok = require('../../lib/klok');

module.exports = (ctx) => {
const { crypto, sociaalRate, socialVerbind, pinKijk, dyncodeGeef, pinBevroren,
  pinBeveiligingNoteer, pinIntentMaak, pinIntentGebruik, codenaamVan } = ctx;

const TTL_MS = 45 * 1000;
const UUR = 60 * 60 * 1000;
const MAX_OPEN = 20000;          // begrensde geheugengroei; ze verlopen binnen 45 seconden
const open = new Map();          // verwijzing -> { handle, vervalt }

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

/* De bezem, en NIET de bewaker. Dit onderscheid komt uit een mutatie die niet
   beet: het verval werd op twee plekken afgedwongen -- hier en bij het opzoeken
   -- en omdat deze bezem op het LEESpad meeliep, dekte hij de controle daar
   volledig af. Twee mechanismen voor een besluit, en geen van beide alleen
   verantwoordelijk: dan kun je er ook geen van beide op aanspreken.

   Nu is de rolverdeling scherp. Deze lus houdt het geheugen klein en draait
   alleen waar de Map GROEIT (bij het maken van een code). Of een code nog geldt,
   wordt op een plek besloten: losOp hieronder, in een vergelijking per code. Dat
   is bovendien het goedkopere pad -- een lus over alles bij elke scan is werk
   dat niemand nodig heeft. */
function opruimen() {
  const nu = klok.nu();
  for (const [t, v] of open) if (v.vervalt < nu) open.delete(t);
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
  opruimen();
  if (open.size > MAX_OPEN) return { status: 503, error: 'Even te druk. Probeer het zo opnieuw.' };
  const verwijzing = crypto.randomBytes(9).toString('base64url');   // 12 tekens, geen scheidingstekens
  open.set(verwijzing, { handle, vervalt: klok.nu() + TTL_MS });
  const c = d.maak({ soort: 'contact', code: verwijzing, ttlMs: TTL_MS });
  pinBeveiligingNoteer(handle, 'livecode_gemaakt', { bron: 'live', uitkomst: 'getoond' });
  return { status: 200, token: c.token, exp: c.exp, ttlMs: c.ttlMs, doel: 'contact' };
}

/* Van een gescande code naar de handle erachter. Geeft null bij elke reden --
   vreemde code, gemanipuleerd, verlopen, al opgebruikt -- want ook hier hoort
   het verschil niets te verklappen. */
function losOp(token) {
  const d = dyn();
  if (!d) return null;
  const r = d.lees(token);
  if (!r.ok || r.soort !== 'contact') return null;
  const v = open.get(r.code);
  // hier valt het besluit, en alleen hier: verlopen is weg, en meteen ook echt weg
  if (!v || v.vervalt < klok.nu()) { open.delete(r.code); return null; }
  return { handle: v.handle, verwijzing: r.code };
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
  const uit = losOp(token);
  if (!uit) return { status: 404, error: 'Deze code is verlopen of hoort bij niemand. Laat een verse code tonen.' };
  if (uit.handle === mij) return { status: 400, error: 'Dat is je eigen code.' };
  const kaart = pinKijk(mij, uit.handle);
  if (!kaart) return { status: 404, error: 'Deze code is verlopen of hoort bij niemand. Laat een verse code tonen.' };
  const intent = pinIntentMaak({ actor: mij, doel: uit.handle, bron: 'live', referentie: uit.verwijzing });
  pinBeveiligingNoteer(uit.handle, 'livecode_bekeken', { bron: 'live', uitkomst: 'getoond', doel: codenaamVan(mij) });
  return { status: 200, codename: kaart.codename, tier: kaart.tier, st: kaart.st,
    bevestiging: intent.token, bevestigingVervalt: intent.exp };
}

/* En dan pas versturen. 'code' gaat als herkomst mee, zodat de ontvanger op
   zijn verzoek het verschil ziet met een verzoek via zijn vaste pin -- dat
   eerste deed hij zelf, dat tweede kan van een pin komen die ergens rondslingert.
   Pas hier gaat de code op. */
async function liveVerbind(mij, token, bevestiging) {
  if (pinBevroren(mij)) return { status: 423, error: 'Je RTG PIN staat in het noodslot.' };
  const uit = losOp(token);
  if (!uit) return { status: 404, error: 'Deze code is verlopen. Laat een verse code tonen.' };
  const intent = await pinIntentGebruik(bevestiging, { actor: mij, bron: 'live', referentie: uit.verwijzing });
  if (!intent || intent.doel !== uit.handle)
    return { status: 409, error: 'De bevestiging is verlopen. Scan de tijdelijke code opnieuw en controleer de ontvanger.' };
  const kaart = pinKijk(mij, uit.handle);
  if (!kaart) return { status: 404, error: 'Deze code is verlopen of hoort bij niemand. Laat een verse code tonen.' };
  const r = await socialVerbind(mij, uit.handle, false, 'code');
  if (r.error) return r;
  open.delete(uit.verwijzing);
  pinBeveiligingNoteer(mij, 'livecode_bevestigd', { bron: 'live', uitkomst: 'verzoek', doel: kaart.codename });
  pinBeveiligingNoteer(uit.handle, 'pin_verzoek', { bron: 'live', uitkomst: 'ontvangen', doel: codenaamVan(mij) });
  return { ...r, codename: kaart.codename };
}

return { liveMaak, liveKijk, liveVerbind, liveOpen: open, LIVE_TTL_MS: TTL_MS };
};
