'use strict';
const V = require('./praktijk-vorm');
const { tenantVoor, tenantOpen } = require('./productie-identiteit');
module.exports = ({ crypto, rid, nu, log, db, rechtenVan }) => {
  const hash = s => crypto.createHash('sha256').update(s).digest('hex');
  function delen(w, actor, b) {
    const p = V.project(w, b.projectId), x = V.details(w, p);
    if (!p) return V.fout('Deze vraag is niet gevonden.', 404);
    if (b.versie !== x.versie) return V.fout('Het werk is gewijzigd. Vernieuw eerst.', 409);
    if (b.intrekken !== true && !['voorstel', 'bevestigd', 'ingepland', 'uitgevoerd', 'afgerond'].includes(x.stand))
      return V.fout('Maak eerst een voorstel.', 409);
    const dagen = b.dagen == null ? 7 : b.dagen;
    if (!Number.isInteger(dagen) || dagen < 1 || dagen > 7) return V.fout('Kies één tot zeven dagen.');
    for (const d of Object.values(w.praktijkDelen || {})) if (d.projectId === p.id) d.ingetrokken = true;
    if (b.intrekken === true) { log(w, actor, 'praktijk-link-ingetrokken', p.id); return { ok: true }; }
    const id = rid(16), token = crypto.randomBytes(32).toString('base64url');
    const d = { id, projectId: p.id, hash: hash(token), verloopt: Date.now() + dagen * 864e5,
      uitgegevenDoor: actor.id || null, versie: x.versie, ingetrokken: false };
    (w.praktijkDelen || (w.praktijkDelen = {}))[id] = d;
    log(w, actor, 'praktijk-link-gemaakt', p.id);
    return { ok: true, link: '/apps/werk.html#gast=' + w.code + '.' + id + '.' + token,
      verloopt: d.verloopt, let: 'Iedereen met deze link kan dit voorstel zien en beantwoorden. Deel hem alleen met uw klant.' };
  }
  function gast(b) {
    if (typeof b.sleutel !== 'string' || b.sleutel.length > 150) return null;
    const [code, id, token, extra] = b.sleutel.split('.');
    if (extra || !/^[a-f0-9]{32}$/.test(id || '') || !/^[\w-]{43}$/.test(token || '')) return null;
    const w = V.pak(db.data.werkruimtes, code), d = w && V.pak(w.praktijkDelen, id);
    if (!d || d.ingetrokken || d.verloopt <= Date.now() || !tenantOpen(tenantVoor(db.data, code))) return null;
    if (!/^[a-f0-9]{64}$/.test(d.hash || '') ||
        !crypto.timingSafeEqual(Buffer.from(d.hash, 'hex'), Buffer.from(hash(token), 'hex'))) return null;
    if (d.uitgegevenDoor) {
      const l = V.pak(w.leden, d.uitgegevenDoor);
      if (!l || l.status !== 'actief' || l.extern || !rechtenVan ||
          !['werkruimte', 'project', 'klant'].every(r => rechtenVan(l).includes(r))) return null;
    }
    const p = V.project(w, d.projectId), x = V.details(w, p);
    if (!p || x.stand === 'geannuleerd') return null;
    return { w, d, p, x };
  }
  const gastBeeld = ({ w, d, p, x }) => ({ ok: true, organisatie: w.naam, titel: p.naam,
    omschrijving: x.omschrijving, voorstel: x.voorstel, bedragMinor: x.bedragMinor, valuta: x.valuta, decimalen: x.decimalen,
    stand: x.stand, datum: x.datum, tijdzone: x.tijdzone, locatie: x.locatie,
    onderdelen: Object.values(w.taken || {}).filter(t => t.projectId === p.id && t.externeAfspraak).map(t => ({
      titel: t.titel, datum: t.deadline, stand: t.externeAfspraak.stand, herkomst: 'handmatig vastgelegd' })),
    versie: x.versie, verloopt: d.verloopt, magAntwoorden: x.stand === 'voorstel' && d.versie === x.versie });
  function besluit(g, b) {
    const { w, d, p, x } = g;
    if (x.stand !== 'voorstel' || d.versie !== x.versie || b.versie !== x.versie)
      return V.fout('Dit voorstel is gewijzigd of al beantwoord. Vraag het actuele voorstel op.', 409);
    if (!['akkoord', 'afwijzen'].includes(b.keuze)) return V.fout('Kies akkoord of afwijzen.');
    x.stand = b.keuze === 'akkoord' ? 'bevestigd' : 'afgewezen';
    x.akkoord = { bron: 'gastlink', keuze: b.keuze, at: nu(), linkId: d.id };
    const kans = V.pak(w.kansen, p.praktijkRef);
    kans.fase = b.keuze === 'akkoord' ? 'gewonnen' : 'verloren';
    kans.historie.push({ van: 'offerte', naar: kans.fase, door: 'gastlink:' + d.id, at: nu() });
    x.versie++;
    log(w, { id: 'gastlink:' + d.id, naam: 'Ontvanger van gastlink' }, 'praktijk-' + b.keuze, p.id);
    return { ok: true, stand: x.stand };
  }
  return { delen, gast, gastBeeld, besluit };
};
