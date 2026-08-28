/* Kern-module "oog": RTG Eye, de camerabril van de werkvloer. De kijklogica
   zelf draait volledig op het toestel (public/apps/oog.html: een eigen
   canvas-visielaag, er verlaat geen beeld het toestel); hier staat alleen wat
   de zaak moet onthouden:

   - de schouw: een chauffeur richt de PDA op het voertuig, de visielaag
     vergelijkt met de vastgelegde nulmeting en levert per zone een score.
     Het resultaat komt hier binnen als compacte, gecodeerde regel (geen
     foto's) en telt als journaalregel: loopt het verkeer via een Zaakdoos,
     dan neemt de doos-proxy hem vanzelf op in het doos-journaal.
   - de nulmeting: per voertuig een handtekening (vector van zonewaarden),
     gedeeld tussen alle PDA's van de zaak.
   - de werkvloer: aangeleerde spullen (kleur/vorm-handtekening) en het
     uitgifteregister: wie nam wat mee, en wanneer het terugkwam. De richting
     wisselt vanzelf (mee -> terug), zonder knop.

   maakOog(state) volgt het vaste kern-patroon. */

const SCHOUW_MAX = 300;      // schouwregels per zaak
const UITGIFTE_MAX = 500;    // uitgifteregels per zaak
const SPULLEN_MAX = 60;      // aangeleerde spullen per zaak
const SIG_MAX = 96;          // een handtekening is een korte vector, geen foto

