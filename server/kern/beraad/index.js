/* ============================================================================
   HET BERAAD (B3) -- samen overleggen en besluiten binnen een genootschap.

   GEMEENSCHAP-FASE0.md par. 4.3. Een beraad hangt aan een DRAGER (vandaag
   alleen een genootschap; het verbond is B2 en bestaat nog niet) en bezit geen
   leden: wie meedoet, is wie NU lid is van die drager. Er is dus geen tweede
   ledenlijst die uit de pas kan lopen met het genootschap.

   WIE WAT MAG:
   - openen, inbrengen, een voorstel schrijven, stemmen: elk lid;
   - naar stemmen, sluiten, intrekken, heropenen: wie het beraad opende of een
     beheerder van het genootschap;
   - een nieuw voorstel TIJDENS het stemmen (dat zet de stemmen terug): alleen
     die twee, anders kan elk lid een lopende stemming eindeloos resetten.
   De actor komt altijd uit de sessie (`sess.key`) en nooit uit het verzoek.

   WIE GEEN LID IS, krijgt 404 en geen 403: "dit beraad bestaat niet" en "je
   mag het niet zien" zijn voor een buitenstaander hetzelfde antwoord, anders
   verraadt het verschil dat een geheim genootschap overlegt.

   HERHALEN DOET NIETS. Een tweede sluiting geeft hetzelfde antwoord en stuurt
   niemand een tweede bericht -- de vorm van de afgelast-reparatie uit fase 1a
   (besluit 5): de eerste geldige handeling blijft leidend, en de bevoegdheid
   wordt EERST getoetst, zodat wie niet mag sluiten ook geen ok krijgt.
   ========================================================================== */
'use strict';

const { keur } = require('../veilig');
const S = require('./standen');
const { maakSchrijver } = require('./ronde');
const { maakZicht } = require('./zicht');
const { maakTerugkoppeling } = require('./terugkoppeling');

