/* Productiepoort voor de gedeelde mediastore.

   Een PostgreSQL-installatie is bedoeld om met meer dan een applicatieproces
   te kunnen draaien. Foto's alleen op de lokale schijf bewaren maakt de ene
   instance dan eigenaar van bytes waar de andere wel een databaseverwijzing
   naar ziet. Dat is geen degraded mode: het is een kapotte verwijzing en, na
   instanceverlies, mogelijk permanent verlies.

   De runtime en deze keuring lezen bewust dezelfde parser uit media/s3. Zo kan
   een instelling niet statisch groen zijn en pas bij de eerste upload falen.
   De keuring doet nog geen netwerkproef; die hoort in de go-live-ronde, waar
   put/get/hash/delete met de echte provider kan worden bewezen. */
'use strict';

const { s3ConfigVanEnv } = require('../media/s3');

function keurMedia(env, fouten) {
  const backend = String(env.RTG_MEDIA_BACKEND || '').trim().toLowerCase();
  const gedeeldeRuntime = !!(env.DATABASE_URL || env.PG_URL);

  if (backend && backend !== 'disk' && backend !== 's3') {
    fouten.push('RTG_MEDIA_BACKEND moet exact "disk" of "s3" zijn.');
    return null;
  }

  if (gedeeldeRuntime && backend !== 's3') {
    fouten.push('B2B2C-media vereist RTG_MEDIA_BACKEND=s3: lokale mediabestanden zijn geen gedeelde waarheid voor meerdere instances.');
    return null;
  }

  if (backend !== 's3') return null;
  try {
    return s3ConfigVanEnv({ ...env, NODE_ENV: 'production' });
  } catch (e) {
    fouten.push('S3-mediastore is niet productieklaar: ' + String(e && e.message || e));
    return null;
  }
}

module.exports = { keurMedia };
