/* Kern-module "groothandel": een brede B2B/B2C-marktplaats (denk Sligro, maar dan
   op het RTG-systeem). Een groothandel voert een assortiment en levert aan:
   - onze horeca/partners (B2B, op inkoopprijs),
   - RTG-leden (boodschappen, op consumentprijs, met bezorging),
   - andere groothandels (doorverkoop/streekproducten).

   Elke groothandel zet zijn eigen functies aan en uit (liever te veel dan te
   weinig): welke klanttypes, bezorgen/afhalen, AI-bijbestellen, doorverkoop,
   facturatie op rekening, retour, spoedlevering, enzovoort.

   AI-bijbestellen voor de horeca kijkt naar wat een zaak de afgelopen dagen
   verkocht (de bestellingen van gasten) en naar de mise-en-place, schat het
   verbruik per product en zet een concept-bestelling klaar die de zaak in een
   tik goedkeurt.

   maakGroothandel(state) volgt het vaste kern-patroon. */

// De functies die een groothandel zelf aan/uit zet. Standaard staat alles aan.
const GH_FUNCTIES = [
  { id: 'b2b', naam: 'Leveren aan horeca/partners (B2B)' },
  { id: 'consument', naam: 'Boodschappen aan leden (supermarkt)' },
  { id: 'doorverkoop', naam: 'Leveren aan andere groothandels' },
  { id: 'bezorgen', naam: 'Bezorgen' },
  { id: 'afhalen', naam: 'Afhalen bij de groothandel' },
  { id: 'aiBijbestel', naam: 'AI-bijbestellen voor de horeca' },
  { id: 'streek', naam: 'Streek- en versproducten' },
  { id: 'contractprijs', naam: 'Contractprijzen per klant' },
  { id: 'facturatie', naam: 'Leveren op rekening (factuur)' },
  { id: 'retour', naam: 'Retour & statiegeld' },
  { id: 'spoed', naam: 'Spoedlevering (zelfde dag)' },
  { id: 'allergenen', naam: 'Allergenen- en herkomstinfo' }
];
const GH_KETEN = { aangevraagd: 'bevestigd', bevestigd: 'onderweg', onderweg: 'geleverd' };
const GH_KLAAR = { geleverd: true, geweigerd: true, geannuleerd: true };
const CATEGORIEEN = ['Vers', 'Zuivel', 'Vlees & vis', 'Groente & fruit', 'Droog & houdbaar', 'Dranken', 'Diepvries', 'Non-food'];

