/* NOTIFICATIES LEZEN -- welke bakken een lid te zien krijgt, en welke het mag
   afvinken. Afgesplitst uit ../server.js, dat over de omvangsgrens staat.

   TWEE BAKKEN, EN DAT IS GEEN VERDUBBELING. notify() in ./meldingen.js schrijft
   een BROADCAST op de pas (alle Business-leden krijgen bericht), meldLid() in
   ./meldaan.js een PERSOONLIJK bericht op de sleutel van het lid ('user-<id>').
   Dit eindpunt las eerst alleen de pas-bak, en dan verdween een persoonlijk
   bericht bij de eerste herlaadbeurt.

   UIT DE PERSOONLIJKE BAK ALLES, UIT DE PAS-BAK ALLEEN BROADCASTS (RTG-V1-RELEASE
   blocker 2). De pas-bak is gedeeld door alle leden van die pas en geeft dus
   alleen wat expliciet `broadcast` draagt; een persoonlijke melding die er per
   abuis in belandde, lekt hier niet naar een ander lid. Afvinken raakt alleen
   de EIGEN bak: met de pas-bak erbij zette een lid de meldingen van iedereen
   met dezelfde pas op gelezen.

   In DEMO valt de sleutel samen met de pas; dan is er een bak, van de persona
   zelf, en wordt er niets dubbel getoond. */
'use strict';

function maakMeldingenLezer(db) {
  const bak = (naam) => (db.data.notifications[naam] || []);
  function meldingenVan(sess) {
    const eigen = bak(sess.key);
    if (!sess.tier || sess.key === sess.tier) return eigen.slice(0, 40);
    const broadcasts = bak(sess.tier).filter(n => n && n.broadcast);
    if (!broadcasts.length) return eigen.slice(0, 40);
    return eigen.concat(broadcasts)
      .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
      .slice(0, 40);
  }
  function markeerGelezen(sleutel) {
    if (sleutel) bak(sleutel).forEach(n => { n.read = true; });
  }
  return { meldingenVan, markeerGelezen };
}

module.exports = { maakMeldingenLezer };
