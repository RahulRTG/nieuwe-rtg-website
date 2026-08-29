/* Alleen experience-state: resume, acknowledgement, korte previews en het
   append-only action evidence-log. Nooit domeinobjecten of projections. */
'use strict';

const { hash, kopie } = require('./canon');

module.exports = function maakOpslag({ db, save, crypto, nu }) {
  const tijd = () => (nu ? nu() : new Date().toISOString());
  const eigen = require('../eigencollectie')({ db, domein: 'kern/experience',
    bezit: { experiencePlatform: 'kaart' } });
  function experienceWortel() {
    const r = eigen.bak('experiencePlatform', bak => Object.assign(bak, {
      version: 2, resume: {}, attention: {}, previews: {}, idempotency: {},
      evidence: [], lastEvidenceHashByActor: {}, evidenceCheckpointByActor: {}
    }));
    for (const n of ['resume', 'attention', 'previews', 'idempotency'])
      if (!r[n] || typeof r[n] !== 'object') r[n] = {};
    if (!Array.isArray(r.evidence)) r.evidence = [];
    /* v1 had one platform-wide chain. That made a member's proof depend on
       hidden records belonging to other actors. New evidence starts an
       independently verifiable v2 chain per opaque actor. The v1 records stay
       immutable and remain hash-verifiable as legacy evidence. */
    if (!r.lastEvidenceHashByActor || typeof r.lastEvidenceHashByActor !== 'object')
      r.lastEvidenceHashByActor = {};
    const nieuweCheckpoints = !r.evidenceCheckpointByActor ||
      typeof r.evidenceCheckpointByActor !== 'object';
    if (nieuweCheckpoints) r.evidenceCheckpointByActor = {};
    /* A v2 log may already have been trimmed before checkpoints existed. Trust
       only that one migration boundary. De huidige laag kapt nooit stil af, dus
       ieder later gat blijft een harde CHAIN_MISMATCH. */
    if (nieuweCheckpoints) for (const e of r.evidence) {
      if (e && e.version === 2 && e.previousHash && !(e.actor in r.evidenceCheckpointByActor))
        r.evidenceCheckpointByActor[e.actor] = e.previousHash;
    }
    r.version = Math.max(2, Number(r.version) || 1);
    return r;
  }
  const actor = key => 'actor_' + hash(crypto, String(key || '')).slice(0, 20);
  const bewaar = () => save();

  function resumeLees(key) { return kopie(experienceWortel().resume[actor(key)] || null); }
  function resumeZet(key, waarde) {
    const v = { ...kopie(waarde), updatedAt: tijd() };
    experienceWortel().resume[actor(key)] = v; bewaar(); return kopie(v);
  }
  function attentionLees(key, id) {
    const a = experienceWortel().attention[actor(key)] || {};
    return kopie(a[id] || null);
  }
  function attentionZet(key, id, waarde) {
    const r = experienceWortel(), a = r.attention[actor(key)] || (r.attention[actor(key)] = {});
    a[id] = { ...kopie(waarde), updatedAt: tijd() }; bewaar(); return kopie(a[id]);
  }
  function previewZet(key, waarde) {
    const r = experienceWortel(); r.previews[waarde.id] = { ...kopie(waarde), actor: actor(key) };
    ruimPreviews(r); bewaar(); return kopie(r.previews[waarde.id]);
  }
  function previewLees(key, id) {
    const p = experienceWortel().previews[id];
    return p && p.actor === actor(key) ? kopie(p) : null;
  }
  function ruimPreviews(r) {
    const nuMs = Date.parse(tijd());
    const grens = (Number.isFinite(nuMs) ? nuMs : Date.now()) - 86400000;
    Object.keys(r.previews).forEach(k => {
      const p = r.previews[k], t = Date.parse(p.expiresAt || p.createdAt || 0);
      if (!Number.isFinite(t) || t < grens) delete r.previews[k];
    });
  }
  function idemLees(key, idemKey) {
    return kopie(experienceWortel().idempotency[actor(key) + ':' + String(idemKey || '')] || null);
  }
  /* Preview, evidence en idem-resultaat zijn één Experience-mutatie. Alle
     willekeur en hashing gebeurt vóór de toestand verandert; daarna volgt één
     save binnen de duurzame bundel van de broker. */
  function actieAfronden(key, previewId, idemKey, fingerprint, inhoud, basisResultaat) {
    const r = experienceWortel(), p = r.previews[previewId], wie = actor(key);
    if (!p || p.actor !== wie) return null;
    if (!r.lastEvidenceHashByActor[wie]) {
      const laatste = r.evidence.slice().reverse().find(e => e.actor === wie && e.version === 2);
      if (laatste) r.lastEvidenceHashByActor[wie] = laatste.hash;
    }
    const body = { id: 'xee_' + crypto.randomBytes(12).toString('hex'), version: 2,
      chain: 'ACTOR', actor: wie, recordedAt: tijd(),
      previousHash: r.lastEvidenceHashByActor[wie] || null, ...kopie(inhoud) };
    body.hash = hash(crypto, body);
    const resultaat = { ...kopie(basisResultaat),
      evidence: { id: body.id, hash: body.hash, recordedAt: body.recordedAt }, replay: false };
    /* Nooit stil afkappen: retentie of archivering moet een expliciete,
       bewezen overdracht zijn; een drukke actor mag andermans bewijs niet uit
       een globale ringbuffer duwen. */
    r.evidence.push(body);
    r.lastEvidenceHashByActor[wie] = body.hash;
    p.executedAt = body.recordedAt;
    r.idempotency[wie + ':' + String(idemKey)] = { previewId, fingerprint,
      createdAt: body.recordedAt, result: kopie(resultaat) };
    bewaar();
    return resultaat;
  }
  function bewijsVoor(key, limiet) {
    const n = Math.min(100, Math.max(1, Number(limiet) || 25));
    return experienceWortel().evidence.filter(e => e.actor === actor(key)).slice(-n).map(kopie);
  }

  function bewijsIntegriteitVoor(key) {
    const wie = actor(key), r = experienceWortel(), actorBewijs = r.evidence.filter(e => e.actor === wie);
    let vorigV2 = r.evidenceCheckpointByActor[wie] || null, gezienV2 = false;
    const checkpoint = !!vorigV2;
    for (const e of actorBewijs) {
      const body = kopie(e), ontvangen = body.hash;
      delete body.hash;
      if (!ontvangen || hash(crypto, body) !== ontvangen)
        return { status: 'INVALID', valid: false, actor: wie, count: actorBewijs.length,
          failedEvidenceId: e.id || null, reason: 'HASH_MISMATCH' };
      if (e.version === 2) {
        if (e.previousHash !== vorigV2)
          return { status: 'INVALID', valid: false, actor: wie, count: actorBewijs.length,
            failedEvidenceId: e.id || null, reason: 'CHAIN_MISMATCH' };
        gezienV2 = true; vorigV2 = ontvangen;
      }
    }
    return { status: actorBewijs.length ? (checkpoint ? 'VERIFIED_FROM_CHECKPOINT' : 'VERIFIED')
      : (checkpoint ? 'VERIFIED_FROM_CHECKPOINT' : 'EMPTY'),
      valid: true, actor: wie, count: actorBewijs.length,
      chainVersion: gezienV2 ? 2 : (actorBewijs.length ? 1 : null), headHash: vorigV2,
      checkpointed: checkpoint, verifiedAt: tijd() };
  }

  return { tijd, actor, resumeLees, resumeZet, attentionLees, attentionZet,
    previewZet, previewLees, idemLees, bewijsVoor,
    bewijsIntegriteitVoor, actieAfronden };
};
