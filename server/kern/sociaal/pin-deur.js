/* Sociaal (deelmodule): DE DEUR VAN DE CONTACTPIN -- opzoeken en verbinden.

   ./pin.js gaat over het bezit (de pin verzinnen, tonen, vernieuwen, uitzetten).
   Dit gaat over wie er aan mag komen. Twee onderwerpen, twee bestanden, en de
   scheiding is niet willekeurig: hier staat alles wat een aanvaller raakt.

   ---------------------------------------------------------------------------
   TWEE REMMEN, EN DE TWEEDE ONTBRAK.

   De eerste telt per VRAGER: dertig pogingen per uur per lid. Die remt de
   ongeduldige en de spammer, en tegen het raden van EEN bepaalde v2-pin is hij
   ruim genoeg -- 32^10 is ruim 1 biljard mogelijkheden. Bestaande v1-pins van
   acht tekens blijven geldig tot hun eigenaar ze vernieuwt.

   Maar wie de pin van niemand in het bijzonder zoekt, raadt niet EEN pin: hij
   zoekt of er ergens IEMAND achter zit. Met honderdduizend leden is de kans per
   gok ongeveer 1 op 11 miljard, en de enige echte kosten zijn accounts -- en een
   account kost een e-mailadres. Twintig accounts is twintig keer dertig, en de
   teller van het ene account ziet niets van het andere.

   Dat is exact de fout die server/pinslot.js beschrijft (daar: twintig gratis
   accounts, elk vijf pogingen, op EEN personeelspin). De les daar is dat de
   teller aan het DOEL hangt en niet aan de aanvrager. Bij een contactpin is er
   geen doel om aan te hangen -- de aanvaller noemt er juist geen -- dus hangt
   hij aan de DEUR: een huisbreed budget aan MISSERS per minuut, gedeeld door
   elke ingang die een code oplost (de leden-app, de gezinsapp, de ouderroute,
   en sinds RTG Link ook /api/link/los).

   DIE REM WOONT HIER NIET MEER, en dat is de hele verhuizing van 20 augustus
   2026: hij staat in ../link/rem.js. Zolang de contactpin de enige deur was,
   was "de rem van de contactpin" hetzelfde als "de rem van het huis". Met een
   tweede ingang is dat niet meer waar, en een huisbrede rem die bij een van de
   deuren woont, is de rem van die deur (LINK.md par. 3.7). De redenering
   hierboven verandert er niet door; alleen het adres.

   ALLEEN MISSERS TELLEN, en dat is wat het budget bruikbaar maakt. Een lid dat
   een pin overtypt of scant, mist vrijwel nooit: hij kreeg hem net. Een raadster
   mist per definitie bijna altijd. Het budget staat daarom laag genoeg om te
   bijten en zo hoog dat normaal gebruik er nooit aan komt.

   De prijs van een huisbrede teller (hij is ook een huisbrede knop) en zijn
   bekende beperking (geheugen, per proces) staan bij de rem zelf.
   --------------------------------------------------------------------------- */
