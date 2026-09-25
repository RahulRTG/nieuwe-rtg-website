/* ============================================================================
   DE KWESTIE EN HAAR ENIGE SCHRIJVER (POLITIEK.md par. 4, fase B).

   EEN KWESTIE BEZIT NIETS. Hij draagt de vraag in de woorden van de inbrenger,
   een zelfgekozen gebied, een inbrengersnummer (nooit een RTG-sleutel, zie
   ./koppeling.js) en zijn behandelrondes. Meer niet.

   EEN SCHRIJVER. Alles wat een kwestie verandert, gaat door `noteer()` hier.
   Die hangt de gebeurtenis EERST aan de tijdlijn van de kwestie en aan het
   journaal van de hele laag -- allebei een hashketen (server/lib/keten.js) --
   en pas daarna verandert het afgeleide veld. Zo is er geen stand zonder een
   regel die zegt hoe hij ontstond. Dezelfde vorm als kern/service/loop.js, met
   een verschil: deze tijdlijn wordt NOOIT ingekort. Niemand kwijt geldt ook
   voor de geschiedenis.

   EEN EINDSTAND VERANDERT NOOIT ACHTERAF. Nieuwe feiten openen een nieuwe
   behandelronde; de oude ronde blijft ongewijzigd staan, met haar besluit, haar
   reden en de terugkoppeling die erbij hoorde.

   Deze module valideert en muteert, maar legt zelf niets vast; index.js doet
   elke mutatie binnen een duurzame vastlegging. */
'use strict';

const keten = require('../../lib/keten');
const { LOPEND, EINDSTAND_VAN } = require('./eindstanden');

function maakKwestieSchrijver({ nu, journaal }) {
  const iso = () => new Date(nu()).toISOString();

  /* De enige plek waar de tijdlijn en het journaal groeien. `max` is 0: nooit
     afkappen. */
  function noteer(k, regel) {
    const r = Object.assign({ at: iso() }, regel);
    keten.noteerIn(k.tijdlijn, r, 0);
    keten.noteerIn(journaal(), { at: r.at, kwestie: k.id, wat: r.wat, ronde: r.ronde || null }, 0);
  }

  const huidige = (k) => k.rondes[k.rondes.length - 1];
  const loopt = (k) => LOPEND.includes(huidige(k).stand);

  function nieuw({ id, inbrenger, onderwerp, gebied }) {
    const k = { id, inbrenger, onderwerp, gebied, at: iso(), volgers: [], tijdlijn: [],
      rondes: [{ nr: 1, stand: 'ingebracht', geopend: iso(), eindstand: null, terugkoppeling: null }] };
    noteer(k, { wat: 'ingebracht', ronde: 1 });
    return k;
  }

  /* Een behandelaar pakt hem op, of zegt dat hij wacht op wie wel bevoegd is.
     Dezelfde stand nog eens zetten is een herhaling en verandert niets. */
  function behandel(k, door, naar, notitie) {
    if (!loopt(k)) return { status: 409, error: 'Deze ronde is al afgesloten. Heropen de kwestie als er iets nieuws is.' };
    if (!['in-behandeling', 'wacht-op-bevoegde'].includes(naar)) {
      return { status: 400, error: 'Kies in-behandeling of wacht-op-bevoegde.' };
    }
    const r = huidige(k);
    if (r.stand === naar) return { ok: true, herhaling: true };
    noteer(k, { wat: 'stand', ronde: r.nr, van: r.stand, naar, door, notitie: notitie || null });
    r.stand = naar;
    return { ok: true };
  }

  /* Een eindstand, met reden. `b` is al gecontroleerd door toetsEindstand(). */
  function sluit(k, door, b, ontvangers) {
    const r = huidige(k);
    const eind = { stand: b.stand, toelichting: b.toelichting, door, at: iso(),
      bevoegdheid: b.bevoegdheid || null, naar: b.naar || null, in: b.in || null };
    noteer(k, { wat: 'eindstand', ronde: r.nr, stand: b.stand, door });
    r.eindstand = eind;
    r.stand = 'afgesloten';
    r.terugkoppeling = {};
    for (const ref of ontvangers) r.terugkoppeling[ref] = { stand: 'klaargezet', klaargezetOp: iso() };
    return { ok: true };
  }

  /* Wat een mens moet meegeven voor een eindstand -- los van het muteren, zodat
     een weigering niets aanraakt. */
  function toetsEindstand(k, b, doorInbrenger) {
    if (!loopt(k)) return { status: 409, error: 'Deze ronde is al afgesloten. Een eindstand verandert niet achteraf; heropen de kwestie als er iets nieuws is.' };
    const e = EINDSTAND_VAN.get(String(b.stand || ''));
    if (!e) return { status: 400, error: 'Kies een eindstand uit de lijst. Er is geen "anders": een kwestie wordt niet weggeboekt.' };
    if (!!e.alleenInbrenger !== !!doorInbrenger) {
      return { status: 403, error: doorInbrenger ? 'U kunt uw kwestie alleen intrekken.' : 'Alleen wie de kwestie inbracht, kan hem intrekken.' };
    }
    if (!doorInbrenger && String(b.toelichting || '').length < 15) {
      return { status: 400, error: 'Geef een toelichting van minstens vijftien tekens: wie dit inbracht, hoort te begrijpen waarom.' };
    }
    if (e.eist.includes('bevoegdheid') && String(b.bevoegdheid || '').length < 3) return { status: 400, error: 'Zeg met welke bevoegdheid dit is afgewezen.' };
    if (e.eist.includes('naar') && String(b.naar || '').length < 3) return { status: 400, error: 'Zeg naar wie de kwestie is doorgestuurd.' };
    if (e.eist.includes('in') && !b.in) return { status: 400, error: 'Zeg in welke kwestie deze verdergaat.' };
    return null;
  }

  function heropen(k, door, reden) {
    if (loopt(k)) return { status: 409, error: 'Deze kwestie loopt nog; er is niets te heropenen.' };
    if (String(reden || '').length < 15) return { status: 400, error: 'Zeg in minstens vijftien tekens welk nieuw feit een nieuwe ronde rechtvaardigt.' };
    const nr = huidige(k).nr + 1;
    noteer(k, { wat: 'heropend', ronde: nr, door, reden });
    k.rondes.push({ nr, stand: 'ingebracht', geopend: iso(), eindstand: null, terugkoppeling: null });
    return { ok: true };
  }

  function volg(k, refs) {
    for (const ref of refs) if (!k.volgers.includes(ref)) k.volgers.push(ref);
    noteer(k, { wat: 'volgers', ronde: huidige(k).nr, erbij: refs.length });
  }

  /* De terugkoppeling aan een ontvanger een trede verder zetten. Nooit terug. */
  function trede(k, ref, naar) {
    const tredes = ['klaargezet', 'gewekt', 'gezien'];
    let bewogen = 0;
    for (const r of k.rondes) {
      const t = r.terugkoppeling && r.terugkoppeling[ref];
      if (!t || tredes.indexOf(t.stand) >= tredes.indexOf(naar)) continue;
      noteer(k, { wat: 'terugkoppeling', ronde: r.nr, naar });
      t.stand = naar;
      t[naar + 'Op'] = iso();
      bewogen++;
    }
    return bewogen;
  }

  return { nieuw, behandel, sluit, toetsEindstand, heropen, volg, trede, huidige, loopt };
}

module.exports = { maakKwestieSchrijver };
