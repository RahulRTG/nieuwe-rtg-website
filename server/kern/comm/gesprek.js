/* DE GESPREKKEN ZELF: waar ze staan, wie erin mag, en hoe er een bij komt.

   Waarom dit uit ./index.js is geknipt: daar stonden drie dingen boven elkaar
   die niets met elkaar te maken hebben behalve dat ze de eerste waren -- de
   opslag, de toegangspoort en het aanleggen van een gesprek. Wie wilde nakijken
   of een id raden genoeg is om mee te lezen, moest langs de hele kern. Nu is
   het antwoord een bestand van vijf schermen.

   Deze laag kent GEEN berichten. Dat is met opzet: een gesprek bestaat ook
   leeg, en de berichtenkant (./bericht.js) leunt op deze poort en niet
   andersom. B() staat hier omdat de berichtenbak samen met het gesprek wordt
   aangelegd -- een gesprek zonder bak is een gesprek dat bij het eerste bericht
   omvalt. */
'use strict';

const MAX_DEELNEMERS = 256;

function maakGesprek({ db, save, nu, id, SOORTEN }) {
  /* ---------------------------------------------------------- opslag */
  const eigen = require('../eigencollectie')({ db, domein: 'kern/comm/gesprek',
    bezit: { commGesprekken: 'lijst', commBerichten: 'kaart', commStand: 'kaart' } });
  function G() { return eigen.bak('commGesprekken'); }
  function B() { return eigen.bak('commBerichten'); }
  function S() { return eigen.bak('commStand'); }
  const standVan = (key, gid) => ((S()[key] || {})[gid] || {});
  function standZet(key, gid, veld, waarde) {
    const s = S();
    const rij = s[key] = s[key] || {};
    const st = rij[gid] = rij[gid] || {};
    if (waarde === null || waarde === false || waarde === '') delete st[veld];
    else st[veld] = waarde;
    if (!Object.keys(st).length) delete rij[gid];
    return st;
  }

  /* -------------------------------------------------------- toegang */
  const gesprekVan = (gid) => G().find((g) => g.id === gid) || null;
  const magErin = (g, key) => !!(g && Array.isArray(g.deelnemers) && g.deelnemers.includes(key));
  /* Elke leesweg loopt hierlangs. Geen enkele functie in deze kern haalt een
     gesprek op zonder deze poort -- een id raden mag nooit genoeg zijn. */
  function eis(gid, key) {
    const g = gesprekVan(gid);
    if (!g) throw new Error('Dit gesprek bestaat niet.');
    if (!magErin(g, key)) throw new Error('Dit gesprek is niet van jou.');
    return g;
  }

  /* --------------------------------------------------- een gesprek maken */
  /* DE ENIGE MANIER waarop er een gesprek bij komt, en dus de plek waar elke
     module langskomt. Idempotent op meta.sleutel: een rit, een bestelling of
     een ticket vraagt bij elke stap opnieuw om "zijn" gesprek en hoort er dan
     niet elke keer een nieuw te krijgen. Zonder dat zou de taxi-module zelf
     moeten onthouden welk gesprek bij welke rit hoort -- en dan zit de
     koppeling weer in de module in plaats van hier. */
  function gesprekMaak(opties) {
    const o = opties || {};
    const soort = SOORTEN.includes(o.soort) ? o.soort : 'personal';
    const deelnemers = [...new Set((o.deelnemers || []).filter(Boolean).map(String))].slice(0, MAX_DEELNEMERS);
    if (deelnemers.length < 1) throw new Error('Een gesprek heeft deelnemers nodig.');
    const sleutel = o.meta && o.meta.sleutel ? String(o.meta.sleutel).slice(0, 120) : null;
    if (sleutel) {
      const bestaat = G().find((g) => g.meta && g.meta.sleutel === sleutel);
      if (bestaat) {
        /* Wie er later bij komt (een tweede chauffeur, een collega die de zaak
           overneemt) schuift gewoon aan. Wie eruit moet, gaat er niet vanzelf
           uit: dat is een handeling met gevolgen en hoort een eigen weg te
           hebben, niet een neveneffect van "maak dit gesprek nog eens". */
        for (const d of deelnemers) if (!bestaat.deelnemers.includes(d)) bestaat.deelnemers.push(d);
        save();
        return bestaat;
      }
    }
    const g = {
      id: id('gsp'), soort,
      titel: String(o.titel || '').slice(0, 120) || null,
      deelnemers, door: o.door || deelnemers[0],
      op: nu(), laatst: nu(),
      meta: Object.assign({}, o.meta || {})
    };
    G().push(g);
    B()[g.id] = [];
    save();
    return g;
  }

  /* Het gesprek van een module OPZOEKEN zonder het te maken. gesprekMaak() is
     idempotent op meta.sleutel en dus verleidelijk om ook als opzoeker te
     gebruiken -- maar dan MAAKT een leesvraag een gesprek, en een module die
     "bestaat deze lijn?" vraagt krijgt altijd ja. Dat is geen detail: bij het
     gastcontact hing er een controle aan ("alleen inzage als er echt een lijn
     is"), en die viel om zodra de vraag zelf de lijn aanlegde. */
  const gesprekMetSleutel = (sleutel) =>
    (sleutel ? G().find((g) => g.meta && g.meta.sleutel === String(sleutel)) : null) || null;

  /* Het een-op-een gesprek tussen twee leden is er precies een, welke kant je
     het ook opent. De sleutel is daarom de twee sleutels op alfabet -- zonder
     dat krijg je twee gesprekken die elkaars berichten niet zien, en dat is
     het soort fout dat pas opvalt als iemand zegt "ik heb je wel geantwoord". */
  function tussen(a, b, opties) {
    const paar = [String(a), String(b)].sort();
    return gesprekMaak(Object.assign({ soort: 'personal', deelnemers: paar,
      meta: { sleutel: 'paar:' + paar.join('|') } }, opties || {}));
  }

  return { G, B, S, standVan, standZet, gesprekVan, magErin, eis,
    gesprekMaak, gesprekMetSleutel, tussen };
}

module.exports = { maakGesprek, MAX_DEELNEMERS };
