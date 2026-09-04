/* BELEID ALS GEGEVEN -- de operationele regels van RTG op één plek, met
   versies, bereik en een knop om terug te zetten.

   DRIE DINGEN IN ÉÉN REGISTER, en dat is met opzet:

   - de CONFIGURATIE (prijzen, limieten, grenzen, landinstellingen),
   - de SCHAKELAARS (een functie aan of uit per land, stad, kantoor of groep),
   - de REGELS die bepalen hoeveel controle een handeling nodig heeft.

   Ze horen bij elkaar omdat ze samen het antwoord geven op "mag dit, en hoeveel
   toezicht hoort erbij". Stonden ze in drie registers, dan zou een wijziging in
   het ene het andere stil kunnen tegenspreken -- en dan weet niemand meer welke
   van de twee de echte regel was.

   ELKE WIJZIGING IS EEN VERSIE. Zetten overschrijft niet; het legt een nieuwe
   versie bovenop en bewaart de vorige. `terug()` zet er één terug, en dat is
   dus geen herstelactie maar gewoon de volgende versie -- ook zichtbaar in het
   journaal. Een terugzetknop die zijn eigen spoor wist, is een gat.

   VIER OGEN WAAR HET ZWAAR IS. Een regel met `vierOgen: true` gaat bij het
   zetten niet meteen live maar wordt een VOORSTEL. Wie het voorstelde kan het
   niet zelf goedkeuren -- dat wordt hier afgedwongen en niet aan het scherm
   overgelaten, want een grendel die alleen in de knop zit, is er niet. */
'use strict';

const { NIVEAUS } = require('../frictie');

/* De startregels. Dit is de enige plek waar ze staan; de rest van Command
   leest ze hier. Elke regel: wat hij betekent, zijn waarde, zijn bereik en of
   hij vier ogen vraagt. */
const START = [
  { id: 'risico.autoGrens', wat: 'Onder deze risicoscore mag een agent zelfstandig handelen', waarde: 30, eenheid: 'score', vierOgen: true },
  { id: 'risico.mensGrens', wat: 'Boven deze risicoscore mag alleen een mens beslissen', waarde: 70, eenheid: 'score', vierOgen: true },
  { id: 'risico.geldGrensCenten', wat: 'Boven dit bedrag krijgt elke handeling extra controle', waarde: 2500000, eenheid: 'centen', vierOgen: true },
  { id: 'agent.actiesPerUur', wat: 'Maximaal aantal handelingen dat één agent per uur mag doen', waarde: 200, eenheid: 'stuks', vierOgen: false },
  { id: 'agent.centenPerDag', wat: 'Maximale geldwaarde die één agent per dag mag raken', waarde: 5000000, eenheid: 'centen', vierOgen: true },
  { id: 'herstel.autoAan', wat: 'Mogen goedgekeurde runbooks zonder mens draaien', waarde: true, eenheid: 'aan/uit', vierOgen: true },
  { id: 'herstel.maxPerRonde', wat: 'Hoeveel gevallen één automatische herstelronde mag aanraken', waarde: 50, eenheid: 'stuks', vierOgen: false },
  { id: 'foundation.deelPromille', wat: 'Deel van de bijdragen dat naar de RTFoundation gaat', waarde: 300, eenheid: 'promille', vierOgen: true },
  { id: 'zaak.termijnUren', wat: 'Binnen hoeveel uur een uitzondering een eigenaar en besluit hoort te hebben', waarde: 48, eenheid: 'uur', vierOgen: false }
];

