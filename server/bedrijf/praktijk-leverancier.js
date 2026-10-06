'use strict';
// De opdracht blijft een bestaande projecttaak. De leverancier ziet uitsluitend
// die opdracht; zijn antwoord is de bron voor de bevestiging, niet een klik van
// de opdrachtgever. Een prijswijziging vraagt een nieuwe opdracht.
const V = require('./praktijk-vorm');
const { gastWerkruimte } = require('./productie-identiteit');
const RECHTEN = require('./praktijk-geldrechten');
module.exports = ({ db, crypto, rid, nu, log, rechtenVan }) => {
  const hash = s => crypto.createHash('sha256').update(s).digest('hex');
  const open = x => ['bevestigd', 'ingepland'].includes(x.stand);
  function trekIn(w, taakId) {
    for (const d of Object.values(w.praktijkDelen || {}))
      if (d.doel === 'werk.leverancier@1' && d.taakId === taakId) d.ingetrokken = true;
  }
  function link(w, actor, p, t) {
    trekIn(w, t.id);
    const id = rid(16), token = crypto.randomBytes(32).toString('base64url'), uitgegeven = Date.now();
    const d = { id, hash: hash(token), issuer: 'rtg.workos', doel: 'werk.leverancier@1',
      projectId: p.id, taakId: t.id, versie: t.externeAfspraak.versie, gebruik: 0,
      uitgegeven, verloopt: uitgegeven + 7 * 864e5, uitgegevenDoor: actor.id || null };
    (w.praktijkDelen || (w.praktijkDelen = {}))[id] = d;
    return { ok: true, taakId: t.id, link: '/apps/werk.html#leverancier=' + w.code + '.' + id + '.' + token,
      verloopt: d.verloopt, let: 'Deze link geeft toegang tot één leveranciersopdracht. Deel hem alleen met de uitvoerende partij.' };
  }
  function handeling(g, b) {
    if (g.alleenLezen || g.l.extern || !RECHTEN.every(r => g.rechten?.includes(r)))
      return V.fout('Een leveranciersopdracht vraagt beheer-, project-, klant- en financiële goedkeuringsrechten.', 403);
    const { w, l: actor } = g, p = V.project(w, b.projectId), x = V.details(w, p);
    if (!p) return V.fout('Deze vraag is niet gevonden.', 404);
    if (!open(x) || b.versie !== x.versie) return V.fout('Het werk is gewijzigd of niet gereed voor een leveranciersopdracht. Vernieuw eerst.', 409);
    let t = V.pak(w.taken, b.taakId);
    if (b.actie === 'aanvragen') {
      if (!V.tekst(b.leverancier, 80) || !V.tekst(b.onderdeel, 120) || !V.tekst(b.voorwaarden, 1000) ||
          !V.tekst(b.locatie, 200) || !V.datum(b.datum) || !V.prijs(b.bedragMinor))
        return V.fout('Vul leverancier, opdracht, datum, locatie, totaalprijs en voorwaarden in.');
      if (Object.values(w.taken || {}).filter(z => z.projectId === p.id).length >= 100)
        return V.fout('Maximaal 100 onderdelen per vraag.', 429);
      t = { id: rid(8), projectId: p.id, ouderId: null, wachtOp: [], uren: 0, urenlijst: [],
        prioriteit: 'normaal', at: nu(), titel: V.tekst(b.onderdeel, 120), wie: V.tekst(b.leverancier, 80),
        deadline: b.datum, kolom: 'te doen', externeAfspraak: { herkomst: 'rtg-aanvraag', stand: 'aangevraagd',
          versie: 1, voorwaarden: V.tekst(b.voorwaarden, 1000), locatie: V.tekst(b.locatie, 200),
          bedragMinor: b.bedragMinor, valuta: x.valuta, decimalen: x.decimalen, tijdzone: x.tijdzone,
          vastgelegdDoor: actor.id || actor.naam, at: nu() } };
      (w.taken || (w.taken = {}))[t.id] = t; x.versie++;
      log(w, actor, 'leveranciersopdracht-aangevraagd', t.id);
      return { ...link(w, actor, p, t), versie: x.versie };
    }
    if (!t || t.projectId !== p.id || t.externeAfspraak?.herkomst !== 'rtg-aanvraag')
      return V.fout('Deze leveranciersopdracht is niet gevonden.', 404);
    const a = t.externeAfspraak;
    if (b.actie === 'link' && ['aangevraagd', 'annulering-gevraagd'].includes(a.stand)) return link(w, actor, p, t);
    if (b.actie === 'intrekken' && a.stand === 'aangevraagd') {
      a.stand = 'ingetrokken'; t.geannuleerd = true; trekIn(w, t.id);
    } else if (b.actie === 'annuleren' && a.stand === 'bevestigd') {
      if (!V.tekst(b.toelichting, 500)) return V.fout('Noteer waarom u de boeking wilt annuleren.');
      a.stand = 'annulering-gevraagd'; a.annuleringsreden = V.tekst(b.toelichting, 500);
    } else if (b.actie === 'uitgevoerd' && a.stand === 'bevestigd') {
      if (!V.tekst(b.toelichting, 500)) return V.fout('Noteer wat daadwerkelijk is uitgevoerd.');
      a.stand = 'uitgevoerd'; a.uitvoering = V.tekst(b.toelichting, 500);
      t.kolom = 'klaar'; t.klaarAt = nu(); t.klaarDoor = actor.id || actor.naam;
    } else return V.fout('Deze handeling past niet bij de actuele leveranciersstatus.', 409);
    a.versie++; x.versie++; a.at = nu(); log(w, actor, 'leveranciersopdracht-' + b.actie, t.id);
    return { ok: true, taakId: t.id, versie: x.versie,
      ...(a.stand === 'annulering-gevraagd' ? link(w, actor, p, t) : {}) };
  }
  function gast(b) {
    if (typeof b.sleutel !== 'string' || b.sleutel.length > 150) return null;
    const [code, id, token, extra] = b.sleutel.split('.');
    if (extra || !/^[a-f0-9]{32}$/.test(id || '') || !/^[\w-]{43}$/.test(token || '')) return null;
    const w = gastWerkruimte(db, code), d = w && V.pak(w.praktijkDelen, id), now = Date.now();
    if (!d || d.ingetrokken || d.issuer !== 'rtg.workos' || d.doel !== 'werk.leverancier@1' ||
        !Number.isFinite(d.uitgegeven) || !Number.isFinite(d.verloopt) || d.uitgegeven > now ||
        d.verloopt <= now || d.verloopt <= d.uitgegeven || d.verloopt - d.uitgegeven > 7 * 864e5 ||
        !/^[a-f0-9]{64}$/.test(d.hash || '') ||
        !crypto.timingSafeEqual(Buffer.from(d.hash, 'hex'), Buffer.from(hash(token), 'hex'))) return null;
    if (d.uitgegevenDoor) {
      const l = V.pak(w.leden, d.uitgegevenDoor);
      if (!l || l.status !== 'actief' || l.extern || !RECHTEN.every(r => rechtenVan(l).includes(r))) return null;
    } else if (process.env.NODE_ENV === 'production') return null;
    const p = V.project(w, d.projectId), x = V.details(w, p), t = V.pak(w.taken, d.taakId);
    if (!p || !open(x) || !t || t.projectId !== p.id || t.externeAfspraak?.herkomst !== 'rtg-aanvraag') return null;
    return { w, d, p, x, t };
  }
  function beeld({ w, d, t }) {
    const a = t.externeAfspraak;
    return { ok: true, organisatie: w.naam, leverancier: t.wie, titel: t.titel, datum: t.deadline,
      voorwaarden: a.voorwaarden, locatie: a.locatie, tijdzone: a.tijdzone, bedragMinor: a.bedragMinor,
      valuta: a.valuta, decimalen: a.decimalen, stand: a.stand, versie: a.versie,
      annuleringsreden: a.annuleringsreden || null,
      magAntwoorden: d.gebruik === 0 && d.versie === a.versie && ['aangevraagd', 'annulering-gevraagd'].includes(a.stand) };
  }
  function besluit(g, b) {
    const { w, d, x, t } = g, a = t.externeAfspraak;
    if (!beeld(g).magAntwoorden || b.versie !== a.versie) return V.fout('Deze opdracht is gewijzigd of al beantwoord.', 409);
    if (!['bevestigen', 'weigeren'].includes(b.keuze) || !V.tekst(b.naam, 80) || !V.tekst(b.referentie, 200))
      return V.fout('Geef uw naam, keuze en bevestigingsreferentie of toelichting.');
    const annulering = a.stand === 'annulering-gevraagd';
    a.stand = b.keuze === 'bevestigen' ? (annulering ? 'geannuleerd' : 'bevestigd') : (annulering ? 'bevestigd' : 'afgewezen');
    a.antwoord = { naam: V.tekst(b.naam, 80), referentie: V.tekst(b.referentie, 200), at: nu(),
      bron: 'leverancierslink', keuze: b.keuze, annulering, linkId: d.id };
    t.geannuleerd = ['geannuleerd', 'afgewezen'].includes(a.stand);
    a.versie++; x.versie++; d.gebruik++;
    log(w, { id: 'leverancierslink:' + d.id, naam: a.antwoord.naam }, 'leveranciersopdracht-' + a.stand, t.id);
    return { ok: true, stand: a.stand };
  }
  return { handeling, gast, beeld, besluit };
};
