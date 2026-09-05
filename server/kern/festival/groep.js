/* RTG Festival: groepen zijn uitsluitend tussen gasten. RTG stuurt niemand een
   uitnodiging en voegt niemand namens een ander toe. Ieder lid mag de code
   roteren of zelf vertrekken; de organisator leest de groep niet. */
'use strict';

module.exports = (ctx) => {
  const { db, save, bewerkCollectie, crypto, schoon } = ctx;
  const nuIso = () => new Date().toISOString();
  const toegang = require('./groep-toegang')({ crypto, nu: nuIso });
  const MAX_LEDEN = toegang.MAX_LEDEN;
  const DUBBELTIK_MS = 5000;

  const bak = (e) => {
    if (!e.groepen || typeof e.groepen !== 'object') e.groepen = {};
    return e.groepen;
  };
  const isLid = (g, codenaam) => (g.leden || []).some(l => l.codenaam === codenaam);
  const festivals = () => {
    /* model.js is de eigenaar en initialiseert deze collectie voordat groep.js
       wordt samengesteld. Hier lezen we die referentie alleen; de mutaties
       lopen via de collectietransactie hierboven. */
    return db.data.festivals && typeof db.data.festivals === 'object'
      ? db.data.festivals : {};
  };
  const editieIn = (bron, fid, eid) => {
    const f = bron[String(fid || '')];
    return f && f.edities ? f.edities[String(eid || '')] || null : null;
  };
  const herstel = (doel, json) => {
    const oud = JSON.parse(json);
    for (const sleutel of Object.keys(doel)) delete doel[sleutel];
    Object.assign(doel, oud);
  };
  function transactie(werk) {
    const doe = bron => {
      if (!bron || typeof bron !== 'object' || Array.isArray(bron))
        throw new Error('festivals hoort een kaart te zijn');
      toegang.migreerLegacy(bron);
      return werk(bron);
    };
    if (typeof bewerkCollectie === 'function') return bewerkCollectie('festivals', doe);
    const bron = festivals(), voor = JSON.stringify(bron);
    try {
      const antwoord = doe(bron);
      if (antwoord && typeof antwoord.then === 'function')
        throw new Error('festivalgroep-transactie mag niet asynchroon zijn');
      if (JSON.stringify(bron) !== voor) save();
      return antwoord;
    } catch (e) { herstel(bron, voor); throw e; }
  }
  const afdruk = waarde => crypto.createHash('sha256').update(String(waarde || '')).digest('hex');
  const publiek = g => ({
    id: g.id, naam: g.naam, maker: g.maker,
    leden: (g.leden || []).map(l => ({ codenaam: l.codenaam, sinds: l.sinds })),
    beeindigd: g.beeindigd || null, toegang: toegang.publiek(g)
  });
  const uitgifte = (p, code) => Object.assign(publiek(p), { code, eenmalig: true });
  const verstreken = at => Date.now() - Date.parse(at);

  function groepMaak(fid, eid, data, idem) {
    const d = data || {};
    const naam = schoon(d.naam, 60);
    if (!naam) return { status: 400, error: 'Geef de groep een naam.' };
    const maker = schoon(d.maker, 60);
    if (!maker) return { status: 400, error: 'Op wiens codenaam komt deze groep?' };
    const idemWaarde = String(idem || d.idem || '').trim().slice(0, 200);
    return transactie(bron => {
      const e = editieIn(bron, fid, eid);
      if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
      if (Object.keys(bak(e)).length >= 5000)
        return { status: 400, error: 'Er staan te veel groepen op deze editie.' };
      const vinger = afdruk(JSON.stringify({ fid: String(fid), eid: String(eid), naam, maker }));
      const idemHash = idemWaarde ? afdruk('festivalgroep-idem|' + maker + '|' + idemWaarde) : null;
      const tikHash = afdruk('festivalgroep-dubbeltik|' + maker + '|' + vinger);
      const bestaand = Object.values(bak(e)).find(g => g && g.uitgifte && (
        (idemHash && g.uitgifte.idem_hash === idemHash) ||
        (!idemHash && g.uitgifte.dubbeltik_hash === tikHash &&
          verstreken(g.uitgifte.at) >= 0 && verstreken(g.uitgifte.at) < DUBBELTIK_MS)
      ));
      if (bestaand) return { status: 409,
        error: 'Deze groepscode is al eenmalig uitgegeven en wordt niet opnieuw getoond. Vernieuw de code als zij niet is ontvangen.',
        herhaald: true, groep: publiek(bestaand) };
      const g = { id: 'grp' + crypto.randomBytes(8).toString('hex'), naam, maker,
        leden: [{ codenaam: maker, sinds: nuIso() }], beeindigd: null, at: nuIso(),
        toegang_historie: [], uitgifte: { idem_hash: idemHash,
          dubbeltik_hash: idemHash ? null : tikHash, fingerprint_hash: vinger, at: nuIso() } };
      const gemaakt = toegang.nieuw(bron, e, g, maker);
      if (!gemaakt) return { status: 500, error: 'Kon geen unieke groepscode maken.' };
      g.toegang = gemaakt.toegang;
      bak(e)[g.id] = g;
      return { ok: true, groep: uitgifte(g, gemaakt.code) };
    });
  }

  /* Meedoen is een eigen handeling; de route neemt codenaam uit de sessie. */
  function groepDeelnemen(fid, eid, data) {
    const d = data || {};
    const codenaam = schoon(d.codenaam, 60);
    if (!codenaam) return { status: 400, error: 'Wie doet er mee?' };
    const code = String(d.code || '').trim().toUpperCase().slice(0, 100);
    return transactie(bron => {
      if ((fid && !eid) || (!fid && eid)) return { status: 404, error: 'Deze groepscode klopt niet (meer).' };
      if (fid && !editieIn(bron, fid, eid)) return { status: 404, error: 'Deze editie bestaat niet.' };
      const treffers = toegang.zoek(bron, code, fid, eid);
      if (treffers.length !== 1) return { status: 404, error: 'Deze groepscode klopt niet (meer).' };
      const g = treffers[0].g;
      if (toegang.reden(g)) return { status: 404, error: 'Deze groepscode klopt niet (meer).' };
      if (isLid(g, codenaam)) return { ok: true, groep: publiek(g), al: true };
      if ((g.leden || []).length >= MAX_LEDEN)
        return { status: 409, error: 'Deze groep zit vol (' + MAX_LEDEN + ').' };
      g.leden.push({ codenaam, sinds: nuIso() });
      toegang.gebruik(g);
      return { ok: true, groep: publiek(g) };
    });
  }

  /* Weg kan altijd. De laatste die vertrekt beëindigt groep en credential. */
  function groepVerlaat(fid, eid, data) {
    const d = data || {};
    const codenaam = schoon(d.codenaam, 60);
    return transactie(bron => {
      const e = editieIn(bron, fid, eid);
      if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
      const g = bak(e)[String(d.id || '')];
      if (!g || g.beeindigd || !isLid(g, codenaam)) return { status: 404, error: 'Deze groep bestaat niet.' };
      g.leden = g.leden.filter(l => l.codenaam !== codenaam);
      if (!g.leden.length) {
        g.beeindigd = nuIso();
        toegang.intrekken(g, codenaam, 'laatste lid heeft de groep verlaten');
      }
      return { ok: true, groep: publiek(g) };
    });
  }

  /* Elk lid mag vernieuwen; er is geen groepshoofd. */
  function groepCodeVernieuw(fid, eid, data, idem) {
    const d = data || {};
    const codenaam = schoon(d.codenaam, 60);
    const idemWaarde = String(idem || d.idem || '').trim().slice(0, 200);
    return transactie(bron => {
      const e = editieIn(bron, fid, eid);
      if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
      const g = bak(e)[String(d.id || '')];
      if (!g || g.beeindigd || !isLid(g, codenaam)) return { status: 404, error: 'Deze groep bestaat niet.' };
      const vinger = afdruk(JSON.stringify({ fid: String(fid), eid: String(eid), id: g.id, codenaam }));
      const idemHash = idemWaarde ? afdruk('festivalgroep-roteer-idem|' + codenaam + '|' + idemWaarde) : null;
      const tikHash = afdruk('festivalgroep-roteer-dubbeltik|' + codenaam + '|' + vinger);
      const laatst = g.laatste_rotatie;
      if (laatst && ((idemHash && laatst.idem_hash === idemHash) ||
          (!idemHash && laatst.dubbeltik_hash === tikHash &&
            verstreken(laatst.at) >= 0 && verstreken(laatst.at) < DUBBELTIK_MS))) {
        return { status: 409,
          error: 'Deze nieuwe groepscode is al eenmalig getoond en wordt niet herhaald.',
          herhaald: true, groep: publiek(g) };
      }
      const gemaakt = toegang.roteer(bron, e, g, codenaam);
      if (!gemaakt) return { status: 500, error: 'Kon geen unieke groepscode maken.' };
      g.laatste_rotatie = { idem_hash: idemHash, dubbeltik_hash: idemHash ? null : tikHash,
        fingerprint_hash: vinger, at: nuIso() };
      return { ok: true, groep: uitgifte(g, gemaakt.code) };
    });
  }

  /* Alleen een lid ziet de stand; zonderPas blijft een getal, geen aansporing. */
  function groepStand(fid, eid, id, codenaam) {
    const wie = schoon(codenaam, 60);
    return transactie(bron => {
      const e = editieIn(bron, fid, eid);
      if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
      const g = bak(e)[String(id || '')];
      if (!g || g.beeindigd || !isLid(g, wie)) return { status: 404, error: 'Deze groep bestaat niet.' };
      const passen = Object.values(e.passen || {});
      const leden = g.leden.map(l => ({ codenaam: l.codenaam, sinds: l.sinds,
        heeftPas: passen.some(p => !p.ingetrokken && p.drager === l.codenaam) }));
      return { ok: true, id: g.id, naam: g.naam, maker: g.maker, toegang: toegang.publiek(g),
        leden, zonderPas: leden.filter(l => !l.heeftPas).length };
    });
  }

  const groepenVan = (e, codenaam) => Object.values((e && e.groepen) || {})
    .filter(g => !g.beeindigd && isLid(g, codenaam)).map(publiek);

  /* Alleen intern: een gast zonder bestaand festival kan met een code meedoen.
     Bij nul of meerdere treffers wordt niet gegokt. */
  function groepEditieVanCode(code) {
    const c = schoon(code, 100);
    if (!c) return null;
    const bron = festivals();
    const treffers = toegang.zoek(bron, c).filter(x => !toegang.reden(x.g))
      .map(x => ({ fid: x.f.id, eid: x.e.id }));
    if (!treffers.length) return null;
    if (treffers.length > 1) return { meerdere: true };
    return treffers[0];
  }

  return { groepMaak, groepDeelnemen, groepVerlaat, groepCodeVernieuw, groepStand,
    groepEditieVanCode,
    groepenVan, GROEP_MAX: MAX_LEDEN };
};
