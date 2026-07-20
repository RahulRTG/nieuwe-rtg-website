/* Het gezamenlijke rampbeeld: tijdens een grote calamiteit delen de
   hulpdiensten, de zorg en defensie hun paraatheid in EEN overzicht, zodat
   niemand blind coordineert. Het beeld telt live over de korpsen heen:

   - korpsen (politie, brandweer, ambulance, special forces): vrije en
     ingezette eenheden over land, water en lucht;
   - ziekenhuizen: vrije bedden en de drukte op de eerste hulp (SEH);
   - defensie: paraatheid van eenheden en het veldhospitaal;
   - de open meldingen die nog om een eenheid vragen.

   Coordinatieniveau: normaal -> incident -> opgeschaald -> ramp. Wie in de
   keten zit (of de boardroom) ziet het beeld van de eigen keten-partners;
   de boardroom ziet alles. Puur coordinatie van hulp: geen offensieve
   functie, geen klantdata, alleen operationele paraatheid. Dit is de
   orkestrator: het niveau schalen, het beeld bouwen en de keten-toegang wonen
   hier; het naoefening-rapport in ./evaluatie, de AI-coordinator in ./advies. */

const NIVEAUS = ['normaal', 'incident', 'opgeschaald', 'ramp'];
const KORPS_TYPES = ['politie', 'brandweer', 'ambulance', 'specials'];

