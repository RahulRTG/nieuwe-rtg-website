/* Kern-module "directpay": rechtstreeks betalen van klant naar leverancier.

   Elk betalend RTG-lid regelt alles via de AI (concierge) en de Salon en rekent
   af met Face ID, precies zoals overal in de app. Het geld gaat RECHTSTREEKS
   van de klant naar de leverancier, niet via een tussenpot:

   - In de demo boeken we dat als een betaling die de ontvangst-teller van de
     leverancier direct ophoogt (zijn uitbetaalbare saldo).
   - In productie is dit een Stripe "destination charge": betaal.maakBetaling
     krijgt dan de connected-account van de leverancier als bestemming mee, zodat
     Stripe het bedrag direct naar de leverancier routeert. De naad (server/
     betaal.js) blijft gelijk; alleen de bestemming komt erbij.

   Twee kanten:
   1. Het lid betaalt zelf een leverancier (bedrag dat het lid kiest, bijv. iets
      dat via de chat of de Salon is afgesproken): betaalDirect().
   2. De leverancier stuurt een betaalverzoek op codenaam; het lid ziet het en
      rekent met Face ID af: verzoekMaak() + betaalVerzoek().

   Veilig: bedrag begrensd, leverancier moet echt bestaan, idempotent (twee keer
   tikken of een herhaald verzoek schrijft nooit dubbel af), en de betaalstatus
   komt uit de betaal-naad, niet van de client. */

const MIN_CENTEN = 50;          // € 0,50 ondergrens
const MAX_CENTEN = 5000000;     // € 50.000 bovengrens per transactie

function maakDirectpay({ db, save, crypto, findSupplier, betaal, notify, notifySupplier, sseToSupplier, sseToCustomer, sseToOffice, logActivity }) {
  const nu = () => new Date().toISOString();
  const id = (p) => (p || 'x') + crypto.randomBytes(5).toString('hex').toUpperCase();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);

  function ensure() {
    if (!Array.isArray(db.data.directBetalingen)) db.data.directBetalingen = [];
    if (!Array.isArray(db.data.betaalVerzoeken)) db.data.betaalVerzoeken = [];
    if (!db.data.directOntvangsten || typeof db.data.directOntvangsten !== 'object') db.data.directOntvangsten = {};
    return db.data;
  }
  const centenVan = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : NaN; };

  // de payout-teller van een leverancier: wat er rechtstreeks binnenkwam
  function ledger(code) {
    ensure();
    if (!db.data.directOntvangsten[code]) db.data.directOntvangsten[code] = { som: 0, aantal: 0, uitbetaald: 0 };
    return db.data.directOntvangsten[code];
  }

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
      const al = db.data.directBetalingen.find(b => b.idem === idemSleutel);
      if (al) return { status: 200, ok: true, betaling: publiek(al), herhaald: true };
    }
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
    db.data.directBetalingen.unshift(b);
    db.data.directBetalingen = db.data.directBetalingen.slice(0, 200000);
    const L = ledger(s.code); L.som += cent; L.aantal += 1;
    save();
    try { notifySupplier(s.code, { icon: '💸', title: 'Rechtstreeks betaald', body: b.codename + ' betaalde € ' + (cent / 100).toFixed(2) + (b.omschrijving ? ' · ' + b.omschrijving : '') }); } catch (e) {}
    try { logActivity(s.code, { name: b.codename }, 'betaalde rechtstreeks € ' + (cent / 100).toFixed(2)); } catch (e) {}
    try { sseToSupplier(s.code, 'sync', { scope: 'ontvangsten' }); } catch (e) {}
    try { sseToCustomer(key, 'sync', { scope: 'betalingen' }); } catch (e) {}
    try { sseToOffice('sync', { scope: 'ontvangsten' }); } catch (e) {}
    return { status: 200, ok: true, betaling: publiek(b) };
  }

  function publiek(b) {
    return { ref: b.ref, supplierCode: b.supplierCode, supplierName: b.supplierName, bedrag: b.bedrag,
      omschrijving: b.omschrijving, bron: b.bron, codename: b.codename, at: b.at };
  }
  function mijnBetalingen(key) {
    ensure();
    return db.data.directBetalingen.filter(b => b.key === key).slice(0, 100).map(publiek);
  }

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
    return db.data.betaalVerzoeken
      .filter(v => v.status === 'open' && v.naarCodename && codename && v.naarCodename.toLowerCase() === String(codename).toLowerCase())
      .slice(0, 40).map(verzoekPubliek);
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
    const betalingen = db.data.directBetalingen.filter(b => b.supplierCode === supplierCode).slice(0, 60).map(publiek);
    const verzoeken = db.data.betaalVerzoeken.filter(v => v.supplierCode === supplierCode).slice(0, 40).map(verzoekPubliek);
    return {
      som: L.som, aantal: L.aantal, uitbetaald: L.uitbetaald, saldo: L.som - L.uitbetaald,
      betalingen, openVerzoeken: verzoeken.filter(v => v.status === 'open'), verzoeken
    };
  }

  return {
    DP_MIN_CENTEN: MIN_CENTEN, DP_MAX_CENTEN: MAX_CENTEN,
    dpBetaalDirect: betaalDirect, dpMijnBetalingen: mijnBetalingen,
    dpVerzoekMaak: verzoekMaak, dpVerzoekenVoor: verzoekenVoor, dpBetaalVerzoek: betaalVerzoek,
    dpVerzoekIntrek: verzoekIntrek, dpOntvangsten: ontvangsten
  };
}

module.exports = { maakDirectpay };
