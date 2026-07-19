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

   Veilig: bedrag begrensd, leverancier moet echt bestaan, idempotent (twee keer
   tikken of een herhaald verzoek schrijft nooit dubbel af), en de betaalstatus
   komt uit de betaal-naad, niet van de client. Dit is de orkestrator: het
   grootboek, de idempotentie, de tempolimiet en het rechtstreeks betalen wonen
   hier; de betaalverzoeken en de ontvangsten-teller in ./verzoek. */

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

  /* O(1)-index op de idempotentiesleutel: het dubbeltik-antwoord hoeft niet
     door tweehonderdduizend betalingen te scannen. Lui opgebouwd uit de
     opgeslagen data, daarna bij elke insert bijgehouden. */
  let idemIndex = null; // idemSleutel -> betaling
  function idemZoek(sleutel) {
    if (!idemIndex) {
      idemIndex = new Map();
      for (const b of ensure().directBetalingen) if (b.idem) idemIndex.set(b.idem, b);
    }
    return sleutel ? (idemIndex.get(sleutel) || null) : null;
  }
  function idemBewaar(b) {
    if (!b.idem) return;
    idemZoek(null); // index bestaat zeker
    idemIndex.set(b.idem, b);
    if (idemIndex.size > 250000) { idemIndex = null; idemZoek(null); } // hersynchroniseer met de gecapte lijst
  }

  /* Tempolimiet per lid: hooguit 12 betaalpogingen per minuut. Een herhaalde
     idempotente tik telt niet mee (die geeft gewoon het bestaande resultaat
     terug), dus een nette retry wordt nooit geblokkeerd. */
  const RATE_MAX = 12, RATE_VENSTER_MS = 60000;
  const betaalTempo = new Map(); // key -> [tijdstippen]
  function tempoOk(key) {
    const nu2 = Date.now();
    const lijst = (betaalTempo.get(key) || []).filter(t => nu2 - t < RATE_VENSTER_MS);
    if (lijst.length >= RATE_MAX) { betaalTempo.set(key, lijst); return false; }
    lijst.push(nu2);
    betaalTempo.set(key, lijst);
    if (betaalTempo.size > 50000) betaalTempo.clear(); // bots de kaart bij extreem veel sleutels
    return true;
  }

  // early-exit verzamelaar: nieuwste-eerst lijsten hoeven nooit verder dan max
  function verzamel(arr, test, max, map) {
    const uit = [];
    for (const x of arr) { if (test(x)) { uit.push(map ? map(x) : x); if (uit.length >= max) break; } }
    return uit;
  }

  // de payout-teller van een leverancier: wat er rechtstreeks binnenkwam
  function ledger(code) {
    ensure();
    if (!db.data.directOntvangsten[code]) db.data.directOntvangsten[code] = { som: 0, aantal: 0, uitbetaald: 0 };
    return db.data.directOntvangsten[code];
  }

  function publiek(b) {
    return { ref: b.ref, supplierCode: b.supplierCode, supplierName: b.supplierName, bedrag: b.bedrag,
      omschrijving: b.omschrijving, bron: b.bron, codename: b.codename, betaalwijze: b.betaalwijze || 'kaart', at: b.at };
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
      const al = idemZoek(idemSleutel);
      if (al) return { status: 200, ok: true, betaling: publiek(al), herhaald: true };
    }
    // tempolimiet NA de idempotentie-check: retries blijven altijd mogelijk
    if (!tempoOk(key)) return { status: 429, error: 'Even rustig aan: te veel betalingen kort na elkaar. Probeer het over een minuut opnieuw.' };
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
    idemBewaar(b);
    const L = ledger(s.code); L.som += cent; L.aantal += 1;
    save();
    try { notifySupplier(s.code, { icon: '💸', title: 'Rechtstreeks betaald', body: b.codename + ' betaalde € ' + (cent / 100).toFixed(2) + (b.omschrijving ? ' · ' + b.omschrijving : '') }); } catch (e) {}
    try { logActivity(s.code, { name: b.codename }, 'betaalde rechtstreeks € ' + (cent / 100).toFixed(2)); } catch (e) {}
    try { sseToSupplier(s.code, 'sync', { scope: 'ontvangsten' }); } catch (e) {}
    try { sseToCustomer(key, 'sync', { scope: 'betalingen' }); } catch (e) {}
    try { sseToOffice('sync', { scope: 'ontvangsten' }); } catch (e) {}
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
    const b = {
      ref: id('DP'), key, codename: codename || key, supplierCode: s.code, supplierName: s.name,
      bedrag: cent, omschrijving: schoon(omschrijving, 120) || 'Directe betaling (munten)',
      bron: 'app', providerId: null, aanbieder: 'munt', betaalwijze: 'munt', idem: null, at: nu()
    };
    db.data.directBetalingen.unshift(b);
    db.data.directBetalingen = db.data.directBetalingen.slice(0, 200000);
    const L = ledger(s.code); L.som += cent; L.aantal += 1;
    save();
    try { notifySupplier(s.code, { icon: '💸', title: 'Rechtstreeks betaald (munten)', body: b.codename + ' betaalde € ' + (cent / 100).toFixed(2) + (b.omschrijving ? ' · ' + b.omschrijving : '') }); } catch (e) {}
    try { logActivity(s.code, { name: b.codename }, 'betaalde rechtstreeks € ' + (cent / 100).toFixed(2) + ' met munten'); } catch (e) {}
    try { sseToSupplier(s.code, 'sync', { scope: 'ontvangsten' }); } catch (e) {}
    try { sseToCustomer(key, 'sync', { scope: 'betalingen' }); } catch (e) {}
    try { sseToOffice('sync', { scope: 'ontvangsten' }); } catch (e) {}
    return { status: 200, ok: true, betaling: publiek(b) };
  }

  function mijnBetalingen(key) {
    ensure();
    // nieuwste-eerst met early exit: nooit verder scannen dan de 100 die we tonen
    return verzamel(db.data.directBetalingen, b => b.key === key, 100, publiek);
  }

  // de gedeelde ctx voor de deelbestanden
  const ctx = { db, save, ensure, centenVan, id, schoon, nu, verzamel, ledger, publiek, betaalDirect,
    findSupplier, sseToSupplier, MIN_CENTEN, MAX_CENTEN };
  const api = {
    DP_MIN_CENTEN: MIN_CENTEN, DP_MAX_CENTEN: MAX_CENTEN,
    dpBetaalDirect: betaalDirect, dpMijnBetalingen: mijnBetalingen, dpRegistreerMunt: registreerMuntBetaling
  };
  Object.assign(api, require('./verzoek')(ctx));
  return api;
}

module.exports = { maakDirectpay };
