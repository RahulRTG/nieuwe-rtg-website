/* DE LOOPBAAN -- wat er van een mens overblijft als het potje voorbij is.

   VERHAAL.md stap 2, 4 en 5, en stap 0 zit erin verweven: dit is de ENIGE plek
   waar de grens tussen "in het potje" en "blijft bestaan" wordt getrokken.

   HIJ STAAT HIER EN NIET IN magnaat/, en dat is de architectuur die het zelf
   zei. `spelCtx` (kern/spellen.js) geeft een spelmodule save, crypto, schud,
   beurtDoor, codenaamVan en nudge -- en met opzet GEEN db en geen 18+-poort:
   een spel werkt op `potje.staat` en raakt de database niet. Een blijvende
   loopbaan kan daar dus niet wonen. Hij hoort naast ./uitslagen.js en
   ./prestaties.js, precies waar alles staat dat een potje overleeft, en hij
   wordt op dezelfde manier gevoed: vanuit `naPotje` in ./partij.js, idempotent,
   nadat de partij klaar is.

   WAAROM DEZE LAAG BESTAAT. Een tycoonspel geeft cijfers. Wie er vijfhonderd uur
   in stopt onthoudt een getal -- ik had 480 miljoen -- en dat is geen
   herinnering maar een score. Wat blijft hangen is: "weet je nog dat ik als
   afwasser bij jou begon, en dat we jaren later samen een hotelketen hadden?"

   Het verschil tussen die twee zinnen is dit bestand. De eerste gaat over een
   getal dat niemand deelt; de tweede over TWEE MENSEN EN EEN GEDEELD VERLEDEN,
   en dat verleden moet ergens staan.

   ============================ DE GRENS ============================

   1. ACHTTIEN PLUS, EN DAT IS GEEN DETAIL. Alles wat een prestatie BUITEN het
      potje bewaart valt onder `progressieMag` (./grens.js). Een werkverleden is
      precies dat: een bewaarde prestatie tussen twee mensen. Dus geldt dezelfde
      poort -- gecontroleerde paspoort-geboortedatum en 18 of ouder.

      Het is ook de veilige stand. De hoofdstukken in de visie beschrijven
      volwassenen die elkaar aannemen, opleiden en mentor zijn. Een laag waarin
      meerderjarigen minderjarigen werven en aan zich binden met een profiel dat
      de relatie vastlegt, is een kinderveiligheidsoppervlak en geen mechaniek.

      ONDER DE ACHTTIEN BLIJFT ALLES SPEELBAAR. Elke campagne, elke rol, elk
      scherm. Er wordt alleen niets van bewaard, en dat is iets anders dan een
      verbod -- dezelfde zin die De Arena tieners al belooft.

   2. BLIJVENDE WAARDE KOMT UIT TIJD EN UIT WAT JE DEED, NOOIT UIT GELD. Kas,
      bedrijven, ondernemingswaarde, leningen en aandelen blijven in het potje.
      Wat het potje overleeft is het FEIT: je hebt daar gewerkt, zo lang, in die
      rol. Er staat hieronder dan ook geen enkel bedrag.

      Dat is de enige permanentie die geen scheve economie maakt. Wie vermogen
      meeneemt begint rijker, en dan is de eerste campagne een verplichte
      grinderonde. Wie een VERLEDEN meeneemt begint precies even arm.

   3. HET IS VAN DE PERSOON, OP ZIJN CODENAAM. Niet van de werkgever. Jouw
      loopbaan is van jou; je oude werkgever houdt zijn eigen kant van hetzelfde
      feit. Wie iemand IS staat in de identiteitskluis (../accounts.js) en nergens
      anders -- dezelfde regel die ../concern/employment.js al draagt.

   4. WEG ZIJN KOST NIETS. Een loopbaan krimpt nooit, er is geen reeks, geen
      dagbeloning en geen verlopende status. Wie een half jaar wegblijft komt
      terug bij precies wat hij achterliet. Dat is niet vriendelijkheid maar de
      enige stand die met CLAUDE.md verenigbaar is.

   ======================= WAT ER WORDT BEWAARD =======================

   Twee dingen, en het tweede is waar het echt om gaat.

   EEN REGEL PER DIENSTVERBAND: bij wie, welke rol, hoe lang, en waarom het
   ophield. Geen loon, geen bedrag.

   EN DE MOMENTEN, in ./loopbaan-momenten.js. Een ontwerpregel draagt die hele
   laag: EEN MOMENT ONTSTAAT ALLEEN ALS ER EEN TWEEDE PERSOON BIJ WAS. */
'use strict';

/* De momenten en hoe je een duur uitspreekt staan in ./loopbaan-momenten.js:
   daar de herinnering, hier het register. */
const { MOMENTEN, MOMENTLIJST, duur, maakTerugblik } = require('./loopbaan-momenten');

