/* Server-side world projections over bestaande domeinwaarheid. De ruwe view
   blijft herkenbaar voor huidige surfaces; objects en attention zijn de nieuwe
   platformlaag eromheen. */
'use strict';
const klok = require('../../lib/klok');

const { hash, kopie } = require('./canon');
const { maakRef } = require('./objectrefs');

module.exports = function maakProjecties({ kern, crypto, contexten, attention, manifesten }) {
  const MAX_AGE = { living: 60, travel: 30, work: 30, foundation: 300 };

  function living(key, economicPrincipalRef) {
    const sociaal = kern.socialewereld.kring(key);
    const geld = kern.geldwereld.stand(key);
    let waarde = { ok: true, proofs: [] }, waardeStil = [];
    if (kern.fonds && typeof kern.fonds.bewijzenVoor === 'function') {
      try { waarde = economicPrincipalRef && kern.fonds.bewijzenVoorRef
        ? kern.fonds.bewijzenVoorRef(economicPrincipalRef, 6)
        : kern.fonds.bewijzenVoor(kern.codenaamVan(key), 6); }
      catch (e) { waarde = { ok: false, proofs: [] }; waardeStil = ['economic.runtime']; }
    }
    const bewijsItems = (waarde.proofs || []).map(p => ({
      soort: 'economic-proof', domain: 'economic', kenmerk: p.intentId,
      titel: 'Waarde ' + (p.requestedValue.amountMinor / 100).toFixed(2) + ' ' + p.requestedValue.currency,
      status: p.status, sig: ['FAILED', 'DISPUTED'].includes(p.status) ? 'incident' : 'gezond',
      uitleg: p.status === 'PROVEN' ? 'Extern gereconcilieerd en volledig bewezen.'
        : p.status === 'DISPUTED' ? 'De externe werkelijkheid wijkt af; herstel is nodig.'
          : p.status === 'FAILED' ? 'De integriteitscontrole is niet geslaagd.'
            : 'Settlement of externe reconciliatie is nog niet compleet.',
      app: 'Economic Proof', link: '/apps/geld.html#economic-proof', proof: p
    }));
    return {
      view: { social: sociaal, money: geld, valueProofs: waarde.proofs || [] },
      items: (sociaal.regels || []).concat(geld.regels || [], bewijsItems),
      sources: [...new Set([...(sociaal.bronnen || []), ...(geld.bronnen || []),
        ...(kern.fonds && kern.fonds.bewijzenVoor ? ['economic.runtime'] : [])])],
      silent: [...new Set([...(sociaal.stil || []), ...(geld.stil || []), ...waardeStil])]
    };
  }
  function travel(key) {
    const view = kern.mijnReizen(key) || {};
    const items = (view.reizen || []).flatMap(r => r.onderdelen || [])
      .concat((view.los || []).map(x => x.onderdeel).filter(Boolean));
    return { view, items, sources: view.bronnen || [], silent: view.stil || [] };
  }
  function work(key) {
    const view = kern.kantoorwereld.werkdag(key) || {};
    return { view, items: view.regels || [], sources: view.bronnen || [], silent: view.stil || [] };
  }
  function foundation(key) {
    /* FoundationOS leest uitsluitend bronnen die ontwikkeling bezitten. De
       algemene levenslijn hoort bij LivingOS; hem hier projecteren liet een
       werkafspraak of paspoorttermijn onbedoeld in FoundationOS verschijnen. */
    const sources = ['onderwijs', 'leren.lijsten', 'leren.projecten'];
    const silent = [];
    const lees = (naam, doe, terug) => {
      try {
        const uit = doe();
        if (!uit || (uit.status && uit.status >= 400)) throw new Error(naam + ' niet beschikbaar');
        return uit;
      } catch (e) { silent.push(naam); return terug; }
    };
    const onderwijs = lees('onderwijs', () => kern.onderwijs.mijn(key),
      { fase: null, jaar: null, verder: { volgende: null, doorstroom: [], via: null }, doelen: {} });
    const leerLijsten = lees('leren.lijsten', () => kern.leren.lijstenVan(key), { lijsten: [] });
    const leerProjecten = lees('leren.projecten', () => kern.leren.projectenVan(key),
      { projecten: [], uitnodigingen: [] });

    /* Beste scores reizen bewust niet mee. Foundation mag persoonlijke
       voortgang tonen, maar bouwt geen rangschikbare mensmaat. */
    const lijsten = (leerLijsten.lijsten || []).map(x => ({
      id: x.id, naam: x.naam, aantal: x.aantal, bijgewerktAt: x.at || null
    }));
    const projecten = (leerProjecten.projecten || []).map(x => ({
      id: x.id, titel: x.titel, wat: x.wat || '', taken: x.taken || 0,
      afgerond: x.af || 0, bijgewerktAt: x.at || null
    }));
    const uitnodigingen = (leerProjecten.uitnodigingen || []).map(x => ({
      id: x.id, titel: x.titel, van: x.van || ''
    }));
    const view = {
      development: {
        phase: onderwijs.fase ? { id: onderwijs.fase.id, name: onderwijs.fase.naam,
          track: onderwijs.fase.trap, year: onderwijs.jaar } : null,
        next: kopie(onderwijs.verder || { volgende: null, doorstroom: [], via: null }),
        goals: Object.entries(onderwijs.doelen || {}).map(([id, x]) => ({
          id, mastery: x && x.beheersing || null, evidenceCount: x && x.stukken || 0
        }))
      },
      learning: { lists: lijsten, projects: projecten },
      opportunities: { invitations: uitnodigingen },
      safeguards: { humanWorthScoring: false, publicFailureMetrics: false }
    };
    const items = [];
    if (view.development.phase) items.push({ soort: 'education-phase', domain: 'education',
      titel: view.development.phase.name, status: 'actief', kenmerk: view.development.phase.id,
      app: 'Leerpaspoort', link: '/apps/foundation/leerpaspoort.html' });
    lijsten.forEach(x => items.push({ soort: 'learning-list', domain: 'education',
      titel: x.naam, status: 'actief', kenmerk: x.id,
      app: 'Overhoren', link: '/apps/foundation/overhoren.html' }));
    projecten.forEach(x => items.push({ soort: 'learning-project', domain: 'education',
      titel: x.titel, status: 'actief', kenmerk: x.id,
      app: 'Projecten', link: '/apps/foundation/projecten.html' }));
    uitnodigingen.forEach(x => items.push({ soort: 'learning-invitation', domain: 'education',
      titel: x.titel, status: 'uitnodiging', sig: 'aandacht', kenmerk: x.id,
      uitleg: x.van ? 'Uitnodiging van ' + x.van + '.' : 'Er ligt een uitnodiging voor u klaar.',
      app: 'Projecten', link: '/apps/foundation/projecten.html' }));
    return { view, items, sources, silent };
  }
  const BOUWERS = { living, travel, work, foundation };

  function projecteer({ key, world, contextId, economicPrincipalRef }) {
    const w = String(world || '').toLowerCase();
    const manifest = manifesten.haal(w);
    if (!manifest) return { error: 'Onbekende wereld.', status: 400 };
    const context = contexten.kies(key, w, contextId);
    if (!context) return { error: 'Voor deze wereld is geen geldige context beschikbaar.', status: 400 };
    if (contextId && context.id !== contextId)
      return { error: 'Deze context hoort niet bij deze gebruiker en wereld.', status: 403,
        code: 'CONTEXT_NOT_ALLOWED' };
    let b;
    try { b = BOUWERS[w](key, economicPrincipalRef); }
    catch (e) { b = { view: {}, items: [], sources: [], silent: ['projection-builder'] }; }
    const items = (b.items || []).map(item => ({ ...kopie(item), ref: maakRef(item, crypto, w) }));
    const objects = items.map(item => ({ ref: item.ref, title: item.titel || '', status: item.status || '',
      source: item.app || item.bron || '', deepLink: item.link || null }));
    const generatedAt = klok.datum().toISOString();
    const inhoud = { world: w, context: context.id, view: b.view, objects };
    const attentions = attention.uit(key, w, context, items);
    return {
      projectionId: manifest.home.projection + ':' + context.id,
      projectionType: manifest.home.projection, schemaVersion: 1,
      world: w, context: kopie(context), generatedAt,
      freshness: { status: 'FRESH', maxAgeSeconds: MAX_AGE[w], generatedAt },
      completeness: { status: b.silent.length ? 'PARTIAL' : 'COMPLETE', missingSources: kopie(b.silent) },
      provenance: { builder: manifest.home.projection, sources: kopie(b.sources), ownsSourceData: false },
      snapshotHash: hash(crypto, inhoud), view: kopie(b.view), objects, attention: attentions,
      attentionSummary: {
        open: attentions.filter(a => !['ACKNOWLEDGED', 'RESOLVED', 'EXPIRED'].includes(a.lifecycle)).length,
        actionRequired: attentions.filter(a => a.severity === 'ACTION_REQUIRED' && a.lifecycle !== 'ACKNOWLEDGED').length
      }
    };
  }

  return { projecteer };
};
