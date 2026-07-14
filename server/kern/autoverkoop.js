/* Kern-module "autoverkoop": een 5-sterren, exclusieve autoverkoop bovenop het
   verhuurbedrijf. Naast huren kan dezelfde zaak auto's verkopen, met een
   vloeiende, luxe flow:
   - een showroom met specs, opties, garantie en historie (VIP-stukken apart),
   - een proefrit op afspraak (de zaak plant hem in),
   - kopen met een bod, optioneel inruil (de zaak taxeert) en optioneel
     concierge-aflevering op je eigen adres,
   - een digitaal koopcontract dat het lid tekent,
   - slimme aanbevelingen.

   Alles zelfstandig in db.data.verkoopDeals en s.verkoop, met het vaste
   kern-patroon maakAutoverkoop(state). */

const KETEN_PROEFRIT = { aangevraagd: 'ingepland', ingepland: 'gereden' };
const KETEN_KOOP = { aangevraagd: 'aanvaard', aanvaard: 'getekend', getekend: 'afgeleverd' };
const KLAAR = { gereden: true, afgeleverd: true, afgewezen: true, geannuleerd: true };
const BRANDSTOF = ['Benzine', 'Diesel', 'Hybride', 'Elektrisch'];

function maakAutoverkoop({ db, save, crypto, findSupplier, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice }) {
  const id = (p) => (p || 'V') + crypto.randomBytes(4).toString('hex').toUpperCase();
  const nu = () => new Date().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const getal = (v, min, max, st) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : st; };
  function deals() { if (!Array.isArray(db.data.verkoopDeals)) db.data.verkoopDeals = []; return db.data.verkoopDeals; }

  function isVerkoopBedrijf(s) { return s && s.type === 'verhuur'; }
  function ver(s) {
    if (!s.verkoop || typeof s.verkoop !== 'object') s.verkoop = {};
    if (typeof s.verkoop.aan !== 'boolean') s.verkoop.aan = false;
    if (!Array.isArray(s.verkoop.showroom)) s.verkoop.showroom = [];
    return s.verkoop;
  }
  function magVerkopen(s) { return isVerkoopBedrijf(s) && ver(s).aan; }
  function autoNaam(a) { return [a.merk, a.model, a.jaar].filter(Boolean).join(' '); }

  /* ---- de zaak beheert de showroom ---- */
  function zetAan(s, aan) {
    if (!isVerkoopBedrijf(s)) return { status: 409, error: 'Autoverkoop hoort bij een verhuur/autobedrijf.' };
    ver(s).aan = aan !== false; save();
    return { status: 200, ok: true, aan: ver(s).aan };
  }
  function zetAuto(s, data) {
    if (!isVerkoopBedrijf(s)) return { status: 409, error: 'Autoverkoop hoort bij een verhuur/autobedrijf.' };
    const v = ver(s);
    const merk = schoon(data.merk, 40);
    if (!merk) return { status: 400, error: 'Vul minstens het merk in.' };
    let a = data.id ? v.showroom.find(x => x.id === data.id) : null;
    if (!a) { a = { id: id('AUTO') }; v.showroom.push(a); }
    a.merk = merk;
    a.model = schoon(data.model, 40) || a.model || '';
    a.jaar = getal(data.jaar, 1950, 2100, a.jaar || new Date().getFullYear());
    a.km = getal(data.km, 0, 2e6, a.km || 0);
    a.prijs = getal(data.prijs, 0, 1e7, a.prijs || 0);
    a.brandstof = BRANDSTOF.includes(data.brandstof) ? data.brandstof : (a.brandstof || 'Benzine');
    a.transmissie = schoon(data.transmissie, 20) || a.transmissie || 'Automaat';
    a.kleur = schoon(data.kleur, 30) || a.kleur || '';
    a.vermogenPk = getal(data.vermogenPk, 0, 3000, a.vermogenPk || 0);
    a.opties = Array.isArray(data.opties) ? data.opties.map(o => schoon(o, 40)).filter(Boolean).slice(0, 30) : (a.opties || []);
    a.garantieMnd = getal(data.garantieMnd, 0, 120, a.garantieMnd != null ? a.garantieMnd : 12);
    a.historie = schoon(data.historie, 400) || a.historie || '';
    if (Array.isArray(data.fotos)) a.fotos = data.fotos.filter(f => typeof f === 'string' && /^data:image\//.test(f) && f.length < 900 * 1024).slice(0, 8);
    if (!Array.isArray(a.fotos)) a.fotos = [];
    a.vip = data.vip === true;
    a.status = ['te koop', 'gereserveerd', 'verkocht'].includes(data.status) ? data.status : (a.status || 'te koop');
    save();
    return { status: 200, ok: true, auto: a };
  }
  function verwijderAuto(s, autoId) {
    const v = ver(s);
    const a = v.showroom.find(x => x.id === autoId);
    if (a) a.status = 'verkocht';        // nooit hard weg: lopende deals verwijzen ernaar
    save();
    return { status: 200, ok: true };
  }

  /* ---- de showroom voor leden ---- */
  function publiekeAuto(a, s) {
    return { id: a.id, supplierCode: s.code, supplierNaam: s.name, naam: autoNaam(a), merk: a.merk, model: a.model,
      jaar: a.jaar, km: a.km, prijs: a.prijs, brandstof: a.brandstof, transmissie: a.transmissie, kleur: a.kleur,
      vermogenPk: a.vermogenPk, opties: a.opties, garantieMnd: a.garantieMnd, historie: a.historie,
      fotos: a.fotos, vip: !!a.vip, status: a.status };
  }
  function bedrijven() { return db.data.suppliers.filter(s => magVerkopen(s)); }
  function showroom(opts) {
    opts = opts || {};
    const zoek = String(opts.zoek || '').toLowerCase();
    const uit = [];
    for (const s of bedrijven()) {
      for (const a of ver(s).showroom) {
        if (a.status !== 'te koop') continue;   // gereserveerd/verkocht niet in de vrije showroom
        if (opts.brandstof && a.brandstof !== opts.brandstof) continue;
        if (opts.maxPrijs && a.prijs > Number(opts.maxPrijs)) continue;
        if (zoek && !(autoNaam(a) + ' ' + a.kleur).toLowerCase().includes(zoek)) continue;
        uit.push(publiekeAuto(a, s));
      }
    }
    // VIP eerst, dan nieuwste
    uit.sort((x, y) => (y.vip - x.vip) || (y.jaar - x.jaar) || (x.prijs - y.prijs));
    return uit.slice(0, 200);
  }
  // Slimme aanbevelingen: de exclusieve/nieuwste stukken bovenaan (curated).
  function aanbevolen(key) {
    return showroom({}).filter(a => a.status === 'te koop').slice(0, 6);
  }
  function vindAuto(supplierCode, autoId) {
    const s = findSupplier(supplierCode);
    if (!magVerkopen(s)) return null;
    const a = ver(s).showroom.find(x => x.id === autoId);
    return a ? { s, a } : null;
  }

  /* ---- proefrit ---- */
  function proefritAanvraag(key, codenaam, supplierCode, autoId, wens) {
    const t = vindAuto(supplierCode, autoId);
    if (!t) return { status: 404, error: 'Deze auto staat niet te koop.' };
    const d = nieuweDeal('proefrit', key, codenaam, t.s, t.a);
    d.wens = schoon(wens, 200);
    bewaar(d, t.s);
    return { status: 200, ok: true, deal: klantDeal(d) };
  }

  /* ---- kopen (met bod, inruil, concierge-aflevering) ---- */
  function koopAanvraag(key, codenaam, supplierCode, autoId, opts) {
    const t = vindAuto(supplierCode, autoId);
    if (!t) return { status: 404, error: 'Deze auto staat niet te koop.' };
    if (t.a.status !== 'te koop') return { status: 409, error: 'Deze auto is niet meer beschikbaar.' };
    opts = opts || {};
    const d = nieuweDeal('koop', key, codenaam, t.s, t.a);
    d.vraagprijs = t.a.prijs;
    d.bod = opts.bod != null ? getal(opts.bod, 0, 1e7, t.a.prijs) : t.a.prijs;
    d.prijs = d.bod;
    if (opts.inruil && (opts.inruil.merk || opts.inruil.model)) {
      d.inruil = { merk: schoon(opts.inruil.merk, 40), model: schoon(opts.inruil.model, 40),
        jaar: getal(opts.inruil.jaar, 1950, 2100, 0), km: getal(opts.inruil.km, 0, 2e6, 0), taxatie: null };
    }
    d.concierge = opts.concierge === true;
    d.adres = d.concierge ? schoon(opts.adres, 160) : '';
    // reserveer de auto zolang de deal loopt
    t.a.status = 'gereserveerd';
    d.contract = { tekst: koopContract(d), getekend: null };
    bewaar(d, t.s);
    return { status: 200, ok: true, deal: klantDeal(d) };
  }
  function koopContract(d) {
    return [
      'RTG Autoverkoop, koopovereenkomst (concept)',
      '',
      'Voertuig: ' + d.autoNaam,
      'Prijs: € ' + d.prijs + (d.vraagprijs && d.vraagprijs !== d.prijs ? ' (vraagprijs € ' + d.vraagprijs + ')' : ''),
      d.inruil ? 'Inruil: ' + [d.inruil.merk, d.inruil.model, d.inruil.jaar].filter(Boolean).join(' ') + (d.inruil.taxatie != null ? ', getaxeerd op € ' + d.inruil.taxatie : ', taxatie volgt') : 'Inruil: geen',
      d.concierge ? 'Aflevering: concierge, op ' + (d.adres || 'uw adres') : 'Aflevering: ophalen bij de zaak',
      '',
      'Door te tekenen bevestigt u de koop tegen bovenstaande voorwaarden. De zaak levert de auto met de opgegeven garantie en historie. Betaling en tenaamstelling worden bij aflevering afgerond.'
    ].join('\n');
  }

  /* ---- inruil-taxatie los aanvragen ---- */
  function inruilAanvraag(key, codenaam, supplierCode, autoId, inruil) {
    const t = vindAuto(supplierCode, autoId);
    if (!t) return { status: 404, error: 'Deze auto staat niet te koop.' };
    if (!inruil || !(inruil.merk || inruil.model)) return { status: 400, error: 'Vul de gegevens van uw inruilauto in.' };
    const d = nieuweDeal('koop', key, codenaam, t.s, t.a);
    d.vraagprijs = t.a.prijs; d.bod = t.a.prijs; d.prijs = t.a.prijs;
    d.inruil = { merk: schoon(inruil.merk, 40), model: schoon(inruil.model, 40), jaar: getal(inruil.jaar, 1950, 2100, 0), km: getal(inruil.km, 0, 2e6, 0), taxatie: null };
    d.alleenTaxatie = true;
    d.contract = { tekst: koopContract(d), getekend: null };
    bewaar(d, t.s);
    return { status: 200, ok: true, deal: klantDeal(d) };
  }

  function nieuweDeal(soort, key, codenaam, s, a) {
    return { ref: id(soort === 'proefrit' ? 'PR' : 'KO'), soort, supplierCode: s.code, supplierNaam: s.name,
      autoId: a.id, autoNaam: autoNaam(a), key, codenaam: codenaam || 'Lid', status: 'aangevraagd',
      at: nu(), stappen: [{ status: 'aangevraagd', at: nu() }] };
  }
  function bewaar(d, s) {
    deals().unshift(d);
    db.data.verkoopDeals = deals().slice(0, 20000);
    save();
    notifySupplier(s.code, { icon: d.soort === 'proefrit' ? '\u{1F697}' : '\u{1F511}', title: d.soort === 'proefrit' ? 'Proefrit-aanvraag' : 'Koop-aanvraag', body: d.codenaam + ' · ' + d.autoNaam + (d.soort === 'koop' && d.bod ? ' · bod € ' + d.bod : '') });
    sseToSupplier(s.code, 'sync', { scope: 'verkoop' });
    sseToOffice('sync', { scope: 'verkoop' });
  }

  /* ---- de zaak/koerier handelt af ---- */
  function dealVan(code, ref) { return deals().find(d => d.ref === ref && d.supplierCode === code); }
  function beslis(code, ref, actie, opts, actor) {
    const d = dealVan(code, ref);
    if (!d) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (KLAAR[d.status]) return { status: 409, error: 'Deze aanvraag is al afgerond.' };
    opts = opts || {};
    const s = findSupplier(code);
    const a = s ? ver(s).showroom.find(x => x.id === d.autoId) : null;
    if (actie === 'afwijs') { d.status = 'afgewezen'; if (a && a.status === 'gereserveerd') a.status = 'te koop'; }
    else if (d.soort === 'proefrit') {
      if (actie === 'plan') { if (d.status !== 'aangevraagd') return { status: 409, error: 'Al ingepland.' }; d.status = 'ingepland'; d.moment = schoon(opts.moment, 40); }
      else if (actie === 'gereden') { d.status = 'gereden'; }
      else return { status: 400, error: 'Onbekende actie.' };
    } else { // koop
      if (actie === 'aanvaard') {
        if (d.status !== 'aangevraagd') return { status: 409, error: 'Deze aanvraag is al behandeld.' };
        if (opts.prijs != null) d.prijs = getal(opts.prijs, 0, 1e7, d.prijs);       // tegenbod
        if (d.inruil && opts.taxatie != null) d.inruil.taxatie = getal(opts.taxatie, 0, 1e7, 0);
        d.contract.tekst = koopContract(d);
        d.status = 'aanvaard';
      } else if (actie === 'taxeer' && d.inruil) { d.inruil.taxatie = getal(opts.taxatie, 0, 1e7, 0); d.contract.tekst = koopContract(d); save(); return { status: 200, ok: true, deal: dealerDeal(d) }; }
      else if (actie === 'afgeleverd') { if (d.status !== 'getekend') return { status: 409, error: 'Teken eerst het contract.' }; d.status = 'afgeleverd'; if (a) a.status = 'verkocht'; }
      else return { status: 400, error: 'Onbekende actie.' };
    }
    d.stappen.push({ status: d.status, at: nu(), door: (actor && actor.name) || null });
    save();
    notify(d.key, { icon: '\u{1F697}', title: d.supplierNaam, body: melding(d), scope: 'orders' });
    sseToCustomer(d.key, 'sync', { scope: 'verkoop' });
    sseToSupplier(code, 'sync', { scope: 'verkoop' });
    return { status: 200, ok: true, status2: d.status, deal: dealerDeal(d) };
  }
  function melding(d) {
    if (d.status === 'ingepland') return 'Uw proefrit is ingepland' + (d.moment ? ': ' + d.moment : '') + '.';
    if (d.status === 'aanvaard') return 'Uw aanvraag is aanvaard. Teken het koopcontract om door te gaan.';
    if (d.status === 'afgeleverd') return 'Uw auto is afgeleverd. Veel rijplezier.';
    if (d.status === 'afgewezen') return 'Uw aanvraag is helaas afgewezen.';
    if (d.status === 'gereden') return 'Bedankt voor de proefrit.';
    return 'Uw aanvraag: ' + d.status + '.';
  }
  // het lid tekent het koopcontract
  function teken(key, ref, naam) {
    const d = deals().find(x => x.ref === ref && x.key === key);
    if (!d) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (d.soort !== 'koop') return { status: 409, error: 'Alleen een koop heeft een contract.' };
    if (d.status !== 'aanvaard') return { status: 409, error: 'Er is nog geen aanvaard aanbod om te tekenen.' };
    const n = schoon(naam, 60);
    if (!n) return { status: 400, error: 'Typ uw naam om te tekenen.' };
    d.contract.getekend = { naam: n, at: nu() };
    d.status = 'getekend'; d.stappen.push({ status: 'getekend', at: nu() });
    save();
    notifySupplier(d.supplierCode, { icon: '✓', title: 'Koopcontract getekend', body: d.codenaam + ' tekende voor ' + d.autoNaam });
    sseToSupplier(d.supplierCode, 'sync', { scope: 'verkoop' });
    return { status: 200, ok: true, status2: d.status };
  }

  /* ---- beelden ---- */
  function klantDeal(d) {
    return { ref: d.ref, soort: d.soort, supplierCode: d.supplierCode, supplierNaam: d.supplierNaam, autoNaam: d.autoNaam,
      status: d.status, moment: d.moment || null, vraagprijs: d.vraagprijs || null, prijs: d.prijs || null, bod: d.bod || null,
      inruil: d.inruil || null, concierge: !!d.concierge, adres: d.adres || '', contract: d.contract ? d.contract.tekst : null,
      getekend: !!(d.contract && d.contract.getekend), at: d.at, stappen: d.stappen };
  }
  function dealerDeal(d) { return Object.assign(klantDeal(d), { codenaam: d.codenaam, wens: d.wens || null }); }
  function mijnDeals(key) { return deals().filter(d => d.key === key).slice(0, 40).map(klantDeal); }
  function dealerInbox(code) {
    const l = deals().filter(d => d.supplierCode === code);
    return {
      aan: (() => { const s = findSupplier(code); return s ? magVerkopen(s) : false; })(),
      showroom: (() => { const s = findSupplier(code); return s ? ver(s).showroom.map(a => publiekeAuto(a, s)) : []; })(),
      open: l.filter(d => !KLAAR[d.status]).map(dealerDeal),
      afgerond: l.filter(d => KLAAR[d.status]).slice(0, 40).map(dealerDeal),
      // wat het personeel (PDA) vandaag moet doen: geplande proefritten en te leveren auto's
      pda: l.filter(d => d.status === 'ingepland' || d.status === 'getekend').map(dealerDeal)
    };
  }

  return {
    AUTOVERKOOP_BRANDSTOF: BRANDSTOF,
    avMagVerkopen: magVerkopen, avZetAan: zetAan, avZetAuto: zetAuto, avVerwijderAuto: verwijderAuto,
    avShowroom: showroom, avAanbevolen: aanbevolen, avProefrit: proefritAanvraag, avKoop: koopAanvraag,
    avInruil: inruilAanvraag, avBeslis: beslis, avTeken: teken, avMijnDeals: mijnDeals, avDealerInbox: dealerInbox
  };
}

module.exports = { maakAutoverkoop };
