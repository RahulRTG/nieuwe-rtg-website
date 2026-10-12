/* DE OPZOEKERS ACHTER DE VERWIJZINGSKETEN -- waar een domein zegt dat het zijn
   eigen soort kan terugvinden, en wat daarvan naar een model mag.

   WAAROM DIT BESTAAT. ./menscontext-ref.js heeft de ketting (opzoeken, bereik,
   bevoegdheid, canoniek) en zegt in zijn kop dat de opzoeker INGESPOTEN wordt
   door wie hem heeft. Tot 12 oktober 2026 spoot niemand hem in: ./lus.js riep
   saneer() aan zonder opties, en elke verwijzing die de app meestuurde bleef
   ONOPGELOST. Rahul las hooguit "1 verwijzing naar reisaanvraag" en wist niet
   welke. Dit bestand is de plek waar een domein zich meldt (EDGE.md par. 14.4,
   de Context Bridge).

   GEEN OBJECTTABEL, EN DAT IS DE GRENS VAN DE KOP VAN menscontext-ref.js. Hier
   staat geen enkel object en geen enkele collectie. Elk domein beantwoordt
   alleen vragen over ZIJN soort, met zijn eigen code; deze laag kiest op de
   soort van de verwijzing welk domein hij het vraagt, en verder niets. Een soort
   die zich niet meldt, blijft ONOPGELOST -- precies zoals voorheen.

   WAT EEN DOMEIN MELDT, en elk deel is verplicht -- leeg is dicht:

     soort     het woord van de verwijzing (`reisaanvraag`)
     zoek      (id) -> de rij, of iets valsigs
     eigenaar  (rij) -> de sessiesleutel van wie hij is
     mag       (rij, sessie) -> true als deze mens hem in een gesprek mag zien
     velden    de POSITIEVE lijst veldnamen die naar het model mogen
     beeld     (rij) -> een object met die velden, OP NAAM opgebouwd

   DE VELDEN ZIJN EEN VERKLARING, EN DE CONTROLE STAAT HIER. AI-CONTEXT-01
   (MENSNETWERK.md par. 4d): een AI-context wordt opgebouwd uit een positieve
   lijst, nooit uit een object waar daarna iets uit wordt gehaald. Het domein
   bouwt `beeld` veld voor veld; deze laag loopt NIET over de rij maar over wat
   `beeld` teruggaf, en gooit elke sleutel weg die niet in `velden` staat. Een
   domein dat per ongeluk een spread schrijft, raakt dus alleen het onverklaarde
   kwijt -- en dat staat in `gewist`, want stil weggooien zegt niets.

   WAT ER NAAR BUITEN GAAT IS EEN BEELD EN NOOIT DE RIJ. De ketting geeft bij
   CANONIEK het object terug dat de opzoeker leverde. Dat object is hier het
   bevroren beeld `{ soort, id, velden }`; eigenaar en bevoegdheid hangen er in
   een WeakMap naast en reizen niet mee. Zo kan een volgende lezer de rij niet
   per ongeluk in een prompt zetten, want hij heeft hem nooit.

   ALLEEN WAARDEN DIE GEEN OPDRACHT KUNNEN DRAGEN. Een veldwaarde is een korte
   tekst zonder besturingstekens, een eindig getal of een boolean; al het andere
   valt weg. Vrije tekst die een lid zelf typte (een notitie) hoort niet in een
   lijst velden: die zou een tweede instructieblok in de prompt kunnen openen. */
'use strict';

const menscontext = require('./menscontext');
const { CONTEXT_REGELS } = require('./lusregels');
const { relatieVan } = require('./menscontext-relatie');

const MAX_VELDEN = 8;      /* dezelfde grens als shared/objectverwijzing.js */
const MAX_WAARDE = 80;     /* dezelfde grens als een tekst in ./menscontext.js */

function woord(x) {
  return String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
}

