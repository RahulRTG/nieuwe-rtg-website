/* ============================================================================
   DE KERN SAMENSTELLEN -- deel 1 van 7, en de uitleg voor alle delen.

   WAAROM DIT OP POSITIE IS GEKNIPT EN NIET OP THEMA. De samenstelling was een
   aaneengesloten blok van 790 regels in server.js: honderddrie regels van de
   vorm Object.assign(kern, require(...)). De VOLGORDE daarvan doet ertoe -- een
   module die een andere uit de kern leest moet erna staan, en dat is hier al een
   keer misgegaan met de postlaag en de antivirus. Een thematische indeling zou
   die volgorde door de war gooien. Het zijn dus aaneengesloten stukken die in
   precies hun oude orde worden aangeroepen; doen alsof het een inhoudelijke
   indeling is, zou een net verhaal over een positionele knip zijn.

   WAAR DE GRENZEN LIGGEN, EN WAAROM NIET ELKE 6 KB. Een knip mag geen naam
   afsnijden van zijn gebruik. De eerste poging deed dat wel en het opstarten
   viel om op "bankregie is not defined" -- luid, meteen, en daarmee precies
   zoals bedoeld. De knipper schuift een grens nu vooruit tot niets meer
   oversteekt, dus de stukken zijn ongelijk van lengte. Dat is de goede ruil.

   DE TWEE DINGEN DIE ELKE LAAG BINNENKRIJGT

   `kern` is het gedeelde object dat elke laag verder vult -- Object.assign
   muteert hetzelfde object, dus wat laag 1 erin zet kan laag 2 lezen.
   `hulp` draagt de helpers en constanten uit server.js die deze modules nodig
   hebben, op EEN plek in plaats van acht eigen lijstjes.
   ========================================================================== */
'use strict';

