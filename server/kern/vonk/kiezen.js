/* RTG Vonk, deelbestand "kiezen": DE BLINDE KEUZE UIT DE DRIE PLEKKEN.

   ./halfweg.js zet drie mogelijkheden klaar; hier kiezen de twee. Blind: tot
   beiden hebben gekozen ziet niemand wat de ander koos, ook niet DAT hij al
   koos. Anders is het geen blinde keuze maar een wachtspel.

   ZODRA BEIDEN HEBBEN GEKOZEN houdt de blindheid op. Kozen ze hetzelfde, dan
   verhuist de tafel naar die plek en is het rond. Kozen ze verschillend, dan
   zien allebei allebei de keuzes en kan ieder met een tik meegaan met de ander.
   Dat is geen geheime stemming over een mens maar een afspraak over een cafe;
   na de keuze helpt zien juist om eruit te komen.

   GEEN AANSPORING. Er staat geen teller bij, geen "de ander wacht al twee
   dagen", geen herinnering. LIFE.md par. 4.1: de knop mag, het duwtje niet.

   DE TAFEL VERHUIST, DE BETALING NIET. m.tafel blijft de vorm die ./match
   verwacht (supplierCode, datum, tijd, prijsPP); alleen de zaak erin verandert.
   Zo raakt de betaal- en reserveerketen hier niet aan, en blijft er een tafel
   staan ook als niemand kiest -- de automatische tafel in het midden is nog
   steeds de bodem, geen tussenstap die je eerst moet nemen. */
module.exports = (ctx) => {
  const { d, save, nu, mag, codenaamVan, notify, sseToCustomer, tafelkaart } = ctx;

  const matchVan = (key, mid) => d().matches.find(x => x.id === mid && (x.a === key || x.b === key));

  /* Wat het lid mag zien. `keuzes` komt er alleen uit als beiden hebben gekozen;
     tot dan is er alleen de eigen keuze. */
  function halfweg(key, mid) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const m = matchVan(key, mid);
    if (!m) return { status: 404, error: 'Deze match bestaat niet.' };
    const hw = m.halfweg || { opties: [], waarom: null, keuzes: {} };
    const ander = m.a === key ? m.b : m.a;
    const beide = !!(hw.keuzes[key] && hw.keuzes[ander]);
    return { status: 200, opties: hw.opties || [], waarom: hw.waarom || null,
      mijnKeuze: hw.keuzes[key] || null, beideGekozen: beide,
      keuzeAnder: beide ? hw.keuzes[ander] : null,
      rond: beide && hw.keuzes[key] === hw.keuzes[ander],
      tafel: m.tafel || null, kaart: tafelkaart() };
  }

  function kies(key, mid, optieId) {
    const poort = mag(key);
    if (!poort.ok) return { status: 403, error: poort.reden };
    const m = matchVan(key, mid);
    if (!m) return { status: 404, error: 'Deze match bestaat niet.' };
    const hw = m.halfweg;
    if (!hw || !(hw.opties || []).length) return { status: 409, error: 'Er staan geen plekken klaar voor deze match.' };
    const optie = hw.opties.find(o => o.id === String(optieId || ''));
    if (!optie) return { status: 400, error: 'Die plek staat niet in uw drie.' };
    hw.keuzes[key] = optie.id;

    const ander = m.a === key ? m.b : m.a;
    const beide = !!hw.keuzes[ander];
    const rond = beide && hw.keuzes[ander] === optie.id;
    if (rond && m.tafel) {
      // dezelfde keuze: de tafel verhuist naar die plek, de rest blijft
      m.tafel = { ...m.tafel, supplierCode: optie.supplierCode, supplierName: optie.supplierName,
        plek: optie.plek, soort: optie.soort, middenAfstandKm: optie.middenAfstandKm };
      for (const wie of [m.a, m.b]) {
        try { notify(wie, { icon: 'bar', title: 'U koos hetzelfde', body: optie.soortLabel + ' bij ' + optie.supplierName + '. Bevestig met EUR ' + (m.tafel.prijsPP) + ' p.p.' }); } catch (e) {}
        try { sseToCustomer(wie, 'vonk', { kind: 'halfweg', id: m.id }); } catch (e) {}
      }
    } else if (beide) {
      // allebei gekozen, maar verschillend: nu mogen ze het van elkaar zien
      for (const wie of [m.a, m.b]) { try { sseToCustomer(wie, 'vonk', { kind: 'halfweg', id: m.id }); } catch (e) {} }
    }
    save();
    return { status: 200, ok: true, mijnKeuze: optie.id, beideGekozen: beide, rond,
      keuzeAnder: beide ? hw.keuzes[ander] : null, tafel: rond ? m.tafel : null };
  }

  return { vonkHalfweg: halfweg, vonkKies: kies };
};