function maakOog({ db, save, crypto, schoon, sseToSupplier, logActivity }) {
  const id = (p) => (p || 'og') + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();

  const eigen = require('./eigencollectie')({ db, domein: 'kern/oog', bezit: {
    oogNulmeting: 'kaart',   // code -> { voertuigId -> { sig, at, door } }
    oogSchouwen: 'kaart',    // code -> [regels]
    oogSpullen: 'kaart',     // code -> [items]
    oogUitgifte: 'kaart'     // code -> [regels]
  } });
  // een handtekening is een compacte vector getallen; alles anders weigeren we
  function schoneSig(sig) {
    if (!Array.isArray(sig) || !sig.length || sig.length > SIG_MAX) return null;
    const uit = sig.map(Number);
    return uit.every(Number.isFinite) ? uit.map(n => Math.round(n * 1000) / 1000) : null;
  }

  /* ---- de voertuigen van de zaak (vloot + vrije invoer bij de schouw) ---- */
  function voertuigen(s) {
    return (s.fleet || []).map(v => ({ id: v.id, naam: v.name + (v.plate ? ' · ' + v.plate : ''), nulmeting: !!((eigen.bak('oogNulmeting')[s.code] || {})[v.id]) }));
  }

  /* ---- de schouw ---- */
  function nulmetingZet(s, actor, data) {
    const vid = schoon(data.voertuigId, 40); if (!vid) return { status: 400, error: 'Kies een voertuig.' };
    const sig = schoneSig(data.sig); if (!sig) return { status: 400, error: 'Geen geldige meting.' };
    const nm = eigen.bak('oogNulmeting');
    const per = nm[s.code] = nm[s.code] || {};
    per[vid] = { sig, at: nu(), door: actor && actor.name || null };
    save();
    return { status: 200, ok: true };
  }
  function nulmetingVan(s, vid) { return (eigen.bak('oogNulmeting')[s.code] || {})[String(vid || '')] || null; }
  function schouwLog(s, actor, data) {
    const naam = schoon(data.voertuigNaam, 60) || 'Voertuig';
    const zones = Array.isArray(data.zones) ? data.zones.slice(0, 12).map(z => ({
      zone: schoon(z.zone, 20), score: Math.round(Number(z.score) || 0), oordeel: z.oordeel === 'afwijking' ? 'afwijking' : 'schoon'
    })) : [];
    const afwijkingen = zones.filter(z => z.oordeel === 'afwijking').length;
    const regel = { id: id('sw'), voertuigId: schoon(data.voertuigId, 40) || null, voertuigNaam: naam,
      door: actor && actor.name || 'PDA', zones, afwijkingen,
      oordeel: afwijkingen ? 'afwijking' : 'schoon', notitie: schoon(data.notitie, 200) || null, at: nu() };
    const sw = eigen.bak('oogSchouwen');
    const rij = sw[s.code] = sw[s.code] || [];
    rij.push(regel); if (rij.length > SCHOUW_MAX) sw[s.code] = rij.slice(-SCHOUW_MAX);
    save();
    if (logActivity) logActivity(s.code, actor, 'RTG Eye: schouw ' + naam + ': ' + (afwijkingen ? afwijkingen + ' afwijking(en)' : 'schoon'));
    sseToSupplier(s.code, 'sync', { scope: 'oog' });
    return { status: 200, ok: true, regel };
  }
  function schouwen(s, vid) {
    let rij = (eigen.bak('oogSchouwen')[s.code] || []);
    if (vid) rij = rij.filter(r => r.voertuigId === vid);
    return rij.slice(-40).reverse();
  }

  /* ---- de werkvloer: aanleren en het uitgifteregister ---- */
  function leer(s, actor, data) {
    const naam = schoon(data.naam, 40); if (!naam) return { status: 400, error: 'Geef het een naam.' };
    const sig = schoneSig(data.sig); if (!sig) return { status: 400, error: 'Geen geldige handtekening.' };
    const sp = eigen.bak('oogSpullen');
    const rij = sp[s.code] = sp[s.code] || [];
    if (data.weg) { sp[s.code] = rij.filter(x => x.id !== data.id); save(); return { status: 200, ok: true }; }
    if (rij.length >= SPULLEN_MAX) return { status: 409, error: 'Tot ' + SPULLEN_MAX + ' aangeleerde spullen per zaak.' };
    const item = { id: id('sp'), naam, sig, door: actor && actor.name || null, at: nu() };
    rij.push(item); save();
    return { status: 200, ok: true, item: { id: item.id, naam: item.naam } };
  }
  function spullen(s) {
    return (eigen.bak('oogSpullen')[s.code] || []).map(x => ({ id: x.id, naam: x.naam, sig: x.sig }));
  }
  // zonder knop: het oog zag een aangeleerd item; de richting wisselt vanzelf
  function uitgifteLog(s, actor, data) {
    const item = (eigen.bak('oogSpullen')[s.code] || []).find(x => x.id === String(data.itemId || ''));
    if (!item) return { status: 404, error: 'Onbekend item; leer het eerst aan.' };
    const ug = eigen.bak('oogUitgifte');
    const rij = ug[s.code] = ug[s.code] || [];
    const wie = actor && actor.name || 'PDA';
    const laatste = [...rij].reverse().find(r => r.itemId === item.id);
    // dezelfde persoon die het item binnen 20 seconden opnieuw toont is dezelfde
    // waarneming, geen nieuwe beweging
    if (laatste && laatste.door === wie && Date.now() - new Date(laatste.at).getTime() < 20000)
      return { status: 200, ok: true, regel: laatste, dubbel: true };
    // de richting volgt het item: is het buiten, dan is tonen = terugbrengen
    const richting = laatste && laatste.richting === 'mee' ? 'terug' : 'mee';
    const regel = { id: id('ui'), itemId: item.id, itemNaam: item.naam, door: wie, richting, at: nu() };
    rij.push(regel); if (rij.length > UITGIFTE_MAX) ug[s.code] = rij.slice(-UITGIFTE_MAX);
    save();
    if (logActivity) logActivity(s.code, actor, 'RTG Eye: ' + wie + ' ' + (richting === 'mee' ? 'neemt mee' : 'brengt terug') + ': ' + item.naam);
    sseToSupplier(s.code, 'sync', { scope: 'oog' });
    return { status: 200, ok: true, regel };
  }
  function overzicht(s) {
    const uit = (eigen.bak('oogUitgifte')[s.code] || []);
    const buiten = {};
    for (const r of uit) buiten[r.itemId] = r.richting === 'mee' ? r : null;
    return {
      schouwen: schouwen(s), uitgifte: uit.slice(-40).reverse(),
      spullen: (eigen.bak('oogSpullen')[s.code] || []).map(x => ({ id: x.id, naam: x.naam })),
      nogBuiten: Object.values(buiten).filter(Boolean).map(r => ({ itemNaam: r.itemNaam, door: r.door, sinds: r.at }))
    };
  }

  return { oogVoertuigen: voertuigen, oogNulmetingZet: nulmetingZet, oogNulmetingVan: nulmetingVan,
    oogSchouwLog: schouwLog, oogSchouwen: schouwen, oogLeer: leer, oogSpullen: spullen,
    oogUitgifteLog: uitgifteLog, oogOverzicht: overzicht };
}

module.exports = { maakOog };
