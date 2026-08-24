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
   hij hier aan de DEUR: een huisbreed budget aan MISSERS per minuut, gedeeld
   door elke ingang die een pin opzoekt (de leden-app, de gezinsapp, de
   ouderroute). Wie er een derde bij bouwt, gebruikt hem ook; dat is de hele
   bedoeling.

   ALLEEN MISSERS TELLEN, en dat is wat het budget bruikbaar maakt. Een lid dat
   een pin overtypt of scant, mist vrijwel nooit: hij kreeg hem net. Een raadster
   mist per definitie bijna altijd. Het budget staat daarom laag genoeg om te
   bijten en zo hoog dat normaal gebruik er nooit aan komt.

   DE PRIJS, EERLIJK: een huisbrede teller is een huisbrede knop. Wie bereid is
   MIS_PER_MINUUT missers per minuut te produceren, zet het opzoeken op pin voor
   iedereen een minuut lang dicht. Dat is een bewuste ruil: zoeken op codenaam
   werkt gewoon door, bestaande vrienden merken niets, en het alternatief is een
   deur die alleen per bezoeker telt en dus bij genoeg bezoekers niet telt. Deze
   De directe rem woont in het geheugen en blijft dus ook zonder infrastructuur
   werken. De HTTP-rand voegt met REDIS_URL dezelfde grenzen atomisch over alle
   instances toe (./pin-clusterrem.js); RTG_PIN_ENTERPRISE=1 maakt die gedeelde
   laag verplicht en laat productie anders niet starten.
   --------------------------------------------------------------------------- */
module.exports = (ctx) => {
const { codenaamVan, soortVan, isBeschermdHandle, isGeblokkeerd, sociaalRate,
  statusVan, connectieTussen, socialVerbind, pinHuidig, pinNormaliseer, handleVanPin,
  pinBevroren, pinBeveiligingNoteer, pinIntentMaak, pinIntentGebruik, crypto } = ctx;
const rem = require('./pin-deur-rem')({ crypto });

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
  if (!sociaalRate(mij, 'pinzoek', 30, rem.UUR))
    return { status: 429, error: 'Te veel pins geprobeerd. Probeer het over een uur opnieuw.' };
  if (!rem.bronMag(context && context.bron))
    return { status: 429, error: 'Te veel PIN-verzoeken vanaf deze verbinding. Probeer het later opnieuw.' };
  /* De huisrem staat NA de eigen rem en VOOR het opzoeken: wie zelf al te snel
     ging, hoort dat te horen, en het budget van het huis mag niet opgaan aan een
     opzoeking die toch al geweigerd werd. */
  if (rem.dicht()) return { status: 429, error: 'Het opzoeken op pin ligt even stil. Probeer het zo opnieuw, of zoek op codenaam.' };
  if (pinHuidig(mij) === pin) return { status: 400, error: 'Dat is je eigen pin.' };
  const kaart = kijk(mij, handleVanPin(pin));
  if (!kaart) { rem.misser(); return { status: 404, error: 'Deze pin kennen we niet.' }; }
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
  if (!pin || rem.dicht()) return null;
  const doel = handleVanPin(pin);
  if (!doel || pinBevroren(doel)) { rem.misser(); return null; }
  return doel;
}

// alleen voor de toetsen: het budget terugzetten zonder een minuut te wachten
function pinDeurReset() { rem.reset(); }

return { pinZoek, pinVerbind, pinNaarHandle, pinKijk: kijk, pinDeurReset,
  MIS_PER_MINUUT: rem.MIS_PER_MINUUT };
};
