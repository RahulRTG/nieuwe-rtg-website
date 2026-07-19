/* Directpay, deelbestand "verzoek": de betaalverzoeken en de leverancierskant. De
   leverancier stuurt een betaalverzoek op codenaam (of open), het lid rekent het met
   Face ID af, een verzoek kan worden ingetrokken, en de ontvangsten-teller toont wat
   er rechtstreeks binnenkwam plus de openstaande verzoeken. Krijgt de gedeelde ctx van
   kern/directpay/index.js. */
module.exports = (ctx) => {
  const { db, save, ensure, centenVan, id, schoon, nu, verzamel, ledger, publiek, betaalDirect,
    findSupplier, sseToSupplier, MIN_CENTEN, MAX_CENTEN } = ctx;

  /* De leverancier stuurt een betaalverzoek op codenaam (of open aan wie het
     bekijkt). Het lid rekent het met Face ID af. */
  function verzoekMaak({ supplierCode, actorName, naarCodename, bedragCenten, omschrijving }) {
    ensure();
    const s = findSupplier(supplierCode);
    if (!s) return { status: 404, error: 'Leverancier niet gevonden.' };
    const cent = centenVan(bedragCenten);
    if (!Number.isFinite(cent) || cent < MIN_CENTEN) return { status: 400, error: 'Kies een bedrag van minstens € ' + (MIN_CENTEN / 100).toFixed(2) + '.' };
    if (cent > MAX_CENTEN) return { status: 400, error: 'Dit bedrag is te hoog.' };
    const v = {
      ref: id('BV'), supplierCode: s.code, supplierName: s.name,
      naarCodename: naarCodename ? schoon(naarCodename, 40) : null,
      bedrag: cent, omschrijving: schoon(omschrijving, 120) || 'Betaalverzoek',
      status: 'open', door: schoon(actorName, 60) || 'Beheer', betaaldDoor: null, betaaldRef: null, at: nu()
    };
    db.data.betaalVerzoeken.unshift(v);
    db.data.betaalVerzoeken = db.data.betaalVerzoeken.slice(0, 100000);
    save();
    try { sseToSupplier(s.code, 'sync', { scope: 'ontvangsten' }); } catch (e) {}
    return { status: 200, ok: true, verzoek: verzoekPubliek(v) };
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
    return verzamel(db.data.betaalVerzoeken,
      v => v.status === 'open' && v.naarCodename && v.naarCodename.toLowerCase() === wie,
      40, verzoekPubliek);
  }
  async function betaalVerzoek({ key, codename, ref, idem }) {
    ensure();
    const v = db.data.betaalVerzoeken.find(x => x.ref === ref);
    if (!v) return { status: 404, error: 'Betaalverzoek niet gevonden.' };
    if (v.status === 'betaald') { const b = db.data.directBetalingen.find(x => x.ref === v.betaaldRef); return { status: 200, ok: true, betaling: b ? publiek(b) : null, herhaald: true }; }
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
    const v = db.data.betaalVerzoeken.find(x => x.ref === ref && x.supplierCode === supplierCode);
    if (!v) return { status: 404, error: 'Betaalverzoek niet gevonden.' };
    if (v.status !== 'open') return { status: 409, error: 'Alleen een open verzoek kan ingetrokken worden.' };
    v.status = 'ingetrokken';
    save();
    return { status: 200, ok: true };
  }

  // de leverancierskant: wat kwam er rechtstreeks binnen + openstaande verzoeken
  function ontvangsten(supplierCode) {
    ensure();
    const L = ledger(supplierCode);
    const betalingen = verzamel(db.data.directBetalingen, b => b.supplierCode === supplierCode, 60, publiek);
    const verzoeken = verzamel(db.data.betaalVerzoeken, v => v.supplierCode === supplierCode, 40, verzoekPubliek);
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
