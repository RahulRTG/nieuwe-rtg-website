/* R6 Profile Media: drie ledenhandelingen, alle drie begrensd door de Vonk-
   capability en de eigenaar. Upload draagt daarnaast een idempotentiesleutel. */
'use strict';

const AFGETEKEND = {
  door: 'Codex, kern en gerichte Connection Profile Media-proef nagelezen; niet door een mens nagelezen',
  op: '2026-09-22'
};
const toegang = { klasse: 'AUTHENTICATED', connectionCapability: 'connection.profile.photo.manage',
  uitleg: 'auth stelt het lid vast; daarna opent de Connection-policy beheer alleen voor het eigen Vonk-profiel' };
const bewijs = wat => ({ gemeten: 'test/connection-profile-media.test.js bewijst ' + wat, op: '2026-09-22' });

const CONTRACTEN = {
  'POST /api/vonk/profile-photo': {
    mutatieId: 'vonk.profile.photo.upload', herkomst: 'mens',
    semantiek: { klasse: 'sleutelVereist' }, toegang, stand: 'PROTECTED',
    nagekeken: 'Idempotency-Key is verplicht en de kern geeft bij dezelfde eigenaar en sleutel hetzelfde media-object terug zonder tweede opslag.',
    bewijs: bewijs('conceptstatus, privé-opslag, metadatareductie en herhaalbare upload'), afgetekend: AFGETEKEND
  },
  'POST /api/vonk/profile-photo/publish': {
    mutatieId: 'vonk.profile.photo.publish', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang, stand: 'PROTECTED',
    nagekeken: 'De kern vergelijkt visibility en publicatiestatus; dezelfde gewenste stand geeft herhaald:true terug zonder versie- of lifecyclemutatie.',
    bewijs: bewijs('dat identieke publicatie dezelfde versie houdt en intrekken oude tickets direct sluit'), afgetekend: AFGETEKEND
  },
  'POST /api/vonk/profile-photo/remove': {
    mutatieId: 'vonk.profile.photo.remove', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang, stand: 'PROTECTED',
    nagekeken: 'De eerste aanroep verwijdert exact het media-object van de sessie-eigenaar; een herhaling vindt geen object en kan niets opnieuw verwijderen.',
    bewijs: bewijs('dat een verdwenen of ingetrokken versie niet meer leverbaar is'), afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };
