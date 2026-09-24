/* Magnaat Economische Motor -- de economische autoriteit van Magnaat.

   MAGNAAT.md par. 2: Magnaat krijgt precies EEN economische autoriteit. Dit is
   hij. Server-autoritatief, deterministisch, volledig synthetisch, dubbel
   boekhouden voor iedere geldstroom, bedragen in hele eurocenten.

   WAT HIJ KENT: geld, rekeningen, bedrijven als economische eenheden, de markt,
   arbeid, krediet, de sectoren van een wereld, en het journaal.
   WAT HIJ NIET KENT: wie hem gebruikt. Geen Oefenkantoor, geen missies, geen
   economenlab, geen bedrijf bij naam. Wat per wereld verschilt komt binnen via
   het PROFIEL; wat een consument naast de economie wil doen, via HAKEN. De
   afhankelijkheid loopt een kant op: consument -> motor, nooit andersom
   (test/magnaat-economische-motor.test.js houdt dat vast op de bron).

     maak({
       wereld,        vaste id van deze economie; staat op elke gebeurtenis
       profiel,       { bedrijven: { <id>: { start, kredietLimiet, kasBuffer } },
                        openingskas: { <sector>: cent }, teksten: { omgeving, werk } }
       wereldState,   () => het object waarin de projectie woont (wereld.economie)
       opslag,        het journaal (./journaal-opslag.js)
       save, motorklant, haken: { zorgStaat, naDag, verrijk }
     })

   Hoe een gebeurtenis, het journaal en de projectie samenhangen staat in
   ./journaal.js; waarom het journaal nooit korter wordt in ./journaal-opslag.js. */
'use strict';
const { SECTOREN, ACTIVITEITEN, MOTOR_VERSIE, REGEL_VERSIE } = require('./constanten');
const { geheugenJournaal, collectieJournaal } = require('./journaal-opslag');

function keurProfiel(profiel) {
  if (!profiel || typeof profiel !== 'object') throw new Error('De economische motor vereist een profiel.');
  const bedrijven = Object.entries(profiel.bedrijven || {});
  if (!bedrijven.length) throw new Error('Een economisch profiel heeft ten minste een bedrijf.');
  for (const [id, b] of bedrijven) {
    if (!b || !b.start || !Number.isInteger(b.kredietLimiet) || !Number.isInteger(b.kasBuffer)) {
      throw new Error('Bedrijf ' + id + ' mist start, kredietLimiet of kasBuffer in het profiel.');
    }
    if (SECTOREN.includes(id)) throw new Error('Bedrijf ' + id + ' draagt de naam van een sector.');
  }
  for (const sector of SECTOREN) {
    if (!Number.isInteger(profiel.openingskas && profiel.openingskas[sector])) throw new Error('Het profiel mist de openingskas van ' + sector + '.');
  }
  if (!profiel.teksten || !profiel.teksten.omgeving || !profiel.teksten.werk) throw new Error('Het profiel mist zijn teksten.');
}

function maak({ wereld, profiel, wereldState, opslag, save = () => {}, motorklant = null, haken = {} }) {
  if (typeof wereldState !== 'function') throw new Error('De economische motor vereist wereldState().');
  if (!wereld || typeof wereld !== 'string') throw new Error('De economische motor vereist een wereld-id.');
  if (!opslag) throw new Error('De economische motor vereist een journaal.');
  keurProfiel(profiel);
  const m = { wereld, profiel, wereldState, opslag, save, haken, motor: motorklant || require('../magnaat-motorklant')() };
  /* Letterlijk opgesomd en niet uit een lijst namen geladen: de bedradingsmeter
     (keuringsregel 59, BEDRADING.json) ziet een require met een variabele als onbekende kant. */
  const delen = [require('./journaal'), require('./geldstromen'), require('./markt'), require('./rust'),
    require('./staat'), require('./dag'), require('./besluiten'), require('./overzicht')];
  for (const deel of delen) Object.assign(m, deel(m));
  return {
    wereld, motorVersie: MOTOR_VERSIE, regelVersie: REGEL_VERSIE,
    overzicht: m.overzicht, volgendeDag: m.volgendeDag, volgendeDagAsync: m.volgendeDagAsync,
    beslis: m.beslis, kiesSchok: m.kiesSchok, transactie: m.transactie, verricht: m.verricht,
    verifieer: m.verifieer, gebeurtenissen: m.gebeurtenissen, saldiNa: m.saldiNa,
    _state: m.state, _boek: m.boek
  };
}

module.exports = { maak, geheugenJournaal, collectieJournaal, ACTIVITEITEN, SECTOREN };
