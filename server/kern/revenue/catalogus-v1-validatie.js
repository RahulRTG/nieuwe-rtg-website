'use strict';

/* Gesloten validator voor Revenue Catalog v1. De machineleesbare vorm staat in
   catalogus-v1.schema.json; deze nul-dependency uitvoering houdt de runtime bij
   exact dezelfde betekenis en weigert onbekende velden. */
function maakRevenueCatalogusValidator(context) {
  const {
    catalogId, catalogVersion, contractDigest, productId, offerId,
    capabilityId, featureId, formulaId, sourceRefs, offer, canoniek
  } = context;

  return function valideerRevenueCatalogusV1(catalogus) {
    const fouten = [];
    const fout = (pad, melding) => fouten.push({ pad, melding });
    const isObject = x => !!x && typeof x === 'object' && !Array.isArray(x);
    const veldenExact = (o, toegestaan, pad) => {
      if (!isObject(o)) { fout(pad, 'moet een object zijn'); return false; }
      for (const sleutel of Object.keys(o)) if (!toegestaan.includes(sleutel)) fout(pad + '.' + sleutel, 'onbekend veld');
      for (const sleutel of toegestaan) if (!Object.prototype.hasOwnProperty.call(o, sleutel)) fout(pad + '.' + sleutel, 'ontbreekt');
      return true;
    };

    if (!veldenExact(catalogus, ['schemaVersion','catalogId','catalogVersion','contractDigest','mode','products'], '$'))
      return { ok: false, fouten };
    if (catalogus.schemaVersion !== 1) fout('$.schemaVersion', 'moet 1 zijn');
    if (catalogus.catalogId !== catalogId) fout('$.catalogId', 'onbekende catalogus');
    if (catalogus.catalogVersion !== catalogVersion) fout('$.catalogVersion', 'onbekende versie');
    if (catalogus.contractDigest !== contractDigest) fout('$.contractDigest', 'past niet bij het v1-schema');
    if (catalogus.mode !== 'READ_ONLY') fout('$.mode', 'moet READ_ONLY zijn');
    if (!Array.isArray(catalogus.products) || catalogus.products.length !== 1) fout('$.products', 'v1 verwacht precies AI Extra S');
    const p = Array.isArray(catalogus.products) ? catalogus.products[0] : null;
    const velden = ['productId','productVersion','offerId','offerVersion','capabilityId','featureId','name','description','kind','unit','salesForms','price','availability','effects','sources','riskRefs'];
    if (veldenExact(p, velden, '$.products[0]')) {
      if (p.productId !== productId || p.productVersion !== 1) fout('$.products[0].productId', 'onbekend product of versie');
      if (p.offerId !== offerId || p.offerVersion !== 1) fout('$.products[0].offerId', 'onbekende aanbieding of versie');
      if (p.capabilityId !== capabilityId || p.featureId !== featureId) fout('$.products[0].capabilityId', 'onjuiste capabilitybinding');
      if (p.name !== offer.naam || p.description !== offer.wat) fout('$.products[0].name', 'past niet bij de aanbiedingsbron');
      if (p.kind !== 'CAPACITY_ADD_ON') fout('$.products[0].kind', 'onbekende productsoort');
      if (veldenExact(p.unit, ['id','quantity'], '$.products[0].unit') &&
        (p.unit.id !== 'rtg-ai-credit' || p.unit.quantity !== offer.credits)) fout('$.products[0].unit', 'past niet bij de aanbiedingsbron');
      if (canoniek(p.salesForms) !== canoniek(['A_LA_CARTE','BUNDLE_ELIGIBLE'])) fout('$.products[0].salesForms', 'onverwachte verkoopvormen');
      if (veldenExact(p.price, ['formulaId','state','currency','amountCenten','taxTreatment','reason'], '$.products[0].price') &&
        (p.price.formulaId !== formulaId || !['AVAILABLE','UNAVAILABLE'].includes(p.price.state) || p.price.currency !== 'EUR' || p.price.taxTreatment !== 'UNSPECIFIED')) fout('$.products[0].price', 'ongeldige prijsprojectie');
      if (p.price && p.price.state === 'AVAILABLE' && (!Number.isInteger(p.price.amountCenten) || p.price.amountCenten < 0)) fout('$.products[0].price.amountCenten', 'beschikbare prijs vraagt centen');
      if (p.price && p.price.state === 'AVAILABLE' && p.price.reason !== null) fout('$.products[0].price.reason', 'beschikbare prijs heeft geen foutreden');
      if (p.price && p.price.state === 'UNAVAILABLE' && p.price.amountCenten !== null) fout('$.products[0].price.amountCenten', 'onbeschikbare prijs moet null zijn');
      if (p.price && p.price.state === 'UNAVAILABLE' && !p.price.reason) fout('$.products[0].price.reason', 'onbeschikbare prijs vraagt een reden');
      if (veldenExact(p.availability, ['catalogVisible','purchasable','reason'], '$.products[0].availability') &&
        (p.availability.catalogVisible !== true || p.availability.purchasable !== false || !p.availability.reason)) fout('$.products[0].availability', 'pilot mag niet koopbaar zijn');
      const effects = p.effects || {};
      if (veldenExact(effects, ['paymentInitiated','creditGranted','subscriptionActivated','entitlementGranted'], '$.products[0].effects') &&
        ['paymentInitiated','creditGranted','subscriptionActivated','entitlementGranted'].some(k => effects[k] !== false)) fout('$.products[0].effects', 'pilot mag geen commercieel effect hebben');
      if (!Array.isArray(p.sources) || p.sources.length !== 3 || new Set(p.sources.map(s => s.role)).size !== 3) fout('$.products[0].sources', 'drie onderscheiden bronrollen vereist');
      else for (let i = 0; i < p.sources.length; i++) {
        const bron = p.sources[i];
        if (veldenExact(bron, ['role','file','symbol'], '$.products[0].sources[' + i + ']') &&
          canoniek(bron) !== canoniek(sourceRefs[i])) fout('$.products[0].sources[' + i + ']', 'past niet bij de vastgelegde bron');
      }
      if (!Array.isArray(p.riskRefs) || !p.riskRefs.includes('REV-AI-CREDIT-001')) fout('$.products[0].riskRefs', 'financieel risico ontbreekt');
    }
    return { ok: fouten.length === 0, fouten };
  };
}

module.exports = { maakRevenueCatalogusValidator };
