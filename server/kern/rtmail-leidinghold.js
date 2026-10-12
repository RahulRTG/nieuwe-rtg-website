/* RTMAIL (deelmodule): de JURIDISCHE HOLD op sollicitatiepost van de
   leidingsplek (besluit 584A met de voorwaarden van de eigenaar, 12 oktober 2026).
   Anders dan een verlenging geen plafond (een bewaarplicht kan langer duren),
   en daarom zwaarder afgeschermd.

   1. AANVRAGEN: een manager van DIE zaak (de route), voor bestaande berichten,
      met grondslag (gesloten lijst), doel en herbeoordelingsdatum, uit de inlog.
   2. HOUDT NIETS VAST tot een beoordeling door de eigenaar of een
      boardroombevoegde met een verse passkey (de route), en alleen als aanvrager
      en beoordelaar ALLEBEI door RTG gekeurd zijn (A3) en aantoonbaar
      verschillende personen (accounts/zelfdemens.js, besluit van de eigenaar).
      Vastgelegd: `onafhankelijkheid: 'gekeurde-identiteit'`, nooit "bewezen":
      een keuring bewijst een identiteit, niet wie er achter het toetsenbord zat.
      Niet gekeurd, niet te vergelijken of zonder accountsleutel (PIN): 409.
      Dezelfde persoon: 403. Afwijzen kan altijd.
   3. HERBEOORDELEN is een volledige nieuwe beoordeling: dezelfde toets, grondslag
      en doel opnieuw, en een datum hoogstens twaalf maanden na DEZE beoordeling.
   4. Een verlopen herbeoordeling HOUDT VAST (besluit van de eigenaar), maar
      escaleert elke ronde naar het kantoor (beveilig.meld, kritiek) tot iemand
      herbeoordeelt of de hold opheft. Niets wordt vanzelf verlengd of vernietigd.
   Een hold van een collega, een gedelegeerde of de bewaring van het gedeelde
   postvak raakt de leidingsplek niet. */
'use strict';

const HOLD_GRONDSLAGEN = Object.freeze(['wettelijke-plicht', 'geschil', 'onderzoek-autoriteit']);
const dag = (iso) => String(iso || '').slice(0, 10);
// een echte kalenderdag: 2027-02-31 rolt bij het parsen door naar maart en telt dus niet
const isDatum = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
/* Hoogstens twaalf maanden vooruit: een hold kan langer gelden, maar alleen door
   hem opnieuw te beoordelen -- zo wordt hij nooit stil permanent. */
const MAAND_MAX = 12;
function binnenTermijn(s, t) {
  if (!isDatum(s) || s <= dag(t)) return false;
  const grens = new Date(dag(t) + 'T00:00:00Z'); grens.setUTCMonth(grens.getUTCMonth() + MAAND_MAX);
  return s <= grens.toISOString().slice(0, 10);
}
const DATUMFOUT = 'Geef een herbeoordelingsdatum (JJJJ-MM-DD) die bestaat, in de toekomst ligt en hoogstens ' + MAAND_MAX + ' maanden vooruit.';

