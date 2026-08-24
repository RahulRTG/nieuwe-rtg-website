/* RESERVEREN VOOR BESTEDEN: het verschil tussen saldo, beschikbaar en definitief.

   Een grootboek kent maar twee standen: het geld staat er of het staat er niet.
   Dat is te weinig zodra een handeling TIJD kost. Een hotel wil zeker weten dat
   de 400 euro er straks nog is, een taxi kent de ritprijs pas aan het eind, en
   een rekening in een restaurant staat een uur open. Zonder reservering is het
   antwoord op "heeft dit lid genoeg?" alleen waar op het moment dat je het
   vraagt -- en precies daartussen gaat het geld op aan iets anders.

   Vandaar drie getallen in plaats van een:

     saldo         wat er in het grootboek staat
     gereserveerd  wat is vastgezet voor een handeling die nog loopt
     beschikbaar   saldo min gereserveerd -- het enige getal waar een
                   bestedingsvraag tegenaan mag worden gehouden

   ER BEWEEGT HIER GEEN GELD. Een reservering is geen boeking en raakt de saldi
   niet aan; het grootboek blijft sluiten op nul zonder dat deze module bestaat.
   Dat is met opzet: zou een reservering boeken, dan had RTG een tweede soort
   saldo en daarmee een tweede boekhouding (GELD.md par. 1). Reserveren zegt
   alleen: reken dit deel even niet mee als beschikbaar.

   DE VERVALDATUM IS GEEN NETHEID MAAR DE KERN. Een reservering die blijft
   hangen -- de app crasht, de taxi rijdt nooit, de partner meldt niets terug --
   zet het geld van een lid vast zonder dat er ooit iets mee gebeurt. Het lid
   ziet dan saldo dat hij niet kan gebruiken en niemand kan uitleggen waarom.
   Daarom heeft elke reservering een `tot`, en is een verlopen reservering
   simpelweg geen reservering meer. Er is geen opruimtaak nodig die kan
   uitvallen: `open()` telt alleen wat nog geldt. */
'use strict';

/* De tijd komt uit de huisklok (server/lib/klok.js) en niet uit het
   besturingssysteem: een vervaldatum of wachttijd die zich van RTG_KLOK niets
   aantrekt, is niet te beproeven. Wie zelf een klok meegeeft, houdt die. */
const { nu: klokNu } = require('../../lib/klok');

const MAX_PER_REKENING = 50;      // meer openstaande reserveringen is een lek, geen gebruik
const STANDAARD_MS = 60 * 60 * 1000;   // een uur
const MAX_MS = 24 * 60 * 60 * 1000;    // niets houdt geld langer dan een dag vast

function maakReserve({ db, save, crypto, nu = klokNu }) {
  function bak() {
    if (!Array.isArray(db.data.waardeReserves)) db.data.waardeReserves = [];
    return db.data.waardeReserves;
  }
  const geldig = r => r.status === 'open' && r.tot > nu();

  /* Alle nog geldende reserveringen op een rekening. Verlopen reserveringen
     tellen hier niet mee -- ze staan nog in de lijst voor het spoor, maar ze
     zetten niets meer vast. */
  function open(rek) { return bak().filter(r => r.rek === rek && geldig(r)); }
  function vastgezet(rek) { return open(rek).reduce((s, r) => s + r.centen, 0); }

  /* Dezelfde lijst, maar vanuit de andere kant bekeken: wat heeft DEZE partij
     vastgezet? Een ondernemer die een borg vraagt, wil weten wat hij mag
     verwachten -- dat is een ander getal dan zijn saldo en het hoort niet door
     elkaar te lopen. `ref` is wie de reservering liet zetten. */
  function voorRef(ref) { return bak().filter(r => r.ref === ref && geldig(r)); }

  /* Een reservering op id, ongeacht status. Wie hem afhandelt moet zelf de ref
     nakijken -- zonder die toets kan iedereen die een id kent het vastgezette
     bedrag van een ander innen, en een id afkijken is makkelijker dan het
     lijkt. */
  function vind(id) { return bak().find(r => r.id === String(id || '')) || null; }

  function reserveer({ rek, centen, doel, ref, msGeldig }) {
    const c = Math.round(Number(centen));
    if (!rek) return { status: 400, error: 'Op welke rekening?' };
    if (!Number.isFinite(c) || c <= 0) return { status: 400, error: 'Dat bedrag kan niet.' };
    if (open(rek).length >= MAX_PER_REKENING)
      return { status: 429, error: 'Er staan te veel reserveringen open op deze rekening.' };
    const ms = Math.min(MAX_MS, Math.max(60000, Math.round(Number(msGeldig) || STANDAARD_MS)));
    const r = { id: 'RS' + crypto.randomBytes(5).toString('hex').toUpperCase(),
      rek, centen: c, doel: String(doel || 'reservering').slice(0, 60),
      ref: ref || null, status: 'open', at: nu(), tot: nu() + ms };
    bak().unshift(r);
    if (bak().length > 20000) bak().length = 20000;
    save();
    return { ok: true, reservering: r };
  }

  /* Vastleggen (capture): de handeling is doorgegaan. Deze module BOEKT NIET --
     hij geeft alleen het bedrag terug dat geboekt mag worden, en sluit de
     reservering. De boeking blijft waar hij hoort: in het pay-grootboek, langs
     dezelfde guard als elke andere. Twee plekken waar geld beweegt is er een
     te veel.

     Er mag voor MINDER worden vastgelegd dan gereserveerd (de taxirit werd
     goedkoper dan het maximum) maar nooit voor meer: dan was de reservering
     geen garantie en had het lid het verschil misschien al uitgegeven. */
  function vastleggen({ id, centen }) {
    const r = bak().find(x => x.id === id);
    if (!r) return { status: 404, error: 'Deze reservering kennen we niet.' };
    if (r.status !== 'open') return { status: 409, error: 'Deze reservering is al afgehandeld.' };
    if (r.tot <= nu()) { r.status = 'verlopen'; save(); return { status: 409, error: 'Deze reservering is verlopen.' }; }
    const c = centen == null ? r.centen : Math.round(Number(centen));
    if (!Number.isFinite(c) || c <= 0) return { status: 400, error: 'Dat bedrag kan niet.' };
    if (c > r.centen) return { status: 409, error: 'Boven het gereserveerde bedrag.', gereserveerd: r.centen };
    r.status = 'vastgelegd';
    r.vastgelegdCenten = c;
    r.vastgelegdAt = nu();
    save();
    return { ok: true, centen: c, vrijgevallen: r.centen - c, reservering: r };
  }

  function vrijgeven({ id }) {
    const r = bak().find(x => x.id === id);
    if (!r) return { status: 404, error: 'Deze reservering kennen we niet.' };
    if (r.status !== 'open') return { ok: true, alAf: true, status2: r.status };
    r.status = 'vrijgegeven';
    r.afAt = nu();
    save();
    return { ok: true, vrijgevallen: r.centen };
  }

  return { open, vastgezet, voorRef, vind, reserveer, vastleggen, vrijgeven, MAX_MS, STANDAARD_MS };
}

module.exports = { maakReserve, MAX_PER_REKENING, MAX_MS };
