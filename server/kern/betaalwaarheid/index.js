/* De RTG Payment Truth: één duurzame, provider-onafhankelijke staat per
   economische betaling. De browser kan starten en kijken, maar nooit zelf
   "betaald" zetten. Elke overgang krijgt een hash naar de vorige gebeurtenis;
   provider-id's en idempotentiesleutels blijven blijvend vindbaar. */
'use strict';

const { STATUS, providerStatus, mag, definitiefBetaald } = require('./staten');
const beeld = require('./beeld');
const { datum: klokDatum } = require('../../lib/klok');

module.exports = function maakBetaalWaarheid({ d, save, crypto, betaal, nu, log, ververs }) {
  const nuIso = nu || (() => klokDatum().toISOString());
  const afhandelaars = new Map();
  const startcontroles = new Map();
  const startend = new Map();

  function doos() {
    const data = d();
    if (!data.betaalWaarheid || typeof data.betaalWaarheid !== 'object') data.betaalWaarheid = {};
    if (!data.betaalWaarheidMeldingen || typeof data.betaalWaarheidMeldingen !== 'object') data.betaalWaarheidMeldingen = {};
    return data.betaalWaarheid;
  }
  const hash = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
  const idVan = (actor, idem) => 'BW-' + hash(String(actor) + '|' + String(idem)).slice(0, 20).toUpperCase();

  function gebeurtenis(r, soort, extra) {
    if (!Array.isArray(r.gebeurtenissen)) r.gebeurtenissen = [];
    const vorig = r.gebeurtenissen.length ? r.gebeurtenissen[r.gebeurtenissen.length - 1].zegel : 'BEGIN';
    const basis = Object.assign({ nr: r.gebeurtenissen.length + 1, at: nuIso(), soort,
      status: r.status, vorig }, extra || {});
    basis.zegel = hash(JSON.stringify(basis));
    r.gebeurtenissen.push(basis);
    r.bijgewerktAt = basis.at;
    return basis;
  }

  const publiek = (r) => beeld.publiek(r, definitiefBetaald);
  const anker = require('./actueel')(doos);
  const bewijs = require('./bewijs')(betaal);
  const afhandeling = require('./afhandeling')({ d, doos, save, nuIso, gebeurtenis,
    STATUS, log, afhandelaars, anker });

  const maak = require('./aanmaken')({ doos, hash, idVan, nuIso, gebeurtenis, save, STATUS });

  function naar(r, status, extra) {
    if (!mag(r.status, status)) {
      gebeurtenis(r, 'VEROUDERDE_OF_ONGELDIGE_OVERGANG', Object.assign({ gevraagd: status }, extra || {}));
      return false;
    }
    const van = r.status;
    r.status = status;
    gebeurtenis(r, 'STATUS', Object.assign({ van, naar: status }, extra || {}));
    return true;
  }

  async function pasProviderToe(r, p, eventId, gebeurtenisType, providerProof) {
    if (!r) return null;
    const actueel = anker(r);
    r = actueel();
    if (r.provider && p.aanbieder && r.provider !== p.aanbieder)
      throw require('./actueel').conflict(); // nooit eerst de eigen provider overschrijven
    if (p.id && r.providerId && p.id !== r.providerId && p.id !== r.providerPaymentId) return publiek(r);
    if (Number.isFinite(p.bedrag) && Math.round(p.bedrag) !== r.centen) {
      r.blokkade = 'bedrag-wijkt-af';
      naar(r, STATUS.CONTROLE_NODIG, { bron: p.aanbieder, providerEventId: eventId,
        verwachtCenten: r.centen, ontvangenCenten: Math.round(p.bedrag) });
      save();
      return publiek(r);
    }
    if (p.valuta && String(p.valuta).toLowerCase() !== r.valuta) {
      r.blokkade = 'valuta-wijkt-af';
      naar(r, STATUS.CONTROLE_NODIG, { bron: p.aanbieder, providerEventId: eventId });
      save();
      return publiek(r);
    }
    r.provider = p.aanbieder || r.provider;
    /* providerId is de stabiele klantflow (bij Stripe bijvoorbeeld cs_...).
       Een latere webhook over de onderliggende geldbeweging (pi_...) mag die
       sleutel niet vervangen; die hoort apart in providerPaymentId. */
    r.providerId = r.providerId || p.id;
    r.providerPaymentId = p.betaalId || p.providerPaymentId || r.providerPaymentId || null;
    r.providerStatus = p.status || r.providerStatus;
    naar(r, providerStatus(r.provider, r.providerStatus, gebeurtenisType), {
      bron: r.provider, providerEventId: eventId || null, providerStatus: r.providerStatus });
    save();
    if (definitiefBetaald(r.status)) bewijs.confirmed(r, eventId, providerProof, p);
    await afhandeling.handelAf(r);
    return publiek(actueel());
  }

  const herstartgrens = require('./herstartgrens')({ STATUS, nuIso, naar, save });
  async function hervatProvider(r, actueel) {
    if (!r.providerId) return null;
    if (definitiefBetaald(r.status)) {
      await afhandeling.handelAf(r);
      return { betaling: publiek(actueel()), actie: { soort: 'klaar' } };
    }
    const verwacht = r.start?.terugkerend?.modus === 'innen' ? {
      referentie: r.id, bedrag: r.centen, valuta: r.valuta, terugkerend: r.start.terugkerend } : undefined;
    const vers = await betaal.haalBetaling(r.provider, r.providerId, verwacht);
    const stand = await pasProviderToe(actueel(), vers, 'hervat:' + r.providerId, 'ophalen', bewijs.providerProof(vers));
    return { betaling: stand, actie: beeld.actieVan(vers) };
  }
  async function begin(id, opties = {}) {
    const bezig = startend.get(id);
    if (bezig) return bezig;
    let actueel;
    const werk = (async () => {
      // De pollcache van een oude worker is geen bewijs dat een provider-id
      // ontbreekt. Sluit de bestaande collectietransactie vóór provider-I/O.
      if (ververs) await ververs();
      let r = doos()[id];
      if (!r) throw new Error('Betaling niet gevonden.');
      actueel = anker(r);
      const bestaand = await hervatProvider(r, actueel);
      if (bestaand) return bestaand;
      // Een voorbereide intentie is nog geen gevalideerde externe start.
      // Ook de achtergrondronde gaat langs de geregistreerde domeineigenaar.
      if (r.context?.startcontrole) {
        const toets = startcontroles.get(r.context.startcontrole);
        if (!toets) throw Object.assign(Error('De betaalstartcontrole is niet aangesloten.'), { nietVerstuurd: true });
        try { await toets(r); }
        catch (e) { e.nietVerstuurd = true; throw e; }
        r = actueel();
        // De controle kan wachten op een andere worker die dezelfde duurzame
        // opdracht al bij de provider startte. Vraag die dan op; start nooit
        // nogmaals op basis van het oude object van vóór de await.
        const inmiddels = await hervatProvider(r, actueel);
        if (inmiddels) return inmiddels;
      }
      // startopties vast, eenmalig: een hervatting moet dezelfde aanbieder gebruiken (./hervat.js)
      const eersteStart = !r.start;
      if (eersteStart) r.start = require('./hervat').startVan(opties);
      herstartgrens(r, eersteStart);
      const st = r.start;
      gebeurtenis(r, 'PROVIDER_START', { bron: st.aanbieder || 'automatisch', hervat: !!opties.hervat, aangeroepen: true });
      save(); /* waarheid bestaat VOOR de externe aanroep */
      actueel = anker(r);
      const p = await betaal.maakBetaling(Object.assign({ bedrag: r.centen, valuta: r.valuta,
        referentie: r.id, idempotentieSleutel: 'waarheid:' + r.id }, st));
      const stand = await pasProviderToe(actueel(), p, 'start:' + p.id, 'start', bewijs.providerProof(p));
      return { betaling: stand, actie: beeld.actieVan(p) };
    })();
    startend.set(id, werk);
    try { return await werk; } catch (e) {
      if (actueel && (!e || !['BETAAL_AFHANDELING_MISLUKT', 'BETAALWAARHEID_PUBLICATIE_CONFLICT',
        'BETAAL_PROVIDER_HERSTART_ONZEKER'].includes(e.code))) {
        const nu = actueel();
        gebeurtenis(nu, 'PROVIDER_FOUT', { fout: String(e && e.message || e).slice(0, 180) }); save();
        if (!e || e.nietVerstuurd !== true) bewijs.unknown(nu, e);
      }
      throw e;
    } finally { startend.delete(id); }
  }

  const providerMelding = require('./inbox')({
    meldingenVan: () => d().betaalWaarheidMeldingen || (d().betaalWaarheidMeldingen = {}),
    doos, save, nuIso, handelAf: r => afhandeling.handelAf(r), pasProviderToe,
    providerProof: bron => bewijs.providerProof(bron), log
  });

  function van(id) { return doos()[String(id || '')] || null; }
  function vanActor(id, actor) { const r = van(id); return r && r.actor === String(actor || '') ? r : null; }
  const herstel = require('./klantactie')({ vanActor, anker, betaal });
  function registreerAfhandeling(soort, fn) { afhandelaars.set(String(soort), fn); }
  function registreerStartcontrole(naam, fn) { startcontroles.set(String(naam), fn); }

  const terug = require('./terug')({ d, doos, save, nuIso, gebeurtenis, naar, STATUS,
    definitiefBetaald, publiek, betaal, hash });

  // gestrande afhandelingen, dan de veegronde zonder uitsluitsel (./hervat.js)
  const veeg = require('./hervat')({ doos, save, nuIso, gebeurtenis, STATUS, definitiefBetaald, log });
  // en de terugbetalingen die op een providerbevestiging wachten (./terugveeg.js)
  const terugveeg = require('./terugveeg')({ doos, save, nuIso, gebeurtenis, betaal,
    providerTerugbetaling: terug.providerTerugbetaling, log });
  async function ronde(opties) {
    if (ververs) await ververs();
    const a = await afhandeling.ronde(opties);
    const h = await veeg.hervat(Object.assign({}, opties || {}, { begin }));
    const t = await terugveeg.veeg(opties || {});
    return Object.assign(a, { hervat: h, terug: t });
  }
  const openstaand = () => Object.assign(veeg.openstaand(), terugveeg.openstaand());
  // een betaling op controle afronden: alleen een mens op naam (./controle.js)
  const controle = require('./controle')({ doos, save, nuIso, gebeurtenis, STATUS });

  return { STATUS, maak, bereidVoor: veeg.bereidVoor, begin, herstel, publiek, van, vanActor, providerMelding,
    terugbetalen: terug.terugbetalen, providerTerugbetaling: terug.providerTerugbetaling,
    registreerAfhandeling, registreerStartcontrole, ronde, openstaand, definitiefBetaald,
    terugAfhandelen: terugveeg.terugAfhandelen, controleAfronden: controle.controleAfronden };
};
