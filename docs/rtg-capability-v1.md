# Documents reference candidate — Capability v1

This is the certification design, not a declaration of certification or production readiness. The final, candidate-bound decision is `DOCUMENT-PILOT-CERTIFICATION.json` in the certification evidence bundle. A change to any meaning contract invalidates evidence with the old digest.

## Authoritative path

```text
Documents panel / gestures ─┐
Standard Edge Bar ──────────┼─ shared/document-capability.js ─┐
Memo (existing consumer) ───┘                               │
Direct API ─────────────────────────────────────────────────┼─ POST /api/bestanden/actie
Rahul proposal → server-held human confirmation ────────────┘          │
Legacy owner /weg and /herstel → translate explicit intent ────────────┤
                                                                      ↓
                       shared auth → documentActie → owner policy → version/state checks
                                                                      ↓
                                              one transactional collection mutation
                                                                      ↓
                                                     state + durable operation receipt
```

Canonical identities are `documents.trash@1` and `documents.restore@1`. Requests carry `capability: "documents.trash"` or `"documents.restore"` plus `contractVersion: 1`. The machine contract is [document-contracten-v1.json](../server/kern/document-contracten-v1.json). The digest covers all semantic fields, not just the capability name. The policy has its own identity and digest. These digests bind stored operation fingerprints and receipts.

Authorization uses the existing session resolver at admission and again inside the transaction callback after any wait. That callback receives a server-created closure, never an input field. Owner lookup uses the collection locked by SQLite/PostgreSQL. Authorization and version checks precede mutation and receipt replay. A permission revocation observed before that linearization point denies execution. Revocation after that point does not retroactively undo an already authorized transition.

## State and recovery

A fresh restore of an ACTIVE file is `409 invalid_state`. A retry of a previously committed restore returns its original receipt and the current resource projection. A fresh trash of a TRASHED file with its current version is a no-op receipt, never permanent erasure. Stale new requests conflict. The revision prevents ACTIVE → TRASHED → ACTIVE from making an old version current again.

The state transition and audit receipt are one transaction. There is no separate required lifecycle event consumer, external search index or notification promise in these two contracts. Vault, shared-file visibility and gallery reads derive from current persisted metadata. Clients refresh on explicit reload, focus and reconnect; this is pull convergence, not a realtime push guarantee. A lost response after commit is resolved by retrying the identical operation. Blob-content availability is verified before a restore can succeed. SQL failure cannot leave a committed lifecycle transition without its receipt.

A delayed response cannot overwrite a newer client projection. Concurrent refreshes use sequence ordering. A metadata edit or content upload waiting behind a lifecycle transition rechecks the version and state under the same collection lock.

## Scope of no-bypass review

The sole ACTIVE/TRASHED writer is `server/kern/document-capability.js`. Owner legacy endpoints are adapters. Creation initializes a new ACTIVE object; metadata edits and content-version restore are different actions and cannot assign lifecycle fields. Existing recipient removal, explicit legacy purge, empty-trash, retention cleanup and account forgetting are separately identified existing semantics. They are **not certified here**, and are not treated as alternative implementations of trash or restore. Administrative whole-database recovery is also outside this bounded application contract.

`node scripts/document-fitness.js` scans server/browser compilation units, including assembled source fragments, and is a required CI preflight. It enforces named composition roots, private handler access, known collection access/writers and adapter authority forwarding. The exact exceptions are in that script; there is no ignore-by-directory option. Negative fixtures prove enforcement. This is not a proof of arbitrary reflective JavaScript information flow.

## Evidence and trust

The local artifact is a source/web-build archive verified against the actual execution files. It is not an OCI production image or a promotion artifact. Every certified test run must bind the full commit, archive digest, contract/policy digests, timestamp and hashed logs. Decision computation reads actual required test identities and results; a supplied PASS string is ignored.

Local checksum binding is unsigned integrity, not an authorized release attestation. A future reviewer can wrap the bundle under the existing `EVIDENCE` role (`RTG:EXTERNAL-EVIDENCE:v1`); build and promotion keys have no implied evidence authority. This round generates and uses no release private keys.

## Differential decisions

- `EXPECTED_SEMANTIC_CORRECTION`: canonical plural/versioned identities; a new restore of ACTIVE is invalid; old operations cannot silently bind to a changed contract.
- `LEGACY_DEFECT`: Edge trash had no loaded weight gate and did nothing; Memo omitted the required operation identity/version; optimistic asynchronous completion could announce an unconfirmed effect; metadata edits could race lifecycle writes.
- `LEGACY_DEFECT`: delayed mutation/read responses could replace newer client projections.
- Historical `/weg` second-click permanent deletion was already separated by the initial pilot. This round preserves that correction; it does not certify legacy purge recovery.

No further domain is migrated by this document. `documents.leave`, `documents.purge`, full Documents, translations, physical hardware, MONEY-012 and RTG production readiness remain outside the certification. MONEY-012 remains an independent P0 release blocker. Capability v1 is not frozen as the official proven reference until the certification decision is PROVEN on its exact candidate and relevant CI has passed.
