/* RTMAIL (deelmodule): de JURIDISCHE HOLD op sollicitatiepost van de
   leidingsplek (besluit 584A, aanscherping van de eigenaar, 12 oktober 2026).

   Een VERLENGING (./rtmail-leidingtermijn.js) is een gewone zaak: per bericht,
   hoogstens een jaar, in te trekken. Een HOLD is iets anders: een wettelijke of
   juridische bewaarplicht kan langer duren dan een jaar, dus er staat geen
   plafond op -- en juist daarom is hij zwaarder afgeschermd.

   1. AANVRAGEN doet een manager van DIE zaak (de route beslist), voor een
      expliciete lijst bestaande berichten -- nooit voor post die nog moet komen
      -- met een grondslag uit een gesloten lijst, een doel en een
      herbeoordelingsdatum. Wie aanvraagt komt uit de inlog.
   2. EEN AANVRAAG HOUDT NIETS VAST tot een tweede, bevoegde mens hem heeft
      beoordeeld: de eigenaar of iemand met een boardroomsleutel, met een verse
      passkey (de route), en nooit de aanvrager zelf (hier).
   3. DE HERBEOORDELINGSDATUM laat de hold niet vervallen. Besluit van de
      eigenaar: VASTHOUDEN -- zolang de verplichting geldig kan zijn, wordt er
      niets automatisch vernietigd -- maar nooit ongemerkt: de ronde escaleert
      elke keer opnieuw naar het kantoor (de bestaande beveiligingsmeldingen,
      die een kritieke melding naar de eigenaar doorzetten), tot iemand
      herbeoordeelt met een nieuwe datum of de hold opheft.
   Een hold van wie dan ook anders -- een collega, een gedelegeerde, de
   juridische bewaring van het gedeelde postvak -- raakt de leidingsplek niet. */
'use strict';

const HOLD_GRONDSLAGEN = Object.freeze(['wettelijke-plicht', 'geschil', 'onderzoek-autoriteit']);
const dag = (iso) => String(iso || '').slice(0, 10);
const isDatum = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

