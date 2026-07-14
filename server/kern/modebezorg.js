/* Kern-module "modebezorg": een slimme, veilige bezorgdienst die een modewinkel
   (retail) in een tik opzet. Veilig voor beide kanten:

   Voor de winkel:
   - een bezorgcode (pincode) die alleen de juiste ontvanger kent; de koerier
     rondt pas af als die klopt (bewijs van juiste levering),
   - een foto bij de overdracht (bewijs dat het is afgeleverd),
   - bij dure stukken een ID-controle aan de deur (RTG-geverifieerd),
   - alleen geverifieerd eigen personeel bezorgt.

   Voor de klant:
   - live volgen van de koerier (naam, positie, ETA),
   - een eigen bezorgcode die je alleen aan de echte koerier geeft,
   - pas-aan-de-deur: past het niet, dan neemt de koerier het meteen retour.

   Slim/efficient: de koerier krijgt de open bezorgingen op de kortste route
   (dichtstbijzijnde eerst). maakModebezorg(state) volgt het kern-patroon. */

const KETEN = { aangevraagd: 'klaargezet', klaargezet: 'onderweg', onderweg: 'afgeleverd' };
const KLAAR = { afgeleverd: true, retour: true, geannuleerd: true };

function maakModebezorg({ db, save, crypto, findSupplier, accounts, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, haversine, etaMinutes, leesUploadDataUrl }) {
  const id = (p) => (p || 'MB') + crypto.randomBytes(4).toString('hex').toUpperCase();
  const nu = () => new Date().toISOString();
  const pin = () => String(Math.floor(1000 + Math.random() * 9000));
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const getal = (v, min, max, st) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : st; };
  function lijst() { if (!Array.isArray(db.data.modeBezorg)) db.data.modeBezorg = []; return db.data.modeBezorg; }

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
    const mm = /^user-(\d+)$/.exec(String(key || ''));
    if (!mm) return false;
    try { const u = accounts.getUserById(Number(mm[1])); return !!(u && u.verified === 'verified'); } catch (e) { return false; }
  }

  /* ---- de klant vraagt een bezorging aan ---- */
  function aanvraag(key, codenaam, supplierCode, itemsIn, opts) {
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
    const lat = Number(opts && opts.lat), lng = Number(opts && opts.lng);
    const b = {
      ref: id('MODE'), supplierCode: s.code, supplierName: s.name, key, codenaam: codenaam || 'Lid',
      items, waarde, kosten, adres, idVereist,
      loc: (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : (s.loc ? { lat: s.loc.lat + 0.01, lng: s.loc.lng + 0.008 } : null),
      bezorgcode: pin(), status: 'aangevraagd', koerier: null, foto: null, idOk: false,
      at: nu(), stappen: [{ status: 'aangevraagd', at: nu() }], gps: null
    };
    lijst().unshift(b);
    db.data.modeBezorg = lijst().slice(0, 20000);
    save();
    notifySupplier(s.code, { icon: '\u{1F45C}', title: 'Nieuwe bezorging', body: b.codenaam + ' · ' + items.length + ' stuk(s) · € ' + waarde + (idVereist ? ' · ID vereist' : '') });
    sseToSupplier(s.code, 'sync', { scope: 'modebezorg' });
    sseToOffice('sync', { scope: 'modebezorg' });
    return { status: 200, ok: true, bezorging: klantBeeld(b) };
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
  // Slimme route: open bezorgingen, dichtstbijzijnde eerst t.o.v. de koerier.
  function route(code, koerierPos) {
    const open = lijst().filter(b => b.supplierCode === code && !KLAAR[b.status]);
    const pos = (koerierPos && Number.isFinite(koerierPos.lat)) ? koerierPos : null;
    const metAfstand = open.map(b => ({ b, d: (pos && b.loc) ? haversine(pos, b.loc) : null }));
    metAfstand.sort((x, y) => (x.d == null ? 1e12 : x.d) - (y.d == null ? 1e12 : y.d));
    return metAfstand.map(x => Object.assign(winkelBeeld(x.b), { afstandM: x.d, etaMin: x.d != null ? etaMinutes(x.d, 'driving') : null }));
  }
  function bezorging(code, ref) { return lijst().find(b => b.ref === ref && b.supplierCode === code); }
  function neem(code, ref, actor) {
    const b = bezorging(code, ref);
    if (!b) return { status: 404, error: 'Bezorging niet gevonden.' };
    if (KLAAR[b.status]) return { status: 409, error: 'Deze bezorging is al afgerond.' };
    b.koerier = { naam: (actor && actor.name) || 'Koerier', staffId: actor && actor.staffId };
    if (b.status === 'aangevraagd') { b.status = 'klaargezet'; b.stappen.push({ status: 'klaargezet', at: nu() }); }
    if (b.status === 'klaargezet') { b.status = 'onderweg'; b.stappen.push({ status: 'onderweg', at: nu() }); }
    save();
    notify(b.key, { icon: '\u{1F6F5}', title: b.supplierName, body: 'Uw bezorging is onderweg met ' + b.koerier.naam + '. Volg live en houd uw bezorgcode klaar.', scope: 'orders' });
    sseToCustomer(b.key, 'sync', { scope: 'modebezorg' });
    sseToSupplier(code, 'sync', { scope: 'modebezorg' });
    return { status: 200, ok: true, status2: b.status };
  }
  function gps(code, ref, lat, lng) {
    const b = bezorging(code, ref);
    if (!b) return { status: 404, error: 'Bezorging niet gevonden.' };
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { status: 400, error: 'Geen positie.' };
    b.gps = { lat, lng, at: nu() };   // vluchtig genoeg; we bewaren de laatste
    const eta = b.loc ? etaMinutes(haversine({ lat, lng }, b.loc), 'driving') : null;
    sseToCustomer(b.key, 'modebezorg', { ref: b.ref, kind: 'gps', lat, lng, etaMin: eta });
    return { status: 200, ok: true, etaMin: eta };
  }
  // Overdracht: bezorgcode moet kloppen; foto als bewijs; bij dure stukken ID ok.
  function overhandig(code, ref, opts, actor) {
    const b = bezorging(code, ref);
    if (!b) return { status: 404, error: 'Bezorging niet gevonden.' };
    if (KLAAR[b.status]) return { status: 409, error: 'Deze bezorging is al afgerond.' };
    if (String((opts && opts.bezorgcode) || '') !== b.bezorgcode) return { status: 403, error: 'De bezorgcode klopt niet. Vraag de klant om de code uit de app.' };
    if (b.idVereist && !(opts && opts.idOk === true)) return { status: 403, error: 'Dit is een dure levering: bevestig eerst de identiteit aan de deur.' };
    const foto = opts && opts.foto;
    if (foto && typeof foto === 'string' && /^data:image\//.test(foto) && foto.length < 900 * 1024) b.foto = foto;
    b.idOk = !!(opts && opts.idOk);
    b.status = 'afgeleverd';
    b.afgeleverdAt = nu();
    b.stappen.push({ status: 'afgeleverd', at: b.afgeleverdAt, door: (actor && actor.name) || null });
    save();
    notify(b.key, { icon: '✅', title: b.supplierName, body: 'Veilig afgeleverd. Bedankt voor uw aankoop.', scope: 'orders' });
    sseToSupplier(code, 'sync', { scope: 'modebezorg' });
    sseToOffice('sync', { scope: 'modebezorg' });
    return { status: 200, ok: true, status2: b.status };
  }
  // Retour aan de deur (past niet / klant weigert): de koerier neemt het mee terug.
  function retour(code, ref, reden, actor) {
    const b = bezorging(code, ref);
    if (!b) return { status: 404, error: 'Bezorging niet gevonden.' };
    if (KLAAR[b.status]) return { status: 409, error: 'Deze bezorging is al afgerond.' };
    const s = findSupplier(code);
    if (s && !instel(s).retourAanDeur) return { status: 409, error: 'Retour aan de deur staat uit voor deze winkel.' };
    b.status = 'retour'; b.retourReden = schoon(reden, 160) || 'Retour aan de deur';
    b.stappen.push({ status: 'retour', at: nu(), door: (actor && actor.name) || null });
    save();
    notify(b.key, { icon: '↩️', title: b.supplierName, body: 'Uw bezorging is retour genomen. Het bedrag wordt teruggestort.', scope: 'orders' });
    sseToSupplier(code, 'sync', { scope: 'modebezorg' });
    return { status: 200, ok: true };
  }

  /* ---- beelden ---- */
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
      status: b.status, bezorgcode: b.bezorgcode, idVereist: b.idVereist,
      koerier: b.koerier ? b.koerier.naam : null, gps: b.gps || null, etaMin: eta, at: b.at
    };
  }
  function mijnBezorgingen(key) {
    return lijst().filter(b => b.key === key).slice(0, 30).map(klantBeeld);
  }

  return {
    MODEBEZORG_KETEN: KETEN,
    mbSetup: setup, mbInstel: instel, mbMagLeveren: magLeveren, mbAanvraag: aanvraag,
    mbWinkelOverzicht: winkelOverzicht, mbRoute: route, mbNeem: neem, mbGps: gps,
    mbOverhandig: overhandig, mbRetour: retour, mbMijn: mijnBezorgingen
  };
}

module.exports = { maakModebezorg };
