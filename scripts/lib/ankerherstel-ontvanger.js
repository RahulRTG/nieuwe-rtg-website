/* Zelfstandige toets voor een tijdvakwissel in scripts/ankerontvanger.js.
   Alleen de apart ingestelde publieke herstelsleutel telt; nooit de sleutel
   waarmee de app haar gewone ankerblokken tekent. */
'use strict';

const crypto = require('crypto');
const SPKI_ED25519 = Buffer.from('302a300506032b6570032100', 'hex');
const DOEL = 'rtg-ankerherstel-v1\n';

function kanoniek(v) {
  if (Array.isArray(v)) return '[' + v.map(kanoniek).join(',') + ']';
  if (v && typeof v === 'object')
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + kanoniek(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
const tijdvak = p => Math.max(1, Number(p && p.tijdvak) || 1);
const zelfde = (a, b) => !!a && !!b && Number(a.nr) === Number(b.nr) && a.hash === b.hash && a.at === b.at;
const hashGoed = v => typeof v === 'string' && /^[0-9a-f]{32}$/i.test(v);
const shaGoed = v => typeof v === 'string' && /^[0-9a-f]{64}$/i.test(v);
const isoGoed = v => typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;

function herstelGoed({ naam, oud, nieuw, verklaringen, geschiedenis, publiek }) {
  if (!publiek) return false;
  let pub;
  try { pub = crypto.createPublicKey({ key: Buffer.concat([SPKI_ED25519, Buffer.from(publiek, 'base64')]), format: 'der', type: 'spki' }); }
  catch { return false; }
  return (verklaringen || []).some(v => {
    if (!v || v.soort !== 'ankerherstelverklaring' || Number(v.versie) !== 1 ||
        typeof v.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.id) ||
        !isoGoed(v.gemaaktAt) ||
        v.journaal !== naam || v.redenCode !== 'ONHERSTELBARE_AUDITBREUK' || !v.handtekening ||
        v.handtekening.alg !== 'ed25519' || v.handtekening.publiek !== publiek ||
        typeof v.handtekening.waarde !== 'string') return false;
    const van = v.van, gem = v.gemeenschappelijk, naar = v.naar, verlies = v.verlies;
    if (![van, gem, naar].every(x => x && Number(x.nr) > 0 && hashGoed(x.hash) && isoGoed(x.at))) return false;
    if (!zelfde(van, oud) || tijdvak(van) !== tijdvak(oud) || tijdvak(naar) !== tijdvak(oud) + 1 ||
        tijdvak(nieuw) !== tijdvak(naar) || nieuw.herstelId !== v.id || Number(nieuw.nr) < Number(naar.nr)) return false;
    if (Number(nieuw.nr) === Number(naar.nr) && nieuw.hash !== naar.hash) return false;
    if (Number(gem.nr) >= Number(van.nr) || Number(gem.nr) >= Number(naar.nr)) return false;
    const vanaf = Number(gem.nr) + 1, tot = Number(van.nr);
    if (!verlies || verlies.status !== 'inhoud-onherstelbaar' || Number(verlies.vanafNr) !== vanaf ||
        Number(verlies.totNr) !== tot || Number(verlies.aantal) !== tot - vanaf + 1) return false;
    if (!Array.isArray(v.bewijs) || !v.bewijs.length || v.bewijs.length > 32 ||
        v.bewijs.some(b => !b || typeof b.soort !== 'string' || b.soort.length < 2 || b.soort.length > 80 || !shaGoed(b.sha256))) return false;
    const gemeenExtern = (geschiedenis || []).some(r => r && r.blok &&
      zelfde(r.blok.punten && r.blok.punten[naam], gem) && tijdvak(r.blok.punten[naam]) === tijdvak(van));
    if (!gemeenExtern) return false;
    try {
      const { handtekening, ...kaal } = v;
      return crypto.verify(null, Buffer.from(DOEL + kanoniek(kaal), 'utf8'), pub,
        Buffer.from(handtekening.waarde, 'base64'));
    } catch { return false; }
  });
}

module.exports = { herstelGoed, tijdvak };