module.exports = (kern, hulp) => {
  const { DATA_DIR, PERSONAS, accounts, anthropic, boekingenVanKlant, crypto, db, findSupplier, keyVanCodenaam, ledenAantal, leeftijdVan, log, mail, media, ordersVanKlant, ordersVanZaak, rtf, save, schoon, sendPush, sendPushToUser, sociaal, sseToCustomer, sseToOffice } = hulp;

Object.assign(kern, sociaal); // de sociale kern-helpers erbij
/* Tafelticket (kern/tafelticket.js): de bonnen van dezelfde tafel op een
   gezegeld ticket (HMAC), met verse controle bij het afrekenen. De AI en de
   kassa lopen over dezelfde /api/supplier/tafelticket-route. */
Object.assign(kern, { tafelticket: require('../kern/tafelticket')({ crypto, dataDir: DATA_DIR, findSupplier, ordersVanZaak }) });
// De dynamische, gesloten RTG-code: HMAC-ondertekende, kort houdbare tokens die
// alleen ons systeem maakt en verifieert (dyncode.key, 0600, in .gitignore).
Object.assign(kern, { dyncode: require('../kern/dyncode')({ crypto, dataDir: DATA_DIR }) });
/* Spellen (kern/spellen.js): mens-erger-je-niet, schaken, woordduel en het
   Sneek-scorebord op de vriendenlaag; RTF- en RTG-leden spelen tegen elkaar. */
Object.assign(kern, require('../kern/spellen')({
  db, save, crypto, zijnVrienden: kern.zijnVrienden, codenaamVan: kern.codenaamVan, sseToCustomer,
  isGeblokkeerd: kern.isGeblokkeerd, socialZoek: kern.socialZoek, sociaalRate: kern.sociaalRate,
  // Rahul als spelmaatje: praat met een echte sleutel, valt anders terug op vaste tips
  anthropic,
  // 18+ (voor Proost): alleen een echt account met paspoort-geboortedatum telt;
  // RTF-gezinsprofielen hebben geen geverifieerde leeftijd en doen nooit mee
  volwassen: (handle) => {
    const m = /^user-(.+)$/.exec(String(handle || ''));
    const geboren = m ? ((accounts.getMemberState(m[1]) || {}).geboren || null) : ((PERSONAS[handle] || {}).geboren || null);
    const lft = leeftijdVan(geboren);
    return lft != null && lft >= 18;
  }
}));
/* RTG Veilig (kern/veilig/): de ruggengraat onder vier apps -- Thuiswacht
   ("ik ben over X minuten thuis"), het stille Codewoord, de Vitale check-in
   en Thuisrust ("niet storen tot thuis").

   De dodemansknop telt op de klok van DEZE server, niet in de app. Dat is de
   hele reden dat het werkt als de telefoon uitvalt: geen levensteken is zelf
   het signaal. Zie kern/veilig/wacht.js. */
function meldAan(handle, note) {
  if (!handle) return null;
  const n = { id: crypto.randomBytes(4).toString('hex'), read: false, at: new Date().toISOString(), ...note };
  /* De veiligheidsbaan: een rust-stand ("niet storen") mag een
     veiligheidsmelding NOOIT tegenhouden. Daarom vraagt deze poort het
     expliciet, in plaats van de gewone meldingsvoorkeuren te volgen. */
  if (kern.rustMagDoor && !kern.rustMagDoor(handle, n)) return n;
  db.data.notifications[handle] = (db.data.notifications[handle] || []);
  db.data.notifications[handle].unshift(n);
  db.data.notifications[handle] = db.data.notifications[handle].slice(0, 40);
  save();
  sseToCustomer(handle, 'notify', n);
  sseToCustomer(handle, 'veilig', n);          // de vier apps luisteren hierop
  try { sendPush(handle, n); } catch (e) { /* push mag een alarm nooit tegenhouden */ }
  const m = /^user-(.+)$/.exec(String(handle));
  if (m) { try { sendPushToUser(m[1], n); } catch (e) {} }
  return n;
}
Object.assign(kern, require('../kern/veiligheid')({
  db, save, crypto, schoon, mail,
  kluis: require('../accounts/kluis'),
  sociaal: { codenaamVan: kern.codenaamVan, zijnVrienden: kern.zijnVrienden },
  meldAan,
  appUrl: () => process.env.APP_URL || ''
}));
kern.meldAan = meldAan;

/* Rahul kijkt mee (kern/kijken.js): een foto van iets, en hij zegt wat het is.
   De foto wordt nergens bewaard; zie de kop van die module. */
Object.assign(kern, require('../kern/kijken').maakKijken({ anthropic }));

/* Het salongesprek (kern/kletspraat/): de Rahul van het ene lid kletst met de
   Rahul van een vriend over hoe hun dag was. Een gimmick met drie sloten:
   alleen tussen vrienden, alleen als beiden het aan hebben staan, en altijd
   met verzonnen plaatsnamen. Zie de kop van die module. */
Object.assign(kern, require('../kern/kletspraat')({
  db, save, crypto,
  sociaal: { codenaamVan: kern.codenaamVan, zijnVrienden: kern.zijnVrienden },
  ordersVanKlant, boekingenVanKlant, anthropic,
  dagContext: require('../kern/context').dagContext, sseToCustomer
}));
/* De sweep: elke halve minuut kijken of er een wacht is afgelopen. Dit is de
   klok die doortikt terwijl de telefoon van het lid uit staat. De overgangen
   zijn idempotent (elke stap kijkt eerst naar de huidige status), dus een
   dubbele sweep levert hooguit een dubbele melding op, nooit een dubbele
   toestand. */
setInterval(() => { try { kern.veiligSweep(); } catch (e) { console.error('[veilig] sweep:', e.message); } }, 30 * 1000).unref();

/* De leerlaag (kern/leren.js): overhoorlijsten, het overhoorduel, samen aan
   projecten en schrijven met buddy-feedback; RTF- en RTG-leden doen samen mee. */
Object.assign(kern, require('../kern/leren')({
  db, save, crypto, codenaamVan: kern.codenaamVan, zijnVrienden: kern.zijnVrienden, socialZoek: kern.socialZoek,
  isGeblokkeerd: kern.isGeblokkeerd, sociaalRate: kern.sociaalRate, sseToCustomer, anthropic, leeftijdInstr: rtf.leeftijdInstr
}));
/* Het babyboekje (kern/baby.js): het dagboek van de allerkleinsten, met
   gezinsnamen en AI-gezinsmomenten; foto's gaan naar de mediastore. */
Object.assign(kern, require('../kern/baby')({ save, crypto, media, anthropic }));
/* De welzijnslaag (kern/welzijn.js): het prive-gevoelsdagboek van een kind;
   niemand leest mee, het scherm wijst zelf warm de weg naar hulp. */
Object.assign(kern, require('../kern/welzijn')({ save }));
/* De RTG-kantoren (kern/afdelingen.js): twaalf afdelingskamers en de
   boardroom die alles ziet en het functieschakelbord bedient. */
Object.assign(kern, require('../kern/afdelingen')({ db, save, crypto, anthropic, ledenAantal, accounts, keyVanCodenaam }));
/* RTG Atelier (kern/atelier.js): het besloten ontwerpbureau van de kantoren
   voor mode en alles wat je aan het lijf draagt. AI tekent concepten uit,
   levert tech packs en de blik van de creatief directeur; het palet komt als
   naam + hex mee zodat het scherm een moodboard toont. */
Object.assign(kern, require('../kern/atelier').maakAtelier({ db, save, crypto, anthropic, schoon }));
/* RTG Ontwerpstudio (kern/studio.js): de tegenhanger van het Atelier voor
   alles wat je beweegt: automotive, jachten & boten, luchtvaart en
   helikopters. AI tekent het concept uit, levert een specsheet en de blik
   van de chef-ontwerper. */
Object.assign(kern, require('../kern/studio').maakStudio({ db, save, crypto, anthropic, schoon }));
/* RTG Hardwarelab (kern/hardwarelab.js): de derde ontwerptak, voor de eigen
   apparaten: PDA's en tablets, schermen, sensoren, de zaakdoos-familie en
   accessoires. AI tekent het concept uit, levert een stuklijst en de blik
   van de chef-engineer. */
Object.assign(kern, require('../kern/hardwarelab').maakHardwarelab({ db, save, crypto, anthropic, schoon }));

/* Het stadsweefsel (kern/stadsweefsel/): de ondergrond onder de stad --
   geografie, objecten, indicatoren, begroting, besluitvorming en het
   algoritmeregister.

   DE VOLGORDE IS HIER GEDRAG. Het weefsel staat VOOR zijn lezers: kern/gemeente
   (laag 2) biedt zijn meldingen bij de zaakmotor aan en kern/stad (laag 5) leest
   zijn zones uit de geografie. Wie dit blok naar beneden schuift, start een stad
   zonder ondergrond -- en dan hangt een gemeentemelding aan geen enkele zaak.
   Het staat in deze laag en niet in laag 2 omdat die daarmee over de 10 KB ging;
   eerder is hier ook goed, want alles wat het weefsel nodig heeft bestaat al. */
const melderSeintje = (codenaam) => {
  try { Promise.resolve(keyVanCodenaam(codenaam)).then(t => { if (t && t.key) sseToCustomer(t.key, 'sync', { scope: 'stad' }); }).catch(() => {}); }
  catch (e) { log.uitzondering(e, { bron: 'weefsel', waar: 'melderSeintje' }); }
};
Object.assign(kern, require('../kern/stadsweefsel')({ db, save, crypto, sseToOffice, melderSeintje, log }));
};
