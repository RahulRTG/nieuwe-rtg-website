/* De BEZORGCODE van een mode-bezorging (mode.bezorgcode): vier cijfers die het
   lid aan de deur VOORLEEST en de koerier intikt. Kort is hier het product, dus
   de 128-bit lat van RELEASEKANDIDAAT.md B9 wordt niet gehaald -- en dat staat
   er, in plaats van dat een langere code het voorlezen onmogelijk maakt.

   Wat de korte code veilig houdt, en alle vijf staan in DEZE module:
   - gebonden aan EEN bezorging (ref) en EEN winkel; de HMAC gaat over ref plus
     code, dus dezelfde vier cijfers bij een andere bezorging zijn niets waard;
   - eenmalig (max_gebruik 1) en na zeven dagen verlopen;
   - VIJF foute pogingen per code en dan vergrendeld (ingetrokken); het lid
     vraagt een nieuwe, hooguit tien keer per bezorging -- raden haalt dus
     hooguit 50 van de 10.000;
   - op schijf alleen een HMAC-SHA256 met een serversleutel (een kale SHA-256
     van vier cijfers is in 10.000 stappen terug te rekenen), vergeleken met
     timingSafeEqual op de rij van die ref;
   - telling, vergrendeling, afronden en sluiten (retour) lopen in EEN
     collectietransactie (PostgreSQL: advisory lock + FOR UPDATE), dus twee
     koeriers of een koerier en een retour winnen nooit allebei.
   De kale code staat alleen in het antwoord op de aanvraag en op een nieuwe
   code (POST /api/mode/bezorg/code); het overzicht van het lid draagt hem niet. */
'use strict';
const path = require('path');

const DOEL = 'mode-overdracht';
const SCOPE = Object.freeze(['koerier.bezorging.afronden']);
const GELDIG_MS = 7 * 86400000;
const MAX_FOUT = 5;
const MAX_ROTATIE = 10;

