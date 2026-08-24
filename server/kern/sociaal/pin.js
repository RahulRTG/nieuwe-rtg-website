/* Sociaal (deelmodule): DE CONTACTPIN -- de eigen code waarmee twee mensen
   elkaar toevoegen zonder eerst een naam te hoeven zoeken. De BlackBerry-pin,
   dan wel met de privacy van dit huis eromheen.

   Zoeken op codenaam werkt (zie ./vrienden/verbinden.js), maar het vraagt dat
   de ander vindbaar IS: je typt iets van hem in en krijgt een lijst terug. Een
   pin draait dat om. Hij zegt niets over wie je bent, hij staat op je eigen
   scherm, en pas als jij hem afgeeft -- voorgelezen, gedeeld of als QR
   voorgehouden -- kan iemand er iets mee. Er valt niets mee te bladeren.

   ------------------------------------------------------------------------
   DIT IS NIET DE PINCODE UIT server/kern/algpin.js, EN DAT VERSCHIL IS DE
   HELE MODULE.

   Die pin is een GEHEIM: hij bewijst op een toestel dat jij het bent, wordt
   met scrypt gehasht bewaard, staat achter een slot van vijf pogingen en komt
   nooit in een antwoord terug. Deze pin is een ADRES: hij bewijst niets, hij
   wijst alleen aan. Hij staat daarom leesbaar in de database en gaat leesbaar
   over de lijn -- precies zoals een telefoonnummer op een kaartje.

   Wie deze twee door elkaar haalt, bouwt of een adres dat niemand kan
   voorlezen, of een geheim dat op ieders scherm staat. Vandaar dat ze allebei
   "pin" heten in de taal van het lid en nooit in de code: hier heet dit
   contactpin, daar heet dat algemene pin.
   ------------------------------------------------------------------------

   Crockford base32 en niet gewoon hex: een pin wordt VOORGELEZEN. Daar zitten
   0/O en 1/I/L in elkaars vaarwater, dus die staan niet in het alfabet en
   worden bij het invoeren stil omgezet naar wat de spreker bedoelde. Dat is
   een bestaand, opgeschreven schema; er is hier niets eigens aan verzonnen.
   Nieuwe pins hebben tien tekens (50 bits). De achttekencodes uit de eerste
   versie blijven geldig: veiligheid mag nooit een stille buitensluiting zijn.
   De remmen die raden tegengaan staan in ./pin-deur.js.

   DRIE BESTANDEN, DRIE ONDERWERPEN. Hier woont het BEZIT: het alfabet, het
   verzinnen, de eigen pin, vernieuwen en de aan/uit-schakelaar, plus de index
   die daarbij hoort. Het OPZOEKEN staat in ./pin-deur.js (de twee remmen en de
   gelijke antwoorden), en de LEVENDE code in ./pin-live.js. */
const klok = require('../../lib/klok');

