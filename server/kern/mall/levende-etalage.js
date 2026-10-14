/* RTG Mall: Living Mall projectie.

   Dit is een LEESLAAG over bestaande bronnen. De projectie verkoopt niets,
   verleent geen recht en verzint geen beschikbaarheid. De Mall-kern blijft
   eigenaar van aanbod en leveranciers; de App-Bibliotheek blijft eigenaar van
   software en installaties. De browser krijgt alleen één rustige vorm waarmee
   zij die bronnen naast elkaar kan presenteren. */
'use strict';

const VERSIE = 1;
const MAX_PER_BRON = 24;

function wereldVoorAanbod(a) {
  const verdieping = String(a.verdieping || '');
  if (['reizen', 'mobiliteit'].includes(verdieping)) return ['travel'];
  if (['diensten', 'leren'].includes(verdieping)) return ['work'];
  if (['zorg'].includes(verdieping)) return ['foundation'];
  return ['living'];
}

function wereldVoorApp(app) {
  if (app.wereld === 'rtf') return ['foundation'];
  const categorie = String((app.categorie || '') + ' ' + (app.categorieLabel || '')).toLowerCase();
  if (/reis|verblijf|mobiliteit|vlucht/.test(categorie)) return ['travel'];
  if (/werk|organisatie|bedrijf|planning|geld|financ/.test(categorie)) return ['work'];
  if (/foundation|zorg|leren|welzijn/.test(categorie)) return ['foundation'];
  return ['living'];
}

function afdelingVoorAanbod(a) {
  if (['reis', 'verblijf', 'ticket', 'boeking'].includes(a.type)) return 'experience';
  if (['dienst', 'offerte', 'abonnement'].includes(a.type)) return 'services';
  if (['wonen'].includes(a.verdieping)) return 'home';
  return 'products';
}

function mallPrijs(prijs) {
  if (!prijs || !Number.isFinite(Number(prijs.bedrag))) return null;
  return {
    amount: Number(prijs.bedrag),
    currency: prijs.valuta || 'EUR',
    unit: prijs.eenheid || null,
    from: !!prijs.vanaf,
    vat: prijs.btw || null
  };
}

function softwareRij(app, actief) {
  return {
    id: 'software:' + app.id,
    kind: 'software',
    department: 'software',
    title: app.naam,
    description: app.uitleg || null,
    provider: { kind: 'rtg', name: 'RTG', status: 'RTG' },
    worlds: wereldVoorApp(app),
    state: actief ? 'ACTIVE' : 'AVAILABLE',
    stateLabel: actief ? 'In uw wereld' : 'Beschikbaar',
    price: app.ledenprijsCenten == null ? null : {
      amount: app.ledenprijsCenten / 100, currency: 'EUR', unit: 'eenmalig', from: false, vat: null
    },
    rating: null,
    action: actief && app.url
      ? { type: 'OPEN', label: 'Open in uw wereld', href: app.url }
      : { type: 'INSTALL', label: 'Voeg toe aan uw wereld', appId: app.id },
    source: { kind: 'app-library', id: app.id },
    category: app.categorieLabel || app.categorie || 'Software'
  };
}

function hardwareRij(product) {
  return {
    id: 'hardware:' + product.slug,
    kind: 'hardware',
    department: 'hardware',
    title: product.naam,
    description: product.beschrijving || null,
    provider: { kind: 'rtg', name: 'RTG Maison', status: 'RTG' },
    worlds: product.discipline && /travel|reis/i.test(product.discipline) ? ['travel'] : ['work', 'living'],
    state: 'AVAILABLE',
    stateLabel: 'Beschikbaar',
    price: { amount: product.eenmalig, currency: 'EUR', unit: product.eenheid,
      from: false, vat: 'ex' },
    recurringPrice: product.perMaand > 0 ? { amount: product.perMaand, currency: 'EUR', unit: 'per maand', vat: 'ex' } : null,
    rating: null,
    action: { type: 'ORDER', label: 'Bestellen', slug: product.slug },
    source: { kind: 'rtg-own-catalog', id: product.slug },
    category: product.discipline || 'RTG Hardware'
  };
}

function aanbodRij(a) {
  return {
    id: 'offer:' + a.id,
    kind: a.type,
    department: afdelingVoorAanbod(a),
    title: a.titel,
    description: a.uitleg || null,
    provider: {
      kind: a.aanbieder.soort,
      code: a.aanbieder.code || null,
      name: a.aanbieder.naam,
      status: a.aanbieder.status || null
    },
    worlds: wereldVoorAanbod(a),
    state: a.beschikbaar && a.beschikbaar.uit ? 'UNAVAILABLE' : 'AVAILABLE',
    stateLabel: a.beschikbaar ? a.beschikbaar.tekst : 'Bekijk beschikbaarheid',
    price: mallPrijs(a.prijs),
    rating: a.waardering || null,
    action: { type: 'NAVIGATE', label: a.cta, href: a.pagina },
    source: { kind: a.bron, id: a.id },
    category: a.genreLabel || a.typeLabel || a.type,
    saveable: true,
    offerId: a.id,
    place: a.plek || null
  };
}

function telMallAfdelingen(items, key) {
  return items.reduce((out, item) => {
    const waarde = item[key];
    out[waarde] = (out[waarde] || 0) + 1;
    return out;
  }, {});
}

function projecteerLivingMall({ aanbod, apps, installedApps, ownProducts, partial, supplierGroups }) {
  const actief = new Set((installedApps || []).map(app => app.id));
  const software = (apps || []).slice(0, MAX_PER_BRON).map(app => softwareRij(app, actief.has(app.id)));
  const hardware = (ownProducts || []).slice(0, MAX_PER_BRON).map(hardwareRij);
  const marketplace = (aanbod || []).slice(0, MAX_PER_BRON).map(aanbodRij);
  const items = software.concat(hardware, marketplace);
  return {
    ok: true,
    projection: 'rtg.mall.living',
    version: VERSIE,
    generatedAt: new Date().toISOString(),
    items,
    departments: telMallAfdelingen(items, 'department'),
    supplierGroups: (supplierGroups || []).map(group => ({
      id: group.type,
      label: group.label,
      count: group.aantal,
      href: group.pagina,
      suppliers: (group.leveranciers || []).map(s => ({ code: s.code, name: s.naam, city: s.stad || null }))
    })),
    sources: {
      software: software.length,
      hardware: hardware.length,
      offers: marketplace.length,
      partial: Array.isArray(partial) ? partial : []
    },
    rules: {
      readOnlyProjection: true,
      domainOwnsExecution: true,
      commercialRightsAreNotAuthorization: true,
      partnerStatusIsNotQualityJudgement: true
    }
  };
}

module.exports = { VERSIE, MAX_PER_BRON, projecteerLivingMall, softwareRij, hardwareRij, aanbodRij };
