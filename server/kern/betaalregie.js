/* Centrale providerregie; geheimen blijven op de server. */
'use strict';
const { datum: klokDatum } = require('../lib/klok');
const betalingCijfers = require('./betaalregie-waarheid');

const PROVIDERS = Object.freeze({
  stripe: {
    naam: 'Stripe', aanmeldUrl: 'https://dashboard.stripe.com/register',
    uitleg: 'Sterk voor kaarten, iDEAL, wallets en internationale betalingen.',
    vereist: [
      ['STRIPE_SECRET_KEY', 'API-koppeling'],
      ['STRIPE_WEBHOOK_SECRET', 'Ondertekende terugmeldingen'],
      ['APP_URL', 'Vaste terugkeer- en webhookadressen']
    ]
  },
  mollie: {
    naam: 'Mollie', aanmeldUrl: 'https://my.mollie.com/dashboard/signup',
    uitleg: 'Sterk voor Nederland en Europa, met een eenvoudige betaalervaring.',
    vereist: [
      ['MOLLIE_API_KEY', 'API-koppeling'],
      ['APP_URL', 'Vaste terugkeer- en webhookadressen']
    ]
  },
  adyen: {
    naam: 'Adyen', aanmeldUrl: 'https://www.adyen.com/contact/sales',
    uitleg: 'Enterprise-rail voor internationale groei, risico en omnichannel.',
    vereist: [
      ['ADYEN_API_KEY', 'API-koppeling'],
      ['ADYEN_MERCHANT_ACCOUNT', 'Merchant-account'],
      ['ADYEN_HMAC_KEY', 'Ondertekende terugmeldingen'],
      ['ADYEN_CHECKOUT_BASE_URL', 'Live Checkout API-adres'],
      ['APP_URL', 'Vaste terugkeer- en webhookadressen']
    ]
  }
});

const FASES = Object.freeze([
  'niet-gestart', 'aanvraag', 'controle', 'goedgekeurd', 'techniek',
  'proef', 'live', 'gepauzeerd', 'probleem'
]);
const FASE_LABEL = Object.freeze({
  'niet-gestart': 'Nog niet gestart', aanvraag: 'Aanvraag loopt',
  controle: 'Provider controleert', goedgekeurd: 'Account goedgekeurd',
  techniek: 'Technische koppeling', proef: 'Proefbetaling', live: 'Live',
  gepauzeerd: 'Gepauzeerd', probleem: 'Probleem'
});
const IT_FASES = new Set(['aanvraag', 'controle', 'goedgekeurd', 'techniek', 'proef', 'gepauzeerd', 'probleem']);