function maakGroothandel({ db, save, crypto, findSupplier, notify, notifySupplier, sseToSupplier, sseToCustomer, sseToOffice, anthropic, bijGeleverd }) {
  const id = (p) => (p || 'g') + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const getal = (v, min, max, st) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : st; };

  function isGroothandel(s) { return s && s.type === 'groothandel'; }
  function defaults(s) {
    if (!s.groothandel || typeof s.groothandel !== 'object') s.groothandel = {};
    const g = s.groothandel;
    if (!g.functies || typeof g.functies !== 'object') g.functies = {};
    for (const f of GH_FUNCTIES) if (!(f.id in g.functies)) g.functies[f.id] = true;   // standaard aan
    if (!Array.isArray(g.producten)) g.producten = [];
    return g;
  }
  function functieAan(s, fid) { return defaults(s).functies[fid] !== false; }
  // welk klanttype hoort bij een kopende partij, en welke functie moet daarvoor aanstaan
  function klantSoortVan(koper) {
    if (koper && koper.soort) return koper.soort;
    return 'partner';
  }
  function functieVoorKlant(soort) { return soort === 'lid' ? 'consument' : soort === 'groothandel' ? 'doorverkoop' : 'b2b'; }
  function prijsVoor(p, soort) {
    if (soort === 'lid') return Number(p.consumentPrijs != null ? p.consumentPrijs : p.inkoopPrijs) || 0;
    return Number(p.inkoopPrijs) || 0;
  }

  /* ---- de groothandel beheert zijn eigen functies en assortiment ---- */
  function functieLijst(s) {
    const g = defaults(s);
    return GH_FUNCTIES.map(f => ({ id: f.id, naam: f.naam, aan: g.functies[f.id] !== false }));
  }
  function zetFunctie(s, fid, aan) {
    if (!GH_FUNCTIES.some(f => f.id === fid)) return { status: 400, error: 'Onbekende functie.' };
    defaults(s).functies[fid] = aan !== false;
    save();
    return { status: 200, ok: true, functies: functieLijst(s) };
  }
  function zetProduct(s, data) {
    const g = defaults(s);
    const naam = schoon(data.naam, 80);
    if (!naam) return { status: 400, error: 'Geef een productnaam.' };
    let p = data.id ? g.producten.find(x => x.id === data.id) : null;
    if (!p) { p = { id: id('p') }; g.producten.push(p); }
    p.naam = naam;
    p.categorie = CATEGORIEEN.includes(data.categorie) ? data.categorie : (p.categorie || 'Droog & houdbaar');
    p.eenheid = schoon(data.eenheid, 20) || p.eenheid || 'stuk';
    p.inkoopPrijs = getal(data.inkoopPrijs, 0, 1e6, p.inkoopPrijs || 0);
    p.consumentPrijs = getal(data.consumentPrijs, 0, 1e6, p.consumentPrijs != null ? p.consumentPrijs : Math.round((p.inkoopPrijs || 0) * 1.35 * 100) / 100);
    p.voorraad = getal(data.voorraad, 0, 1e9, p.voorraad || 0);
    p.minBestel = getal(data.minBestel, 1, 1e6, p.minBestel || 1);
    p.btw = getal(data.btw, 0, 27, p.btw != null ? p.btw : 9);
    p.herkomst = schoon(data.herkomst, 60) || p.herkomst || '';
    p.allergenen = schoon(data.allergenen, 120) || p.allergenen || '';
    p.actief = data.actief !== false;
    save();
    return { status: 200, ok: true, product: p };
  }
  function zetVoorraad(s, pid, voorraad) {
    const p = defaults(s).producten.find(x => x.id === pid);
    if (!p) return { status: 404, error: 'Product niet gevonden.' };
    p.voorraad = getal(voorraad, 0, 1e9, p.voorraad);
    save();
    return { status: 200, ok: true, voorraad: p.voorraad };
  }

  /* ---- de marktplaats: wat een klant van een klanttype kan bestellen ---- */
  function orders() { if (!Array.isArray(db.data.groothandelOrders)) db.data.groothandelOrders = []; return db.data.groothandelOrders; }
  function actieveGroothandels() { return db.data.suppliers.filter(isGroothandel); }
  function publiekProduct(p, soort) {
    return { id: p.id, naam: p.naam, categorie: p.categorie, eenheid: p.eenheid, prijs: prijsVoor(p, soort),
      btw: p.btw, voorraad: p.voorraad, minBestel: p.minBestel, herkomst: p.herkomst, allergenen: p.allergenen };
  }
  function markt(soort, opts) {
    opts = opts || {};
    const fnodig = functieVoorKlant(soort);
    const zoek = String(opts.zoek || '').toLowerCase();
    return actieveGroothandels()
      .filter(s => functieAan(s, fnodig))
      .map(s => {
        const g = defaults(s);
        let prod = g.producten.filter(p => p.actief);
        if (opts.categorie) prod = prod.filter(p => p.categorie === opts.categorie);
        if (zoek) prod = prod.filter(p => (p.naam + ' ' + p.categorie).toLowerCase().includes(zoek));
        return {
          code: s.code, naam: s.name, city: s.city,
          bezorgt: functieAan(s, 'bezorgen'), afhalen: functieAan(s, 'afhalen'),
          spoed: functieAan(s, 'spoed'), factuur: functieAan(s, 'facturatie'),
          producten: prod.slice(0, 400).map(p => publiekProduct(p, soort))
        };
      })
      .filter(s => s.producten.length || !zoek);
  }

  /* ---- een bestelling plaatsen (B2B, boodschappen of doorverkoop) ---- */
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

  return {
    GROOTHANDEL_FUNCTIES: GH_FUNCTIES, GROOTHANDEL_CATEGORIEEN: CATEGORIEEN,
    ghIsGroothandel: isGroothandel, ghDefaults: defaults, ghFunctieAan: functieAan,
    ghFunctieLijst: functieLijst, ghZetFunctie: zetFunctie, ghZetProduct: zetProduct, ghZetVoorraad: zetVoorraad,
    ghMarkt: markt, ghPlaatsBestelling: plaatsBestelling, ghOrderVerder: orderVerder, ghAnnuleer: annuleer,
    ghMijnBestellingen: mijnBestellingen, ghInkomend: inkomend, ghBijbestelVoorstel: bijbestelVoorstel
  };
}

module.exports = { GROOTHANDEL_FUNCTIES: GH_FUNCTIES, maakGroothandel };
