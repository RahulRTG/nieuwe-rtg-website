/* ============================================================================
   HET BERAAD EN ZIJN ENIGE SCHRIJVER (GEMEENSCHAP-FASE0.md par. 4.3).

   De standmachine is die van bedrijf/besluit.js (eerst inbreng, dan stemmen,
   een bezwaar verdwijnt nooit, niemand stemt twee keer), het tijdlijnpatroon dat
   van de kwestie in DemocratieOS: elke verandering hangt EERST een regel aan een
   hashketen (lib/keten.js) en verandert pas daarna het veld. De tijdlijn wordt
   nooit ingekort.

   DRIE DINGEN DIE HIER VASTLIGGEN:
   1. DE UITSLAG WORDT EEN KEER UITGEREKEND, bij het sluiten, en daarna nooit
      meer (stadsweefsel/besluitvorming.js): wie hem bij elke weergave opnieuw
      telt, laat het register meebewegen met wie er later vertrok.
   2. EEN EINDSTAND VERANDERT NOOIT. Heropenen maakt een nieuwe ronde; de oude
      blijft staan met haar uitslag, haar eindstand en haar terugkoppeling.
   3. EEN STEM STAAT NIET IN DE TIJDLIJN. De keten zegt DAT er gestemd is, niet
      wie of wat -- anders is het geheim van de stem een kwestie van wie de
      opslag mag lezen.

   Deze module controleert de STAND en muteert; wie iets mag (lid, opener,
   beheerder) toetst ./index.js, want daarvoor is het genootschap nodig. Ze legt
   zelf niets vast. */
'use strict';

const keten = require('../../lib/keten');
const S = require('./standen');

