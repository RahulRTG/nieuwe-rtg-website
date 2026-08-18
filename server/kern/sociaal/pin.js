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

   Wat er WEL geheim aan is, is dat een pin niet af te lopen mag zijn. Acht
   tekens uit Crockford base32 zijn 32^8 = 1,1 biljoen mogelijkheden, en elke
   poging kost een tik uit dezelfde snelheidsteller die de rest van de sociale
   laag remt (sociaalRate). Wie raadt, komt in een mensenleven niet in de
   buurt van een tweede lid.

   Crockford base32 en niet gewoon hex: een pin wordt VOORGELEZEN. Daar zitten
   0/O en 1/I/L in elkaars vaarwater, dus die staan niet in het alfabet en
   worden bij het invoeren stil omgezet naar wat de spreker bedoelde. Dat is
   een bestaand, opgeschreven schema; er is hier niets eigens aan verzonnen. */
module.exports = (ctx) => {
const { db, save, crypto, codenaamVan, soortVan, isBeschermdHandle, isGeblokkeerd,
  sociaalRate, statusVan, connectieTussen, socialVerbind } = ctx;

/* Crockford base32: geen I, L, O en U. 256 is precies 8 x 32, dus `byte % 32`
   is zuiver uniform -- er hoeft geen enkele trekking verworpen te worden. */
const ALFABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const LENGTE = 8;
const UUR = 60 * 60 * 1000;

const rij = () => {
  if (!db.data.contactPins || typeof db.data.contactPins !== 'object') db.data.contactPins = {};
  return db.data.contactPins;
};

/* Van wat een mens intypt naar de pin zoals hij bewaard staat, of null.
   De omzetting O->0 en I/L->1 is de Crockford-lezing: wie "IBAN" hoort
   voorlezen weet niet of het een i of een 1 is, en de pin hoort dat niet uit
   te maken. U->V om dezelfde reden. Streepjes, spaties en punten mogen: het
   scherm toont 'A1B2-C3D4' en dat plakt iemand terug zoals het er staat. */
function normaliseer(ruw) {
  const s = String(ruw == null ? '' : ruw).toUpperCase().replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
  if (s.length !== LENGTE) return null;
  for (const teken of s) if (!ALFABET.includes(teken)) return null;
  return s;
}
// zoals het lid hem ziet: twee groepjes van vier, want acht op een rij overtypt niemand
const toonbaar = pin => (pin ? pin.slice(0, 4) + '-' + pin.slice(4) : null);

/* Van pin naar handle. Een doorloop en geen index, en dat is een keuze: een
   index naast db.data is een tweede waarheid die stil uit de pas kan lopen
   zodra de opslaglaag db.data vervangt (bij een externe wijziging gebeurt dat
   echt). connectieTussen doet het in ../sociaal.js om dezelfde reden met een
   doorloop. Het aantal aanroepen is bovendien geremd (zie pinZoek), dus deze
   lus loopt hooguit tientallen keren per uur per lid. */
function handleVanPin(pin) {
  const r = rij();
  for (const handle of Object.keys(r)) if (r[handle] && r[handle].pin === pin) return handle;
  return null;
}

function verzinPin() {
  /* Botsingen zijn met 1,1 biljoen mogelijkheden zeldzaam, maar "zeldzaam"
     is geen "nooit": twee leden met dezelfde pin zou betekenen dat een
     verzoek bij de verkeerde belandt. Dus altijd nakijken, en opgeven met een
     fout in plaats van stil een dubbele uit te delen. */
  for (let poging = 0; poging < 50; poging++) {
    const bytes = crypto.randomBytes(LENGTE);
    let pin = '';
    for (let i = 0; i < LENGTE; i++) pin += ALFABET[bytes[i] % 32];
    if (!handleVanPin(pin)) return pin;
  }
  throw new Error('contactpin: geen vrije pin gevonden na 50 pogingen');
}

/* De eigen pin. Wordt bij de eerste keer opvragen gemaakt en daarna bewaard:
   een lid dat zijn pin nooit gebruikt, hoeft er ook geen te hebben staan. */
function pinVan(handle) {
  if (!handle) return null;
  const r = rij();
  if (!r[handle] || !r[handle].pin) {
    r[handle] = { pin: verzinPin(), at: new Date().toISOString() };
    save();
  }
  return r[handle].pin;
}
const pinKaart = handle => { const p = pinVan(handle); return { pin: p, toon: toonbaar(p) }; };

/* Een nieuwe pin. Dit is het intrekken van een adres: wie de oude heeft
   (op een oude foto van de QR, in een oude groepsapp) kan er niets meer mee.
   Bestaande vriendschappen raakt het niet -- die staan op de handle. */
function pinVernieuw(handle) {
  if (!handle) return { status: 400, error: 'Onbekend lid.' };
  if (!sociaalRate(handle, 'pinnieuw', 10, UUR))
    return { status: 429, error: 'Je hebt net al een nieuwe pin gemaakt. Probeer het over een uur opnieuw.' };
  rij()[handle] = { pin: verzinPin(), at: new Date().toISOString() };
  save();
  return { status: 200, ...pinKaart(handle) };
}

/* Opzoeken wie er achter een pin zit -- zonder iets te doen. Dat is met opzet
   een aparte stap: het scherm toont eerst "dit is Gouden Ibis", en de MENS
   drukt daarna pas op verzoek sturen (LIFE.md: samenstellen en klaarzetten,
   bevestigen doet de mens). Een gescande QR die meteen een verzoek verstuurt,
   is een verzoek dat iemand nooit bewust deed.

   Drie uitkomsten geven met opzet HETZELFDE antwoord: de pin bestaat niet, de
   pin hoort bij een beschermd profiel (15 of jonger) en de pin hoort bij
   iemand die jou blokkeerde. Anders is het verschil in de foutmelding precies
   het gaatje waardoor je alsnog kunt vaststellen dat een kind bestaat. */
function pinZoek(mij, ruw) {
  const pin = normaliseer(ruw);
  if (!pin) return { status: 400, error: 'Een pin bestaat uit acht tekens, bijvoorbeeld 7K2M-9XPQ.' };
  if (!sociaalRate(mij, 'pinzoek', 30, UUR))
    return { status: 429, error: 'Te veel pins geprobeerd. Probeer het over een uur opnieuw.' };
  const eigen = rij()[mij];
  if (eigen && eigen.pin === pin) return { status: 400, error: 'Dat is je eigen pin.' };
  const doel = handleVanPin(pin);
  if (!doel || isBeschermdHandle(doel) || isGeblokkeerd(mij, doel))
    return { status: 404, error: 'Deze pin kennen we niet.' };
  return { status: 200, key: doel, codename: codenaamVan(doel), tier: soortVan(doel),
    st: statusVan(mij, connectieTussen(mij, doel)) };
}

/* Verbinden op pin. Doet zelf geen enkele controle over: hij zoekt de handle
   op en laat socialVerbind de rest doen. Dat is de bedoeling -- daar wonen de
   blokkade, de ouder-goedkeuring en de snelheidsrem, en een tweede kopie
   ervan hier zou de dag na de eerste wijziging al uit de pas lopen. */
async function pinVerbind(mij, ruw) {
  const gevonden = pinZoek(mij, ruw);
  if (gevonden.error) return gevonden;
  const r = await socialVerbind(mij, gevonden.key);
  return r.error ? r : { ...r, key: gevonden.key, codename: gevonden.codename };
}

/* De rauwe oplossing, voor de ouderkant (zie ouderVerbind in
   ./vrienden/verbinden.js). Die MAG een beschermd profiel raken -- twee
   ouders wisselen de pin van hun kinderen uit, precies zoals ze nu de
   codenaam overtypen -- en de ouder van het andere kind moet daarna alsnog
   akkoord geven (voogdWacht). Geen eigen rem hier: de aanroeper zet hem, want
   die weet op wiens naam er geteld moet worden. */
function pinNaarHandle(ruw) {
  const pin = normaliseer(ruw);
  return pin ? handleVanPin(pin) : null;
}

return { pinVan, pinKaart, pinVernieuw, pinZoek, pinVerbind, pinNaarHandle,
  pinNormaliseer: normaliseer, pinToonbaar: toonbaar };
};
