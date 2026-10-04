/* De vier hostproeven die geen onafhankelijke runner nodig hebben. De vorm van
   het uiteindelijke verslag blijft eigendom van scripts/extern-bewijs.js. */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MAX_DEFINITIE_DAGEN = 2;
const EICAR = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$', 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'].join('');

function definitieDatum(versietekst) {
  const deel = String(versietekst || '').split('/');
  const d = Date.parse(deel.slice(2).join('/'));
  return Number.isFinite(d) ? d : null;
}

async function malware(o, verslag) {
  const van = o.nu(), clamd = o.clamd();
  if (!clamd) return verslag('malware', o.commit, van, o.nu(), 'FAIL',
    ['RTG_CLAMD_HOST ontbreekt: er is geen scanner om te beproeven'], {});
  const redenen = [];
  const versie = await clamd.definitieVersie().catch(e => { redenen.push(e.message); return null; });
  const datum = definitieDatum(versie);
  const leeftijdDagen = datum == null ? null : Math.floor((o.nu() - datum) / 86400000);
  if (datum == null) redenen.push('de definitiedatum is niet uit het VERSION-antwoord te lezen');
  else if (leeftijdDagen > MAX_DEFINITIE_DAGEN) redenen.push('de definities zijn ' + leeftijdDagen + ' dagen oud');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-malwareproef-'));
  let besmet = null, schoon = null;
  try {
    fs.writeFileSync(path.join(map, 'eicar.txt'), EICAR);
    fs.writeFileSync(path.join(map, 'schoon.txt'), 'RTG bewijsverslag: een gewoon tekstbestand.\n');
    besmet = await clamd.scanBestand(path.join(map, 'eicar.txt')).catch(e => ({ fout:e.message }));
    schoon = await clamd.scanBestand(path.join(map, 'schoon.txt')).catch(e => ({ fout:e.message }));
  } finally { fs.rmSync(map, { recursive:true, force:true }); }
  if (!besmet || besmet.verdict !== 'besmet') redenen.push('de EICAR-proef werd NIET herkend');
  if (!schoon || schoon.verdict !== 'schoon') redenen.push('een schoon bestand kwam niet schoon terug');
  return verslag('malware', o.commit, van, o.nu(), redenen.length ? 'FAIL' : 'PASS', redenen,
    { versie, definitieDatum:datum == null ? null : new Date(datum).toISOString(), leeftijdDagen,
      maxDefinitieDagen:MAX_DEFINITIE_DAGEN, eicar:besmet, schoon });
}

async function objectopslag(o, verslag) {
  const van = o.nu(), r = await o.beproefMedia(o.env);
  return verslag('objectopslag', o.commit, van, o.nu(), r && r.ok === true ? 'PASS' : 'FAIL',
    r && r.ok === true ? [] : [String((r && r.reden) || 'geen uitslag')], r || {});
}

function regels(pad) {
  try { return fs.readFileSync(pad, 'utf8').split('\n').filter(Boolean).slice(0, 3); }
  catch (e) { return null; }
}
function rollback(o, verslag) {
  const van = o.nu(), voor = regels(o.staat), set = regels(o.rollbackStaat);
  const r = o.draai('sh', ['scripts/docker/live.sh', 'rollback']), na = regels(o.staat), redenen = [];
  if (!set) redenen.push('er was geen bewezen rollbackset');
  if (r.status !== 0) redenen.push('live.sh rollback eindigde met exitcode ' + r.status);
  if (set && JSON.stringify(na) !== JSON.stringify(set)) redenen.push('de actieve set is na afloop niet de rollbackset');
  if (voor && set && JSON.stringify(voor) === JSON.stringify(set))
    redenen.push('de actieve set WAS al de rollbackset: er is niets teruggezet');
  return verslag('rollback', o.commit, van, o.nu(), redenen.length ? 'FAIL' : 'PASS', redenen,
    { exitcode:r.status, voor, rollbackset:set, na });
}

function herstel(o, stempel, verslag) {
  const van = o.nu();
  if (!/^\d{8}T\d{6}Z$/.test(String(stempel || '')))
    return verslag('herstel', o.commit, van, o.nu(), 'FAIL', ['geef de exacte back-upstempel (JJJJMMDDTuummssZ)'], {});
  const r = o.draai('sh', ['scripts/docker/live.sh', 'restore', stempel]), tot = o.nu();
  const login = String(o.env.RTG_HERSTEL_LOGIN_GEZIEN || '').trim();
  const naam = String(o.env.RTG_HERSTEL_NAAM_GEZIEN || '').trim();
  const redenen = [], open = [];
  if (r.status !== 0) redenen.push('live.sh restore eindigde met exitcode ' + r.status);
  if (!login) open.push('een mens heeft nog niet verklaard dat een bestaand lid na het herstel kan inloggen (RTG_HERSTEL_LOGIN_GEZIEN)');
  if (!naam) open.push('een mens heeft nog niet verklaard dat de echte naam zichtbaar is, dus dat de kluissleutel bij de data hoort (RTG_HERSTEL_NAAM_GEZIEN)');
  return verslag('herstel', o.commit, van, tot, redenen.length ? 'FAIL' : open.length ? 'OPEN' : 'PASS',
    redenen.concat(open), { stempel, exitcode:r.status, hersteltijdMs:tot - van },
    login && naam ? { inlogGezienDoor:login.slice(0, 120), naamGezienDoor:naam.slice(0, 120) } : null);
}

module.exports = { malware, objectopslag, rollback, herstel, definitieDatum,
  MAX_DEFINITIE_DAGEN, EICAR };