module.exports = ({ db, save, findSupplier, anthropic }) => {
  const nu = () => Date.now();
  const lijst = x => Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.values(x) : []);
  function hulp() { if (!db.data.hulp) db.data.hulp = {}; return db.data.hulp; }

  // de keten-partners van een korps (akkoord-verbindingen uit de ketenchat)
  function partnersVan(code) {
    const links = ((hulp().keten || {}).links) || [];
    return links.filter(l => l.status === 'akkoord' && (l.a === code || l.b === code)).map(l => l.a === code ? l.b : l.a);
  }

  // het beeld voor een set codes (of alle hulp/zorg/defensie voor de boardroom)
  function beeldVoor(codes) {
    const set = codes ? new Set(codes) : null;
    const h = hulp();
    const isIn = s => set ? set.has(s.code) : true;
    const suppliers = (db.data.suppliers || []);
    const korpsen = [], ziekenhuizen = [], defensie = [];
    let eenhedenVrij = 0, eenhedenIn = 0, beddenVrij = 0, sehWachtend = 0;

    for (const s of suppliers) {
      if (!isIn(s)) continue;
      if (KORPS_TYPES.includes(s.type)) {
        const eh = (h.eenheden || {})[s.code] || [];
        const vrij = eh.filter(e => e.status === 'vrij').length;
        const inzet = eh.filter(e => e.status === 'onderweg' || e.status === 'ter-plaatse').length;
        eenhedenVrij += vrij; eenhedenIn += inzet;
        korpsen.push({ code: s.code, naam: s.name, soort: s.type, vrij, inzet, totaal: eh.length,
          perSoort: ['land', 'water', 'lucht', 'heli'].map(k => ({ soort: k, vrij: eh.filter(e => e.soort === k && e.status === 'vrij').length })).filter(x => x.vrij) });
      } else if (s.type === 'ziekenhuis') {
        const bed = (h.bedden || {})[s.code] || { totaal: 0, bezet: 0 };
        const vrij = Math.max(0, (bed.totaal || 0) - (bed.bezet || 0));
        const wacht = ((h.seh || {})[s.code] || []).filter(p => p.status === 'wacht').length;
        beddenVrij += vrij; sehWachtend += wacht;
        ziekenhuizen.push({ code: s.code, naam: s.name, beddenVrij: vrij, beddenTotaal: bed.totaal || 0, sehWachtend: wacht });
      } else if (s.type === 'defensie') {
        const d = (db.data.defensie || {})[s.code] || {};
        const ee = d.eenheden || [];
        defensie.push({ code: s.code, naam: s.name,
          gevechtsgereed: ee.filter(e => e.paraat === 'gevechtsgereed').length,
          beperkt: ee.filter(e => e.paraat === 'beperkt').length,
          gewonden: (d.gewonden || []).filter(g => g.status !== 'ontslagen' && g.status !== 'geevacueerd').length });
      }
    }
    const meldingenOpen = lijst(h.meldingen).filter(m => m.status !== 'afgerond' && (!set || set.has(m.korps))).length;
    return {
      korpsen, ziekenhuizen, defensie,
      totalen: { eenhedenVrij, eenhedenIngezet: eenhedenIn, beddenVrij, sehWachtend, meldingenOpen }
    };
  }

  /* De stad-naad (laat gebonden: RTG Stad wordt na dit rampbeeld gemount).
     Tijdens een calamiteit hoort de staat van de stad -- het scenario, de
     bord-waarschuwingen, de vloot -- bij het gezamenlijke beeld: puur
     operationele toestand, geen persoonsgegevens (de stad meet dingen, geen
     mensen), dus de hele keten mag hem zien. */
  let stadFoto = null;
  function koppelStad(fn) { if (typeof fn === 'function') stadFoto = fn; }

  /* Het rampbeeld voor een viewer. Een korps ziet zichzelf plus de
     keten-partners; de boardroom (viewerCode null) ziet alles. */
  function beeld(viewerCode) {
    let codes = null;
    if (viewerCode) {
      const self = findSupplier(viewerCode);
      const magZien = self && (KORPS_TYPES.includes(self.type) || ['ziekenhuis', 'huisarts', 'defensie', 'apotheek', 'specialist', 'beautymedical'].includes(self.type));
      if (!magZien) return { status: 403, error: 'Alleen hulpdiensten, zorg en defensie delen het rampbeeld.' };
      codes = [viewerCode, ...partnersVan(viewerCode)];
      if (codes.length === 1) return { status: 409, error: 'Verbind eerst met een ander korps in de keten; daarna deelt u het rampbeeld.' };
    }
    let stad = null;
    if (stadFoto) { try { stad = stadFoto(); } catch (e) {} }
    return { ok: true, ramp: hulp().ramp || { niveau: 'normaal', sinds: null, door: null }, stad, ...beeldVoor(codes) };
  }

  /* Het niveau op- of afschalen. Blijft bij de keten en de boardroom; wordt
     met naam en tijd vastgelegd. */
  function schaal(niveau, door) {
    if (!NIVEAUS.includes(niveau)) return { status: 400, error: 'Kies: ' + NIVEAUS.join(', ') + '.' };
    const h = hulp();
    const vorig = (h.ramp && h.ramp.niveau) || 'normaal';
    h.ramp = { niveau, sinds: nu(), door: String(door || 'coordinatie').replace(/[<>]/g, '').slice(0, 40) };
    // het niveauverloop bewaren, zodat het rapport de tijdlijn kan tonen
    if (!Array.isArray(h.rampLog)) h.rampLog = [];
    h.rampLog.push({ niveau, door: h.ramp.door, at: nu() });
    if (h.rampLog.length > 200) h.rampLog.shift();
    save();
    const uit = { ok: true, ramp: h.ramp };
    // bij AFSCHALEN naar normaal komt het naoefening-rapport meteen mee
    if (niveau === 'normaal' && vorig !== 'normaal') uit.evaluatie = ctx.evaluatieRaw(null);
    return uit;
  }

  // de gedeelde ctx voor de deelbestanden
  const ctx = { db, save, findSupplier, anthropic, nu, lijst, hulp, partnersVan, beeldVoor, beeld, NIVEAUS, KORPS_TYPES };
  const api = { NIVEAUS, beeld, schaal, koppelStad };
  Object.assign(api, require('./evaluatie')(ctx)); // vult ctx.evaluatieRaw
  Object.assign(api, require('./advies')(ctx));
  return { rampbeeld: api };
};
