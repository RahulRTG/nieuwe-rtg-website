/* Directpay, deelbestand "betalen": het rechtstreeks afrekenen zelf. De kant
   met de kaart (betaalDirect, via de betaal-naad) en de kant met munten
   (registreerMuntBetaling, waar het geld al binnen is). De idempotentie, de
   tempolimiet, het grootboek en de publieke vorm komen via de ctx uit
   ./index.js; dit bestand kent alleen de volgorde van de stappen.

   Afgesplitst uit index.js toen die de 10 KB passeerde: die is de orkestrator,
   dit is de handeling. */
module.exports = (ctx) => {
  const { db, save, crypto, betaal, ensure, centenVan, id, schoon, nu, ledger, publiek,
    idemZoek, idemBewaar, tempoOk, findSupplier, notifySupplier, logActivity,
    sseToSupplier, sseToCustomer, sseToOffice, MIN_CENTEN, MAX_CENTEN } = ctx;

  /* De betalingen die op DIT moment bij de provider liggen. De idempotentie-
     controle hieronder en het vastleggen in voerUit staan aan weerszijden van
     `await betaal.maakBetaling`. Twee gelijktijdige verzoeken zagen allebei
     niets en legden allebei een betaling vast: het lid werd terecht maar EEN
     keer afgeschreven (allebei sturen dezelfde idempotencyKey naar de provider)
     en juist daardoor viel het niet op dat de ontvangstenteller van de
     leverancier dubbel telde. Een tweede verzoek wacht nu op het eerste. */
  const inVlucht = new Map();

  /* Het lid betaalt een leverancier rechtstreeks. `idem` is een client-token dat
     dubbel afschrijven bij dubbeltik/herhaling voorkomt. */
  async function betaalDirect({ key, codename, supplierCode, bedragCenten, omschrijving, bron, idem }) {
    ensure();
    const s = findSupplier(supplierCode);
    if (!s) return { status: 404, error: 'Leverancier niet gevonden.' };
    const cent = centenVan(bedragCenten);
    if (!Number.isFinite(cent) || cent < MIN_CENTEN) return { status: 400, error: 'Kies een bedrag van minstens € ' + (MIN_CENTEN / 100).toFixed(2) + '.' };
    if (cent > MAX_CENTEN) return { status: 400, error: 'Dit bedrag is te hoog voor een directe betaling.' };
    // idempotentie tegen dubbeltik: zelfde lid + zelfde idem = zelfde betaling
    const idemSleutel = idem ? ('dp:' + key + ':' + String(idem).slice(0, 60)) : null;
    if (idemSleutel) {
      const al = idemZoek(idemSleutel);
      if (al) return { status: 200, ok: true, betaling: publiek(al), herhaald: true };
      const bezig = inVlucht.get(idemSleutel);
      if (bezig) {
        const eerder = await bezig;
        return eerder && eerder.ok ? Object.assign({}, eerder, { herhaald: true }) : eerder;
      }
    }
    // tempolimiet NA de idempotentie-check: retries blijven altijd mogelijk
    if (!tempoOk(key)) return { status: 429, error: 'Even rustig aan: te veel betalingen kort na elkaar. Probeer het over een minuut opnieuw.' };
    const werk = { key, codename, zaak: s, cent, omschrijving, bron, idem, idemSleutel };
    if (!idemSleutel) return await voerUit(werk);
    const belofte = voerUit(werk);
    inVlucht.set(idemSleutel, belofte);
    try { return await belofte; } finally { inVlucht.delete(idemSleutel); }
  }

  async function voerUit({ key, codename, zaak: s, cent, omschrijving, bron, idem, idemSleutel }) {
    let prov;
    try {
      prov = await betaal.maakBetaling({
        bedrag: cent, valuta: 'eur',
        referentie: 'DP-' + (idem || crypto.randomUUID()),
        idempotentieSleutel: idemSleutel || undefined,
        omschrijving: (s.name + ' · ' + (omschrijving || 'Directe betaling')).slice(0, 120),
        // productie: bestemming = connected account van de leverancier (destination charge)
        bestemming: s.stripeAccount || undefined
      });
    } catch (e) { return { status: 502, error: 'Betaling kon niet gestart worden: ' + e.message }; }
    if (prov.status && !['betaald', 'succeeded', 'processing', 'requires_capture'].includes(prov.status))
      return { status: 402, error: 'De betaling is niet bevestigd.' };
    const b = {
      ref: id('DP'), key, codename: codename || key, supplierCode: s.code, supplierName: s.name,
      bedrag: cent, omschrijving: schoon(omschrijving, 120) || 'Directe betaling',
      bron: ['ai', 'salon', 'verzoek', 'app'].includes(bron) ? bron : 'app',
      providerId: prov.id || null, aanbieder: prov.aanbieder || 'demo', idem: idemSleutel || null, at: nu()
    };
    vastleggen(b, cent, key, 'Rechtstreeks betaald', 'betaalde rechtstreeks € ' + (cent / 100).toFixed(2));
    idemBewaar(b);
    save();
    return { status: 200, ok: true, betaling: publiek(b) };
  }

  /* Een met munten (crypto) betaalde directe betaling vastleggen. Het geld is al
     binnen en door de munt-aanbieder omgezet naar euro; hier alleen registreren
     en de leverancier crediteren, zonder kaartafschrijving. */
  function registreerMuntBetaling({ key, codename, supplierCode, bedragCenten, omschrijving }) {
    ensure();
    const s = findSupplier(supplierCode);
    if (!s) return { status: 404, error: 'Leverancier niet gevonden.' };
    const cent = centenVan(bedragCenten);
    if (!Number.isFinite(cent) || cent < MIN_CENTEN) return { status: 400, error: 'Bedrag te laag.' };
    /* DEZELFDE BOVENGRENS ALS betaalDirect, en die stond hier niet.

       betaalDirect weigert boven MAX_CENTEN; deze tweeling controleerde alleen de
       ondergrens. Het bedrag komt hier uit de munt-webhook, dus de aanbieder --
       of wie zijn bericht kan zetten -- bepaalde zelf hoeveel er bij de
       ontvangstenteller van de leverancier bij kwam. De doorlichting zag
       EUR 10.000.000 bijgeschreven op een verzoek van EUR 0,50.

       Pijnlijk detail: deze functie is vanmiddag door mij uit index.js gehaald.
       De asymmetrie is meeverhuisd zonder dat ik hem zag -- twee functies naast
       elkaar met verschillende grenzen leest als opzet zolang niemand ze naast
       elkaar legt. */
    if (cent > MAX_CENTEN) return { status: 400, error: 'Dit bedrag is te hoog voor een directe betaling.' };
    const b = {
      ref: id('DP'), key, codename: codename || key, supplierCode: s.code, supplierName: s.name,
      bedrag: cent, omschrijving: schoon(omschrijving, 120) || 'Directe betaling (munten)',
      bron: 'app', providerId: null, aanbieder: 'munt', betaalwijze: 'munt', idem: null, at: nu()
    };
    vastleggen(b, cent, key, 'Rechtstreeks betaald (munten)', 'betaalde rechtstreeks € ' + (cent / 100).toFixed(2) + ' met munten');
    save();
    return { status: 200, ok: true, betaling: publiek(b) };
  }

  /* De betaling in de boeken en iedereen die het aangaat een seintje. Beide
     betaalwijzen deden dit woord voor woord hetzelfde; de teller mag maar op
     een plek opgehoogd worden, anders loopt hij ooit uiteen. */
  function vastleggen(b, cent, key, kop, log) {
    db.data.directBetalingen.unshift(b);
    db.data.directBetalingen = db.data.directBetalingen.slice(0, 200000);
    const L = ledger(b.supplierCode); L.som += cent; L.aantal += 1;
    try { notifySupplier(b.supplierCode, { icon: 'betalen', title: kop, body: b.codename + ' betaalde € ' + (cent / 100).toFixed(2) + (b.omschrijving ? ' · ' + b.omschrijving : '') }); } catch (e) {}
    try { logActivity(b.supplierCode, { name: b.codename }, log); } catch (e) {}
    try { sseToSupplier(b.supplierCode, 'sync', { scope: 'ontvangsten' }); } catch (e) {}
    try { sseToCustomer(key, 'sync', { scope: 'betalingen' }); } catch (e) {}
    try { sseToOffice('sync', { scope: 'ontvangsten' }); } catch (e) {}
  }

  return { betaalDirect, registreerMuntBetaling };
};
