/* Directpay, deelbestand "verzoek": de betaalverzoeken en de leverancierskant. De
   leverancier stuurt een betaalverzoek op codenaam (of open), het lid rekent het met
   Face ID af, een verzoek kan worden ingetrokken, en de ontvangsten-teller toont wat
   er rechtstreeks binnenkwam plus de openstaande verzoeken. Krijgt de gedeelde ctx van
   kern/directpay/index.js. */
module.exports = (ctx) => {
  const { db, save, ensure, centenVan, id, schoon, nu, ledger, publiek, betaalDirect, metIdem,
    findSupplier, sseToSupplier, MIN_CENTEN, MAX_CENTEN,
    directBetalingMetRef, directBetalingenVanZaak,
    betaalVerzoekMetRef, betaalVerzoekenVoorCodenaam, betaalVerzoekenVanZaak, betaalVerzoekenVoegToe } = ctx;

  /* De leverancier stuurt een betaalverzoek op codenaam (of open aan wie het
     bekijkt). Het lid rekent het met Face ID af. */
  async function verzoekMaak({ supplierCode, actorName, naarCodename, bedragCenten, omschrijving, idem }) {
    ensure();
    const s = findSupplier(supplierCode);
    if (!s) return { status: 404, error: 'Leverancier niet gevonden.' };
    const cent = centenVan(bedragCenten);
    if (!Number.isFinite(cent) || cent < MIN_CENTEN) return { status: 400, error: 'Kies een bedrag van minstens € ' + (MIN_CENTEN / 100).toFixed(2) + '.' };
    if (cent > MAX_CENTEN) return { status: 400, error: 'Dit bedrag is te hoog.' };
    /* EEN DUBBELTIK MAAKT HIER GELD (TAKEN.md 4.55). Elke oproep gaf een nieuw
       verzoek met een eigen ref, en twee verzoeken van hetzelfde bedrag kan de
       gast ALLEBEI afrekenen. De afdruk draagt de zaak, de ontvanger en het
       bedrag -- niet de omschrijving: vrije tekst is geen ander verzoek en mag
       dus geen 409 opleveren (zie de kop van server/lib/idem.js). */
    return metIdem(idem ? 'bv:' + s.code + ':' + String(idem).slice(0, 60) : null,
      'bv|' + s.code + '|' + (naarCodename ? schoon(naarCodename, 40) : '') + '|' + cent, () => {
      const v = {
        ref: id('BV'), supplierCode: s.code, supplierName: s.name,
        naarCodename: naarCodename ? schoon(naarCodename, 40) : null,
        bedrag: cent, omschrijving: schoon(omschrijving, 120) || 'Betaalverzoek',
        status: 'open', door: schoon(actorName, 60) || 'Beheer', betaaldDoor: null, betaaldRef: null, at: nu()
      };
      /* Ging met unshift + slice(0, 100000): een kopie van de hele array bij elk
         verzoek, en de staart eraf zonder dat er iets bewaard werd. Nu via de
         transactie-index, net als de betalingen zelf. */
      betaalVerzoekenVoegToe(v);
      save();
      try { sseToSupplier(s.code, 'sync', { scope: 'ontvangsten' }); } catch (e) {}
      return { status: 200, ok: true, verzoek: verzoekPubliek(v) };
    });
  }
  function verzoekPubliek(v) {
    return { ref: v.ref, supplierCode: v.supplierCode, supplierName: v.supplierName, naarCodename: v.naarCodename,
      bedrag: v.bedrag, omschrijving: v.omschrijving, status: v.status, betaaldDoor: v.betaaldDoor, at: v.at };
  }
  // open verzoeken die aan dit lid gericht zijn (op codenaam), nieuwste eerst
  function verzoekenVoor(codename) {
    ensure();
    if (!codename) return [];
    const wie = String(codename).toLowerCase();
    /* Geindexeerd op de codenaam in kleine letters (zie COLLECTIES in
       db/tx/ledger.js), zodat dit geen scan meer is over honderdduizend
       verzoeken om er veertig te tonen. De statusfilter blijft: de index gaat
       over de ontvanger, niet over de status -- die verandert namelijk wel. */
    return betaalVerzoekenVoorCodenaam(wie).filter(v => v.status === 'open').slice(0, 40).map(verzoekPubliek);
  }
  async function betaalVerzoek({ key, codename, ref, idem }) {
    ensure();
    const v = betaalVerzoekMetRef(ref);
    if (!v) return { status: 404, error: 'Betaalverzoek niet gevonden.' };
    if (v.status === 'betaald') { const b = directBetalingMetRef(v.betaaldRef); return { status: 200, ok: true, betaling: b ? publiek(b) : null, herhaald: true }; }
    if (v.status !== 'open') return { status: 409, error: 'Dit betaalverzoek is niet meer open.' };
    if (v.naarCodename && codename && v.naarCodename.toLowerCase() !== String(codename).toLowerCase())
      return { status: 403, error: 'Dit betaalverzoek staat op naam van iemand anders.' };
    const r = await betaalDirect({ key, codename, supplierCode: v.supplierCode, bedragCenten: v.bedrag,
      omschrijving: v.omschrijving, bron: 'verzoek', idem: idem || ('bv:' + v.ref) });
    if (!r.ok) return r;
    v.status = 'betaald'; v.betaaldDoor = codename || key; v.betaaldRef = r.betaling.ref;
    save();
    try { sseToSupplier(v.supplierCode, 'sync', { scope: 'ontvangsten' }); } catch (e) {}
    return { status: 200, ok: true, betaling: r.betaling };
  }
  function verzoekIntrek(supplierCode, ref) {
    ensure();
    /* Op ref via de index, en DAARNA pas kijken of het verzoek van deze zaak is.
       De oude .find() deed beide voorwaarden in een: haal je ze uit elkaar, dan
       moet de tweede blijven staan, anders trekt de ene leverancier het verzoek
       van de andere in. */
    const v = betaalVerzoekMetRef(ref);
    if (!v || v.supplierCode !== supplierCode) return { status: 404, error: 'Betaalverzoek niet gevonden.' };
    if (v.status !== 'open') return { status: 409, error: 'Alleen een open verzoek kan ingetrokken worden.' };
    v.status = 'ingetrokken';
    save();
    return { status: 200, ok: true };
  }

  // de leverancierskant: wat kwam er rechtstreeks binnen + openstaande verzoeken
  function ontvangsten(supplierCode) {
    ensure();
    const L = ledger(supplierCode);
    const betalingen = directBetalingenVanZaak(supplierCode).slice(0, 60).map(publiek);
    const verzoeken = betaalVerzoekenVanZaak(supplierCode).slice(0, 40).map(verzoekPubliek);
    return {
      som: L.som, aantal: L.aantal, uitbetaald: L.uitbetaald, saldo: L.som - L.uitbetaald,
      betalingen, openVerzoeken: verzoeken.filter(v => v.status === 'open'), verzoeken
    };
  }

  return {
    dpVerzoekMaak: verzoekMaak, dpVerzoekenVoor: verzoekenVoor, dpBetaalVerzoek: betaalVerzoek,
    dpVerzoekIntrek: verzoekIntrek, dpOntvangsten: ontvangsten
  };
};
