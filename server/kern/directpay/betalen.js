/* Directpay-handeling voor kaart- en reeds bevestigde muntbetalingen.
   De gedeelde grenzen, idempotentie en boekhouding komen via index.js. */

module.exports = (ctx) => {
  const { save, crypto, betaal, betaalWaarheid, ensure, centenVan, id, schoon, nu, ledger, publiek,
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
      if (al && (al.bedrag !== cent || al.supplierCode !== s.code))
        return { status: 409, error: 'Deze sleutel hoort al bij een ander bedrag of een andere partner.' };
      if (al) return { status: 200, ok: true, betaling: publiek(al), herhaald: true };
      const bezig = inVlucht.get(idemSleutel);
      if (bezig) {
        if (bezig.cent !== cent || bezig.supplierCode !== s.code)
          return { status: 409, error: 'Deze sleutel hoort al bij een ander bedrag of een andere partner.' };
        const eerder = await bezig.belofte;
        return eerder && eerder.ok ? Object.assign({}, eerder, { herhaald: true }) : eerder;
      }
    }
    // tempolimiet NA de idempotentie-check: retries blijven altijd mogelijk
    if (!tempoOk(key)) return { status: 429, error: 'Even rustig aan: te veel betalingen kort na elkaar. Probeer het over een minuut opnieuw.' };
    const werk = { key, codename, zaak: s, cent, omschrijving, bron, idem, idemSleutel };
    if (!idemSleutel) return await voerUit(werk);
    const belofte = voerUit(werk);
    inVlucht.set(idemSleutel, { belofte, cent, supplierCode: s.code });
    try { return await belofte; } finally { inVlucht.delete(idemSleutel); }
  }

  /* VIA DE BETAALWAARHEID (MONEY-012). Hier stond een kale betaal.maakBetaling
     met een wachtende rij in kaartWachtend: geen veegronde, een stille wis boven
     de 20.000 rijen, en een verloren antwoord liet niets achter. Nu staat de
     betaling vast VOOR de aanroep en boekt de afhandelaar
     (kern/betaalwaarheid/inkomend.js) pas als de provider hem definitief
     bevestigt -- processing en requires_capture zijn nog geen geld. */
  async function voerUit({ key, codename, zaak: s, cent, omschrijving, bron, idemSleutel }) {
    if (!betaalWaarheid) return { status: 503, error: 'De betaalwaarheid is niet aangesloten; er is niets afgeschreven.' };
    let w;
    try {
      w = betaalWaarheid.maak({ actor: 'dp:' + key, soort: 'direct', bronRef: s.code, supplierCode: s.code,
        idem: idemSleutel || ('los:' + crypto.randomUUID()), centen: cent, valuta: 'eur',
        context: { key, codename, supplierCode: s.code, omschrijving: schoon(omschrijving, 120) || 'Directe betaling',
          bron: ['ai', 'salon', 'verzoek', 'app'].includes(bron) ? bron : 'app', idem: idemSleutel || null } });
    } catch (e) { return { status: 409, error: e.message }; }
    let uit;
    try {
      uit = await betaalWaarheid.begin(w.id, { bestemming: s.stripeAccount || undefined,
        omschrijving: (s.name + ' · ' + (omschrijving || 'Directe betaling')).slice(0, 120) });
    } catch (e) {
      return { status: 502, betalingId: w.id, onbekend: e && e.code !== 'BETAAL_AFHANDELING_MISLUKT',
        error: 'De betaling gaf geen uitsluitsel. Betaal niet opnieuw: RTG zoekt het na met dezelfde sleutel.' };
    }
    const r = betaalWaarheid.van(w.id);
    if (r && r.afgehandeldAt) {
      const b = idemZoek(idemSleutel || ('waarheid:' + w.id));
      // wat onder deze sleutel staat, moet DEZE betaling zijn
      if (!b || b.bedrag !== cent || b.supplierCode !== s.code)
        return { status: 409, betalingId: w.id, error: 'Deze sleutel hoort al bij een ander bedrag of een andere partner.' };
      return { status: 200, ok: true, betaling: publiek(b), betalingId: w.id };
    }
    /* GEWEIGERD IS AF, NIET ONDERWEG -- dezelfde regel als kern/pay/opladen.js.
       Hier stond voor elke niet-bevestigde afloop "nog niet definitief
       bevestigd", ook als de bank had geweigerd: het lid wachtte dan op niets
       (voltooiproef tab:betalen, 19 oktober 2026). */
    const stand = r && r.status;
    if (stand === 'GEWEIGERD' || stand === 'GEANNULEERD')
      return { status: 402, pending: false, betalingId: w.id,
        error: 'De betaling is niet gelukt. Er is niets afgeschreven en niets bij de partner geboekt.' };
    return { status: 402, pending: true, betalingId: w.id, providerId: (r && r.providerId) || null,
      clientSecret: (uit && uit.actie && uit.actie.clientSecret) || null,
      error: stand === 'CONTROLE_NODIG' ? 'De betaling ligt bij RTG ter controle. Betaal niet opnieuw.'
        : 'De kaartbetaling is nog niet definitief bevestigd. Er is niets bij de partner geboekt.' };
  }

  const { registreerMuntBetaling, registreerBevestigdeBetaling } = require('./bevestigd')({
    save, ensure, centenVan, id, schoon, nu, ledger, publiek, idemZoek, idemBewaar,
    findSupplier, notifySupplier, logActivity, sseToSupplier, sseToCustomer,
    sseToOffice, MIN_CENTEN, MAX_CENTEN, directBetalingenVoegToe
  });

  return { betaalDirect, registreerMuntBetaling, registreerBevestigdeBetaling };
};
