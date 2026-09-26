'use strict';
module.exports = { SLEUTELS: {
  // Transport caches deliberately skip /actie; the durable domain receipt owns this identity.
  'POST /api/bestanden/actie': { velden: ['operationId'], waarom: 'Owner-scoped identity binds contract/version/resource/expectedVersion; changed input conflicts. Durable domain handler rechecks authority on every retry.' },
  // Declares duplicate identity only, not purge recovery or release proof.
  'POST /api/bestanden/wis': { velden: ['id'], waarom: 'Explicit legacy erasure of this owned trashed resource. A repeated id cannot erase another resource; crash/backup cleanup remains unproven and outside the pilot.' }
} };