module.exports = ({ db, save, codenaamVan, progressieMag, GEEN_PROGRESSIE }) => {
  const alle = () => {
    if (!db.data.loopbaan || typeof db.data.loopbaan !== 'object') db.data.loopbaan = {};
    return db.data.loopbaan;
  };
  const vanWie = (codenaam) => {
    const l = alle();
    if (!l[codenaam]) l[codenaam] = { banen: [], momenten: [] };
    return l[codenaam];
  };

  /* DE POORT, en hij staat op EEN plek. Alles hieronder loopt hierlangs: is het
     antwoord nee, dan gebeurt er niets en wordt dat GEZEGD -- stil weglaten zou
     betekenen dat een tiener denkt dat het bewaard is. */
  const mag = (handle) => !!progressieMag(handle);

  /* EEN AFGELOPEN DIENSTVERBAND BIJSCHRIJVEN. Beide kanten krijgen hun eigen
     regel, want het is van allebei -- maar elk op zijn eigen codenaam en zonder
     iets van de ander dan die codenaam. */
  function onthoudBaan(handle, codenaam, { werkgever, rol, rolnaam, sector, maanden, reden, potje }) {
    if (!mag(handle)) return { bewaard: false, reden: GEEN_PROGRESSIE };
    if (!codenaam || !werkgever || !maanden) return { bewaard: false, reden: 'onvolledig' };
    /* `sector` is het VAK en niet de werkgever: waar je het geleerd hebt reist
       mee, bij wie je het leerde ook, en geen van beide is een bedrag. */
    vanWie(codenaam).banen.push({ werkgever, rol, rolnaam, sector: sector || null,
      maanden: Math.round(maanden), duur: duur(maanden), reden: reden || 'geeindigd', potje });
    save();
    return { bewaard: true };
  }

  /* EEN MOMENT BIJSCHRIJVEN. `samen` is verplicht en dat is de hele wet van deze
     laag: zonder een tweede mens bestaat het moment niet. En hij komt maar EEN
     keer -- "je eerste baan" is er een, anders is het geen eerste. */
  function onthoud(handle, codenaam, soort, { samen, wat, potje }) {
    if (!mag(handle)) return { bewaard: false, reden: GEEN_PROGRESSIE };
    if (!MOMENTEN[soort]) return { bewaard: false, reden: 'die soort bestaat niet' };
    if (!samen) return { bewaard: false, reden: 'een moment zonder tweede mens bestaat niet' };
    const l = vanWie(codenaam);
    /* EEN EERSTE IS MAAR EEN KEER EEN EERSTE. De soorten die met `eerste_`
       beginnen komen hoogstens een keer voor; de andere mogen vaker. */
    if (soort.startsWith('eerste_') && l.momenten.some(m => m.soort === soort))
      return { bewaard: false, reden: 'die had je al' };
    l.momenten.push({ soort, samen, wat: wat || '', potje });
    save();
    return { bewaard: true };
  }

  /* WAT ER GEBEURT ALS IEMAND STOPT. Drie dingen, en ze zijn alle drie
     asymmetrisch met opzet (VERHAAL.md paragraaf 1):

       - zijn EIGEN kant verdwijnt met hem;
       - de kant van de ANDER blijft, op codenaam, want dat jij drie jaar voor
         iemand werkte is ook DIENS geschiedenis en die mag niet verdwijnen
         omdat de ander vertrekt. Wat overblijft is een codenaam zonder mens;
       - er wordt niets herschreven. Een verleden dat verandert als iemand
         vertrekt, is geen verleden. */
  function stoptErmee(codenaam) {
    const l = alle();
    const weg = !!l[codenaam];
    delete l[codenaam];
    save();
    return { weg, uitleg: 'Wat anderen over deze samenwerking bewaren blijft staan, op codenaam.' };
  }

  /* WAT EEN AFGELOPEN POTJE OPLEVERT staat in ./loopbaan-noteren.js: de
     dienstverbanden EN de overdrachten die iemand naliet. Dat is een eigen
     onderwerp -- het groeit met elke laag die een blijvend feit produceert,
     terwijl dit register af is zodra het klopt. */
  const { noteerLoopbaan, noteerNalatenschap } =
    require('./loopbaan-noteren')({ onthoud, onthoudBaan, duur, codenaamVan, alle });

  const terugblik = maakTerugblik({ alle, mag, GEEN_PROGRESSIE });

  /* WAT JE MEENEEMT NAAR JE VOLGENDE CAMPAGNE staat in ./loopbaan-profiel.js.
     Dit register SCHRIJFT; dat bestand LEEST -- en die richting ontbrak, want
     er werd keurig bewaard dat je drie jaar bedrijfsleider was en niemand
     vroeg er ooit naar. De grens staat daar: geschiedenis maakt deuren
     zichtbaar en schenkt geen waarde. */
  const { profiel, tussen, ervaringIn } =
    require('./loopbaan-profiel')({ alle, mag, GEEN_PROGRESSIE });

  return { MOMENTEN, MOMENTLIJST, duur, mag, onthoudBaan, onthoud, terugblik,
    stoptErmee, noteerLoopbaan, noteerNalatenschap, alle,
    profiel, tussen, ervaringIn };
};
module.exports.MOMENTEN = MOMENTEN;
module.exports.duur = duur;