module.exports = ({ L, lees, plek, save, busVan, kap, nu, crypto, zelfdeMens }) => {
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
    if (!binnenTermijn(herbeoordeling, nu())) return { status: 400, error: DATUMFOUT };
    if (!Array.isArray(ids) || !ids.length || ids.some(x => typeof x !== 'string'))
      return { status: 400, error: 'Noem de berichten waar de hold over gaat; een hold geldt nooit voor post die nog moet komen.' };
    const eigen = new Set(plek().filter(m => busVan(m.naar) === bus).map(m => m.id));
    const vreemd = ids.filter(x => !eigen.has(x));
    if (vreemd.length) return { status: 404, error: 'Niet op de leidingsplek van deze zaak: ' + vreemd.join(', ') + '.' };
    const h = { id: crypto.randomBytes(5).toString('hex'), postvak: bus, ids: [...new Set(ids)], grondslag, doel: d,
      herbeoordeling, stand: 'aangevraagd', aangevraagdDoor: door, aanvragerSleutel: sleutel || null, aangevraagdOp: nu() };
    const zonder = !h.aanvragerSleutel;
    schrijf().unshift(h);
    spoor({ postvak: bus, hold: h.id, actie: 'hold aangevraagd', grondslag, door });
    save();
    return { ok: true, hold: h, let: zonder ? 'Een inlog zonder account: deze hold kan niet worden goedgekeurd.'
      : 'De hold houdt niets vast tot een andere, door RTG gekeurde persoon met boardroomrecht hem heeft beoordeeld.' };
  }

  /* De beoordeling. `wie` is de boardroomsleutel uit de inlog (de route eist
     boardroom en een verse passkey); de aanvrager beoordeelt nooit zijn eigen hold. */
  function beoordeel({ id, actie, herbeoordeling, grondslag, doel, wie }) {
    const h = schrijf().find(x => x.id === String(id || ''));
    if (!h) return { status: 404, error: 'Die hold bestaat niet.' };
    if (!wie) return { status: 403, error: 'Beoordelen hoort bij een persoon met een boardroomsleutel.' };
    if (!h.aanvragerSleutel && actie !== 'afwijzen')
      return { status: 409, error: 'Niet vast te stellen wie aanvroeg (een inlog zonder account). Alleen afwijzen kan; vraag opnieuw aan vanaf een account.' };
    if (h.aanvragerSleutel === wie)
      return { status: 403, error: 'Wie de hold aanvroeg, beoordeelt hem niet zelf: daar is een andere gekeurde persoon voor.' };
    // `zelfdeMens` (accounts/zelfdemens.js): 'ander', 'zelfde' of 'onbekend' -- alleen 'ander' telt
    const mens = actie === 'afwijzen' ? 'ander' : (typeof zelfdeMens === 'function' ? zelfdeMens(h.aanvragerSleutel, wie) : 'onbekend');
    if (mens === 'zelfde') return { status: 403, error: 'Volgens de kluis zijn aanvrager en beoordelaar dezelfde (gekeurde) persoon: daar is een ander voor nodig.' };
    if (mens !== 'ander') return { status: 409, error: 'Niet vast te stellen dat u een andere gekeurde persoon bent dan de aanvrager: ' +
      'laat beide accounts door RTG keuren (identiteitsbewijs met de geboortedatum van het document) en probeer het opnieuw.' };
    const ander = { onafhankelijkheid: 'gekeurde-identiteit', vastgesteld: 'beide accounts door RTG gekeurd (A3); naam of documentgeboortedatum verschilt' };
    const open = h.stand === 'aangevraagd', loopt = h.stand === 'beoordeeld';
    if (actie === 'goedkeuren' && open) Object.assign(h, ander, { stand: 'beoordeeld', beoordeeldDoor: wie, beoordeeldOp: nu() });
    else if (actie === 'afwijzen' && open) Object.assign(h, { stand: 'afgewezen', beoordeeldDoor: wie, beoordeeldOp: nu() });
    else if (actie === 'herbeoordeel' && loopt) {
      if (typeof grondslag !== 'string' || !HOLD_GRONDSLAGEN.includes(grondslag))
        return { status: 400, error: 'Een herbeoordeling stelt de grondslag opnieuw vast: ' + HOLD_GRONDSLAGEN.join(', ') + '.' };
      const d = kap(doel, 600);
      if (!d) return { status: 400, error: 'Een herbeoordeling stelt het doel opnieuw vast; een nieuwe datum alleen zet een hold niet voort.' };
      if (!binnenTermijn(herbeoordeling, nu())) return { status: 400, error: DATUMFOUT };
      Object.assign(h, ander, { grondslag, doel: d, herbeoordeling, herbeoordeeldDoor: wie, herbeoordeeldOp: nu(), escalatie: null });
    } else if (actie === 'opheffen' && loopt) Object.assign(h, ander, { stand: 'opgeheven', opgehevenDoor: wie, opgehevenOp: nu(), escalatie: null });
    else return { status: 409, error: 'Dat kan niet in de stand "' + h.stand + '".' };
    spoor({ postvak: h.postvak, hold: h.id, actie: 'hold ' + actie, door: wie, grondslag: h.grondslag, doel: h.doel,
      herbeoordeling: h.herbeoordeling, onafhankelijkheid: h.onafhankelijkheid || null });
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