function maakBeleid({ db, save, crypto, journaal, vak, start, opslag }) {
  const V = typeof vak === 'function' ? vak : (() => opslag.vak());
  const REGELS = Array.isArray(start) ? start : START;
  function reg() {
    const v = V();
    if (!v.commandBeleid) v.commandBeleid = {};
    const r = v.commandBeleid;
    for (const b of REGELS) {
      if (!r[b.id]) r[b.id] = { id: b.id, wat: b.wat, eenheid: b.eenheid, vierOgen: b.vierOgen, bereik: 'globaal',
        versies: [{ v: 1, waarde: b.waarde, at: null, door: 'startwaarde', reden: 'de regel zoals hij is opgezet' }] };
    }
    return r;
  }
  function voorstellen() {
    const v = V();
    if (!Array.isArray(v.commandVoorstellen)) v.commandVoorstellen = [];
    return v.commandVoorstellen;
  }

  const nu = () => new Date().toISOString();
  const huidige = (b) => b.versies[b.versies.length - 1];

  function waarde(id, standaard) {
    const b = reg()[String(id)];
    return b ? huidige(b).waarde : standaard;
  }
  function getal(id, standaard) {
    const v = waarde(id, standaard);
    return Number.isFinite(Number(v)) ? Number(v) : standaard;
  }

  function alles() {
    return Object.values(reg()).map(b => ({
      id: b.id, wat: b.wat, eenheid: b.eenheid, vierOgen: b.vierOgen, bereik: b.bereik || 'globaal',
      waarde: huidige(b).waarde, versie: huidige(b).v, sinds: huidige(b).at, door: huidige(b).door,
      versies: b.versies.length
    }));
  }

  /* Zetten. Vraagt de regel vier ogen, dan wordt het een voorstel; anders gaat
     hij meteen live. In beide gevallen komt er een journaalregel met de oude en
     de nieuwe waarde erin -- dat is wat "iedere handeling met oude en nieuwe
     toestand" betekent. */
  function zet(id, nieuweWaarde, door, reden, bereik) {
    const b = reg()[String(id)];
    if (!b) return { error: 'Die regel bestaat niet: ' + id, status: 404 };
    if (!door) return { error: 'Zonder herleidbare actor wordt er geen regel gezet.', status: 403 };
    if (!reden || String(reden).trim().length < 4) return { error: 'Een beleidswijziging vraagt een reden.', status: 400 };
    const oud = huidige(b);
    if (b.vierOgen) {
      const v = { id: crypto.randomUUID(), regel: b.id, wat: b.wat, van: oud.waarde, naar: nieuweWaarde,
        bereik: bereik || b.bereik || 'globaal', door: String(door), reden: String(reden), at: nu(), status: 'wacht' };
      voorstellen().push(v);
      if (save) save();
      journaal.noteer({ actor: door, actie: 'beleid voorstellen', objectType: 'beleid', objectId: b.id,
        niveau: NIVEAUS.hand, reden, beleid: b.id, uitslag: 'wacht op tweede paar ogen', voor: { waarde: oud.waarde }, na: { waarde: nieuweWaarde } });
      return { voorstel: v, vierOgen: true };
    }
    const versie = { v: oud.v + 1, waarde: nieuweWaarde, at: nu(), door: String(door), reden: String(reden) };
    b.versies.push(versie);
    if (bereik) b.bereik = String(bereik);
    if (save) save();
    journaal.noteer({ actor: door, actie: 'beleid zetten', objectType: 'beleid', objectId: b.id,
      niveau: NIVEAUS.hand, reden, beleid: b.id, voor: { waarde: oud.waarde, versie: oud.v }, na: { waarde: nieuweWaarde, versie: versie.v } });
    return { regel: b.id, waarde: nieuweWaarde, versie: versie.v };
  }

  /* Het tweede paar ogen. Niet dezelfde actor: dat is de hele functie. */
  function keur(voorstelId, door, akkoord, reden) {
    const v = voorstellen().find(x => x.id === String(voorstelId));
    if (!v) return { error: 'Dat voorstel bestaat niet.', status: 404 };
    if (v.status !== 'wacht') return { error: 'Dat voorstel is al afgehandeld (' + v.status + ').', status: 409 };
    if (!door) return { error: 'Zonder herleidbare actor wordt er niets goedgekeurd.', status: 403 };
    if (String(door) === v.door) return { error: 'Vier ogen betekent twee mensen: wie voorstelt, keurt niet zelf goed.', status: 403 };
    v.status = akkoord ? 'goedgekeurd' : 'afgewezen';
    v.tweede = String(door); v.tweedeReden = String(reden || ''); v.beslistOp = nu();
    let uitkomst = null;
    if (akkoord) {
      const b = reg()[v.regel];
      const oud = huidige(b);
      b.versies.push({ v: oud.v + 1, waarde: v.naar, at: nu(), door: v.door + ' + ' + door, reden: v.reden });
      if (v.bereik) b.bereik = v.bereik;
      uitkomst = { regel: b.id, waarde: v.naar, versie: oud.v + 1 };
    }
    if (save) save();
    journaal.noteer({ actor: door, actie: akkoord ? 'beleid goedkeuren' : 'beleid afwijzen', objectType: 'beleid',
      objectId: v.regel, niveau: NIVEAUS.hand, reden: reden || v.reden, beleid: v.regel,
      voor: { waarde: v.van, voorgesteldDoor: v.door }, na: { waarde: akkoord ? v.naar : v.van } });
    return { voorstel: v, uitkomst };
  }

  /* ÉÉN KNOP TERUG. Zet de vorige versie opnieuw bovenop -- niet door de
     laatste weg te gooien, want dan zou het spoor van de fout meeverdwijnen. */
  function terug(id, door, reden) {
    const b = reg()[String(id)];
    if (!b) return { error: 'Die regel bestaat niet: ' + id, status: 404 };
    if (b.versies.length < 2) return { error: 'Er is geen eerdere versie om naar terug te gaan.', status: 409 };
    if (!door) return { error: 'Zonder herleidbare actor wordt er niets teruggezet.', status: 403 };
    const nu2 = huidige(b), vorige = b.versies[b.versies.length - 2];
    b.versies.push({ v: nu2.v + 1, waarde: vorige.waarde, at: nu(), door: String(door),
      reden: String(reden || 'terug naar versie ' + vorige.v), terugNaar: vorige.v });
    if (save) save();
    journaal.noteer({ actor: door, actie: 'beleid terugzetten', objectType: 'beleid', objectId: b.id,
      niveau: NIVEAUS.hand, reden: reden || 'terug naar versie ' + vorige.v, beleid: b.id,
      voor: { waarde: nu2.waarde, versie: nu2.v }, na: { waarde: vorige.waarde, versie: nu2.v + 1 } });
    return { regel: b.id, waarde: vorige.waarde, versie: nu2.v + 1, terugNaar: vorige.v };
  }

  function geschiedenis(id) {
    const b = reg()[String(id)];
    return b ? { id: b.id, wat: b.wat, versies: b.versies.slice().reverse() } : { error: 'Die regel bestaat niet.', status: 404 };
  }
  const openVoorstellen = () => voorstellen().filter(v => v.status === 'wacht');

  return { alles, waarde, getal, zet, keur, terug, geschiedenis, openVoorstellen,
    voorstellen: () => voorstellen().slice().reverse().slice(0, 50), START: REGELS };
}

module.exports = { maakBeleid, START };
