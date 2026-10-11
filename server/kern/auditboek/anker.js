/* ============================================================================
   HET ANKER -- de kop van het auditboek, getekend en naar buiten gebracht.

   Een anker zegt: "op dit tijdstip stond de kop van boek X op regel N met hash H,
   en dit is het K-de anker". Het is getekend met een Ed25519-sleutel die NIET in
   de database staat (RTG_AUDIT_ANKER_SIGN_KEY; de publieke helft staat vast in
   deploy/audit-anker.pub of RTG_AUDIT_ANKER_PUBLIC_KEY_FILE), en elk anker draagt
   de hash van zijn voorganger. Daarmee zijn drie aanvallen zichtbaar:

     kop afknippen     de database heeft minder regels dan een anker vastlegde;
     herschrijven      de regel op het ankerpunt heeft een andere hash;
     anker weggooien   de ankerketen heeft een gat of een sink heeft er minder
                       dan de andere (twee sinks vergelijken elkaar).

   Een aanvaller met ALLEEN de database kan dit niet herstellen: hij heeft de
   sleutel niet en kan de sinks niet overschrijven. Een aanvaller met database,
   sleutel EN alle sinks wel -- dat is de grens van dit ontwerp en ze staat in
   AUDITBOEK.md, niet in een voetnoot.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const path = require('path');
const trust = require('../../config/release-trust');
const { kanoniek } = require('./regel');

const DOMEIN = 'RTG:AUDIT-ANKER:v1\0';
const FORMAAT = 'rtg-auditanker-v1';
const hex = b => crypto.createHash('sha256').update(b).digest('hex');
const zonderSig = v => { const z = { ...v }; delete z.handtekening; return z; };
const ankerHash = v => hex(DOMEIN + kanoniek(zonderSig(v)));

function teken(v, prive) {
  if (!prive || prive.asymmetricKeyType !== 'ed25519') throw new Error('Ankersleutel moet een private Ed25519-sleutel zijn.');
  return { ...v, handtekening: crypto.sign(null, Buffer.from(DOMEIN + kanoniek(zonderSig(v))), prive).toString('base64') };
}
function controleerHandtekening(v, publiek) {
  try {
    if (!v || !/^[A-Za-z0-9+/]{86}==$/.test(String(v.handtekening || ''))) return false;
    return crypto.verify(null, Buffer.from(DOMEIN + kanoniek(zonderSig(v))), publiek, Buffer.from(v.handtekening, 'base64'));
  } catch (e) { return false; }
}

/* Sleutels uit de omgeving. De PRIVATE sleutel is optioneel (een verifieerder
   heeft hem niet nodig en hoort hem niet te hebben); de publieke is verplicht
   om iets te kunnen controleren. Hoort de private niet bij de vaste publieke,
   dan weigert dit -- een sleutel die het anker niet kan verifieren is waardeloos. */
function laadSleutels(env = process.env, root = path.join(__dirname, '..', '..', '..')) {
  const bestand = env.RTG_AUDIT_ANKER_PUBLIC_KEY_FILE || path.join(root, 'deploy', 'audit-anker.pub');
  let publiek = null, prive = null;
  try { publiek = trust.readPublic(bestand).key; } catch (e) { publiek = null; }
  const ruw = String(env.RTG_AUDIT_ANKER_SIGN_KEY || '');
  if (ruw) {
    try {
      prive = crypto.createPrivateKey(ruw.includes('BEGIN') ? ruw : { key: Buffer.from(ruw, 'base64'), format: 'der', type: 'pkcs8' });
      if (prive.asymmetricKeyType !== 'ed25519') throw new Error();
    } catch (e) { throw new Error('RTG_AUDIT_ANKER_SIGN_KEY is geen geldige private Ed25519-sleutel.'); }
    if (!publiek) throw new Error('De publieke ankersleutel ontbreekt (deploy/audit-anker.pub): een handtekening zonder bekende sleutel bewijst niets.');
    if (!crypto.createPublicKey(prive).export({ type: 'spki', format: 'der' }).equals(publiek.export({ type: 'spki', format: 'der' })))
      throw new Error('RTG_AUDIT_ANKER_SIGN_KEY hoort niet bij de vaste publieke ankersleutel.');
  }
  return { publiek, prive, vingerafdruk: publiek ? hex(publiek.export({ type: 'spki', format: 'der' })) : null };
}

/* De lijst van één sink nalopen: handtekening, boek-id, volgnummers vanaf 1
   zonder gat, en de ketenhash. Geeft de klachten terug; leeg = in orde. */
