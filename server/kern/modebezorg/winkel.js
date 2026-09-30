/* Modebezorg (deelmodule): de winkelkant: instellingen en setup van de
   modewinkel, de verificatie-eis, de bezorgaanvraag van het lid, het
   winkeloverzicht en de winkel- en klantbeelden (ook door de koerierlaag
   gebruikt). Krijgt de gedeelde context een keer bij het opstarten vanuit
   kern/modebezorg.js. */
const { idVanKey } = require('../../lib/lidsleutel');

module.exports = (ctx) => {
  const { db, save, crypto, findSupplier, accounts, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, haversine, etaMinutes, leesUploadDataUrl,
    KETEN, KLAAR, id, nu, bezorgcode, houderVan, schoon, getal, lijst } = ctx;
  function isRetail(s) { return s && s.type === 'retail'; }
  function instel(s) {
    if (!s.modebezorg || typeof s.modebezorg !== 'object') s.modebezorg = {};
    const m = s.modebezorg;
    if (typeof m.aan !== 'boolean') m.aan = false;
    if (typeof m.straalKm !== 'number') m.straalKm = 15;
    if (typeof m.kosten !== 'number') m.kosten = 6.5;
    if (typeof m.gratisVanaf !== 'number') m.gratisVanaf = 150;
    if (typeof m.waardegrensId !== 'number') m.waardegrensId = 250;    // vanaf dit bedrag ID aan de deur
    if (typeof m.retourAanDeur !== 'boolean') m.retourAanDeur = true;
    return m;
  }
  // Eén tik: bezorgdienst aanzetten met verstandige standaarden (of aanpassen).
  function setup(s, opts) {
    if (!isRetail(s)) return { status: 409, error: 'De bezorgdienst is voor modewinkels.' };
    const m = instel(s);
    opts = opts || {};
    m.aan = opts.aan !== false;
    if (opts.straalKm != null) m.straalKm = getal(opts.straalKm, 1, 100, m.straalKm);
    if (opts.kosten != null) m.kosten = getal(opts.kosten, 0, 100, m.kosten);
    if (opts.gratisVanaf != null) m.gratisVanaf = getal(opts.gratisVanaf, 0, 100000, m.gratisVanaf);
    if (opts.waardegrensId != null) m.waardegrensId = getal(opts.waardegrensId, 0, 100000, m.waardegrensId);
    if (opts.retourAanDeur != null) m.retourAanDeur = opts.retourAanDeur !== false;
    save();
    return { status: 200, ok: true, instellingen: m };
  }
  function magLeveren(s) { return isRetail(s) && instel(s).aan; }

  function accountVerified(key) {
    const id = idVanKey(key);
    if (id == null) return false;
    try { const u = accounts.getUserById(id); return !!(u && u.verified === 'verified'); } catch (e) { return false; }
  }

  /* ---- de klant vraagt een bezorging aan ---- */
  /* Oude bezorgingen droegen hun vier cijfers kaal; die worden weggehaald en
     niet gehonoreerd. Het lid vraagt voor een lopende bezorging een nieuwe. */
  let legacyKlaar = false;
  function ruimOudeBezorgcodes() {
    if (legacyKlaar) return;
    let n = 0;
    for (const b of lijst()) if (b && Object.prototype.hasOwnProperty.call(b, 'bezorgcode')) { delete b.bezorgcode; n++; }
    if (n) save();
    legacyKlaar = true;
  }
  function aanvraag(key, codenaam, supplierCode, itemsIn, opts) {
    ruimOudeBezorgcodes();
    const s = findSupplier(supplierCode);
    if (!isRetail(s)) return { status: 404, error: 'Winkel niet gevonden.' };
    if (!magLeveren(s)) return { status: 409, error: s.name + ' bezorgt op dit moment niet.' };
    const m = instel(s);
    const items = (Array.isArray(itemsIn) ? itemsIn : []).map(it => ({
      naam: schoon(it.naam, 80) || 'Artikel', maat: schoon(it.maat, 12), kleur: schoon(it.kleur, 24),
      prijs: getal(it.prijs, 0, 1e6, 0), aantal: Math.max(1, Math.round(getal(it.aantal, 1, 99, 1)))
    })).filter(it => it.naam);
    if (!items.length) return { status: 400, error: 'Kies minstens een artikel.' };
    const waarde = Math.round(items.reduce((n, it) => n + it.prijs * it.aantal, 0) * 100) / 100;
    const kosten = waarde >= m.gratisVanaf ? 0 : m.kosten;
    const adres = schoon((opts && opts.adres) || '', 160);
    if (!adres) return { status: 400, error: 'Vul een bezorgadres in.' };
    const idVereist = waarde >= m.waardegrensId;
    if (idVereist && !accountVerified(key)) return { status: 403, error: 'Voor een bezorging boven € ' + m.waardegrensId + ' is een RTG-geverifieerd account nodig (ID aan de deur).' };
    /* Geen punt is geen punt (NAVIGATIE.md N20, par. 12 gebrek 5). Hier stond
       zonder coordinaat de winkel plus (0,01; 0,008) als bestemming, en daar
       werd een route en een ETA naartoe gerekend: een verzonnen plek die als
       echte afstand op het scherm kwam. Zonder punt blijft `loc` null, en
       alles erna (route, ETA) zegt dan eerlijk dat het het niet weet. */
    const lat = opts && opts.lat != null && opts.lat !== '' ? Number(opts.lat) : NaN;
    const lng = opts && opts.lng != null && opts.lng !== '' ? Number(opts.lng) : NaN;
    const b = {
      ref: id('MODE'), supplierCode: s.code, supplierName: s.name, key, codenaam: codenaam || 'Lid',
      items, waarde, kosten, adres, idVereist,
      loc: (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null,
      status: 'aangevraagd', koerier: null, foto: null, idOk: false,
      at: nu(), stappen: [{ status: 'aangevraagd', at: nu() }], gps: null
    };
    lijst().unshift(b);
    db.data.modeBezorg = lijst().slice(0, 20000);
    save();
    notifySupplier(s.code, { icon: '\u{1F45C}', title: 'Nieuwe bezorging', body: b.codenaam + ' · ' + items.length + ' stuk(s) · € ' + waarde + (idVereist ? ' · ID vereist' : '') });
    sseToSupplier(s.code, 'sync', { scope: 'modebezorg' });
    sseToOffice('sync', { scope: 'modebezorg' });
    /* Geen code in dit antwoord: de aanvraag blijft zo een gewone, herhaalbare
       schrijfroute. Het lid haalt zijn code met /api/mode/bezorg/code. */
    return { status: 200, ok: true, bezorging: klantBeeld(b) };
  }
  // Een nieuwe bezorgcode voor een eigen, lopende bezorging (de vorige vervalt).
  async function codeNieuw(key, ref) {
    ruimOudeBezorgcodes();
    const b = lijst().find(x => x.ref === String(ref || '') && x.key === key);
    if (!b) return { status: 404, error: 'Bezorging niet gevonden.' };
    if (KLAAR[b.status]) return { status: 409, error: 'Deze bezorging is al afgerond.' };
    const c = await bezorgcode.uitgeven({ ref: b.ref, supplierCode: b.supplierCode, houder: houderVan(key) });
    return c.error ? c : { status: 200, ok: true, ref: b.ref, bezorgcode: c.code, toegang: c.toegang };
  }

  /* ---- de winkel/koerier ---- */
  function winkelOverzicht(code) {
    const l = lijst().filter(b => b.supplierCode === code);
    return {
      instellingen: (() => { const s = findSupplier(code); return s ? instel(s) : null; })(),
      open: l.filter(b => !KLAAR[b.status]).map(winkelBeeld),
      afgerond: l.filter(b => KLAAR[b.status]).slice(0, 40).map(winkelBeeld),
      omzet: Math.round(l.filter(b => b.status === 'afgeleverd').reduce((n, b) => n + b.waarde + b.kosten, 0) * 100) / 100
    };
  }
  function winkelBeeld(b) {
    return {
      ref: b.ref, codenaam: b.codenaam, items: b.items, waarde: b.waarde, kosten: b.kosten,
      adres: b.adres, idVereist: b.idVereist, idOk: b.idOk, status: b.status,
      koerier: b.koerier ? b.koerier.naam : null, foto: b.foto ? true : false, at: b.at, stappen: b.stappen,
      retourReden: b.retourReden || null
    };
  }
  function klantBeeld(b) {
    const eta = (b.gps && b.loc) ? etaMinutes(haversine(b.gps, b.loc), 'driving') : null;
    return {
      ref: b.ref, supplierName: b.supplierName, items: b.items, waarde: b.waarde, kosten: b.kosten,
      status: b.status, idVereist: b.idVereist,
      koerier: b.koerier ? b.koerier.naam : null, gps: b.gps || null, etaMin: eta, at: b.at
    };
  }
  function mijnBezorgingen(key) {
    ruimOudeBezorgcodes();
    return lijst().filter(b => b.key === key).slice(0, 30).map(klantBeeld);
  }
  return { isRetail, instel, setup, magLeveren, accountVerified, aanvraag, codeNieuw, winkelOverzicht, winkelBeeld, klantBeeld, mijnBezorgingen };
};