module.exports = ({ db, save, codenaamVan, notify, genootschap, nu = Date.now }) => {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/beraad/index', bezit: { beraad: 'kaart' } });
  const lijstSchrijf = () => { const g = eigen.bak('beraad'); if (!Array.isArray(g.lijst)) g.lijst = []; return g.lijst; };
  const lijstKijk = () => { const g = eigen.kijk('beraad'); return Array.isArray(g.lijst) ? g.lijst : []; };
  const schr = maakSchrijver({ nu });
  const zicht = maakZicht({ codenaamVan });
  const { wek, mijn, gezien } = maakTerugkoppeling({ notify, save, schr, zicht, lijstKijk, genootschap });

  const NIET = { status: 404, error: 'Dit beraad ken ik niet, of je bent geen lid van het genootschap waarin het loopt.' };
  const tekstVan = (t, max) => String(t == null ? '' : t).slice(0, max).trim();
  const gekeurd = (t) => { const k = keur(t); return k.ok ? null : { status: 400, error: k.reden }; };

  /* De poort: bestaat het beraad, en is deze sessie lid van zijn drager? */
  function poort(sess, id) {
    const b = lijstKijk().find(x => String(x.id) === String(id == null ? '' : id));
    if (!b || !sess || !sess.key) return NIET;
    const gr = genootschap.groepMet(b.drager.id);
    if (!gr || !genootschap.isLid(gr, sess.key)) return NIET;
    return { b, gr, regie: b.door === sess.key || genootschap.isBeheer(gr, sess.key) };
  }
  const geenRegie = { status: 403, error: 'Dit doet wie het beraad opende, of een beheerder van het genootschap.' };

  function quorumVan(gr, gevraagd) {
    const leden = (gr.leden || []).length || 1;
    const q = Number(gevraagd);
    if (gevraagd == null || gevraagd === '') return Math.max(1, Math.ceil(leden / 2));
    if (!Number.isInteger(q) || q < 1 || q > leden) return null;
    return q;
  }

  function nieuwId(lijst) {
    let id = nu();
    while (lijst.some(x => x.id === id)) id++;
    return id;
  }

  const klaar = (sess, b, r) => (r && r.error ? r : Object.assign({ ok: true, beraad: zicht.beraad(b, sess.key) },
    r && r.herhaling ? { herhaling: true } : {}));

  function open(sess, invoer) {
    const v = invoer || {};
    const d = v.drager || {};
    if (d.soort !== 'genootschap') return { status: 400, error: 'Een beraad hangt vandaag alleen aan een genootschap.' };
    const gr = genootschap.groepMet(d.id);
    if (!gr || !genootschap.isLid(gr, sess.key)) return { status: 404, error: 'Dit genootschap ken ik niet, of je bent er geen lid van.' };
    const vraag = tekstVan(v.vraag, S.VRAAG_MAX);
    if (!vraag) return { status: 400, error: 'Waarover gaat het beraad? Een vraag is het begin.' };
    const fout = gekeurd(vraag); if (fout) return fout;
    const quorum = quorumVan(gr, v.quorum);
    if (quorum == null) return { status: 400, error: 'Het quorum is een heel getal tussen 1 en het aantal leden (' + (gr.leden || []).length + ').' };
    const lijst = lijstSchrijf();
    const b = schr.nieuw({ id: nieuwId(lijst), drager: { soort: 'genootschap', id: gr.id }, vraag,
      door: sess.key, gevoelig: v.gevoelig === true, quorum });
    lijst.unshift(b);
    save();
    return { ok: true, beraad: zicht.beraad(b, sess.key) };
  }

  function inbreng(sess, id, invoer) {
    const p = poort(sess, id); if (p.error) return p;
    const v = invoer || {};
    if (v.intrek != null) { const r = schr.trekInbrengIn(p.b, sess.key, v.intrek); if (!r.error && !r.herhaling) save(); return klaar(sess, p.b, r); }
    const soort = v.soort == null ? 'inbreng' : String(v.soort);
    if (!S.SOORTEN[soort]) return { status: 400, error: 'Kies inbreng, bezwaar of open-punt.' };
    const tekst = tekstVan(v.tekst, S.TEKST_MAX);
    if (!tekst) return { status: 400, error: 'Wat wil je inbrengen?' };
    const fout = gekeurd(tekst); if (fout) return fout;
    const r = schr.brengIn(p.b, sess.key, soort, tekst);
    if (!r.error) save();
    return r.error ? r : Object.assign(klaar(sess, p.b, r), { id: r.id });
  }

  function voorstel(sess, id, invoer) {
    const p = poort(sess, id); if (p.error) return p;
    const tekst = tekstVan((invoer || {}).tekst, S.VOORSTEL_MAX);
    if (!tekst) return { status: 400, error: 'Een voorstel zonder tekst is geen voorstel.' };
    const fout = gekeurd(tekst); if (fout) return fout;
    if (schr.huidige(p.b).stand === 'stemmen' && !p.regie) {
      return { status: 403, error: 'Er wordt gestemd. Een nieuw voorstel zet alle stemmen terug, en dat doet wie het beraad opende of een beheerder.' };
    }
    const r = schr.zetVoorstel(p.b, sess.key, tekst);
    if (!r.error) save();
    return r.error ? r : Object.assign(klaar(sess, p.b, r), { versie: r.versie, stemmenTerug: r.stemmenTerug });
  }

  function naarStemmen(sess, id) {
    const p = poort(sess, id); if (p.error) return p;
    if (!p.regie) return geenRegie;
    const r = schr.naarStemmen(p.b, sess.key);
    if (!r.error && !r.herhaling) save();
    return klaar(sess, p.b, r);
  }

  function stem(sess, id, keuze) {
    const p = poort(sess, id); if (p.error) return p;
    const r = schr.stem(p.b, sess.key, String(keuze || ''));
    if (!r.error && !r.herhaling) save();
    return klaar(sess, p.b, r);
  }

  function sluit(sess, id, invoer) {
    const p = poort(sess, id); if (p.error) return p;
    if (!p.regie) return geenRegie;
    const v = invoer || {};
    const r0 = schr.huidige(p.b);
    if (r0.stand === 'besloten') return klaar(sess, p.b, { herhaling: true });
    const toelichting = tekstVan(v.toelichting, S.TOELICHTING_MAX);
    if (toelichting) { const fout = gekeurd(toelichting); if (fout) return fout; }
    const r = v.intrekken === true ? schr.trekIn(p.b, sess.key, toelichting) : schr.sluit(p.b, sess.key, toelichting);
    if (r.error) return r;
    save();
    wek(p.b, r0.nr, r.ontvangers);
    save();
    return klaar(sess, p.b, r);
  }

  function heropenBeraad(sess, id, invoer) {
    const p = poort(sess, id); if (p.error) return p;
    if (!p.regie) return geenRegie;
    const v = invoer || {};
    const reden = tekstVan(v.reden, S.TOELICHTING_MAX);
    if (reden) { const fout = gekeurd(reden); if (fout) return fout; }
    const quorum = quorumVan(p.gr, v.quorum);
    if (quorum == null) return { status: 400, error: 'Het quorum is een heel getal tussen 1 en het aantal leden.' };
    const r = schr.heropen(p.b, sess.key, reden, quorum);
    if (!r.error) save();
    return klaar(sess, p.b, r);
  }

  function lees(sess, id) {
    const p = poort(sess, id); if (p.error) return p;
    return { ok: true, beraad: zicht.beraad(p.b, sess.key), mijnRegie: p.regie };
  }

  return { open, inbreng, voorstel, naarStemmen, stem, sluit, heropen: heropenBeraad, lees, mijn, gezien,
    poort, lijstKijk, huidige: schr.huidige };
};