module.exports = (ctx) => {
const { db, save, crypto, codenaamVan, soortVan, isBeschermdHandle, isGeblokkeerd,
  sociaalRate, statusVan, connectieTussen, socialVerbind, pinIsIngetrokken,
  pinTrekIn, pinBeveiligingNoteer, pinBeveiligingBeeld, pinBevries,
  pinIntentTrekInVoor } = ctx;

/* Crockford base32: geen I, L, O en U. 256 is precies 8 x 32, dus `byte % 32`
   is zuiver uniform -- er hoeft geen enkele trekking verworpen te worden. */
const ALFABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const NIEUWE_LENGTE = 10;
const OUDE_LENGTE = 8;
const UUR = 60 * 60 * 1000;

const rij = () => {
  if (!db.data.contactPins || typeof db.data.contactPins !== 'object') db.data.contactPins = {};
  return db.data.contactPins;
};

/* Van wat een mens intypt naar de pin zoals hij bewaard staat, of null.
   De omzetting O->0 en I/L->1 is de Crockford-lezing: wie "IBAN" hoort
   voorlezen weet niet of het een i of een 1 is, en de pin hoort dat niet uit
   te maken. U->V om dezelfde reden. Streepjes, spaties en punten mogen: het
   v2-scherm toont 'A1B2C-D3E4F' en dat plakt iemand terug zoals het er staat;
   bestaande v1-pins blijven als 'A1B2-C3D4' geldig tot vernieuwing. */
function normaliseer(ruw) {
  const s = String(ruw == null ? '' : ruw).toUpperCase().replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
  if (s.length !== OUDE_LENGTE && s.length !== NIEUWE_LENGTE) return null;
  for (const teken of s) if (!ALFABET.includes(teken)) return null;
  return s;
}
// v1 blijft 4-4; de nieuwe v2-pin leest als twee even grote groepen van vijf
const toonbaar = pin => pin ? (pin.length === OUDE_LENGTE
  ? pin.slice(0, 4) + '-' + pin.slice(4)
  : pin.slice(0, 5) + '-' + pin.slice(5)) : null;

/* De hint van pin naar lid staat in ./pin-index.js -- een eigen bestand, want
   de uitleg waarom een index hier GEEN tweede waarheid is, is langer dan de
   code zelf. Hij krijgt de rij-lezer mee en raakt db nooit aan. */
const { zoekRuw, indexZet } = require('./pin-index')(rij);

/* Twee opzoekingen en niet een, en dat verschil is een bug die anders pas over
   maanden opvalt. `zoekRuw` zegt of een pin BEZET is -- daar controleert
   verzinPin op, en die moet ook een UITGEZETTE pin zien: anders krijgt een nieuw
   lid de pin die iemand tijdelijk had uitgezet, en zijn er twee zodra die ander
   hem weer aanzet. `handleVanPin` zegt of een pin iemand AANWIJST, en daar telt
   de schakelaar wel. */
const pinBezet = pin => !!zoekRuw(pin) || pinIsIngetrokken(pin);
function handleVanPin(pin) {
  const handle = zoekRuw(pin);
  if (!handle) return null;
  return rij()[handle].uit ? null : handle;
}
// de opgeslagen pin, zonder er een te maken: op een LEESpad hoort niets te
// ontstaan (pinVan maakt er wel een aan, en schrijft dus ook)
const pinHuidig = handle => { const e = rij()[handle]; return e && e.pin ? e.pin : null; };
function verzinPin() {
  /* Botsingen zijn met ruim 1 biljard mogelijkheden zeldzaam, maar "zeldzaam"
     is geen "nooit": twee leden met dezelfde pin zou betekenen dat een
     verzoek bij de verkeerde belandt. Dus altijd nakijken, en opgeven met een
     fout in plaats van stil een dubbele uit te delen. */
  for (let poging = 0; poging < 50; poging++) {
    const bytes = crypto.randomBytes(NIEUWE_LENGTE);
    let pin = '';
    for (let i = 0; i < NIEUWE_LENGTE; i++) pin += ALFABET[bytes[i] % 32];
    if (!pinBezet(pin)) return pin;
  }
  throw new Error('contactpin: geen vrije pin gevonden na 50 pogingen');
}

/* De eigen pin. Wordt bij de eerste keer opvragen gemaakt en daarna bewaard:
   een lid dat zijn pin nooit gebruikt, hoeft er ook geen te hebben staan. */
function pinVan(handle) {
  if (!handle) return null;
  const r = rij();
  if (!r[handle] || !r[handle].pin) {
    const at = klok.datum().toISOString();
    r[handle] = { pin: verzinPin(), versie: 2, at, laatstGewijzigd: at };
    indexZet(handle, null, r[handle].pin);
    pinBeveiligingNoteer(handle, 'pin_gemaakt', { bron: 'vast', uitkomst: 'gelukt' });
  }
  return r[handle].pin;
}
const pinKaart = handle => {
  const p = pinVan(handle), e = rij()[handle] || {};
  return { pin: p, toon: toonbaar(p), uit: !!e.uit,
    versie: p && p.length === OUDE_LENGTE ? 1 : 2,
    gemaaktOp: e.at || null, laatstGewijzigd: e.laatstGewijzigd || e.at || null,
    ...pinBeveiligingBeeld(handle) };
};

/* Een nieuwe pin. Dit is het intrekken van een adres: wie de oude heeft
   (op een oude foto van de QR, in een oude groepsapp) kan er niets meer mee.
   Bestaande vriendschappen raakt het niet -- die staan op de handle. */
function pinVernieuw(handle) {
  if (!handle) return { status: 400, error: 'Onbekend lid.' };
  if (!sociaalRate(handle, 'pinnieuw', 3, UUR))
    return { status: 429, error: 'Je hebt net al een nieuwe pin gemaakt. Probeer het over een uur opnieuw.' };
  const r = rij(), oud = r[handle] ? r[handle].pin : null;
  // de stand van de schakelaar blijft staan: wie zijn pin uit had, wil na een
  // verse pin niet ineens weer vindbaar zijn
  const nieuw = verzinPin(), at = klok.datum().toISOString();
  if (oud) pinTrekIn(oud, 'vernieuwd');
  r[handle] = { pin: nieuw, versie: 2, at,
    laatstGewijzigd: at, uit: !!(r[handle] && r[handle].uit) };
  indexZet(handle, oud, r[handle].pin);
  pinIntentTrekInVoor(handle);
  pinBeveiligingNoteer(handle, 'pin_vernieuwd', { bron: 'vast', uitkomst: 'gelukt' });
  return { status: 200, ...pinKaart(handle) };
}

/* De pin uitzetten. Vernieuwen helpt tegen een pin die is rondgegaan, maar niet
   tegen "ik wil helemaal niet op deze manier gevonden worden" -- en dat is een
   ander verzoek. Uit betekent: de vaste pin wijst niemand meer aan, met precies
   hetzelfde antwoord als een pin die niet bestaat (zie ./pin-deur.js).

   DE LEVENDE CODE BLIJFT WEL WERKEN, en dat is geen gat maar het onderscheid
   waar deze schakelaar over gaat: een pin die je hebt afgegeven werkt PASSIEF
   door, ook als je allang niet meer weet aan wie. Een code die je op dit moment
   ophoudt is een HANDELING, met een mens die hem bewust laat zien en een venster
   van 45 seconden. Wie de eerste dichtdoet, wil zelden de tweede kwijt --
   en het scherm zegt dat er ook bij. */
function pinUit(handle, uit, opties) {
  if (!handle) return { status: 400, error: 'Onbekend lid.' };
  pinVan(handle);                      // zorgt dat er een rij is om te schakelen
  if (opties && Object.prototype.hasOwnProperty.call(opties, 'bevroren')) {
    const r = pinBevries(handle, !!opties.bevroren);
    pinIntentTrekInVoor(handle);
    return r.error ? r : { status: 200, ...pinKaart(handle) };
  }
  rij()[handle].uit = !!uit;
  pinIntentTrekInVoor(handle);
  pinBeveiligingNoteer(handle, uit ? 'vaste_pin_uit' : 'vaste_pin_aan', { bron: 'vast', uitkomst: 'gelukt' });
  return { status: 200, ...pinKaart(handle) };
}

return { pinVan, pinKaart, pinVernieuw, pinUit, handleVanPin, pinHuidig,
  pinNormaliseer: normaliseer, pinToonbaar: toonbaar };
};
