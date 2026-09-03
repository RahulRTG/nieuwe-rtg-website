/* ============================================================================
   HET GESPREK ZELF -- opbellen, aannemen, signaleren en ophangen.

   ./gesprek.js zegt WIE mag bellen en WAT de stand is; dit bestand schrijft en
   rinkelt. Eigen bestand omdat de twee samen over de omvangsgrens van
   keuringsregel 13 gingen, met de naad op een echte grens.

   DE SIGNALERING IS EEN DOORGEEFLUIK en kijkt niet in het pakket: een
   WebRTC-onderhandeling is geen inhoud. Wat hij wel doet is de RICHTING bewaken
   -- alleen de melder van dit gesprek en de mens die opnam mogen erin, en een
   derde die het nummer raadt komt er niet tussen.
   ========================================================================== */
'use strict';

module.exports = function maakGesprekLijn(c) {
  const { G, vind, stand, kort, magBellen, nu, schoon,
    zaken, loop, save, crypto, sseToCustomer, sseToOffice } = c;

  /* ---------------------------------------------------------- opbellen ---- */
  /* Een gesprek hoort ALTIJD bij een zaak. Zonder zaak is een gesprek een half
     uur werk waar niets van terugkomt; met een zaak staat het in de tijdlijn en
     kan een collega het overnemen. Is er geen zaak, dan wordt er een geopend --
     dat is geen administratie maar precies de reden dat dit beter is dan
     telefonie. */
  function bel({ melder, tier, zaakId, video, titel } = {}) {
    const m = magBellen(tier);
    if (!m.mag) return { status: 403, error: m.waarom, wel: m.wel };
    if (!melder) return { status: 400, error: 'Een gesprek zonder melder kan niemand aannemen.' };

    /* EERST KIJKEN OF ER AL EEN OPROEP LOOPT, EN PAS DAARNA EEN ZAAK MAKEN.
       Andersom stond het hier, en dat kostte een zaak per druk: de tweede druk
       maakte netjes een nieuwe zaak aan en gaf daarna het BESTAANDE gesprek
       terug -- dus geen tweede rinkel, wel een lege tweede zaak in de wachtrij.
       Gevonden met de kale meetronde; de toets keek naar het gesprek en niet
       naar het aantal zaken, en zag het dus niet. */
    const lopend = G().find(g => g.melder === String(melder) && stand(g) === 'rinkelt');
    if (lopend) return { ok: true, gesprek: kort(lopend), zaak: lopend.zaak, let: 'Uw oproep stond al klaar.' };

    let z = zaakId ? zaken.vind(zaakId) : null;
    if (z && z.melder !== String(melder)) return { status: 404, error: 'Deze zaak kennen wij niet.' };
    if (!z) {
      const r = zaken.open({ melder, doelgroep: 'lid', soort: 'ondersteuning', kanaal: 'gesprek',
        titel: schoon(titel, 110) || 'Gebeld met RTG', bron: 'gesprek' });
      if (r.error) return r;
      z = zaken.vind(r.zaak.id);
    }

    const g = { id: 'GSP-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      zaak: z.id, melder: String(melder), video: !!video, status: 'rinkelt',
      at: nu(), mens: null, aangenomenAt: null, beeindigdAt: null, seconden: null };
    G().unshift(g);
    if (G().length > 5000) G().pop();
    loop.noteer(z, { wat: 'gesprek', naar: 'rinkelt', gesprek: g.id, video: !!video });
    save();
    /* Het kantoor hoort dat er iemand belt. Alleen het NUMMER van het gesprek en
       de zaak -- geen naam, geen codenaam, geen onderwerp: wie opneemt ziet de
       zaak vanzelf, en een rinkel in een open kantoor hoeft niet te vertellen
       waar het over gaat. */
    if (typeof sseToOffice === 'function') {
      try { sseToOffice('servicebel', { kind: 'rinkelt', gesprek: g.id, zaak: z.id, video: !!video }); } catch (e) {}
    }
    return { ok: true, gesprek: kort(g), zaak: z.id,
      let: 'Wij laten uw oproep in het kantoor rinkelen. Neemt er niemand op, dan blijft uw zaak staan en ' +
        'reageren wij daar; u hoeft niet nog eens te bellen.' };
  }

  /* ------------------------------------------------------- aannemen ------- */
  function neem(id, { mens } = {}) {
    const g = vind(id);
    if (!g) return { status: 404, error: 'Deze oproep kennen wij niet.' };
    const s = stand(g);
    if (s !== 'rinkelt') return { status: 400, error: 'Deze oproep is ' + s + '.' };
    const w = schoon(mens, 60);
    if (!w) return { status: 400, error: 'Wie neemt op? Een gesprek hoort een naam te hebben.' };
    g.status = 'bezig'; g.mens = w; g.aangenomenAt = nu();
    const z = zaken.vind(g.zaak);
    if (z) {
      loop.noteer(z, { wat: 'gesprek', naar: 'aangenomen', gesprek: g.id, door: w });
      /* De zaak gaat mee naar in behandeling: er zit iemand aan de lijn, dus hij
         wacht niet meer op een mens. */
      loop.zetStand(z, 'inBehandeling', w, 'Opgenomen aan de telefoon.');
    }
    save();
    return { ok: true, gesprek: kort(g) };
  }

  /* De signalering. Deze laag is een DOORGEEFLUIK en kijkt niet in het pakket:
     WebRTC-onderhandeling is geen inhoud. Wat hij wel doet is de richting
     bewaken -- alleen de melder van dit gesprek en de mens die opnam mogen
     erin, en een derde die het nummer raadt komt er niet tussen. */
  /* `tekst` rijdt mee als signaal en niet als bericht. Het is de MEELEESBAAN
   (shared/meelezen.js): een weg naar tekst in een live gesprek, zodat een dove
   deelnemer kan meedoen. Hij wordt doorgegeven en nergens bewaard -- net als de
   stem. Wie hem wel wil bewaren, neemt daarmee een besluit over de inhoud van
   een gesprek, en dat is iets anders dan vastleggen DAT er gebeld is. */
const SIGNALEN = ['accept', 'offer', 'answer', 'ice', 'hangup', 'decline', 'busy', 'tekst'];
  function signaal(id, { van, wie, kind, payload } = {}) {
    const g = vind(id);
    if (!g) return { status: 404, error: 'Deze oproep kennen wij niet.' };
    if (!SIGNALEN.includes(String(kind))) return { status: 400, error: 'Onbekend signaal.' };
    if (stand(g) === 'beeindigd') return { status: 400, error: 'Dit gesprek is voorbij.' };
    if (van === 'melder' && String(wie) !== g.melder) return { status: 403, error: 'Dit gesprek is niet van u.' };
    if (van === 'mens' && String(wie) !== g.mens) return { status: 403, error: 'U heeft deze oproep niet aangenomen.' };

    if (van === 'melder') {
      if (typeof sseToOffice === 'function') {
        try { sseToOffice('servicebel', { kind, gesprek: g.id, zaak: g.zaak, payload: payload || null }); } catch (e) {}
      }
    } else if (typeof sseToCustomer === 'function') {
      try { sseToCustomer(g.melder, 'servicebel', { kind, gesprek: g.id, zaak: g.zaak, payload: payload || null }); } catch (e) {}
    }
    return { ok: true };
  }

  function eind(id, { door } = {}) {
    const g = vind(id);
    if (!g) return { status: 404, error: 'Deze oproep kennen wij niet.' };
    if (g.status === 'beeindigd') return { ok: true, gesprek: kort(g), let: 'Dit gesprek was al voorbij.' };
    const was = stand(g);
    g.status = 'beeindigd'; g.beeindigdAt = nu();
    g.seconden = g.aangenomenAt ? Math.round((Date.parse(g.beeindigdAt) - Date.parse(g.aangenomenAt)) / 1000) : null;
    const z = zaken.vind(g.zaak);
    if (z) {
      /* EEN GEMIST GESPREK IS GEEN NUL SECONDEN. Wie hier een duur van 0 zou
         wegschrijven, telt straks gemiste oproepen mee in een gemiddelde
         gespreksduur -- en dan wordt dat gemiddelde beter naarmate er minder
         mensen worden geholpen. */
      loop.noteer(z, { wat: 'gesprek', naar: was === 'rinkelt' ? 'gemist' : 'beeindigd',
        gesprek: g.id, door: schoon(door, 60) || null, seconden: g.seconden });
      if (was === 'rinkelt') {
        loop.bericht(z.id, { van: 'systeem',
          tekst: 'U heeft gebeld en wij hebben niet opgenomen. Uw melding staat hier; wij reageren erop.' });
      }
    }
    save();
    if (typeof sseToCustomer === 'function') {
      try { sseToCustomer(g.melder, 'servicebel', { kind: 'hangup', gesprek: g.id, zaak: g.zaak }); } catch (e) {}
    }
    return { ok: true, gesprek: kort(g) };
  }

  return { bel, neem, signaal, eind };
};