function waarde(x) {
  if (typeof x === 'boolean') return x;
  if (typeof x === 'number') return Number.isFinite(x) ? x : undefined;
  if (typeof x !== 'string') return undefined;
  const t = x.replace(/[^\S ]|[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_WAARDE);
  return t || undefined;
}

/* Hoe een mens het object noemt: "uw reisaanvraag 'Ibiza, jetset-week'". De
   titel komt uit het beeld (de positieve lijst van het domein); zonder titel
   blijft het bij de soort. Nooit een id: dat is een sleutel, geen naam. */
function naamVan(beeld) {
  const soort = String(beeld.soort || 'object').replace(/-/g, ' ');
  const titel = beeld.velden && typeof beeld.velden.titel === 'string' ? beeld.velden.titel : '';
  return 'uw ' + soort + (titel ? ' ‘' + titel + '’' : '');
}

function maakContextDomeinen() {
  const domeinen = new Map();
  const achter = new WeakMap();

  /* Een domein meldt zich. Een onvolledige melding gooit -- bij het opstarten,
     niet bij de eerste vraag van een lid. */
  function meld(d) {
    const soort = woord(d && d.soort);
    if (!soort) throw new Error('contextdomein zonder soort');
    for (const k of ['zoek', 'eigenaar', 'mag', 'beeld'])
      if (typeof d[k] !== 'function') throw new Error('contextdomein ' + soort + ': ' + k + ' ontbreekt (leeg is dicht)');
    if (!Array.isArray(d.velden) || !d.velden.length || d.velden.length > MAX_VELDEN)
      throw new Error('contextdomein ' + soort + ': velden is een positieve lijst van 1 tot ' + MAX_VELDEN + ' namen');
    if (domeinen.has(soort)) throw new Error('contextdomein ' + soort + ' is al gemeld; twee eigenaars van een soort is er een te veel');
    domeinen.set(soort, { soort, zoek: d.zoek, eigenaar: d.eigenaar, mag: d.mag, beeld: d.beeld,
      velden: Object.freeze(d.velden.map(String)) });
  }

  function beeldVan(dom, rij, id) {
    let ruw = null;
    try { ruw = dom.beeld(rij); } catch (e) { ruw = null; }
    const velden = {}, gewist = [];
    if (ruw && typeof ruw === 'object') {
      for (const k of Object.keys(ruw)) {
        if (!dom.velden.includes(k)) { gewist.push(k); continue; }
        const v = waarde(ruw[k]);
        if (v !== undefined) velden[k] = v;
      }
    }
    return { beeld: Object.freeze({ soort: dom.soort, id, velden: Object.freeze(velden) }), gewist };
  }

  /* De opties voor ./menscontext-ref.js, gebonden aan EEN sessie. Zonder
     sessiesleutel is er geen bereik, en dan levert de ketting BUITEN_BEREIK --
     "ik kon niet kijken" is geen "het mag". */
  function voor(sessie) {
    const s = sessie || null;
    const gewist = [];
    return {
      opzoeker(ref) {
        const dom = domeinen.get(woord(ref && ref.soort));
        if (!dom) return null;
        const rij = dom.zoek(String(ref.id || ''));
        if (!rij || typeof rij !== 'object') return null;
        const { beeld, gewist: weg } = beeldVan(dom, rij, String(ref.id || ''));
        for (const k of weg) gewist.push({ soort: dom.soort, veld: k, reden: 'staat niet in de positieve veldlijst van dit domein' });
        achter.set(beeld, { dom, rij });
        return beeld;
      },
      bereik: {
        sleutel: s && s.key ? String(s.key) : null,
        eigenaarVan(beeld) {
          const a = achter.get(beeld);
          return a ? a.dom.eigenaar(a.rij) : null;
        }
      },
      mag(beeld) {
        const a = achter.get(beeld);
        return !!a && a.dom.mag(a.rij, s) === true;
      },
      /* Wat de domeinen probeerden mee te geven en hier is tegengehouden. */
      gewist: () => gewist.slice()
    };
  }

  /* Wat een route nodig heeft, in een keer: de opzoeking voor de stuurlus (die
     zelf saneert) en de schermregel voor het gesprek. Een sanering per route,
     zodat het gesprek en de stuurlus dezelfde regel zien. */
  /* Wat een route nodig heeft, in een keer, voor DEZE vraag: de opzoeking voor
     de stuurlus, de relatie tussen de vraag en het aangewezen object
     (./menscontext-relatie.js), de schermregel voor het gesprek, en -- als de
     vraag het object noemt en er iets bij zegt dat er niet bij hoort -- de
     vraag die Rahul terugstelt in plaats van te raden. */
  function scherm(sessie, ruw, vraag) {
    const opzoeking = voor(sessie);
    const r = menscontext.saneer(ruw, opzoeking);
    const beelden = (r.verwijzingenUitslag || []).filter((u) => u.stand === 'CANONIEK').map((u) => u.object);
    const { relatie, reden, object } = relatieVan(vraag, beelden);
    const regel = menscontext.handtekening(r, { relatie });
    /* `aangewezen`: de SERVER vond een object van deze mens EN de vraag gaat
       erover. Alleen dan mag een vrije vraag eerst naar de stuurlus; een nieuwe
       taak met een oude aanvraag open is geen vraag over die aanvraag. */
    const aangewezen = beelden.length > 0 && (relatie === 'over' || relatie === 'wijzig');
    const onderwerp = object && relatie !== 'los' ? naamVan(object) : null;
    return { opzoeking, aangewezen, relatie, reden, onderwerp,
      verduidelijk: relatie === 'onduidelijk' && beelden.length
        ? 'Bedoelt u ' + naamVan(object || beelden[0]) + ', of gaat het om iets nieuws? Zeg het gerust, dan ga ik verder.' : null,
      scherm: regel ? { regel, uitleg: CONTEXT_REGELS } : null };
  }

  return { meld, voor, scherm, soorten: () => [...domeinen.keys()] };
}

module.exports = { maakContextDomeinen, MAX_VELDEN, MAX_WAARDE };
