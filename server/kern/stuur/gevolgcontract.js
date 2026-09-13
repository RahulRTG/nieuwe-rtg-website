/* ============================================================================
   HET GEVOLGCONTRACT -- wat een capability VEROORZAAKT, verklaard en begrensd.

   WAAROM DIT NAAST ./gevolg.js STAAT EN HEM NIET VERVANGT. `gevolg.js` MEET: hij
   leest de `opslag` van IDEMPROEF.json en zegt welke collecties een route een
   keer echt aanraakte. Dat is hard en het is smal -- vers gemeten over de 173
   AI-bereikbare paden: 38 gemeten, 48 zonder effect, en 87 ONBEKEND. Een
   voorspelling die daarop leunt, weet van de helft niets.

   Dit bestand voegt de andere helft toe: een VERKLARING van een mens over wat een
   handeling veroorzaakt -- afgeleide gevolgen, gevolgen buiten de opslag, wat er
   bij een mislukking gebeurt, en wat we met opzet NIET weten. Meting en verklaring
   staan naast elkaar en worden nooit opgeteld; dat is dezelfde vorm als de twee
   assen van scripts/machinedekking.js en scripts/kantoormacht.js.

   DE REGEL DIE DIT EERLIJK HOUDT, en het is de enige die echt telt: een contract
   mag MEER zeggen dan de meting, maar nooit iets ANDERS. Waar het `graad: gemeten`
   claimt, moet `gevolg.js` dat bevestigen -- anders is het een bewering met een
   stempel dat niemand heeft gezet, en dan is dit register binnen een maand het
   valse groen dat het moest voorkomen. `keur()` weigert zo'n regel.

   VIER DINGEN UIT HET VOORSTEL ZIJN GEMETEN EN AANGEPAST. Niet uit voorzichtigheid
   maar omdat de naam of de ladder al bezet was:

   1. `reversible: yes/no` WORDT NIET VERKLAARD. Herstel is in dit huis GEMETEN,
      met VIJF uitslagen: `exact`, `compensatie`, `geen-herstel`, `nietBeproefd` en
      `wereldOntbreekt` (scripts/herstelproef.js). Een boolean eroverheen zou een
      meting met vijf standen platslaan tot twee -- en juist het verschil tussen
      "een creditnota" en "de factuur is weg" is waar die proef voor bestaat.
      Het contract VERWIJST dus naar die proef en verklaart hem niet.

   2. `KNOWN / BOUNDED / UNKNOWN` WORDT GEEN ZESDE ZEKERHEIDSLADDER. Dit huis
      heeft er al: de vier bewijsgraden (onbekend/vermoed/gemeten/bewezen, op twee
      plekken in kern/ als `GRADEN`), de drie graden van gevolg.js, vijf
      assurance-standen, acht uitkomsten in CONTROLPLANE.md, vier fiscale
      zekerheidsklassen, en `bewezenBegrensd`/`aannemelijkBegrensd` in
      scripts/lib/lusvorm.js -- dus zelfs het WOORD begrensd is bezet.
      AFSPRAAK.md verbiedt een zesde ladder met zoveel woorden.

      De bedoeling erachter is wel juist en blijft overeind, maar als TWEEDE AS in
      plaats van als derde trede: de graad zegt hoe hard we het weten, en het veld
      `uitkomsten` zegt of de uitkomstRUIMTE benoemd is. Een externe betaling met
      een gesloten set (`betaald`, `geweigerd`, `teruggeboekt`) is iets anders dan
      een gevolg waarvan niemand de mogelijkheden kent -- en dat verschil staat er
      nu zonder een nieuw woord voor "bounded".

   3. `affectedGoals` HEET `streefstand`. `doel` draagt in dit huis al twee
      betekenissen over 28 modules (een levensdoel en de AVG-doelbinding), en de
      gouden weg gebruikt daarom al `streefstand` voor wat na de handeling waar
      moet zijn (kern/kantoor/geldketen/klaarzet.js).

   4. `privacyImpact` HEET `classificatie`, uit de woordenlijst van
      kern/envelop.js. Daar staat ook de regel die meekomt: `onbekend` is geen
      `openbaar`, en een gevolg erft de classificatie niet -- dat zou raden zijn.

   WAT DIT BESTAND NIET DOET. Het voert niets uit, het beslist niets en het bezit
   geen plan -- net als ./plan.js en ./gevolg.js. En het zegt nooit HOEVEEL er
   verandert: "bankSaldi" is een collectie, geen bedrag. Wie hier een getal in wil,
   bouwt een tweede boekhouding.
   ========================================================================== */
'use strict';

const gevolg = require('./gevolg');

/* De graden, de soorten en de geleende classificaties wonen in
   ./gevolgcontract/woorden.js -- daar staat ook waarom deze laag `gevolg` heet en
   niet `effect`, want dat woord is in dit huis vijf keer bezet. */
const { GRADEN, SOORTEN, klassen } = require('./gevolgcontract/woorden');