function controleerLijst(lijst, { boekId, publiek }) {
  const k = [];
  let vorige = null, verwacht = 1;
  for (const v of lijst) {
    if (!v || v.formaat !== FORMAAT) { k.push('anker met onbekend formaat'); continue; }
    if (!publiek || !controleerHandtekening(v, publiek)) { k.push('anker ' + v.ankerNr + ': handtekening klopt niet'); }
    if (v.boekId !== boekId) k.push('anker ' + v.ankerNr + ' hoort bij een ander boek');
    if (v.ankerNr !== verwacht) k.push('ankerketen heeft een gat: verwacht ' + verwacht + ', gevonden ' + v.ankerNr);
    if ((v.vorigeAnkerHash || null) !== vorige) k.push('anker ' + v.ankerNr + ' wijst niet naar zijn voorganger');
    verwacht = v.ankerNr + 1; vorige = ankerHash(v);
  }
  return k;
}

async function kop(pool) {
  const r = (await pool.query('SELECT nr, hash FROM auditboek ORDER BY nr DESC LIMIT 1')).rows[0];
  return r ? { nr: Number(r.nr), hash: r.hash } : null;
}

/* Wat er in het ankernummer van de sinks staat, samengevoegd. Een sink die niet
   antwoordt telt als onbereikbaar en NIET als leeg. */
async function leesSinks(sinks) {
  const uit = await Promise.all(sinks.map(async s => {
    try { return { sink: s, lijst: await s.list(), fout: null }; } catch (e) { return { sink: s, lijst: null, fout: e.message }; }
  }));
  return uit;
}

/* Elke sink krijgt wat hij mist van de anderen, op volgorde. Dat is het herstel
   na een storing: een sink die even weg was, loopt niet voor altijd achter. */
async function gelijkTrekken(gelezen, publiek, boekId) {
  const goed = new Map();
  for (const g of gelezen) if (g.lijst && !controleerLijst(g.lijst, { boekId, publiek }).length)
    for (const v of g.lijst) goed.set(v.ankerNr, v);
  const alle = [...goed.values()].sort((a, b) => a.ankerNr - b.ankerNr);
  for (const g of gelezen) {
    if (!g.lijst) continue;
    const heeft = new Set(g.lijst.map(v => v.ankerNr));
    for (const v of alle) if (!heeft.has(v.ankerNr)) { try { await g.sink.append(v); } catch (e) { g.fout = e.message; } }
  }
  return alle;
}

async function maakAnker({ pool, sinks, sleutels, boekId, nu = Date.now(), minSinks = 1, force = false }) {
  if (!sleutels || !sleutels.prive) throw Object.assign(new Error('Geen ankersleutel: er kan niet worden verankerd.'), { code: 'ANKER_GEEN_SLEUTEL' });
  if (!sinks.length || sinks.length < minSinks) throw Object.assign(new Error('Te weinig ankerbestemmingen (' + sinks.length + ' van minimaal ' + minSinks + ').'), { code: 'ANKER_TE_WEINIG_SINKS' });
  const top = await kop(pool);
  if (!top) return { overgeslagen: 'leeg' };
  const gelezen = await leesSinks(sinks);
  const alle = await gelijkTrekken(gelezen, sleutels.publiek, boekId);
  const laatste = alle[alle.length - 1] || null;
  if (laatste && laatste.kop.nr === top.nr && !force) return { overgeslagen: 'ongewijzigd', ankerNr: laatste.ankerNr };
  const v = teken({ formaat: FORMAAT, boekId, ankerNr: laatste ? laatste.ankerNr + 1 : 1, vorigeAnkerHash: laatste ? ankerHash(laatste) : null,
    kop: top, tijd: new Date(nu).toISOString() }, sleutels.prive);
  const uitslag = await Promise.allSettled(sinks.map(s => s.append(v)));
  const ontvangsten = uitslag.map((u, i) => ({ sink: sinks[i].naam, ok: u.status === 'fulfilled', ontvangst: u.status === 'fulfilled' ? u.value : String(u.reason && u.reason.message || u.reason) }));
  const gelukt = ontvangsten.filter(o => o.ok).length;
  if (gelukt < minSinks) throw Object.assign(new Error('Anker ' + v.ankerNr + ' is niet weggezet: ' + gelukt + ' van minimaal ' + minSinks + ' bestemmingen namen het aan.'), { code: 'ANKER_NIET_WEGGEZET', ontvangsten });
  await pool.query('INSERT INTO auditboek_anker(anker_nr, nr, hash, tijd, verklaring, ontvangsten) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
    [v.ankerNr, top.nr, top.hash, v.tijd, kanoniek(v), JSON.stringify(ontvangsten)]);
  return { ankerNr: v.ankerNr, kop: top, ontvangsten, gelukt };
}

module.exports = { teken, controleerHandtekening, controleerLijst, ankerHash, laadSleutels, maakAnker, leesSinks, gelijkTrekken, kop, FORMAAT, DOMEIN };
