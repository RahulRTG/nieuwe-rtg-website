/* Beraad (deelmodule): de terugkoppeling -- wie meedeed, hoort de uitkomst.

   Drie treden (./standen.js): klaargezet zodra de eindstand vastligt, gewekt als
   er een melding op de SLEUTEL is gezet, gezien als het lid zelf keek. Het
   leespad is /api/beraad/mijn; de melding is alleen de wek (MAATSTAF.md par. 7f:
   een bericht is pas bezorgd als er een bewezen leespad bestaat).

   Een melding gaat op de sleutel van het lid en als OBJECT -- een tekst gooit
   notify() terug (test/notify-vorm.test.js), en een melding op de pas verdwijnt
   bij de eerste herlaadbeurt (opzet/meldaan.js). */
'use strict';

const { log } = require('../../log');

function maakTerugkoppeling({ notify, save, schr, zicht, lijstKijk, genootschap }) {
  /* EEN MELDING PER ONTVANGER, OP DE SLEUTEL, ALS OBJECT. De tekst noemt met
     opzet de vraag en de uitkomst niet: een melding kan op een vergrendeld
     scherm verschijnen, en bij een gevoelig beraad is de vraag zelf het
     gegeven. De uitkomst staat in /api/beraad/mijn -- dat is het leespad, de
     melding is alleen de wek. */
  function wek(b, nr, keys) {
    for (const k of keys) {
      if (!notify) break;
      try {
        notify(k, { title: 'Beraad', body: 'Een beraad waaraan je meedeed heeft een uitkomst. Open het om te zien wat er besloten is.' });
        schr.trede(b, k, 'gewekt', nr);
      } catch (e) { log.uitzondering(e, { bron: 'beraad', waar: 'terugkoppeling' }); }
    }
  }

  /* Mijn beraden: die van de genootschappen waar ik NU lid van ben, en apart
     elke terugkoppeling die op mijn sleutel staat -- ook als ik inmiddels
     vertrok. Een uitkomst die je niet meer kunt lezen omdat je weg bent, is niet
     teruggekoppeld. */
  function mijn(sess) {
    const groepen = new Set(genootschap.mijne(sess.key).map(g => String(g.id)));
    const alle = lijstKijk();
    const terug = [];
    for (const b of alle) {
      for (const r of b.rondes) {
        const t = r.terugkoppeling && r.terugkoppeling[sess.key];
        if (t) terug.push({ beraad: b.id, vraag: b.vraag, ronde: r.nr, trede: t,
          eindstand: r.eindstand.stand, toelichting: r.eindstand.toelichting, uitslag: zicht.uitslagZicht(b, r) });
      }
    }
    return { ok: true,
      beraden: alle.filter(b => groepen.has(String(b.drager.id))).slice(0, 60).map(b => zicht.kort(b, sess.key)),
      terugkoppeling: terug.slice(0, 60) };
  }

  /* Gezien: de terugkoppeling op de eigen sleutel naar de laatste trede. Werkt
     ook voor wie vertrok, want het spoor hangt aan de sleutel en niet aan het
     lidmaatschap; wie er niets heeft staan, krijgt 404. */
  function gezien(sess, id) {
    const b = lijstKijk().find(x => String(x.id) === String(id == null ? '' : id));
    const heeft = b && b.rondes.some(r => r.terugkoppeling && r.terugkoppeling[sess.key]);
    if (!heeft) return { status: 404, error: 'Hier staat geen terugkoppeling voor je klaar.' };
    const bewogen = schr.trede(b, sess.key, 'gezien');
    if (bewogen) save();
    return { ok: true, bewogen };
  }

  return { wek, mijn, gezien };
}

module.exports = { maakTerugkoppeling };