module.exports = ({ crypto, bewerkCollectie, dataDir, geheim, nu = () => new Date().toISOString() }) => {
  if (typeof bewerkCollectie !== 'function') throw new Error('De bezorgcode vereist een collectietransactie.');
  const sleutel = geheim
    ? crypto.createHash('sha256').update('rtg-bezorgcode-v1\0' + String(geheim)).digest()
    : require('../../lib/sleutelbestand').sleutel(path.join(dataDir, 'bezorgcode.key'), 32);
  const hash = (ref, code) => crypto.createHmac('sha256', sleutel)
    .update('rtg-bezorgcode-v1|' + String(ref) + '|' + String(code == null ? '' : code).trim()).digest('hex');
  const zelfde = (a, b) => /^[a-f0-9]{64}$/.test(String(a || '')) && /^[a-f0-9]{64}$/.test(String(b || '')) &&
    crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

  const transactie = werk => bewerkCollectie('modeBezorgCode', bron => {
    if (!bron || typeof bron !== 'object' || Array.isArray(bron)) throw new Error('modeBezorgCode hoort een kaart te zijn');
    return werk(bron);
  });
  const trekIn = (t, door, reden) => {
    if (t && !t.ingetrokken_at) Object.assign(t, { ingetrokken_at: nu(), ingetrokken_door: String(door).slice(0, 80), intrekreden: reden });
  };
  const publiek = t => t ? { issuer: t.issuer, doel: t.doel, scope: [...t.scope], issued_at: t.issued_at,
    expires_at: t.expires_at, max_gebruik: t.max_gebruik, gebruik: t.gebruik, fout: t.fout,
    fout_max: MAX_FOUT, ingetrokken_at: t.ingetrokken_at, rotatie: t.rotatie } : null;
  const reden = t => !t ? 'onbekend' : t.ingetrokken_at ? 'ingetrokken'
    : !(Date.parse(t.expires_at) > Date.parse(nu())) ? 'verlopen'
    : !(t.gebruik < t.max_gebruik) ? 'opgebruikt' : null;

  /* Uitgeven IS roteren: de vorige code gaat ingetrokken de historie in, en
     elke nieuwe code begint met een vol pogingenbudget -- vandaar het plafond. */
  function uitgeven({ ref, supplierCode, houder }) {
    return transactie(bron => {
      const r = bron[ref] || (bron[ref] = { ref, supplierCode, houder_hash: houder, toegang: null,
        historie: [], afgerond: null, gesloten: null });
      if (r.supplierCode !== supplierCode || r.houder_hash !== houder) return { status: 404, error: 'Bezorging niet gevonden.' };
      if (r.afgerond || r.gesloten) return { status: 409, error: 'Deze bezorging is al afgerond.' };
      const rotatie = (r.toegang ? r.toegang.rotatie : 0) + 1;
      if (rotatie > MAX_ROTATIE) return { status: 409, error: 'Er zijn al ' + MAX_ROTATIE + ' bezorgcodes gemaakt voor deze bezorging. Neem contact op met de winkel.' };
      if (r.toegang) { trekIn(r.toegang, houder, 'nieuwe bezorgcode'); r.historie.push(r.toegang); }
      const code = String(crypto.randomInt(0, 10000)).padStart(4, '0');
      const at = nu();
      r.toegang = { code_hash: hash(ref, code), issuer: 'rtg.lid.modebezorging', doel: DOEL, scope: [...SCOPE],
        onderwerp: { soort: 'mode-bezorging', ref, supplierCode, houder_hash: houder },
        issued_at: at, expires_at: new Date(Date.parse(at) + GELDIG_MS).toISOString(),
        max_gebruik: 1, gebruik: 0, fout: 0, ingetrokken_at: null, rotatie };
      return { status: 200, ok: true, eenmalig: true, code, toegang: publiek(r.toegang) };
    });
  }

  // De koerier tikt de code in. Elke fout telt BINNEN de transactie.
  function claim({ ref, supplierCode, code, actor }) {
    return transactie(bron => {
      const r = bron[ref];
      if (!r || r.supplierCode !== supplierCode) return { status: 404, error: 'Bezorging niet gevonden.' };
      if (r.afgerond || r.gesloten) return { status: 409, error: 'Deze bezorging is al afgerond.' };
      const t = r.toegang, waarom = reden(t);
      if (waarom) return { status: 403, error: 'Deze bezorgcode is niet meer geldig (' + waarom + '). Vraag de klant om een nieuwe code uit de app.' };
      if (!zelfde(t.code_hash, hash(ref, code))) {
        t.fout += 1;
        if (t.fout >= MAX_FOUT) trekIn(t, 'systeem', 'te veel foute pogingen');
        return { status: 403, resterend: Math.max(0, MAX_FOUT - t.fout),
          error: t.ingetrokken_at ? 'De bezorgcode is vergrendeld na ' + MAX_FOUT + ' foute pogingen. De klant maakt in de app een nieuwe.'
            : 'De bezorgcode klopt niet. Vraag de klant om de code uit de app.' };
      }
      t.gebruik += 1;
      r.afgerond = { at: nu(), door: String((actor && actor.name) || 'koerier').slice(0, 80) };
      return { status: 200, ok: true };
    });
  }

  // Retour of annuleren: de code gaat dicht, en een afgeronde bezorging gaat niet meer retour.
  function sluit({ ref, supplierCode, door, waarom }) {
    return transactie(bron => {
      const r = bron[ref];
      if (!r) return { status: 200, ok: true };
      if (r.supplierCode !== supplierCode) return { status: 404, error: 'Bezorging niet gevonden.' };
      if (r.afgerond) return { status: 409, error: 'Deze bezorging is al afgerond.' };
      trekIn(r.toegang, door, waarom || 'bezorging gesloten');
      r.gesloten = r.gesloten || { at: nu(), reden: String(waarom || '').slice(0, 160) };
      return { status: 200, ok: true };
    });
  }

  return { uitgeven, claim, sluit, hash, DOEL, SCOPE, MAX_FOUT, MAX_ROTATIE };
};
module.exports.MAX_FOUT = MAX_FOUT;
