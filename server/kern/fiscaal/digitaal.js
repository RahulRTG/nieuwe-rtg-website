/* ============================================================================
   DE BTW OP EEN DIGITALE DIENST -- en waarom dat een ANDER antwoord is dan
   ./tarief.js geeft.

   ./tarief.js beantwoordt de vraag voor een zaak: welk tarief hoort bij deze
   verkoop, in het land van de ZAAK. Dat klopt voor een maaltijd, een kamer en
   een rit: die vinden plaats waar de zaak staat, en daar is de btw ook
   verschuldigd.

   Voor een DIGITALE DIENST aan een consument geldt het omgekeerde. De plaats
   van de dienst is waar de AFNEMER woont (art. 58 btw-richtlijn), en dus is het
   tarief van het land van het lid het juiste. Een app die een Spaanse uitgever
   verkoopt aan een Nederlands lid draagt Nederlandse btw, niet Spaanse.

   DIT IS GEEN TWEEDE WAARHEID (LAT-regel 4). De tarieven komen uit dezelfde
   levende landentabel als ./tarief.js -- ./landen.js, met de overlay van de
   Regelwacht eroverheen. Wat verschilt is de VRAAG, niet het cijfer: welk land
   telt. Zou dit in kern/appstore/ staan, dan zou de App Store een eigen fiscale
   mening krijgen, en dat is precies wat hier niet mag.

   WAT ER NIET IS, EN WAT DAT BETEKENT.

   Dit rekent een bedrag uit; het doet GEEN aangifte. Er is geen OSS-registratie,
   geen drempelbewaking (de EUR 10.000-grens waaronder een kleine verkoper zijn
   eigen landtarief mag houden), geen onderscheid tussen zakelijke en
   particuliere afnemers (btw-verlegging bij een geldig btw-nummer) en geen
   controle op twee bewijsstukken van de woonplaats zoals de uitvoeringsverordening
   vraagt. Wat er wel is: elke aanschaf legt land, tarief en bedrag vast, zodat
   een boekhouder het kan aangeven. Dat staat ook zo in APPSTORE.md; een bedrag
   dat eruitziet als een aangifte terwijl er geen aangifte achter zit, is de
   duurste vorm van LAT-regel 6.

   EN HET RAADT NOOIT. Een land dat niet in de tabel staat, levert geen
   standaardtarief maar een weigering met de reden. Een aanschaf met een verzonnen
   btw-tarief is erger dan geen aanschaf: hij ziet er precies zo uit als een
   goede.
   ========================================================================== */
'use strict';

const { LANDEN } = require('./landen');

const LANDVORM = /^[A-Z]{2}$/;

/* Het tarief voor een digitale dienst in dit land: het STANDAARDtarief, en niet
   een verlaagd tarief. Verlaagde tarieven horen bij eten, logies en vervoer;
   software valt daar in geen enkel land van deze tabel onder. */
function tariefVoorDigitaal(land) {
  const l = String(land || '').trim().toUpperCase();
  if (!LANDVORM.test(l)) return null;
  const rij = Object.prototype.hasOwnProperty.call(LANDEN, l) ? LANDEN[l] : null;
  if (!rij || !rij.tarieven || rij.tarieven.standaard == null) return null;
  return { land: l, naam: rij.naam, procent: Number(rij.tarieven.standaard) };
}

/* De splitsing van een BRUTO bedrag (wat het lid betaalt) in btw en netto.

   Bruto en niet netto, en dat is een besluit: de prijs die een uitgever
   opgeeft, is de prijs die het lid ziet. Zou hij netto zijn, dan verandert het
   bedrag op het scherm per land -- en dan is "wat kost deze app" geen vraag met
   een antwoord meer.

   Afronden op hele centen, en de btw naar beneden. De uitgever krijgt daarmee
   hooguit een cent meer dan hij strikt zou moeten en de fiscus nooit een cent
   te weinig; het omgekeerde zou een bedrag opleveren dat niet is geind. */
function splitsBruto(brutoCenten, land) {
  const t = tariefVoorDigitaal(land);
  if (!t) return { error: 'Voor dit land kennen wij geen btw-tarief; zonder tarief is de aanschaf niet af te rekenen.', status: 409, land: String(land || '').toUpperCase() || null };
  const bruto = Math.round(Number(brutoCenten) || 0);
  if (!Number.isFinite(bruto) || bruto < 0) return { error: 'Dat bedrag kan niet.', status: 400 };
  const btw = Math.floor(bruto - (bruto / (1 + t.procent / 100)));
  return { ok: true, land: t.land, landNaam: t.naam, tariefProcent: t.procent,
    brutoCenten: bruto, btwCenten: btw, nettoCenten: bruto - btw };
}

/* Van wat een mens heeft opgeschreven naar een landcode.

   De onboarding vraagt "en in welk land?" en bewaart het antwoord als vrije
   tekst -- "Nederland", "nederland", "NL", "the netherlands". Voor een adres op
   een pakket is dat genoeg; voor een btw-tarief niet. Deze functie doet EEN
   ding: hem herkennen als hij te herkennen is, en anders null teruggeven. Ze
   raadt niet en ze kiest geen standaardland, want een verkeerd land is een
   verkeerd tarief en dat ziet er precies zo uit als een goed tarief.

   Wat NIET wordt herkend, is geen fout van het lid maar een vraag: het scherm
   laat hem dan zelf zijn land kiezen uit dezelfde tabel. */
function landcodeUit(tekst) {
  const t = String(tekst == null ? '' : tekst).trim();
  if (!t) return null;
  const kort = t.toUpperCase();
  if (LANDVORM.test(kort) && Object.prototype.hasOwnProperty.call(LANDEN, kort)) return kort;
  const plat = (x) => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  const zoek = plat(t);
  if (!zoek) return null;
  for (const [code, rij] of Object.entries(LANDEN)) if (plat(rij.naam) === zoek) return code;
  return null;
}

/* De lijst waaruit een lid kiest: code en naam, op naam gesorteerd. Uit dezelfde
   tabel als het tarief, zodat er geen land in de keuzelijst kan staan waarvoor
   we geen tarief kennen. */
function landkeuze() {
  return Object.entries(LANDEN).map(([code, rij]) => ({ code, naam: rij.naam }))
    .sort((a, b) => (a.naam < b.naam ? -1 : 1));
}

module.exports = { tariefVoorDigitaal, splitsBruto, landcodeUit, landkeuze, LANDVORM };
