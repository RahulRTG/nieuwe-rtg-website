/* Deterministische retries: dezelfde operatie krijgt hetzelfde schema. Iedere
   poging levert een receipt; ambigue geldresultaten vereisen reconciliatie. */
'use strict';

const { hash, bevries } = require('./canon');

const NETWERK = new Set(['ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ETIMEDOUT', 'ENETUNREACH']);

function classificeerFout(fout) {
  const status = Number(fout && (fout.status || fout.statusCode));
  const code = fout && fout.code;
  if ((status === 408 || status === 425 || status === 429 || status >= 500) || NETWERK.has(code)) return 'RETRYABLE';
  if (status >= 400 && status < 500) return 'TERMINAL';
  return 'UNKNOWN';
}

function vertraging(operationId, poging, beleid) {
  const b = beleid || {}, basis = Number(b.baseMs) || 500, max = Number(b.maxMs) || 60000;
  const getal = parseInt(hash(String(operationId) + ':' + poging).slice(0, 8), 16) / 0xffffffff;
  const jitter = 0.8 + getal * 0.4;
  return Math.min(max, Math.round(basis * Math.pow(2, Math.max(0, poging - 1)) * jitter));
}

async function voerUit(opties) {
  const o = opties || {};
  if (!o.operationId || !o.idempotencyKey || !o.inputHash || typeof o.execute !== 'function')
    throw new Error('bewijsvlak retry: operationId, idempotencyKey, inputHash en execute zijn verplicht');
  const maximum = Math.max(1, Math.min(20, Number(o.policy && o.policy.maxAttempts) || 3));
  const receipts = [];
  for (let poging = 1; poging <= maximum; poging++) {
    const gestart = new Date().toISOString();
    try {
      const result = await o.execute({ attempt: poging, operationId: o.operationId,
        idempotencyKey: o.idempotencyKey, inputHash: o.inputHash });
      const status = Number(result && result.status);
      if (!status || status < 400) {
        const r = bevries({ attempt: poging, at: gestart, outcome: 'SUCCESS', inputHash: o.inputHash });
        receipts.push(r); if (o.onAttempt) await o.onAttempt(r);
        return { ok: true, result, receipts };
      }
      throw Object.assign(new Error('provider status ' + status), { status, response: result,
        ambiguous: !!result.ambiguous });
    } catch (fout) {
      let klasse = classificeerFout(fout);
      if (fout && fout.ambiguous && o.money === true) {
        if (typeof o.reconcile !== 'function') klasse = 'RECONCILE_REQUIRED';
        else {
          const stand = await o.reconcile({ operationId: o.operationId,
            idempotencyKey: o.idempotencyKey, inputHash: o.inputHash, attempt: poging });
          if (stand && stand.completed) {
            const r = bevries({ attempt: poging, at: gestart, outcome: 'RECONCILED_SUCCESS', inputHash: o.inputHash });
            receipts.push(r); if (o.onAttempt) await o.onAttempt(r);
            return { ok: true, result: stand.result, receipts, reconciled: true };
          }
          if (!(stand && stand.safeToRetry)) klasse = 'RECONCILE_REQUIRED';
          else klasse = 'RETRYABLE';
        }
      }
      const laatste = poging >= maximum || klasse !== 'RETRYABLE';
      const delayMs = laatste ? null : vertraging(o.operationId, poging, o.policy);
      const receipt = bevries({ attempt: poging, at: gestart, outcome: laatste ? 'FAILED' : 'RETRY_SCHEDULED',
        classification: klasse, inputHash: o.inputHash, delayMs,
        errorCode: fout && (fout.code || fout.status || null) });
      receipts.push(receipt); if (o.onAttempt) await o.onAttempt(receipt);
      if (laatste) return { ok: false, decision: klasse === 'TERMINAL' ? 'DENY' : 'ESCALATE', classification: klasse, receipts };
      if (o.wait) await o.wait(delayMs);
    }
  }
}

module.exports = { classificeer: classificeerFout, vertraging, voerUit };
