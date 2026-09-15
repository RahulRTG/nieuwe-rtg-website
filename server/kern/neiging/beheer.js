/* ============================================================================
   WAT HET LID MET ZIJN EIGEN GEHEUGEN DOET -- vergeten, niet-hiervoor, en de
   termijn die vanzelf veegt.

   Apart van ./bewaren.js langs een echte naad: dat bestand schrijft OP wat er
   is verteld of opgemerkt, dit bestand is de kant waar het LID aan de knoppen
   zit. Twee lezers, twee redenen om te veranderen -- en samen gingen ze over de
   tienkilobytegrens van keuringsregel 13, een lijst die hoort te krimpen door
   een snede en niet door een uitzondering.

   Hij krijgt de binnenkant van de opslag MEE en pakt hem niet zelf. Daardoor is
   er nog steeds precies EEN plek waar een neiging ontstaat en EEN plek waar de
   graad wordt berekend; een tweede greep op dezelfde bak zou die twee stil
   kunnen laten uiteenlopen.
   ========================================================================== */
'use strict';

/* De doelenlijst komt uit hetzelfde besluitenregister als ./bewaren.js hem
   leest, en wordt niet doorgegeven. Twee lezers van EEN register is goed; een
   doorgegeven kopie zou betekenen dat een aanroeper kan bepalen welke doelen er
   bestaan, en dan is de gesloten lijst niet meer gesloten. */
const { DOELEN } = require('./besluiten');

module.exports = function maakBeheer({ bak, actor, lijstVan, toon, tijd, save }) {
  /* VERGEET. Echt weg, en niet een vlaggetje. */
  function vergeet(key, id) {
    const lijst = lijstVan(actor(key));
    const i = lijst.findIndex(n => n.id === id);
    if (i < 0) return { status: 404, error: 'Die staat hier niet.' };
    const weg = lijst.splice(i, 1)[0]; save();
    return { ok: true, vergeten: weg.onderwerp };
  }

  /* NIET HIERVOOR GEBRUIKEN. Het doel gaat eraf en komt niet terug doordat het
     gedrag zich herhaalt -- zie `afgewezenDoel` in onthoud(). */
  function nietVoor(key, id, doel) {
    if (!DOELEN.includes(doel)) return { status: 400, error: 'Onbekend doel.' };
    const n = lijstVan(actor(key)).find(x => x.id === id);
    if (!n) return { status: 404, error: 'Die staat hier niet.' };
    n.doel = n.doel.filter(d => d !== doel);
    if (!Array.isArray(n.afgewezenDoel)) n.afgewezenDoel = [];
    if (!n.afgewezenDoel.includes(doel)) n.afgewezenDoel.push(doel);
    /* Geen enkel doel over betekent: deze neiging doet niets meer. Hij blijft
       zichtbaar staan als geweigerd, zodat het lid ziet dat hij er nog is. */
    if (!n.doel.length) n.geweigerd = true;
    save();
    return { ok: true, neiging: toon(n, tijd()) };
  }

  /* De bewaartermijn afdwingen. Geen achtergrondtaak: hij loopt bij het lezen,
     zodat er nooit een dag is waarop de termijn wel is verstreken en het
     gegeven er nog staat omdat een timer niet draaide. */
  function veeg(key) {
    const a = actor(key), lijst = lijstVan(a), n = Date.parse(tijd());
    const houd = lijst.filter(x => !Number.isFinite(Date.parse(x.vervalt)) || Date.parse(x.vervalt) > n);
    if (houd.length === lijst.length) return 0;
    bak().perActor[a] = houd; save();
    return lijst.length - houd.length;
  }

  /* Welke vragen zijn dit lid al voorgelegd. Zie de toelichting in bak(). */
  function gesteld(key) {
    const b = bak(), a = actor(key);
    if (!Array.isArray(b.gesteldPerActor[a])) b.gesteldPerActor[a] = [];
    return b.gesteldPerActor[a];
  }
  function noteerGesteld(key, vraagId) {
    const lijst = gesteld(key);
    if (!lijst.includes(vraagId)) { lijst.push(vraagId); save(); }
    return lijst.slice();
  }
  /* De intake opnieuw beginnen. Haalt ALLEEN weg welke vragen zijn gesteld en
     raakt geen enkele neiging aan: wat het lid heeft verteld blijft van hem,
     ook als hij de vragen nog een keer wil zien. */
  function opnieuw(key) {
    bak().gesteldPerActor[actor(key)] = []; save();
    return { ok: true };
  }

  return { vergeet, nietVoor, veeg, gesteld, noteerGesteld, opnieuw };
};
