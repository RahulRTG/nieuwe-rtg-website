/* De RTG Payment Truth: één duurzame, provider-onafhankelijke staat per
   economische betaling. De browser kan starten en kijken, maar nooit zelf
   "betaald" zetten. Elke overgang krijgt een hash naar de vorige gebeurtenis;
   provider-id's en idempotentiesleutels blijven blijvend vindbaar. */
'use strict';

const { STATUS, providerStatus, mag, definitiefBetaald } = require('./staten');
const beeld = require('./beeld');
const { datum: klokDatum } = require('../../lib/klok');

module.exports = function maakBetaalWaarheid({ d, save, crypto, betaal, nu, log }) {
  const nuIso = nu || (() => klokDatum().toISOString());
  const afhandelaars = new Map();
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
  const afhandeling = require('./afhandeling')({ d, doos, save, nuIso, gebeurtenis,
    STATUS, log, afhandelaars });

  function maak(invoer) {
    const actor = String(invoer.actor || '');
    const idem = String(invoer.idem || '');
    const centen = Math.round(Number(invoer.centen));
    if (!actor || !idem) throw new Error('Betaling mist een eigenaar of idempotentiesleutel.');
    if (!Number.isFinite(centen) || centen <= 0) throw new Error('Betaling mist een geldig bedrag.');
    const id = idVan(actor, idem);
    const bestaand = doos()[id];
    if (bestaand) {
      if (bestaand.actor !== actor || bestaand.centen !== centen || bestaand.bronRef !== String(invoer.bronRef || ''))
        throw new Error('Deze veilige betaalsleutel hoort al bij een andere betaling.');
      return bestaand;
    }
    const r = doos()[id] = { id, actor, idemHash: hash(idem), soort: String(invoer.soort || 'betaling'),
      bronRef: String(invoer.bronRef || ''), supplierCode: invoer.supplierCode || null,
      centen, valuta: String(invoer.valuta || 'eur').toLowerCase(), status: STATUS.AANGEMAAKT,
      provider: null, providerId: null, providerStatus: null,
      context: invoer.context || null, aangemaaktAt: nuIso(), bijgewerktAt: nuIso(),
      gebeurtenissen: [], terugbetaaldCenten: 0 };
    gebeurtenis(r, 'AANGEMAAKT', { bron: 'server' });
    save();
    return r;
  }

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

  async function pasProviderToe(r, p, eventId, gebeurtenisType) {
    if (!r) return null;
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
    await afhandeling.handelAf(r);
    return publiek(r);
  }

  async function begin(id, opties) {
    const r = doos()[id];
    if (!r) throw new Error('Betaling niet gevonden.');
    const bezig = startend.get(id);
    if (bezig) return bezig;
    const werk = (async () => {
      if (r.providerId && definitiefBetaald(r.status)) {
        await afhandeling.handelAf(r);
        return { betaling: publiek(r), actie: { soort: 'klaar' } };
      }
      if (r.providerId) {
        const vers = await betaal.haalBetaling(r.provider, r.providerId);
        const stand = await pasProviderToe(r, vers, 'hervat:' + r.providerId, 'ophalen');
        return { betaling: stand, actie: beeld.actieVan(vers) };
      }
      gebeurtenis(r, 'PROVIDER_START', { bron: opties.aanbieder || 'automatisch' });
      save(); /* waarheid bestaat VOOR de externe aanroep */
      const p = await betaal.maakBetaling({ bedrag: r.centen, valuta: r.valuta,
        referentie: r.id, idempotentieSleutel: 'waarheid:' + r.id,
        omschrijving: opties.omschrijving, aanbieder: opties.aanbieder,
        methode: opties.methode, returnUrl: opties.returnUrl, webhookUrl: opties.webhookUrl });
      const stand = await pasProviderToe(r, p, 'start:' + p.id, 'start');
      return { betaling: stand, actie: beeld.actieVan(p) };
    })();
    startend.set(id, werk);
    try { return await werk; } catch (e) {
      if (!e || e.code !== 'BETAAL_AFHANDELING_MISLUKT') {
        gebeurtenis(r, 'PROVIDER_FOUT', { fout: String(e && e.message || e).slice(0, 180) }); save();
      }
      throw e;
    } finally { startend.delete(id); }
  }

  async function providerMelding(invoer) {
    const meldingen = d().betaalWaarheidMeldingen || (d().betaalWaarheidMeldingen = {});
    const eventId = String(invoer.eventId || (invoer.aanbieder + ':' + invoer.providerId + ':' + invoer.status));
    if (meldingen[eventId] && meldingen[eventId].verwerktAt) {
      const eerder = meldingen[eventId].betalingId && doos()[meldingen[eventId].betalingId];
      if (eerder) await afhandeling.handelAf(eerder); /* herstel na een lokale afhandelstoring */
      return meldingen[eventId].betalingId || null;
    }
    if (!meldingen[eventId]) meldingen[eventId] = { eventId, aanbieder: invoer.aanbieder,
      providerId: invoer.providerId || null, ontvangenAt: nuIso(), verwerktAt: null };
    save(); /* duurzame inbox vóór een 2xx aan de provider */
    const r = Object.values(doos()).find(x =>
      (invoer.providerId && x.providerId === invoer.providerId) ||
      (invoer.providerId && x.providerPaymentId === invoer.providerId) ||
      (invoer.referentie && x.id === invoer.referentie));
    if (!r && /^BW-/.test(String(invoer.referentie || ''))) {
      meldingen[eventId].wachtOpWaarheid = true;
      save();
      throw new Error('De betaalwaarheid is nog niet zichtbaar; provider moet opnieuw proberen.');
    }
    if (r) {
      meldingen[eventId].betalingId = r.id;
      save(); /* koppeling staat vast vóór de mogelijk falende domeinafhandeling */
      await pasProviderToe(r, invoer, eventId, invoer.gebeurtenis);
    } else meldingen[eventId].betalingId = null;
    meldingen[eventId].verwerktAt = nuIso();
    save();
    return r ? r.id : null;
  }

  function van(id) { return doos()[String(id || '')] || null; }
  function vanActor(id, actor) { const r = van(id); return r && r.actor === String(actor || '') ? r : null; }
  function registreerAfhandeling(soort, fn) { afhandelaars.set(String(soort), fn); }

  const terug = require('./terug')({ d, doos, save, nuIso, gebeurtenis, naar, STATUS,
    definitiefBetaald, publiek, betaal, hash });

  return { STATUS, maak, begin, publiek, van, vanActor, providerMelding,
    terugbetalen: terug.terugbetalen, providerTerugbetaling: terug.providerTerugbetaling,
    registreerAfhandeling, ronde: afhandeling.ronde, definitiefBetaald };
};
