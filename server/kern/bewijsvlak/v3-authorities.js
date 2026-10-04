/* Versioned authority/source contracts for V3 evidence.

   A caller cannot turn free-form source/authority strings into evidence. Only a
   trusted adapter inside `maakV3` receives the opaque, one-use grant needed to
   attach one of these contracts. The persisted attestation binds the exact
   normalized EvidenceRecord to the immutable contract version. */
'use strict';

const { hash, kopie, bevries } = require('./canon');
const { PAYMENT_PROVIDERS, BUILTIN } = require('./v3-authority-contracts');

const velden = ['factTypes', 'truthClasses', 'scopes', 'sourceTypes', 'sourceRefs', 'authorityIds',
  'authorityBases', 'operationDomains', 'capabilities', 'providers'];

function fout(code, reden) {
  const e = new Error('bewijsvlak v3 authority: ' + reden);
  e.code = code;
  return e;
}

function normaliseer(input) {
  const c = kopie(input || {});
  if (!/^[a-z][a-z0-9.-]{2,120}$/.test(String(c.id || '')) || !Number.isSafeInteger(c.version) || c.version < 1)
    throw fout('AUTHORITY_CONTRACT_INVALID', 'ongeldige contractref');
  if (!/^[a-z0-9:._-]{3,180}$/i.test(String(c.signer || '')))
    throw fout('AUTHORITY_CONTRACT_INVALID', 'signer ontbreekt');
  for (const key of velden) c[key] = [...new Set((c[key] || []).map(String))].sort();
  c.providerRequired = c.providerRequired === true;
  c.sourceRefEqualsProvider = c.sourceRefEqualsProvider === true;
  c.sourceRefEqualsAuthorityId = c.sourceRefEqualsAuthorityId === true;
  c.authorityIdProviderPrefix = c.authorityIdProviderPrefix ? String(c.authorityIdProviderPrefix) : null;
  c.authorityIdSourcePrefix = c.authorityIdSourcePrefix ? String(c.authorityIdSourcePrefix) : null;
  c.authorityBasesPrefix = c.authorityBasesPrefix ? String(c.authorityBasesPrefix) : null;
  c.mechanism = 'opaque-adapter-v1';
  c.contractDigest = hash({ ...c, contractDigest: undefined });
  return bevries(c);
}

function bevat(lijst, waarde) { return !lijst.length || lijst.includes(String(waarde == null ? '' : waarde)); }

function redenen(contract, evidence, declaredSigner) {
  const e = evidence || {}, source = e.source || {}, authority = e.authority || {}, operation = e.operation || {};
  const uit = [];
  if (!bevat(contract.factTypes, e.factType)) uit.push('FACT_TYPE');
  if (!bevat(contract.truthClasses, e.truthClass)) uit.push('TRUTH_CLASS');
  const scopes = Array.isArray(authority.scopes) ? authority.scopes : [];
  if (!scopes.length || scopes.some(scope => !contract.scopes.includes(scope))) uit.push('SCOPE');
  if (!bevat(contract.sourceTypes, source.type)) uit.push('SOURCE_TYPE');
  if (!bevat(contract.sourceRefs, source.ref)) uit.push('SOURCE_REF');
  if (!bevat(contract.authorityIds, authority.id)) uit.push('AUTHORITY_ID');
  if (!bevat(contract.authorityBases, authority.basis)) uit.push('AUTHORITY_BASIS');
  if (contract.authorityBasesPrefix && !String(authority.basis || '').startsWith(contract.authorityBasesPrefix))
    uit.push('AUTHORITY_BASIS');
  if (!bevat(contract.operationDomains, operation.domain)) uit.push('OPERATION_DOMAIN');
  if (!bevat(contract.capabilities, operation.capability)) uit.push('CAPABILITY');
  if (contract.providerRequired && !operation.provider) uit.push('PROVIDER_REQUIRED');
  if (!bevat(contract.providers, operation.provider)) uit.push('PROVIDER');
  if (contract.sourceRefEqualsProvider && source.ref !== operation.provider) uit.push('SOURCE_PROVIDER_BINDING');
  if (contract.authorityIdProviderPrefix && authority.id !== contract.authorityIdProviderPrefix + operation.provider)
    uit.push('AUTHORITY_PROVIDER_BINDING');
  if (contract.authorityIdSourcePrefix && authority.id !== contract.authorityIdSourcePrefix + source.ref)
    uit.push('AUTHORITY_SOURCE_BINDING');
  if (contract.sourceRefEqualsAuthorityId && source.ref !== authority.id) uit.push('SOURCE_AUTHORITY_BINDING');
  if (declaredSigner != null && String(declaredSigner) !== contract.signer) uit.push('SIGNER');
  return [...new Set(uit)].sort();
}

function zonderAttestatie(evidence) {
  const basis = kopie(evidence || {});
  delete basis.recordDigest; delete basis.evidenceId; delete basis.authorityContract;
  return basis;
}

function maakAuthorityRegister(extra) {
  const map = new Map(), grants = new WeakMap();
  for (const item of [...BUILTIN, ...(extra || [])]) {
    const c = normaliseer(item), key = c.id + '@' + c.version;
    if (map.has(key) && map.get(key).contractDigest !== c.contractDigest)
      throw fout('AUTHORITY_CONTRACT_CONFLICT', 'dezelfde versie heeft andere inhoud');
    map.set(key, c);
  }
  const get = (id, version) => map.get(String(id) + '@' + Number(version)) || null;

  function issue(ref, input) {
    const c = get(ref && ref.id, ref && ref.version);
    if (!c) throw fout('AUTHORITY_CONTRACT_UNKNOWN', 'onbekend authority/source-contract');
    const token = Object.freeze(Object.create(null));
    grants.set(token, { contract: c, inputDigest: hash(input || {}) });
    return token;
  }

  function attest(token, input, evidence) {
    const grant = token && grants.get(token);
    if (!grant || grant.inputDigest !== hash(input || {}))
      throw fout('AUTHORITY_PROOF_REQUIRED', 'caller-supplied authorityvelden zijn geen bewijs');
    grants.delete(token);
    const problems = redenen(grant.contract, evidence, input && input.signer);
    if (problems.length) throw fout('AUTHORITY_CONTRACT_DENIED', problems.join(','));
    const bindingDigest = hash(zonderAttestatie(evidence));
    return bevries({ id: grant.contract.id, version: grant.contract.version,
      digest: grant.contract.contractDigest, signer: grant.contract.signer,
      mechanism: grant.contract.mechanism, bindingDigest });
  }

  function verifyStored(evidence, ref) {
    const a = evidence && evidence.authorityContract, c = a && get(a.id, a.version);
    if (!a || !c || (ref && (a.id !== ref.id || a.version !== ref.version ||
      (ref.digest && a.digest !== ref.digest)))) return false;
    if (a.digest !== c.contractDigest || a.signer !== c.signer || a.mechanism !== c.mechanism) return false;
    if (a.bindingDigest !== hash(zonderAttestatie(evidence))) return false;
    return redenen(c, evidence).length === 0;
  }

  return Object.freeze({ get, issue, attest, verifyStored,
    list: () => [...map.values()].map(kopie) });
}

module.exports = { PAYMENT_PROVIDERS, BUILTIN, normaliseer, maakRegister: maakAuthorityRegister };
