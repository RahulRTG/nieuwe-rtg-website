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
    for (const r of (Array.isArray(regelsIn) ? regelsIn : [])) {
      const p = g.producten.find(x => x.id === r.productId && x.actief);
      if (!p) continue;
      const aantal = Math.max(0, Math.round(Number(r.aantal) || 0));
      if (aantal <= 0) continue;
      const prijs = prijsVoor(p, soort);
      regels.push({ productId: p.id, naam: p.naam, eenheid: p.eenheid, aantal, prijs });
      subtotaal += prijs * aantal;
      if (typeof p.voorraad === 'number') p.voorraad = Math.max(0, p.voorraad - aantal);
    }
    if (!regels.length) return { status: 400, error: 'Kies minstens een product.' };
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

  function orderVerder(groothandelCode, ref, actie, actor) {
    const o = orders().find(x => x.ref === ref && x.groothandelCode === groothandelCode);
    if (!o) return { status: 404, error: 'Bestelling niet gevonden.' };
    if (GH_KLAAR[o.status]) return { status: 409, error: 'Deze bestelling is al afgerond.' };
    if (actie === 'weiger') { o.status = 'geweigerd'; }
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
    // voorraad terug
    const s = findSupplier(o.groothandelCode);
    if (s) { const g = defaults(s); for (const r of o.regels) { const p = g.producten.find(x => x.id === r.productId); if (p && typeof p.voorraad === 'number') p.voorraad += r.aantal; } }
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

  /* ---- AI-bijbestellen voor de horeca ----
     Kijkt naar wat de zaak de afgelopen 14 dagen verkocht (gast-bestellingen)
     en naar de laatste mise-en-place, schat het verbruik en matcht dat op de
     producten van de groothandel. Zet een concept-bestelling klaar. */
  function verbruikVan(partner) {
    const sinds = Date.now() - 14 * 86400000;
    const teller = new Map(); // woord -> aantal verkocht
    for (const o of (db.data.orders || [])) {
      if (o.supplierCode !== partner.code) continue;
      if (o.at && new Date(o.at).getTime() < sinds) continue;
      for (const it of (o.items || [])) {
        for (const w of woorden(it.name || it.naam)) teller.set(w, (teller.get(w) || 0) + (Number(it.qty) || 1));
      }
    }
    // mise-en-place van de laatste dagen telt mee als verbruik-signaal
    const mep = partner.dailyMeps || {};
    for (const k of Object.keys(mep)) {
      for (const t of ((mep[k] && mep[k].tasks) || [])) for (const w of woorden(t.text || t)) teller.set(w, (teller.get(w) || 0) + 2);
    }
    return teller;
  }
  function woorden(tekst) {
    return String(tekst || '').toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(w => w.length >= 4);
  }
  function bijbestelVoorstel(partner, groothandelCode) {
    const s = findSupplier(groothandelCode);
    if (!isGroothandel(s)) return { status: 404, error: 'Groothandel niet gevonden.' };
    if (!functieAan(s, 'aiBijbestel')) return { status: 409, error: 'Deze groothandel biedt geen AI-bijbestellen.' };
    if (!functieAan(s, 'b2b')) return { status: 409, error: 'Deze groothandel levert niet aan horeca.' };
    const teller = verbruikVan(partner);
    const g = defaults(s);
    const regels = [];
    for (const p of g.producten.filter(x => x.actief)) {
      const sleutels = woorden(p.naam);
      let score = 0;
      for (const w of sleutels) for (const [k, v] of teller) if (k.includes(w) || w.includes(k)) score += v;
      if (score <= 0) continue;
      // voorgestelde hoeveelheid: het geschatte verbruik, minstens de minimale bestelhoeveelheid
      const aantal = Math.max(p.minBestel || 1, Math.ceil(score / 3));
      regels.push({ productId: p.id, naam: p.naam, eenheid: p.eenheid, aantal, prijs: prijsVoor(p, 'partner'), reden: score + ' keer in verkoop/mise-en-place' });
    }
    regels.sort((a, b) => b.aantal * b.prijs - a.aantal * a.prijs);
    const totaal = Math.round(regels.reduce((n, r) => n + r.aantal * r.prijs, 0) * 100) / 100;
    const uitleg = regels.length
      ? 'Op basis van de verkoop en mise-en-place van de afgelopen 14 dagen: ' + regels.length + ' product(en), samen € ' + totaal + '. Controleer en bevestig.'
      : 'Nog te weinig verkoopdata om iets voor te stellen. Plaats eerst wat bestellingen of bestel handmatig.';
    return { status: 200, ok: true, groothandelCode: s.code, groothandelNaam: s.name, regels: regels.slice(0, 40), totaal, uitleg };
  }

  return { plaatsBestelling, orderVerder, annuleer, mijnBestellingen, inkomend, bijbestelVoorstel };
};
