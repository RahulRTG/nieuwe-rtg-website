/* One server-owned meaning for UI, Edge Bar, API and confirmed Rahul proposals.
   No model, transport cache or client-supplied actor can decide authority here. */
'use strict';
const { createHash } = require('node:crypto');
const { CONTRACTEN, POLICY, policyDigest, staat, fout } = require('./document-contracten');

module.exports = function maakDocumentCapability({ bewerkCollectie, store, leesBytes, nu }) {
  return async function documentActie(key, input, authority) {
    const b = input || {};
    if (!key) return fout(401, 'authentication_required', 'Meld u aan om dit bestand te beheren.');
    if (!bewerkCollectie || !['sqlite', 'postgres'].includes(store))
      return fout(503, 'storage_unavailable', 'De opslag kan deze handeling nu niet duurzaam bevestigen.');
    try {
      return await bewerkCollectie('bestanden', alle => {
        if (typeof authority !== 'function' || authority() !== true)
          return fout(401, 'authority_revoked', 'Uw toegang is niet meer geldig. Meld u opnieuw aan.');
        const bord = alle['lid:' + key];
        const it = bord && (bord.items || []).find(x => x.id === b.id);
        if (!it) return fout(404, 'not_found', 'Dat bestand staat niet in uw eigen kluis.');
        const contract = Object.hasOwn(CONTRACTEN, b.capability) && CONTRACTEN[b.capability];
        if (!contract || b.contractVersion !== 1)
          return fout(400, 'invalid_contract', 'Deze documenthandeling of contractversie is niet bekend.');
        if (Object.keys(b).some(k => !['capability', 'contractVersion', 'id', 'operationId', 'expectedVersion'].includes(k)))
          return fout(400, 'invalid_input', 'Deze documenthandeling bevat onbekende invoervelden.');
        if (typeof b.operationId !== 'string' || typeof b.expectedVersion !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(b.operationId || '') || !/^[a-f0-9]{64}$/.test(b.expectedVersion || ''))
          return fout(428, 'operation_required', 'Open het bestand opnieuw en probeer de handeling nogmaals.');
        const afdruk = createHash('sha256').update(JSON.stringify([
          b.capability, b.contractVersion, b.id, b.expectedVersion, contract.digest, policyDigest
        ])).digest('hex');
        const operaties = bord.documentOperations || {};
        const oud = Object.hasOwn(operaties, b.operationId) && operaties[b.operationId];
        // Ownership is checked before replay, including after account deletion.
        if (oud) {
          if (oud.fingerprint !== afdruk)
            return fout(409, 'operation_conflict', 'Deze opdrachtcode hoort bij een andere handeling.');
          return { ...oud.receipt, resource: staat(it), herhaald: true };
        }
        const voor = staat(it);
        if (voor.version !== b.expectedVersion)
          return fout(409, 'version_conflict', 'Dit bestand is intussen veranderd. Bekijk de actuele versie voordat u verdergaat.');
        if (b.capability === 'documents.restore' && voor.state !== contract.before)
          return fout(409, 'invalid_state', 'Dit bestand staat niet in de prullenbak.');
        // Never silently evict replay protection; capacity requires an explicit retention design.
        if (Object.keys(operaties).length >= 10000)
          return fout(503, 'receipt_capacity', 'De opslag van operatiebewijzen heeft onderhoud nodig. Probeer het later opnieuw.');
        if (b.capability === 'documents.restore' && [it, ...(it.versies || [])].some(v => !leesBytes(v.ref)))
          return fout(410, 'content_unavailable', 'De inhoud is niet volledig beschikbaar. Het bestand is niet als hersteld bevestigd.');
        if (voor.state !== contract.after) {
          it.weg = contract.after === 'trashed';
          it.wegOp = it.weg ? nu() : null;
          it.documentRevision = (it.documentRevision || 0) + 1;
        }
        const receipt = { ok: true, capability: contract.id, contractVersion: 1,
          contractDigest: contract.digest, policy: { id: POLICY.id, digest: policyDigest, decision: 'ALLOW' },
          operationId: b.operationId, resource: staat(it),
          effect: { before: voor.state, after: contract.after, changed: voor.state !== contract.after },
          auditRef: createHash('sha256').update(key + '\0' + b.operationId + '\0' + afdruk).digest('hex'),
          committedAt: nu(), herhaald: false,
          ...(contract.after === 'trashed' ? { prullenbak: true } : {}) };
        operaties[b.operationId] = { fingerprint: afdruk, receipt };
        bord.documentOperations = operaties;
        return receipt;
      });
    } catch (e) {
      // A connection may be lost after COMMIT. Do not claim rollback; retry resolves the receipt.
      return fout(503, 'outcome_unknown', 'De opslag heeft de uitkomst niet bevestigd. Probeer dezelfde opdracht opnieuw.');
    }
  };
};
