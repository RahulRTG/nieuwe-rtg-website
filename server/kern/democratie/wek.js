/* ============================================================================
   DE WEK -- de melding na een vastgelegde eindstand (kern/democratie).

   De terugkoppeling heeft twee helften en alleen de eerste is het bewijs: de
   eindstand is te LEZEN via de eigen lijst van de inbrenger, in dezelfde
   vastlegging. De wek is een melding daarbovenop, en de trede `gewekt` wordt
   pas gezet als meldLid hem echt bezorgde -- een melding die de rust of de
   voorkeur van het lid tegenhield, geeft null (opzet/meldaan.js) en laat de
   trede op `klaargezet`. Afgesplitst uit ./index.js op de omvangsgrens. */
'use strict';

function maakWek({ schrijver, koppeling, vastleggen, meldLid, ontvangersVan, kijk }) {
  /* De wek na een vastgelegde eindstand. Mislukt hij, dan blijft de trede
     `klaargezet` staan: verklaard, en herbezorgbaar. */
  async function wek(k) {
    const r = schrijver.huidige(k);
    if (r.stand !== 'afgesloten') return 0;
    let n = 0;
    for (const ref of ontvangersVan(k)) {
      const t = r.terugkoppeling && r.terugkoppeling[ref];
      const sleutel = koppeling.sleutelVan(ref);
      if (!t || t.stand !== 'klaargezet' || !sleutel) continue;
      let gewekt = null;
      try {
        /* De wek zegt NIET welke kwestie en niet welke uitkomst: een bericht op
           de sleutel van het lid met het kwestienummer erin is een koppeling
           tussen mens en kwestie buiten ./koppeling.js om. */
        gewekt = meldLid(sleutel, { icon: 'kwestie', scope: 'democratie', title: 'Er is nieuws in je kwesties',
          body: 'Open je kwesties om te lezen wat er is besloten en waarom.' });
      } catch (e) { console.warn('[democratie] wek mislukt voor ' + k.id + ': ' + e.message); }
      if (!gewekt) continue;
      const mis = await vastleggen(() => { schrijver.trede(k, ref, 'gewekt'); });
      if (!mis) n++;
    }
    return n;
  }

  /* Haalt elke wek in die niet uitging. Raakt geen eindstand aan. */
  async function herbezorg() {
    let gewekt = 0;
    for (const k of Object.values(kijk())) gewekt += await wek(k);
    return { ok: true, gewekt };
  }

  return { wek, herbezorg };
}

module.exports = { maakWek };