function maakSchrijver({ nu }) {
  const iso = () => new Date(nu()).toISOString();

  function noteer(b, regel) {
    keten.noteerIn(b.tijdlijn, Object.assign({ at: iso() }, regel), 0);
  }

  const huidige = (b) => b.rondes[b.rondes.length - 1];

  function legeRonde(nr, quorum) {
    return { nr, stand: 'open', geopend: iso(), inbreng: [], bezwaren: [], openPunten: [],
      voorstel: null, voorstelBevroren: null, quorum, stemmen: {}, uitslag: null, eindstand: null,
      terugkoppeling: {}, volgnr: 0 };
  }

  function nieuw({ id, drager, vraag, door, gevoelig, quorum }) {
    const b = { id, drager, vraag, door, at: iso(), gevoelig: !!gevoelig, tijdlijn: [],
      rondes: [legeRonde(1, quorum)] };
    noteer(b, { wat: 'geopend', ronde: 1, door, quorum });
    return b;
  }

  const items = (r) => [].concat(r.inbreng, r.bezwaren, r.openPunten);

  function brengIn(b, door, soort, tekst) {
    const r = huidige(b);
    if (!['open', 'voorstel'].includes(r.stand)) {
      return { status: 409, error: r.stand === 'stemmen'
        ? 'Het voorstel is bevroren en er wordt gestemd. Inbreng kan weer als er een nieuw voorstel komt.'
        : 'Deze ronde is besloten. Heropen het beraad als er iets nieuws is.' };
    }
    if (items(r).length >= S.ITEMS_PER_RONDE) return { status: 409, error: 'Deze ronde zit vol. Rond haar af en heropen.' };
    r.volgnr = (r.volgnr || 0) + 1;
    const rij = { id: 'r' + r.nr + '-' + r.volgnr, vanKey: door, tekst, at: iso() };
    noteer(b, { wat: soort, ronde: r.nr, id: rij.id, door });
    r[S.SOORTEN[soort]].push(rij);
    return { ok: true, id: rij.id };
  }

  /* Intrekken is een markering. De regel blijft staan, met wie hem schreef en
     wanneer; alleen de schrijver zelf trekt in. */
  function trekInbrengIn(b, door, id) {
    const r = huidige(b);
    if (r.stand === 'besloten') return { status: 409, error: 'Deze ronde is besloten; wat er gezegd is, blijft staan.' };
    const rij = items(r).find(x => x.id === String(id || ''));
    if (!rij) return { status: 404, error: 'Deze inbreng ken ik niet.' };
    if (rij.vanKey !== door) return { status: 403, error: 'Alleen wie iets inbracht, trekt het in.' };
    if (rij.ingetrokken) return { ok: true, herhaling: true };
    noteer(b, { wat: 'ingetrokken', ronde: r.nr, id: rij.id, door });
    rij.ingetrokken = iso();
    return { ok: true };
  }

  /* Een nieuwe versie van het voorstel. Tijdens het stemmen zet hij de ronde
     terug: de stemmen gaan naar nul en de bevriezing gaat eraf. */
  function zetVoorstel(b, door, tekst) {
    const r = huidige(b);
    if (r.stand === 'besloten') return { status: 409, error: 'Deze ronde is besloten. Heropen het beraad voor een nieuw voorstel.' };
    // dezelfde tekst nog eens is een dubbeltik en geen nieuwe versie: de stemmen blijven staan
    if (r.voorstel && r.voorstel.tekst === tekst) return { ok: true, herhaling: true, versie: r.voorstel.versie, stemmenTerug: false };
    const versie = r.voorstel ? r.voorstel.versie + 1 : 1;
    const terug = r.stand === 'stemmen';
    noteer(b, { wat: 'voorstel', ronde: r.nr, versie, door, stemmenTerug: terug });
    r.voorstel = { versie, tekst, door, at: iso() };
    r.voorstelBevroren = null;
    r.stemmen = {};
    r.stand = 'voorstel';
    return { ok: true, versie, stemmenTerug: terug };
  }

  const hashVoorstel = (v) => keten.hashVan({ versie: v.versie, tekst: v.tekst });

  function naarStemmen(b, door) {
    const r = huidige(b);
    if (r.stand === 'stemmen') return { ok: true, herhaling: true };
    if (r.stand === 'besloten') return { status: 409, error: 'Deze ronde is besloten.' };
    if (!r.voorstel) return { status: 409, error: 'Er ligt nog geen voorstel. Stemmen gaat over een tekst, niet over een stemming.' };
    const h = hashVoorstel(r.voorstel);
    noteer(b, { wat: 'naar-stemmen', ronde: r.nr, versie: r.voorstel.versie, bevroren: h, door });
    r.voorstelBevroren = h;
    r.stand = 'stemmen';
    return { ok: true };
  }

  function stem(b, door, keuze) {
    const r = huidige(b);
    if (r.stand !== 'stemmen') {
      return { status: 409, error: r.stand === 'besloten' ? 'Er valt niets meer te stemmen: deze ronde is besloten.'
        : 'Er wordt nog niet gestemd. Eerst moet het voorstel bevroren worden.' };
    }
    if (!S.KEUZES.includes(keuze)) return { status: 400, error: 'Stem voor, tegen of onthouding.' };
    // tweede verdediging: de bevriezing hoort bij DIT voorstel
    if (!r.voorstel || r.voorstelBevroren !== hashVoorstel(r.voorstel)) {
      return { status: 409, error: 'Het voorstel klopt niet met wat er bevroren werd; er wordt niet gestemd.' };
    }
    const was = r.stemmen[door] || null;
    if (was === keuze) return { ok: true, herhaling: true };
    noteer(b, { wat: was ? 'stem-gewijzigd' : 'gestemd', ronde: r.nr });
    r.stemmen[door] = keuze;
    return { ok: true };
  }

  function ontvangersVan(r) {
    const s = new Set(items(r).map(x => x.vanKey));
    for (const k of Object.keys(r.stemmen)) s.add(k);
    return [...s];
  }

  function zetEind(b, r, eind) {
    noteer(b, { wat: 'eindstand', ronde: r.nr, stand: eind.stand, door: eind.door });
    r.eindstand = eind;
    r.stand = 'besloten';
    r.terugkoppeling = {};
    for (const k of ontvangersVan(r)) r.terugkoppeling[k] = 'klaargezet';
    return { ok: true, ontvangers: Object.keys(r.terugkoppeling) };
  }

  /* Sluiten: hier, en alleen hier, wordt geteld. */
  function sluit(b, door, toelichting) {
    const r = huidige(b);
    if (r.stand !== 'stemmen') return { status: 409, error: 'Er wordt niet gestemd. Zet het voorstel eerst naar stemmen, of trek het beraad in.' };
    const tel = { voor: 0, tegen: 0, onthouding: 0 };
    for (const k of Object.values(r.stemmen)) tel[k]++;
    const uitgebracht = tel.voor + tel.tegen + tel.onthouding;
    const gehaald = uitgebracht >= r.quorum;
    const stand = !gehaald ? 'geen-besluit' : (tel.voor > tel.tegen ? 'aangenomen' : 'verworpen');
    r.uitslag = { voor: tel.voor, tegen: tel.tegen, onthouding: tel.onthouding, uitgebracht,
      quorum: r.quorum, quorumGehaald: gehaald, versie: r.voorstel.versie, bevroren: r.voorstelBevroren, at: iso() };
    return zetEind(b, r, { stand, toelichting: toelichting || S.EINDSTAND_VAN.get(stand).uitleg, door, at: iso() });
  }

  function trekIn(b, door, toelichting) {
    const r = huidige(b);
    if (r.stand === 'besloten') return { status: 409, error: 'Deze ronde is al besloten.' };
    if (String(toelichting || '').length < 10) return { status: 400, error: 'Zeg in minstens tien tekens waarom het beraad stopt; wie meedeed, hoort het te begrijpen.' };
    return zetEind(b, r, { stand: 'ingetrokken', toelichting, door, at: iso() });
  }

  function heropen(b, door, reden, quorum) {
    const r = huidige(b);
    if (r.stand !== 'besloten') return { status: 409, error: 'Deze ronde loopt nog; er is niets te heropenen.' };
    if (String(reden || '').length < 15) return { status: 400, error: 'Zeg in minstens vijftien tekens wat er nieuw is.' };
    const nr = r.nr + 1;
    noteer(b, { wat: 'heropend', ronde: nr, door, reden, quorum });
    b.rondes.push(legeRonde(nr, quorum));
    return { ok: true, ronde: nr };
  }

  /* De terugkoppeling een trede verder -- over alle rondes, of over een ronde
     (`nr`) als alleen die gewekt werd. Nooit terug. */
  function trede(b, key, naar, nr) {
    let bewogen = 0;
    for (const r of b.rondes) {
      if (nr != null && r.nr !== nr) continue;
      const t = r.terugkoppeling && r.terugkoppeling[key];
      if (!t || S.TREDEN.indexOf(t) >= S.TREDEN.indexOf(naar)) continue;
      noteer(b, { wat: 'terugkoppeling', ronde: r.nr, naar });
      r.terugkoppeling[key] = naar;
      bewogen++;
    }
    return bewogen;
  }

  return { nieuw, brengIn, trekInbrengIn, zetVoorstel, naarStemmen, stem, sluit, trekIn, heropen,
    trede, huidige, items };
}

module.exports = { maakSchrijver };
