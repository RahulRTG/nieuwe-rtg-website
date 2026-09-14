/* DE KEURING VAN EEN GEVOLGCONTRACT -- komt elke bewering erdoor?

   APART VAN ../gevolgcontract.js OM DE REDEN DIE DIT HUIS AL TWEE KEER HEEFT
   OPGESCHREVEN: kern/isolatie/ houdt zijn grammatica (effecten.js), zijn
   uitspraken (effectregister.js) en zijn woordenlijst (effectwoorden.js) apart, en
   server/kern/mutatiecontract/keuring.js staat om dezelfde reden naast zijn
   register. De poort groeit met elke regel die iemand erbij bedenkt; de laag
   eromheen hoort daar niet mee te groeien.

   DE REGEL DIE DEZE POORT DRAAGT: een contract mag MEER zeggen dan de meting, maar
   nooit iets ANDERS. Waar het `graad: gemeten` claimt, moet ../gevolg.js dat
   bevestigen -- anders is het een bewering met een stempel dat niemand heeft gezet.
   ========================================================================== */
'use strict';

const gevolg = require('../gevolg');
const { GRADEN, SOORTEN, klassen, werkwoorden } = require('./woorden');

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

  /* DE TWEE WERKWOORDENLIJSTEN. `veroorzaakt` en `nooit` zijn waar een vergelijker
     op kan vergelijken zonder op naamgelijkheid te gokken: een gesloten lijst uit
     kern/isolatie/effectwoorden.js. Drie regels:

       1. elk woord staat in die lijst (een tikfout is geen nieuw effect);
       2. geen woord staat in BEIDE (dan zegt het contract niets, en een vergelijker
          die daar een winnaar kiest verzint beleid);
       3. `nooit` is een BEWERING en geen leegte -- staat er niets, dan zegt het
          contract niet "er gebeurt niets anders" maar "ik weet het niet". Dat
          verschil is het hele punt van deze laag, dus het wordt hier niet
          afgedwongen maar door `vergelijk()` als GAT gemeld. */
  for (const veld of ['veroorzaakt', 'nooit']) {
    const lijst = c && c[veld];
    if (lijst === undefined) continue;
    if (!Array.isArray(lijst)) { fout.push('`' + veld + '` hoort een lijst werkwoorden te zijn'); continue; }
    for (const w of lijst)
      if (!werkwoorden().includes(w))
        fout.push('`' + veld + '` noemt "' + w + '", en dat staat niet in de woordenlijst van ' +
          'kern/isolatie/effectwoorden.js');
  }
  const beide = (Array.isArray(c && c.veroorzaakt) ? c.veroorzaakt : [])
    .filter(w => (Array.isArray(c && c.nooit) ? c.nooit : []).includes(w));
  for (const w of beide)
    fout.push('"' + w + '" staat in `veroorzaakt` EN in `nooit`; dan zegt het contract niets');

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

module.exports = { keur };