/* ---------------------------------------------------------------------------
   DE KEURING. Een contract komt er alleen door als elke bewering draagbaar is.
   ------------------------------------------------------------------------- */
function keur(c) {
  const fout = [];
  const pad = (c && c.capability) || null;
  if (!pad || !String(pad).startsWith('/api/')) fout.push('een contract zonder capability-pad');

  /* GEEN HANDMATIG HERSTEL. Zie punt 1 in de kop: herstel is gemeten en heeft
     vijf uitslagen; een verklaring eroverheen is een platslag. */
  for (const verboden of ['reversible', 'omkeerbaar', 'herstelbaar', 'compensation']) {
    if (c && Object.prototype.hasOwnProperty.call(c, verboden))
      fout.push('het veld "' + verboden + '" wordt niet verklaard maar GEMETEN ' +
        '(scripts/herstelproef.js, vijf uitslagen); verwijs ernaar in plaats van het te beweren');
  }
  /* En de drie namen die al bezet zijn. Een botsing op een centrale naam is de
     duurste fout die SEMANTIEK.json meet, dus hij wordt hier geweigerd en niet
     stilzwijgend omgezet. */
  const bezet = { doel: 'streefstand', doelen: 'streefstand', privacyImpact: 'classificatie',
    goals: 'streefstand' };
  for (const [naam, ipv] of Object.entries(bezet))
    if (c && Object.prototype.hasOwnProperty.call(c, naam))
      fout.push('het veld "' + naam + '" heet hier "' + ipv + '" -- die naam is elders al bezet');

  /* Elke bewering draagt een SOORT, een graad uit de vier, en een reden. */
  const beweringen = Array.isArray(c && c.gevolgen) ? c.gevolgen : [];
  if (!beweringen.length) fout.push('een contract zonder enkel gevolg; dan is er niets verklaard');
  for (const g of beweringen) {
    const merk = (g && g.wat) ? String(g.wat).slice(0, 40) : '(zonder wat)';
    if (!g || !SOORTEN.includes(g.soort)) fout.push(merk + ': soort hoort een van ' + SOORTEN.join('/') + ' te zijn');
    if (!g || !GRADEN.includes(g.graad)) fout.push(merk + ': graad hoort een van ' + GRADEN.join('/') + ' te zijn');
    if (!g || !g.wat) fout.push('een gevolg zonder `wat`');
    if (g && !g.reden) fout.push(merk + ': elk gevolg draagt een reden, ook een gemeten');
    /* DE UITKOMSTRUIMTE IS EEN VELD EN GEEN TREDE (punt 2 in de kop). Staat hij
       er, dan is hij GESLOTEN: een lijst met minstens twee benoemde uitkomsten.
       Een lijst van een is geen ruimte maar een bewering. */
    if (g && g.uitkomsten !== undefined) {
      if (!Array.isArray(g.uitkomsten) || g.uitkomsten.length < 2)
        fout.push(merk + ': `uitkomsten` is een GESLOTEN set van minstens twee benoemde uitkomsten');
    }
    /* Een gevolg BUITEN de opslag kan nooit `gemeten` zijn: de meting kijkt
       alleen naar collecties. Dat staat in GRENZEN van gevolg.js als punt 3, en
       hier wordt het afgedwongen in plaats van gehoopt. */
    if (g && g.soort === 'buiten' && (g.graad === 'gemeten' || g.graad === 'bewezen'))
      fout.push(merk + ': een gevolg buiten de opslag kan niet `' + g.graad +
        '` zijn -- gevolg.js kijkt alleen naar collecties (zie zijn GRENZEN, punt 3)');
  }

  if (c && c.classificatie !== undefined && !klassen().includes(c.classificatie))
    fout.push('classificatie "' + c.classificatie + '" staat niet in de woordenlijst van kern/envelop.js');

  /* DE BELANGRIJKSTE: EEN GEMETEN DIRECT GEVOLG MOET DOOR DE METING GEDEKT ZIJN.
     Claimt het contract dat een collectie verandert en zag de proef die collectie
     nooit, dan is dat geen verklaring maar een wens. Omgekeerd mag de meting MEER
     zien dan het contract noemt -- dat is een onvolledig contract en geen leugen,
     en `dekking()` hieronder telt het als GEDEELTELIJK. */
  if (pad) {
    const m = gevolg.gevolgVan(pad);
    const gemeten = new Set(m.collecties || []);
    for (const g of beweringen) {
      if (!g || g.soort !== 'direct' || g.graad !== 'gemeten') continue;
      if (!g.collectie) { fout.push(String(g.wat).slice(0, 40) + ': een gemeten direct gevolg noemt zijn collectie'); continue; }
      if (!gemeten.has(g.collectie))
        fout.push(String(g.wat).slice(0, 40) + ': claimt `gemeten` op collectie "' + g.collectie +
          '" maar de proef zag die daar nooit veranderen (gevolg.js zegt: ' + m.graad + ')');
    }
  }
  return fout;
}

const { stand, STANDEN } = require('./gevolgcontract/stand');

module.exports = { keur, stand, GRADEN, SOORTEN, STANDEN, klassen };
