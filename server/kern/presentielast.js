/* RTG School: wat een presentielijst een leraar kost.

   In het belofteregister stond "presentie van een les staat binnen 30
   seconden" met daarachter: meting nog niet. Deze module rekent uit wat
   narekenbaar is, en zegt er even hard bij wat het niet is.

   DRIE DELEN, EN MAAR TWEE ERVAN ZIJN TE METEN.

   1. HET AANTAL HANDELINGEN. Exact te tellen, en het hangt aan een ontwerp-
      keuze: het scherm zet iedereen op `aanwezig` en de leraar wijzigt alleen
      de UITZONDERINGEN. Een klas van dertig met twee afwezigen kost dan drie
      handelingen en niet dertig. Zou het scherm leeg beginnen, dan is dertig
      seconden onhaalbaar en is de belofte een wens. Dat is het verschil tussen
      uitzonderingsgestuurd ontwerpen en een formulier (ONTWERP.md).
   2. DE SERVER. Echt te meten: hoe lang /school/aanwezigheid/zet erover doet
      voor een volle klas. Zie test/presentiemeting.test.js.
   3. DE MENS. NIET te meten vanaf hier. Hoe snel een leraar dertig kinderen
      overziet, op een schoollaptop, met een klas die binnenloopt -- dat weet
      deze machine niet en er is nooit iemand mee geklokt. Wij zeggen dus niet
      "dertig seconden gehaald" maar "dit is wat het kost aan handelingen en
      aan server; de rest is ongemeten".

   WAAROM HIER GEEN SECONDEN PER KLIK STAAN. Dat zou een verzonnen getal zijn
   dat er gemeten uitziet -- precies de fout die in kern/koppelvlak-kaarten.js
   is rechtgezet. Een aantal handelingen is een feit; een seconde per handeling
   is een gok. */

/* De belofte zelf, zodat het getal op een plek staat. */
const BUDGET_SECONDEN = 30;

/* Wat het scherm van een leraar vraagt. `uitzonderingen` is het aantal
   leerlingen dat NIET gewoon aanwezig is; de rest staat al goed.

   De +1 is de knop "Zet de presentie". Datum, lesuur en vak tellen niet mee:
   die staan al ingevuld (vandaag, het eerste uur) en vak mag leeg. */
function handelingen(leerlingen, uitzonderingen) {
  const n = Math.max(0, Number(leerlingen) || 0);
  const u = Math.min(n, Math.max(0, Number(uitzonderingen) || 0));
  return { leerlingen: n, uitzonderingen: u, handelingen: u + 1,
    /* Waar het op zou uitkomen ZONDER de standaardstand: dan is elke leerling
       een handeling. Dat getal staat erbij omdat het de ontwerpkeuze zichtbaar
       maakt in plaats van hem te laten verdwijnen in een gewoonte. */
    zonderStandaard: n + 1,
    bespaard: n - u };
}

/* Een leraar die te laat noteert, geeft er minuten bij: dat is een tweede
   handeling voor die ene leerling. Wie dat vergeet mee te tellen, meet een
   makkelijkere klas dan er is. */
function metMinuten(leerlingen, uitzonderingen, telaat) {
  const b = handelingen(leerlingen, uitzonderingen);
  const t = Math.min(b.uitzonderingen, Math.max(0, Number(telaat) || 0));
  return Object.assign(b, { telaat: t, handelingen: b.handelingen + t });
}

module.exports = { BUDGET_SECONDEN, handelingen, metMinuten,
  ongemeten: 'hoe snel een mens dit doet: er is nooit een leraar mee geklokt' };
