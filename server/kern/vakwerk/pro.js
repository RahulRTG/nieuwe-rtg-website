/* Vakwerk Pro, deel 1: de offerte-stroom. Precies wat vakbedrijven elders per
   maand voor betalen: een lid vraagt een vrije klus aan (geen vaste dienst),
   de zaak antwoordt met een prijs en toelichting, en bij akkoord staat de
   klus direct als bevestigde boeking in de agenda -- betalen loopt daarna
   gewoon achteraf via de bestaande wegen; er wordt nooit geclaimd dat er
   betaald is. Alles op codenaam. Krijgt de gedeelde ctx van vakwerk/index. */
const OFFERTEBOUW = require('../onderneming/offertebouw');

module.exports = (ctx) => {
  const { db, save, findSupplier, isVak, scho, crypto, notify, notifySupplier,
    sseToCustomer, sseToSupplier, boekingenVoegToe } = ctx;
  const nu = () => new Date().toISOString();
  const lijst = () => (Array.isArray(db.data.vakOffertes) ? db.data.vakOffertes : (db.data.vakOffertes = []));

  /* `regels` reist mee naar de klant: een bedrag zonder onderbouwing is precies
     waar de offertebouwer voor bestaat. Null als de zaak alleen een prijs gaf --
     dat mag nog steeds, en oudere offertes hebben niets anders. */
  const publiekLid = o => ({ id: o.id, supplierCode: o.supplierCode, zaak: o.supplierName,
    omschrijving: o.omschrijving, wens: o.wens, status: o.status, prijs: o.prijs || null,
    regels: o.regels || null, btwBedrag: o.btwBedrag != null ? o.btwBedrag : null,
    toelichting: o.toelichting || null, boekingRef: o.boekingRef || null, at: o.at });
  const publiekZaak = o => ({ id: o.id, klant: o.customerCodename, omschrijving: o.omschrijving,
    wens: o.wens, status: o.status, prijs: o.prijs || null, regels: o.regels || null, at: o.at });

  function offerteVraag(sessie, body) {
    const s = findSupplier((body || {}).supplierCode);
    if (!isVak(s)) return { status: 404, error: 'Deze zaak neemt geen offerte-aanvragen aan.' };
    const omschrijving = scho((body || {}).omschrijving, 300);
    if (omschrijving.length < 10) return { status: 400, error: 'Omschrijf de klus in een paar zinnen.' };
    const open = lijst().filter(o => o.customerKey === sessie.key && o.status === 'aangevraagd').length;
    if (open >= 10) return { status: 429, error: 'U heeft al tien open aanvragen; wacht eerst op antwoord.' };
    const w = String((body || {}).wens || '');
    const o = {
      id: 'OF-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      supplierCode: s.code, supplierName: s.name,
      customerKey: sessie.key, customerTier: sessie.tier, customerCodename: sessie.codename,
      omschrijving, wens: /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : null,
      status: 'aangevraagd', at: nu()
    };
    lijst().unshift(o);
    db.data.vakOffertes = lijst().slice(0, 5000);
    save();
    notifySupplier(s.code, { icon: 'agenda', title: 'Offerte-aanvraag', body: o.customerCodename + ': ' + omschrijving.slice(0, 90) });
    sseToSupplier(s.code, 'sync', { scope: 'orders' });
    return { status: 200, ok: true, offerte: publiekLid(o) };
  }

  const offertesVanLid = key => ({ status: 200, offertes: lijst().filter(o => o.customerKey === key).slice(0, 25).map(publiekLid) });
  const offertesVanZaak = code => lijst().filter(o => o.supplierCode === code).slice(0, 40).map(publiekZaak);

  /* Antwoorden kan op twee manieren, en dit blijft de ENIGE plek die een
     offerte bijwerkt. Met `regels` bouwt kern/onderneming/offertebouw.js de
     prijs op uit het eigen aanbod plus losse posten; met alleen `prijs` gaat
     het zoals het altijd ging. Dat tweede is geen tijdelijke tolerantie maar
     het eerlijke geval: een klus van een uur is soms gewoon een bedrag. */
  function offerteAntwoord(code, body) {
    const o = lijst().find(x => x.id === String((body || {}).id || '') && x.supplierCode === code);
    if (!o) return { status: 404, error: 'Offerte niet gevonden.' };
    if (o.status !== 'aangevraagd') return { status: 409, error: 'Deze aanvraag is al ' + o.status + '.' };

    let prijs = Math.round(Number((body || {}).prijs) * 100) / 100;
    let opbouw = null;
    if (Array.isArray((body || {}).regels) && body.regels.length) {
      /* caps reist mee zodat de bouwer het tarief uit de fiscale laag kan
         halen met dezelfde basiscategorie als de factuurmotor straks. */
      const zaakVoorOfferte = findSupplier(code);
      let zaakCaps = []; try { zaakCaps = db.capsVan(zaakVoorOfferte) || []; } catch (e) { zaakCaps = []; }
      opbouw = OFFERTEBOUW.offerteBouw(zaakVoorOfferte, body.regels, scho, zaakCaps);
      if (!opbouw.ok) return opbouw;
      prijs = opbouw.totaal;
    }
    if (!(prijs > 0)) return { status: 400, error: 'Geef een prijs op, of bouw hem op uit regels.' };
    o.status = 'aangeboden'; o.prijs = prijs;
    o.regels = opbouw ? opbouw.regels : null;
    o.subtotaal = opbouw ? opbouw.subtotaal : null;
    o.btwBedrag = opbouw ? opbouw.btwBedrag : null;
    o.toelichting = scho((body || {}).toelichting, 200) || null; o.antwoordAt = nu();
    save();
    notify(o.customerTier, { icon: 'agenda', title: o.supplierName, body: 'Uw offerte-aanvraag is beantwoord: ' + prijs.toLocaleString('nl-NL') + ' euro. Akkoord geven kan in de Mall.', scope: 'orders' });
    sseToCustomer(o.customerKey || o.customerTier, 'sync', { scope: 'orders' });
    return { status: 200, ok: true, offerte: publiekZaak(o) };
  }

  function offerteWeiger(code, body) {
    const o = lijst().find(x => x.id === String((body || {}).id || '') && x.supplierCode === code);
    if (!o) return { status: 404, error: 'Offerte niet gevonden.' };
    if (o.status !== 'aangevraagd') return { status: 409, error: 'Deze aanvraag is al ' + o.status + '.' };
    o.status = 'afgewezen'; o.antwoordAt = nu();
    save();
    notify(o.customerTier, { icon: 'agenda', title: o.supplierName, body: 'De zaak kan uw klus helaas niet aannemen.', scope: 'orders' });
    sseToCustomer(o.customerKey || o.customerTier, 'sync', { scope: 'orders' });
    return { status: 200, ok: true };
  }

  function offerteAkkoord(key, body) {
    const o = lijst().find(x => x.id === String((body || {}).id || '') && x.customerKey === key);
    if (!o) return { status: 404, error: 'Offerte niet gevonden.' };
    if (o.status !== 'aangeboden') return { status: 409, error: 'Deze offerte staat niet open voor akkoord (status: ' + o.status + ').' };
    const s = findSupplier(o.supplierCode);
    if (!s) return { status: 404, error: 'De zaak bestaat niet meer.' };
    const boeking = {
      ref: 'RTG-B-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      supplierCode: s.code, supplierName: s.name,
      customerTier: o.customerTier, customerKey: o.customerKey, customerCodename: o.customerCodename,
      service: { id: 'offerte-' + o.id, name: 'Offerte: ' + o.omschrijving.slice(0, 60), soort: 'dienst', duurMin: null },
      price: o.prijs, wanneer: o.wens || null, note: 'Akkoord op offerte ' + o.id,
      betaalMoment: 'achteraf', status: 'bevestigd', paid: false, at: nu()
    };
    boekingenVoegToe(boeking);
    o.status = 'akkoord'; o.boekingRef = boeking.ref;
    save();
    notifySupplier(s.code, { icon: 'agenda', title: 'Offerte akkoord', body: o.customerCodename + ' ging akkoord met ' + o.id + '; de klus staat bevestigd (' + boeking.ref + ').' });
    sseToSupplier(s.code, 'sync', { scope: 'orders' });
    return { status: 200, ok: true, boeking };
  }

  function offerteIntrek(key, body) {
    const o = lijst().find(x => x.id === String((body || {}).id || '') && x.customerKey === key);
    if (!o) return { status: 404, error: 'Offerte niet gevonden.' };
    if (o.status === 'akkoord') return { status: 409, error: 'Deze offerte is al akkoord; overleg met de zaak.' };
    o.status = 'ingetrokken';
    save();
    sseToSupplier(o.supplierCode, 'sync', { scope: 'orders' });
    return { status: 200, ok: true };
  }

  return { offerteVraag, offertesVanLid, offertesVanZaak, offerteAntwoord, offerteWeiger, offerteAkkoord, offerteIntrek };
};
