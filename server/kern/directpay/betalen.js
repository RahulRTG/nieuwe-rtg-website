/* Directpay-handeling voor kaart- en reeds bevestigde muntbetalingen.
   De gedeelde grenzen, idempotentie en boekhouding komen via index.js. */
const betaalstaten = require('../betaalwaarheid/staten');

module.exports = (ctx) => {
  const { db, save, crypto, betaal, ensure, centenVan, id, schoon, nu, nuMs, ledger, publiek,
    idemZoek, idemBewaar, tempoOk, findSupplier, notifySupplier, logActivity,
    sseToSupplier, sseToCustomer, sseToOffice, MIN_CENTEN, MAX_CENTEN,
    directBetalingenVoegToe } = ctx;

  /* Verzoeken met dezelfde sleutel delen ook rond de provider-await één
     belofte, zodat de leverancier nooit dubbel wordt gecrediteerd. */
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
    // Een gewone platformbetaling mag nooit doorgaan voor iets dat "rechtstreeks" heet.
    if (betaal.AANBIEDER === 'stripe' && !betaal.CONNECT_SANDBOX)
      return { status: 503, error: 'Rechtstreeks betalen staat veilig uit totdat Stripe Connect met gecontroleerde partneraccounts is geactiveerd.' };
    if (betaal.CONNECT_SANDBOX && !s.stripeAccount)
      return { status: 409, error: 'Deze partner heeft nog geen Connected Account in de lokale sandbox.' };
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
    /* Processing en requires_capture zijn nog geen ontvangen geld. Bewaar wel
       de strikt begrensde settlementcontext, zodat uitsluitend een later
       geverifieerd providerbericht de echte boeking kan afronden. */
    if (!betaalstaten.definitiefBetaald(betaalstaten.providerStatus(prov.aanbieder, prov.status, 'start'))) {
      if (prov.id) {
        db.data.kaartWachtend = db.data.kaartWachtend && typeof db.data.kaartWachtend === 'object'
          ? db.data.kaartWachtend : {};
        db.data.kaartWachtend[prov.id] = {
          soort: 'direct', betaalwijze: 'kaart', key, codename,
          supplierCode: s.code, centen: cent,
          omschrijving: schoon(omschrijving, 120) || 'Directe betaling',
          bron: ['ai', 'salon', 'verzoek', 'app'].includes(bron) ? bron : 'app',
          idem: idemSleutel || ('provider:' + prov.id), at: nuMs()
        };
        const sleutels = Object.keys(db.data.kaartWachtend);
        if (sleutels.length > 20000)
          for (const k of sleutels.slice(0, sleutels.length - 20000)) delete db.data.kaartWachtend[k];
        save();
      }
      return {
        status: 402,
        error: 'De kaartbetaling is nog niet definitief bevestigd. Er is niets bij de partner geboekt.',
        pending: true,
        providerId: prov.id || null,
        clientSecret: prov.clientSecret || null
      };
    }
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

  return { betaalDirect, registreerMuntBetaling, registreerBevestigdeBetaling };
};
