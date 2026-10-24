/* Vastleggen van een reeds bevestigde providerbetaling. Deze laag boekt
   en meldt, maar kan zelf geen providerbetaling starten. De bestaande grenzen,
   herhaalsleutels en transactie-index blijven behouden. */
module.exports = (ctx) => {
  const { save, ensure, centenVan, id, schoon, nu, ledger, publiek, idemZoek,
    idemBewaar, findSupplier, notifySupplier, logActivity, sseToSupplier,
    sseToCustomer, sseToOffice, MIN_CENTEN, MAX_CENTEN, directBetalingenVoegToe } = ctx;
  /* Een met munten (crypto) betaalde directe betaling vastleggen. Het geld is al
     binnen en door de munt-aanbieder omgezet naar euro; hier alleen registreren
     en de leverancier crediteren, zonder kaartafschrijving. */
  function registreerBevestigdeBetaling({ key, codename, supplierCode, bedragCenten, omschrijving, bron, providerId, aanbieder, betaalwijze, idem }) {
    ensure();
    const s = findSupplier(supplierCode);
    if (!s) return { status: 404, error: 'Leverancier niet gevonden.' };
    const cent = centenVan(bedragCenten);
    if (!Number.isFinite(cent) || cent < MIN_CENTEN) return { status: 400, error: 'Bedrag te laag.' };
    /* Dezelfde harde bovengrens als betaalDirect. Ook een provider-ingang mag
       nooit een door de afzender gekozen onbeperkte bijschrijving toelaten. */
    if (cent > MAX_CENTEN) return { status: 400, error: 'Dit bedrag is te hoog voor een directe betaling.' };
    const idemSleutel = idem || (providerId ? String(aanbieder || 'provider') + ':' + providerId : null);
    if (idemSleutel) {
      const al = idemZoek(idemSleutel);
      // een herhaling is alleen een herhaling bij hetzelfde bedrag en dezelfde partner
      if (al && (al.bedrag !== cent || al.supplierCode !== s.code))
        return { status: 409, error: 'Deze sleutel hoort al bij een ander bedrag of een andere partner.' };
      if (al) return { status: 200, ok: true, betaling: publiek(al), herhaald: true };
    }
    const isMunt = betaalwijze === 'munt';
    const b = {
      ref: id('DP'), key, codename: codename || key, supplierCode: s.code, supplierName: s.name,
      bedrag: cent, omschrijving: schoon(omschrijving, 120) || (isMunt ? 'Directe betaling (munten)' : 'Directe betaling'),
      bron: ['ai', 'salon', 'verzoek', 'app'].includes(bron) ? bron : 'app', providerId: providerId || null,
      aanbieder: aanbieder || (isMunt ? 'munt' : 'stripe'), betaalwijze: isMunt ? 'munt' : 'kaart', idem: idemSleutel, at: nu()
    };
    vastleggen(b, cent, key, isMunt ? 'Rechtstreeks betaald (munten)' : 'Rechtstreeks betaald',
      'betaalde rechtstreeks € ' + (cent / 100).toFixed(2) + (isMunt ? ' met munten' : ''));
    idemBewaar(b);
    save();
    return { status: 200, ok: true, betaling: publiek(b) };
  }

  function registreerMuntBetaling(a) {
    return registreerBevestigdeBetaling(Object.assign({}, a, { aanbieder: 'munt', betaalwijze: 'munt' }));
  }

  /* De betaling in de boeken en iedereen die het aangaat een seintje. Beide
     betaalwijzen deden dit woord voor woord hetzelfde; de teller mag maar op
     een plek opgehoogd worden, anders loopt hij ooit uiteen. */
  function vastleggen(b, cent, key, kop, log) {
    /* Ging met unshift + slice(0, 200000). Die slice kopieerde bij elke betaling
       de hele array, en wat erbuiten viel verdween zonder spoor -- boeking
       50.001, maar dan met geld. Nu via de transactie-index: geindexeerd, en de
       staart gaat naar het grootboek of anders eerst naar het archief. */
    directBetalingenVoegToe(b);
    const L = ledger(b.supplierCode); L.som += cent; L.aantal += 1;
    try { notifySupplier(b.supplierCode, { icon: 'betalen', title: kop, body: b.codename + ' betaalde € ' + (cent / 100).toFixed(2) + (b.omschrijving ? ' · ' + b.omschrijving : '') }); } catch (e) {}
    try { logActivity(b.supplierCode, { name: b.codename }, log); } catch (e) {}
    try { sseToSupplier(b.supplierCode, 'sync', { scope: 'ontvangsten' }); } catch (e) {}
    try { sseToCustomer(key, 'sync', { scope: 'betalingen' }); } catch (e) {}
    try { sseToOffice('sync', { scope: 'ontvangsten' }); } catch (e) {}
  }

  return { registreerMuntBetaling, registreerBevestigdeBetaling };
};
