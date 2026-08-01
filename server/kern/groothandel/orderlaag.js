/* Groothandel (deelmodule): de orderketen: bestellen, de statusketen
   (aangevraagd -> geleverd), annuleren, de lijsten voor koper en
   groothandel, verbruik en het slimme bijbestelvoorstel. orders en markt
   komen via de context binnen nadat kern/groothandel.js de
   assortimentlaag heeft gemount. */
module.exports = (ctx) => {
  const { db, save, crypto, findSupplier, notify, notifySupplier, sseToSupplier, sseToCustomer, sseToOffice, anthropic, bijGeleverd,
    GH_FUNCTIES, GH_KETEN, GH_KLAAR, CATEGORIEEN,
    id, nu, schoon, getal, isGroothandel, defaults, functieAan, klantSoortVan, functieVoorKlant, prijsVoor } = ctx;
  const { functieLijst, zetFunctie, zetProduct, zetVoorraad, orders, actieveGroothandels, publiekProduct, markt } = ctx;
  function plaatsBestelling(groothandelCode, koper, regelsIn, opts) {
    opts = opts || {};
    const s = findSupplier(groothandelCode);
    if (!isGroothandel(s)) return { status: 404, error: 'Groothandel niet gevonden.' };
    const soort = klantSoortVan(koper);
    const fnodig = functieVoorKlant(soort);
    if (!functieAan(s, fnodig)) return { status: 409, error: 'Deze groothandel levert niet aan dit type klant.' };
    const bezorgen = opts.bezorgen !== false;
    if (bezorgen && !functieAan(s, 'bezorgen')) return { status: 409, error: 'Deze groothandel bezorgt niet; kies afhalen.' };
    if (!bezorgen && !functieAan(s, 'afhalen')) return { status: 409, error: 'Afhalen kan hier niet; kies bezorgen.' };
    const g = defaults(s);
    const regels = [];
    let subtotaal = 0;
    /* EERST nakijken, PAS DAARNA afboeken. De aftrek stond in de lus met een
       bodem (Math.max(0, voorraad - aantal)) en zonder te kijken of het paste;
       annuleren zette daarna de VOLLE hoeveelheid terug, dus elke rondgang blies
       de voorraad op met het verschil. Heen en terug horen elkaars omgekeerde te
       zijn. Per product optellen: twee regels moeten ook samen passen. */
    const nodig = new Map();
    for (const r of (Array.isArray(regelsIn) ? regelsIn : [])) {
      const p = g.producten.find(x => x.id === r.productId && x.actief);
      if (!p) continue;
      const aantal = Math.max(0, Math.round(Number(r.aantal) || 0));
      if (aantal <= 0) continue;
      const prijs = prijsVoor(p, soort);
      const som = (nodig.get(p.id) || 0) + aantal;
      if (typeof p.voorraad === 'number' && p.voorraad < som)
        return { status: 409, error: 'Van ' + p.naam + ' ligt er nog ' + p.voorraad + ' ' + (p.eenheid || 'stuks') + '; pas de hoeveelheid aan.' };
      nodig.set(p.id, som);
      regels.push({ productId: p.id, naam: p.naam, eenheid: p.eenheid, aantal, prijs });
      subtotaal += prijs * aantal;
    }
    if (!regels.length) return { status: 400, error: 'Kies minstens een product.' };
    for (const [pid, aantal] of nodig) {
      const p = g.producten.find(x => x.id === pid);
      if (p && typeof p.voorraad === 'number') p.voorraad -= aantal;
    }
    const order = {
      ref: id('GH').toUpperCase(), groothandelCode: s.code, groothandelNaam: s.name,
      klant: { soort, id: koper.id, naam: koper.naam || 'Klant' },
      regels, subtotaal: Math.round(subtotaal * 100) / 100, bezorgen,
      soort: soort === 'lid' ? 'boodschappen' : soort === 'groothandel' ? 'doorverkoop' : 'b2b',
      bron: opts.bron === 'ai' ? 'ai' : 'handmatig', status: 'aangevraagd', at: nu(), stappen: [{ status: 'aangevraagd', at: nu() }]
    };
    orders().unshift(order);
    db.data.groothandelOrders = orders().slice(0, 20000);
    save();
    notifySupplier(s.code, { icon: '\u{1F4E6}', title: 'Nieuwe bestelling', body: order.klant.naam + ' · ' + regels.length + ' regel(s) · € ' + order.subtotaal + (order.bron === 'ai' ? ' (AI-bijbestelling)' : '') });
    sseToSupplier(s.code, 'sync', { scope: 'groothandel' });
    sseToOffice('sync', { scope: 'groothandel' });
    return { status: 200, ok: true, order: publiekeOrder(order, 'klant') };
  }

  // De gereserveerde voorraad terug op de plank. Een order valt maar een keer uit
  // de keten (geannuleerd of geweigerd staan allebei in GH_KLAAR), dus dubbel kan niet.
  function voorraadTerug(o) {
    const s = findSupplier(o.groothandelCode);
    if (!s) return;
    const g = defaults(s);
    for (const r of o.regels) {
      const p = g.producten.find(x => x.id === r.productId);
      if (p && typeof p.voorraad === 'number') p.voorraad += r.aantal;
    }
  }

  function orderVerder(groothandelCode, ref, actie, actor) {
    const o = orders().find(x => x.ref === ref && x.groothandelCode === groothandelCode);
    if (!o) return { status: 404, error: 'Bestelling niet gevonden.' };
    if (GH_KLAAR[o.status]) return { status: 409, error: 'Deze bestelling is al afgerond.' };
    // weigeren is ook een niet-doorgegane bestelling: voorraad terug. Dat gebeurde
    // alleen bij annuleren, dus een geweigerde order bleef als verkocht afgeboekt.
    if (actie === 'weiger') { o.status = 'geweigerd'; voorraadTerug(o); }
    else if (actie === 'verder') { const volgende = GH_KETEN[o.status]; if (!volgende) return { status: 409, error: 'Geen volgende stap.' }; o.status = volgende; }
    else return { status: 400, error: 'Onbekende actie.' };
    o.stappen.push({ status: o.status, at: nu(), door: (actor && actor.name) || null });
    save();
    // geleverd bij een zaak: de keukenvoorraad van de klant vult zichzelf aan
    if (o.status === 'geleverd' && o.klant.soort !== 'lid' && bijGeleverd) { try { bijGeleverd(o); } catch (e) {} }
    notifKlant(o, o.status === 'geweigerd' ? 'Bestelling geweigerd' : 'Bestelling: ' + o.status);
    sseToSupplier(groothandelCode, 'sync', { scope: 'groothandel' });
    sseToOffice('sync', { scope: 'groothandel' });
    return { status: 200, ok: true, status2: o.status };
  }
  function notifKlant(o, tekst) {
    if (o.klant.soort === 'lid') { sseToCustomer(o.klant.id, 'sync', { scope: 'groothandel' }); notify(o.klant.id, { icon: '\u{1F6D2}', title: o.groothandelNaam, body: tekst, scope: 'orders' }); }
    else { sseToSupplier(o.klant.id, 'sync', { scope: 'inkoop' }); notifySupplier(o.klant.id, { icon: '\u{1F4E6}', title: o.groothandelNaam, body: tekst }); }
  }
  function annuleer(koper, ref) {
    const o = orders().find(x => x.ref === ref && x.klant.soort === klantSoortVan(koper) && x.klant.id === koper.id);
    if (!o) return { status: 404, error: 'Bestelling niet gevonden.' };
    if (o.status !== 'aangevraagd') return { status: 409, error: 'Alleen een nog niet bevestigde bestelling kan geannuleerd worden.' };
    o.status = 'geannuleerd'; o.stappen.push({ status: 'geannuleerd', at: nu() });
    voorraadTerug(o);
    save();
    sseToSupplier(o.groothandelCode, 'sync', { scope: 'groothandel' });
    return { status: 200, ok: true };
  }

  function publiekeOrder(o, kant) {
    return {
      ref: o.ref, groothandelCode: o.groothandelCode, groothandelNaam: o.groothandelNaam,
      klant: kant === 'groothandel' ? o.klant : { soort: o.klant.soort, naam: o.klant.naam },
      regels: o.regels, subtotaal: o.subtotaal, bezorgen: o.bezorgen, soort: o.soort, bron: o.bron,
      status: o.status, at: o.at, stappen: o.stappen
    };
  }
  function mijnBestellingen(koper) {
    const soort = klantSoortVan(koper);
    return orders().filter(o => o.klant.soort === soort && o.klant.id === koper.id).slice(0, 100).map(o => publiekeOrder(o, 'klant'));
  }
  function inkomend(groothandelCode) {
    const lijst = orders().filter(o => o.groothandelCode === groothandelCode);
    return {
      open: lijst.filter(o => !GH_KLAAR[o.status]).map(o => publiekeOrder(o, 'groothandel')),
      afgerond: lijst.filter(o => GH_KLAAR[o.status]).slice(0, 60).map(o => publiekeOrder(o, 'groothandel')),
      omzet: Math.round(lijst.filter(o => o.status === 'geleverd').reduce((n, o) => n + o.subtotaal, 0) * 100) / 100
    };
  }

  /* Het slimme bijbestelvoorstel is een eigen onderwerp (verkoopdata lezen,
     schatten, matchen) en woont daarom in ./bijbestel; deze laag gaat over de
     orderketen zelf. Afgesplitst toen dit bestand de 10 KB passeerde. */
  const { bijbestelVoorstel } = require('./bijbestel')({ db, findSupplier, isGroothandel, defaults, functieAan, prijsVoor });

  return { plaatsBestelling, orderVerder, annuleer, mijnBestellingen, inkomend, bijbestelVoorstel };
};