module.exports = function maakBetaalregie({ d, save, betaal, env, nu }) {
  const omgeving = env || process.env;
  const nuIso = nu || (() => klokDatum().toISOString());

  function staat() {
    const data = d();
    if (!data.betaalRegie || typeof data.betaalRegie !== 'object') data.betaalRegie = {};
    const r = data.betaalRegie;
    if (!r.providers || typeof r.providers !== 'object') r.providers = {};
    if (!Array.isArray(r.audit)) r.audit = [];
    for (const id of Object.keys(PROVIDERS)) {
      if (!r.providers[id] || typeof r.providers[id] !== 'object')
        r.providers[id] = { fase: 'niet-gestart', bijgewerktAt: null, notitie: '' };
    }
    if (!r.voorkeur && Object.prototype.hasOwnProperty.call(PROVIDERS, String(omgeving.PAYMENT_PROVIDER || '').toLowerCase()))
      r.voorkeur = String(omgeving.PAYMENT_PROVIDER).toLowerCase();
    return r;
  }

  function geheimAan(naam) {
    const waarde = String(omgeving[naam] || '').trim();
    if (!waarde) return false;
    if (/(change|vervang|voorbeeld|example|dummy|demo|test_key)/i.test(waarde)) return false;
    if (naam === 'ADYEN_HMAC_KEY') return /^[A-Fa-f0-9]{64}$/.test(waarde);
    if (naam === 'ADYEN_CHECKOUT_BASE_URL')
      return /^https:\/\/[^/]+-checkout-live\.adyenpayments\.com\/checkout\/v\d+\/?$/.test(waarde);
    if (naam === 'APP_URL') return /^https?:\/\/[^/]+/.test(waarde);
    return true;
  }

  function rails() {
    try { return betaal.mogelijkheden().rails || []; } catch (e) { return []; }
  }

  function providerBeeld(id, r, actieveRails, cijfers) {
    const meta = PROVIDERS[id];
    const checklist = meta.vereist.map(([sleutel, label]) => ({ sleutel, label, ingesteld: geheimAan(sleutel) }));
    const gereed = checklist.every(x => x.ingesteld);
    const actief = actieveRails.has(id);
    const transacties = cijfers.perProvider[id] || 0;
    const bevestigd = (d().betaalWaarheid && Object.values(d().betaalWaarheid)
      .some(b => b.provider === id && ['BEVESTIGD', 'GEDEELTELIJK_TERUGBETAALD', 'TERUGBETAALD'].includes(b.status))) || false;
    let werkt = 'nog-niet-gekoppeld';
    if (gereed && actief) werkt = bevestigd ? 'bewezen-met-betaling' : 'klaar-voor-proef';
    else if (checklist.some(x => x.ingesteld)) werkt = 'onvolledig';
    const fase = FASES.includes(r.fase) ? r.fase : 'niet-gestart';
    return { id, naam: meta.naam, uitleg: meta.uitleg, aanmeldUrl: meta.aanmeldUrl,
      fase, faseLabel: FASE_LABEL[fase], werkt, gereed, actief, transacties,
      checklist, bijgewerktAt: r.bijgewerktAt || null, door: r.door || null,
      notitie: String(r.notitie || '').slice(0, 240) };
  }

  function overzicht() {
    const r = staat();
    const cijfers = betalingCijfers(d());
    const uit = betaal.BETALEN_AAN === false;
    const actieveRails = new Set(rails().filter(x => x.echt).map(x => x.id));
    const providers = Object.keys(PROVIDERS).map(id => providerBeeld(id, r.providers[id], actieveRails, cijfers));
    const problemen = [];
    if (!uit && !providers.some(p => p.actief)) problemen.push({ ernst: 'kritiek', code: 'GEEN-ECHTE-PROVIDER',
      tekst: 'Er is nog geen echte betaalprovider gekoppeld. Betalen blijft fail-closed uit; oefenen kan in Magnaat Test.' });
    for (const p of providers) {
      if (p.fase === 'live' && !p.gereed) problemen.push({ ernst: 'kritiek', code: p.id.toUpperCase() + '-ONVOLLEDIG',
        tekst: p.naam + ' staat administratief live, maar de beveiligde serverinstellingen zijn niet compleet.' });
      if (p.fase !== 'niet-gestart' && p.fase !== 'aanvraag' && p.fase !== 'controle' && !p.gereed)
        problemen.push({ ernst: 'waarschuwing', code: p.id.toUpperCase() + '-INSTELLINGEN',
          tekst: p.naam + ' mist nog ' + p.checklist.filter(x => !x.ingesteld).map(x => x.label).join(', ') + '.' });
    }
    if (cijfers.controleNodig) problemen.push({ ernst: 'kritiek', code: 'BETALING-CONTROLE',
      tekst: cijfers.controleNodig + ' betaling(en) hebben menselijke controle nodig.' });
    if (cijfers.afhandelingWacht) problemen.push({ ernst: 'kritiek', code: 'AFHANDELING-WACHT',
      tekst: cijfers.afhandelingWacht + ' bevestigde betaling(en) wachten nog op veilige domeinafhandeling.' });
    if (cijfers.terugbetalingControle) problemen.push({ ernst: 'kritiek', code: 'TERUGBETALING-CONTROLE',
      tekst: cijfers.terugbetalingControle + ' terugbetaling(en) wachten op menselijke controle.' });
    if (cijfers.terugbetalingWacht) problemen.push({ ernst: 'waarschuwing', code: 'TERUGBETALING-WACHT',
      tekst: cijfers.terugbetalingWacht + ' terugbetaling(en) wachten op providerbevestiging.' });
    const inbox = Object.values(d().betaalWaarheidMeldingen || {});
    const onverwerkt = inbox.filter(x => !x.verwerktAt).length;
    if (onverwerkt) problemen.push({ ernst: 'waarschuwing', code: 'WEBHOOK-WACHT',
      tekst: onverwerkt + ' terugmelding(en) wachten nog op verwerking.' });
    return { eigenaarEmail: require('../eigenaar').eigenaarEmail(), voorkeur: r.voorkeur || null, betalingenUit: uit,
      providers, cijfers, problemen, gezond: !problemen.some(p => p.ernst === 'kritiek'),
      audit: r.audit.slice(-30).reverse(), bijgewerktAt: nuIso() };
  }

  function audit(r, soort, actor, extra) {
    r.audit.push(Object.assign({ at: nuIso(), soort, actor: String(actor || 'onbekend').slice(0, 100) }, extra || {}));
    if (r.audit.length > 500) r.audit.splice(0, r.audit.length - 500);
  }

  function zetFase(id, fase, actor, notitie, rol) {
    id = String(id || '').toLowerCase(); fase = String(fase || '').toLowerCase();
    if (!PROVIDERS[id]) throw new Error('Onbekende betaalprovider.');
    if (!FASES.includes(fase)) throw new Error('Onbekende stap in de koppeling.');
    if (rol === 'it' && !IT_FASES.has(fase)) throw new Error('Livegang is een besluit van de eigenaar.');
    const r = staat();
    const p = r.providers[id];
    if (fase === 'live') {
      const beeld = overzicht().providers.find(x => x.id === id);
      if (!beeld || !beeld.gereed || !beeld.actief)
        throw new Error('Deze provider kan pas live nadat alle serverinstellingen en controles groen zijn.');
    }
    const van = p.fase || 'niet-gestart';
    p.fase = fase; p.bijgewerktAt = nuIso(); p.door = String(actor || 'onbekend').slice(0, 100);
    p.notitie = String(notitie || '').trim().slice(0, 240);
    audit(r, 'fase', actor, { provider: id, van, naar: fase, notitie: p.notitie });
    save();
    return overzicht();
  }

  function kiesVoorkeur(id, actor) {
    id = String(id || '').toLowerCase();
    if (!PROVIDERS[id]) throw new Error('Onbekende betaalprovider.');
    const r = staat(), van = r.voorkeur || null;
    r.voorkeur = id;
    audit(r, 'voorkeur', actor, { van, naar: id });
    save();
    return overzicht();
  }

  function proef(id, actor) {
    id = String(id || '').toLowerCase();
    const beeld = overzicht().providers.find(x => x.id === id);
    if (!beeld) throw new Error('Onbekende betaalprovider.');
    const r = staat();
    const ok = beeld.gereed && beeld.actief;
    audit(r, 'configuratieproef', actor, { provider: id, ok,
      ontbreekt: beeld.checklist.filter(x => !x.ingesteld).map(x => x.sleutel) });
    if (ok && r.providers[id].fase !== 'live') {
      r.providers[id].fase = 'proef'; r.providers[id].bijgewerktAt = nuIso();
      r.providers[id].door = String(actor || 'onbekend').slice(0, 100);
    }
    save();
    return { ok, provider: id, uitleg: ok
      ? 'De configuratie is compleet. Voer nu een echte proefbetaling en terugbetaling uit.'
      : 'De configuratie is nog niet compleet.', overzicht: overzicht() };
  }

  return { PROVIDERS, FASES, overzicht, zetFase, kiesVoorkeur, proef };
};
