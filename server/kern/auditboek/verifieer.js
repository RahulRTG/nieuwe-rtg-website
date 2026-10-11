/* ============================================================================
   DE VERIFICATIE -- klopt het boek met zichzelf EN met wat er buiten staat?

   Twee vragen die niet door elkaar mogen lopen (lib/keten.js zegt het al):
     LOKAAL   klopt de overgebleven geschiedenis: hashes, links, kolommen, vorm;
     EXTERN   is de geschiedenis nog even LANG en even ECHT als de ankers zeggen.

   Elke bevinding heeft een ernst. `fataal` is manipulatie of een tegenspraak;
   `onbekend` is "ik kan het niet vaststellen" (een sink die niet antwoordt) en
   telt als NIET in orde: een controle die niet kon draaien is niet geslaagd.
   `waarschuwing` is achterstand. `strikt` (de releasemodus) maakt de achterstand
   van een sink of een verouderd anker ook fataal.
   ========================================================================== */
'use strict';
const { controleerRegel } = require('./regel');
const { controleerLijst, ankerHash, leesSinks } = require('./anker');

const DAG = 24 * 3600 * 1000;
const TOLERANTIE = 5 * 60 * 1000;

async function verifieer({ pool, sinks = [], sleutels, minSinks = 1, nu = Date.now(), strikt = true,
  maxAnkerLeeftijdMs = 6 * 3600 * 1000, bewaarDagen = 730, batch = 5000 }) {
  const b = [];
  const meld = (code, ernst, tekst) => { if (b.filter(x => x.code === code).length < 10) b.push({ code, ernst, tekst }); };

  const meta = (await pool.query("SELECT waarde FROM auditboek_meta WHERE sleutel = 'boek_id'")).rows[0];
  if (!meta) { meld('geenBoek', 'fataal', 'het auditboek is niet aangemaakt'); return eindUitslag(b, {}); }
  const boekId = meta.waarde;
  const cps = new Map((await pool.query('SELECT nr, hash, tijd, anker_nr FROM auditboek_checkpoint ORDER BY nr')).rows.map(r => [Number(r.nr), r]));

  /* ---- EXTERN: de ankers van alle sinks ---- */
  const gelezen = await leesSinks(sinks);
  const unie = new Map();
  let bereikbaar = 0;
  for (const g of gelezen) {
    if (!g.lijst) { meld('sinkOnbereikbaar', 'onbekend', g.sink.naam + ' antwoordt niet: ' + g.fout); continue; }
    const kl = sleutels && sleutels.publiek ? controleerLijst(g.lijst, { boekId, publiek: sleutels.publiek }) : ['geen publieke ankersleutel'];
    if (kl.length) { for (const k of kl.slice(0, 3)) meld('ankerOngeldig', 'fataal', g.sink.naam + ': ' + k); continue; }
    bereikbaar++;
    for (const v of g.lijst) {
      const oud = unie.get(v.ankerNr);
      if (oud && ankerHash(oud) !== ankerHash(v)) meld('sinkAfwijking', 'fataal', 'sinks verschillen over anker ' + v.ankerNr);
      unie.set(v.ankerNr, v);
    }
  }
  const ankers = [...unie.values()].sort((x, y) => x.ankerNr - y.ankerNr);
  const maxNr = ankers.length ? ankers[ankers.length - 1].ankerNr : 0;
  for (const g of gelezen) if (g.lijst && g.lijst.length < maxNr && !b.some(x => x.code === 'ankerOngeldig' && x.tekst.startsWith(g.sink.naam)))
    meld('sinkAchterstand', strikt ? 'fataal' : 'waarschuwing', g.sink.naam + ' heeft ' + g.lijst.length + ' van ' + maxNr + ' ankers');
  if (sinks.length < minSinks) meld('tekortSinks', 'fataal', 'er zijn ' + sinks.length + ' ankerbestemmingen ingericht, minimaal ' + minSinks + ' vereist');
  else if (bereikbaar < minSinks) meld('tekortBereikbaar', 'onbekend', bereikbaar + ' bereikbare geldige sinks, minimaal ' + minSinks);
  const inDb = (await pool.query('SELECT anker_nr, hash FROM auditboek_anker')).rows;
  for (const r of inDb) {
    const v = unie.get(Number(r.anker_nr));
    if (bereikbaar >= minSinks && !v) meld('ankerVerdwenen', 'fataal', 'anker ' + r.anker_nr + ' staat in de database maar in geen enkele sink');
    else if (v && v.kop.hash !== r.hash) meld('sinkAfwijking', 'fataal', 'anker ' + r.anker_nr + ' wijkt af van het databaserecord');
  }

  /* ---- LOKAAL: het boek zelf ---- */
  const wantNr = new Set(ankers.map(a => a.kop.nr));
  const hashBij = new Map();
  let vorig = null, eerste = null, aantal = 0, na = 0;
  for (;;) {
    const rijen = (await pool.query('SELECT nr, tijd, type, categorie, actor, regel, vorige, hash FROM auditboek WHERE nr > $1 ORDER BY nr LIMIT $2', [vorig ? vorig.nr : 0, batch])).rows;
    if (!rijen.length) break;
    for (const r of rijen) {
      aantal++;
      const nr = Number(r.nr);
      let regel;
      try { regel = JSON.parse(r.regel); } catch (e) { meld('regelOngeldig', 'fataal', 'regel ' + nr + ' is geen JSON'); vorig = { nr, hash: r.hash }; continue; }
      const kl = controleerRegel(regel);
      if (kl.length) meld('regelOngeldig', 'fataal', 'regel ' + nr + ': ' + kl.slice(0, 2).join('; '));
      if (regel.nr !== nr || regel.hash !== r.hash || (regel.vorige || null) !== (r.vorige || null) || regel.type !== r.type ||
          regel.categorie !== r.categorie || regel.actor.soort + ':' + regel.actor.ref !== r.actor || Date.parse(regel.tijd) !== new Date(r.tijd).getTime())
        meld('kolommenAfwijkend', 'fataal', 'regel ' + nr + ': kolommen komen niet overeen met het gehashte record');
      if (!eerste) {
        eerste = { nr, vorige: r.vorige, tijd: new Date(r.tijd).getTime() };
        if (nr === 1) { if (r.vorige) meld('ketenGebroken', 'fataal', 'regel 1 heeft een voorganger'); }
        else { const c = cps.get(nr - 1); if (!c) meld('ketenGebroken', 'fataal', 'het boek begint op regel ' + nr + ' zonder checkpoint: er zijn regels verdwenen');
          else if (c.hash !== r.vorige) meld('ketenGebroken', 'fataal', 'het checkpoint past niet op regel ' + nr); }
      } else {
        if (nr !== vorig.nr + 1) meld('ketenGebroken', 'fataal', 'gat in de nummering tussen ' + vorig.nr + ' en ' + nr + ': er zijn regels verwijderd');
        else if (r.vorige !== vorig.hash) meld('ketenGebroken', 'fataal', 'regel ' + nr + ' wijst niet naar zijn voorganger');
        if (new Date(r.tijd).getTime() < vorig.tijd - TOLERANTIE) meld('tijdSprong', 'waarschuwing', 'regel ' + nr + ' is ouder dan zijn voorganger');
      }
      if (wantNr.has(nr)) hashBij.set(nr, r.hash);
      vorig = { nr, hash: r.hash, tijd: new Date(r.tijd).getTime() };
    }
  }
  const kopNr = vorig ? vorig.nr : (cps.size ? Math.max(...cps.keys()) : 0);

  /* ---- DE TWEE HALVEN OP ELKAAR ---- */
  for (const a of ankers) {
    if (a.kop.nr > kopNr) { meld('ingekort', 'fataal', 'anker ' + a.ankerNr + ' legde regel ' + a.kop.nr + ' vast, het boek eindigt op ' + kopNr); continue; }
    if (hashBij.has(a.kop.nr)) { if (hashBij.get(a.kop.nr) !== a.kop.hash) meld('herschreven', 'fataal', 'regel ' + a.kop.nr + ' heeft een andere hash dan anker ' + a.ankerNr + ' vastlegde'); }
    else if (eerste && a.kop.nr >= eerste.nr) meld('herschreven', 'fataal', 'regel ' + a.kop.nr + ' uit anker ' + a.ankerNr + ' ontbreekt in het boek');
    else if (cps.has(a.kop.nr) && cps.get(a.kop.nr).hash !== a.kop.hash) meld('herschreven', 'fataal', 'checkpoint ' + a.kop.nr + ' wijkt af van anker ' + a.ankerNr);
  }
  if (!ankers.length && aantal) meld('geenAnker', 'onbekend', 'het boek heeft ' + aantal + ' regels maar nog geen enkel anker buiten de database');
  const laatste = ankers[ankers.length - 1] || null;
  if (laatste) {
    na = Math.max(0, kopNr - laatste.kop.nr);
    if (nu - Date.parse(laatste.tijd) > maxAnkerLeeftijdMs) meld('ankerVerouderd', strikt ? 'fataal' : 'waarschuwing', 'het laatste anker is ' + Math.round((nu - Date.parse(laatste.tijd)) / 60000) + ' minuten oud');
  }

  /* ---- DE BEWARING: een checkpoint is geen vrijbrief ---- */
  if (eerste && eerste.nr > 1) {
    const c = cps.get(eerste.nr - 1);
    if (c) {
      const ev = (await pool.query("SELECT regel FROM auditboek WHERE type = 'auditboek.retentie' ORDER BY nr")).rows.map(r => { try { return JSON.parse(r.regel); } catch (e) { return null; } })
        .find(r => r && r.context && r.context.totNr === Number(c.nr) && r.context.checkpointHash === c.hash);
      const eerstDekkend = ankers.find(a => a.kop.nr >= Number(c.nr));
      if (!ev) meld('retentieZonderSpoor', 'fataal', 'het checkpoint op ' + c.nr + ' heeft geen retentiegebeurtenis in het boek');
      else if (!eerstDekkend) meld('retentieZonderAnker', 'onbekend', 'geen anker dat regel ' + c.nr + ' dekt; de verjaring is niet te bewijzen');
      else if (Date.parse(eerstDekkend.tijd) > Date.parse(ev.tijd) - bewaarDagen * DAG + TOLERANTIE)
        meld('retentieTeVroeg', 'fataal', 'regel ' + c.nr + ' bestond volgens anker ' + eerstDekkend.ankerNr + ' nog geen ' + bewaarDagen + ' dagen toen hij werd verwijderd');
    }
  }
  return eindUitslag(b, { regels: aantal, kopNr, ankers: ankers.length, laatsteAnkerNr: laatste ? laatste.ankerNr : 0, regelsNaLaatsteAnker: na, bestemmingen: sinks.length, bereikbaar });
}

function eindUitslag(b, stats) {
  const fataal = b.filter(x => x.ernst === 'fataal').length, onbekend = b.filter(x => x.ernst === 'onbekend').length;
  const waarschuwingen = b.filter(x => x.ernst === 'waarschuwing').length;
  return { ok: fataal === 0 && onbekend === 0, uitslag: fataal ? 'gemanipuleerd-of-inconsistent' : onbekend ? 'niet-vast-te-stellen' : waarschuwingen ? 'in-orde-met-achterstand' : 'in-orde',
    fataal, onbekend, waarschuwingen, bevindingen: b, stats };
}

module.exports = { verifieer };