module.exports = ({ L, lees, plek, save, busVan, kap, nu, crypto }) => {
  const holds = () => (lees().holds || []);
  const schrijf = () => { const l = L(); if (!Array.isArray(l.holds)) l.holds = []; return l.holds; };
  const spoor = (r) => L().spoor.unshift(Object.assign({ at: nu() }, r));

  function aanvraag({ adres, ids, grondslag, doel, herbeoordeling, door, sleutel }) {
    const bus = busVan(adres);
    if (!door) return { status: 403, error: 'Wie een hold aanvraagt, komt uit de inlog; die ontbreekt.' };
    if (typeof grondslag !== 'string' || !HOLD_GRONDSLAGEN.includes(grondslag))
      return { status: 400, error: 'Kies een grondslag voor de hold: ' + HOLD_GRONDSLAGEN.join(', ') + '.' };
    const d = kap(doel, 600);
    if (!d) return { status: 400, error: 'Zeg waarvoor deze post bewaard moet blijven (doel).' };
    if (!isDatum(herbeoordeling) || herbeoordeling <= dag(nu()))
      return { status: 400, error: 'Geef een herbeoordelingsdatum in de toekomst (JJJJ-MM-DD).' };
    if (!Array.isArray(ids) || !ids.length || ids.some(x => typeof x !== 'string'))
      return { status: 400, error: 'Noem de berichten waar de hold over gaat; een hold geldt nooit voor post die nog moet komen.' };
    const eigen = new Set(plek().filter(m => busVan(m.naar) === bus).map(m => m.id));
    const vreemd = ids.filter(x => !eigen.has(x));
    if (vreemd.length) return { status: 404, error: 'Niet op de leidingsplek van deze zaak: ' + vreemd.join(', ') + '.' };
    const h = { id: crypto.randomBytes(5).toString('hex'), postvak: bus, ids: [...new Set(ids)], grondslag, doel: d,
      herbeoordeling, stand: 'aangevraagd', aangevraagdDoor: door, aanvragerSleutel: sleutel || null, aangevraagdOp: nu() };
    schrijf().unshift(h);
    spoor({ postvak: bus, hold: h.id, actie: 'hold aangevraagd', grondslag, door });
    save();
    return { ok: true, hold: h, let: 'De hold houdt niets vast tot de eigenaar of een boardroombevoegde hem heeft beoordeeld.' };
  }

  /* De beoordeling. `wie` is de boardroomsleutel uit de inlog (de route eist
     boardroom en een verse passkey); de aanvrager beoordeelt nooit zijn eigen hold. */
  function beoordeel({ id, actie, herbeoordeling, wie }) {
    const h = schrijf().find(x => x.id === String(id || ''));
    if (!h) return { status: 404, error: 'Die hold bestaat niet.' };
    if (!wie) return { status: 403, error: 'Beoordelen hoort bij een persoon met een boardroomsleutel.' };
    if (h.aanvragerSleutel && h.aanvragerSleutel === wie)
      return { status: 403, error: 'Wie de hold aanvroeg, beoordeelt hem niet zelf: daar is een tweede mens voor.' };
    const open = h.stand === 'aangevraagd', loopt = h.stand === 'beoordeeld';
    if (actie === 'goedkeuren' && open) Object.assign(h, { stand: 'beoordeeld', beoordeeldDoor: wie, beoordeeldOp: nu() });
    else if (actie === 'afwijzen' && open) Object.assign(h, { stand: 'afgewezen', beoordeeldDoor: wie, beoordeeldOp: nu() });
    else if (actie === 'herbeoordeel' && loopt) {
      if (!isDatum(herbeoordeling) || herbeoordeling <= dag(nu())) return { status: 400, error: 'Geef een nieuwe herbeoordelingsdatum in de toekomst.' };
      Object.assign(h, { herbeoordeling, herbeoordeeldDoor: wie, herbeoordeeldOp: nu(), escalatie: null });
    } else if (actie === 'opheffen' && loopt) Object.assign(h, { stand: 'opgeheven', opgehevenDoor: wie, opgehevenOp: nu(), escalatie: null });
    else return { status: 409, error: 'Dat kan niet in de stand "' + h.stand + '".' };
    spoor({ postvak: h.postvak, hold: h.id, actie: 'hold ' + actie, door: wie });
    save();
    return { ok: true, hold: h };
  }

  // alleen een BEOORDEELDE hold houdt iets vast; de herbeoordelingsdatum laat hem niet vervallen
  const houdtVast = (m, bus) => holds().some(h => h.stand === 'beoordeeld' && h.postvak === bus && h.ids.includes(m.id));
  const verlopen = (h, t) => h.stand === 'beoordeeld' && h.herbeoordeling <= dag(t);

  /* De escalatie per ronde: niet stil, en niet een keer. `meld` is het
     signaalpad van het kantoor (opzet/start.js geeft beveilig.meld mee). */
  function escaleer(t, meld) {
    let n = 0;
    for (const h of holds()) {
      if (!verlopen(h, t)) continue;
      n++;
      h.escalatie = { sinds: h.herbeoordeling, laatst: t, aantal: ((h.escalatie && h.escalatie.aantal) || 0) + 1 };
      if (typeof meld === 'function') meld('bewaarplicht-herbeoordeling', 'kritiek',
        'Een juridische hold op sollicitatiepost (' + h.postvak + ', ' + h.grondslag + ') wacht sinds ' + h.herbeoordeling +
        ' op herbeoordeling. De post blijft bewaard tot iemand herbeoordeelt of de hold opheft.', { bron: 'rtmail-hold:' + h.id });
    }
    return n;
  }

  const beeld = (bus, t) => holds().filter(h => h.postvak === bus).map(h => Object.assign({}, h, {
    let: verlopen(h, t) ? 'herbeoordeling verlopen sinds ' + h.herbeoordeling
      : h.stand === 'aangevraagd' ? 'aangevraagd: houdt niets vast tot een beoordeling' : null }));
  const lijst = (t) => holds().map(h => Object.assign({}, h, { verlopen: verlopen(h, t) }));

  return { aanvraag, beoordeel, houdtVast, escaleer, beeld, lijst, HOLD_GRONDSLAGEN };
};
module.exports.HOLD_GRONDSLAGEN = HOLD_GRONDSLAGEN;