module.exports = (ctx) => {
const { codenaamVan, soortVan, isBeschermdHandle, isGeblokkeerd, sociaalRate,
  statusVan, connectieTussen, socialVerbind, pinHuidig, pinNormaliseer, handleVanPin,
  pinBevroren, pinBeveiligingNoteer, pinIntentMaak, pinIntentGebruik, crypto } = ctx;
/* De bronrem uit de enterprise-rand blijft per netwerkspoor tellen. Het
   huisbudget zelf is de singleton van RTG Link: de pindeur en de linkdeur
   moeten dezelfde missers zien, ook wanneer beide PR's tegelijk landen. */
const bronRem = require('./pin-deur-rem')({ crypto });
const huisRem = require('../link/rem');
const UUR = bronRem.UUR;

/* Opzoeken wie er achter een pin zit -- zonder iets te doen. Dat is met opzet
   een aparte stap: het scherm toont eerst "dit is Gouden Ibis", en de MENS
   drukt daarna pas op verzoek sturen (LIFE.md: samenstellen en klaarzetten,
   bevestigen doet de mens). Een gescande QR die meteen een verzoek verstuurt,
   is een verzoek dat iemand nooit bewust deed.

   VIER uitkomsten geven met opzet HETZELFDE antwoord: de pin bestaat niet, de
   pin hoort bij een beschermd profiel (15 of jonger), de pin hoort bij iemand
   die jou blokkeerde, en de pin staat uit. Anders is het verschil in de
   foutmelding precies het gaatje waardoor je alsnog kunt vaststellen dat een
   kind bestaat -- of dat een pin ooit van iemand wás. */
function pinZoek(mij, ruw, context) {
  const pin = pinNormaliseer(ruw);
  if (!pin) return { status: 400, error: 'Een RTG PIN heeft acht of tien tekens, bijvoorbeeld 7K2M9-XPQH3.' };
  if (pinBevroren(mij)) return { status: 423, error: 'Je RTG PIN staat in het noodslot. Zet het slot uit voordat je een nieuwe PIN-handeling doet.' };
  if (!sociaalRate(mij, 'pinzoek', 30, UUR))
    return { status: 429, error: 'Te veel pins geprobeerd. Probeer het over een uur opnieuw.' };
  if (!bronRem.bronMag(context && context.bron))
    return { status: 429, error: 'Te veel PIN-verzoeken vanaf deze verbinding. Probeer het later opnieuw.' };
  /* De huisrem staat NA de eigen rem en VOOR het opzoeken: wie zelf al te snel
     ging, hoort dat te horen, en het budget van het huis mag niet opgaan aan een
     opzoeking die toch al geweigerd werd. */
  if (huisRem.deurDicht()) return { status: 429, error: 'Het opzoeken op pin ligt even stil. Probeer het zo opnieuw, of zoek op codenaam.' };
  if (pinHuidig(mij) === pin) return { status: 400, error: 'Dat is je eigen pin.' };
  const kaart = kijk(mij, handleVanPin(pin));
  if (!kaart) { huisRem.misserGeteld(); return { status: 404, error: 'Deze pin kennen we niet.' }; }
  const intent = pinIntentMaak({ actor: mij, doel: kaart.key, bron: 'vast', referentie: pin });
  pinBeveiligingNoteer(kaart.key, 'pin_bekeken', { bron: 'vast', uitkomst: 'getoond', doel: codenaamVan(mij) });
  return { status: 200, ...kaart, bevestiging: intent.token, bevestigingVervalt: intent.exp };
}

/* Wat het scherm van een gevonden mens te zien krijgt -- of niets, en dan is dat
   voor alle redenen hetzelfde niets. Staat apart omdat de levende code
   (./pin-live.js) op een ANDERE manier bij een handle komt maar op precies
   dezelfde manier moet zwijgen; twee kopieen van deze regel is hoe de ene
   variant een beschermd kind gaat verklappen dat de andere afschermt. */
function kijk(mij, doel) {
  if (!doel || pinBevroren(doel) || isBeschermdHandle(doel) || isGeblokkeerd(mij, doel)) return null;
  return { key: doel, codename: codenaamVan(doel), tier: soortVan(doel),
    st: statusVan(mij, connectieTussen(mij, doel)) };
}

/* Verbinden op pin. Doet zelf geen enkele controle over: hij zoekt de handle
   op en laat socialVerbind de rest doen. Dat is de bedoeling -- daar wonen de
   blokkade, de ouder-goedkeuring en de snelheidsrem, en een tweede kopie
   ervan hier zou de dag na de eerste wijziging al uit de pas lopen.

   'pin' gaat als herkomst mee, zodat de ontvanger op zijn verzoek ziet DAT er
   iemand via zijn pin binnenkwam. Dat is het signaal waarmee hij kan besluiten
   zijn pin te vernieuwen; zonder dat verschil merkt hij nooit dat de pin die
   hij ooit in een groepsapp zette, nog steeds rondgaat. */
async function pinVerbind(mij, ruw, bevestiging) {
  if (pinBevroren(mij)) return { status: 423, error: 'Je RTG PIN staat in het noodslot.' };
  const pin = pinNormaliseer(ruw);
  if (!pin) return { status: 400, error: 'Ongeldige RTG PIN.' };
  const intent = await pinIntentGebruik(bevestiging, { actor: mij, bron: 'vast', referentie: pin });
  if (!intent) return { status: 409, error: 'De bevestiging is verlopen. Zoek de RTG PIN opnieuw op en controleer de ontvanger.' };
  const doel = handleVanPin(pin);
  const kaart = doel === intent.doel ? kijk(mij, doel) : null;
  if (!kaart) return { status: 409, error: 'De RTG PIN is gewijzigd of niet meer beschikbaar. Zoek opnieuw.' };
  const r = await socialVerbind(mij, doel, false, 'pin');
  if (r.error) return r;
  pinBeveiligingNoteer(mij, 'pin_bevestigd', { bron: 'vast', uitkomst: 'verzoek', doel: kaart.codename });
  pinBeveiligingNoteer(doel, 'pin_verzoek', { bron: 'vast', uitkomst: 'ontvangen', doel: codenaamVan(mij) });
  return { ...r, key: doel, codename: kaart.codename };
}

/* De rauwe oplossing, voor de ouderkant (zie ouderVerbind in
   ./vrienden/verbinden.js). Die MAG een beschermd profiel raken -- twee
   ouders wisselen de pin van hun kinderen uit, precies zoals ze nu de
   codenaam overtypen -- en de ouder van het andere kind moet daarna alsnog
   akkoord geven (voogdWacht). De eigen rem zet de aanroeper (die weet op wiens
   naam er geteld moet worden); de huisrem staat hier wel, want dit is dezelfde
   deur naar dezelfde pins. */
function pinNaarHandle(ruw) {
  const pin = pinNormaliseer(ruw);
  if (!pin || huisRem.deurDicht()) return null;
  const doel = handleVanPin(pin);
  if (!doel || pinBevroren(doel)) { huisRem.misserGeteld(); return null; }
  return doel;
}

/* Alleen voor de toetsen: het budget terugzetten zonder een minuut te wachten.
   Blijft hier staan onder zijn oude naam, want de contactpin-toetsen roepen hem
   zo aan; hij zet nu de gedeelde rem terug en niet een eigen kopie. */
const pinDeurReset = () => { bronRem.reset(); huisRem.remReset(); };

return { pinZoek, pinVerbind, pinNaarHandle, pinKijk: kijk, pinDeurReset,
  MIS_PER_MINUUT: huisRem.MIS_PER_MINUUT };
};
