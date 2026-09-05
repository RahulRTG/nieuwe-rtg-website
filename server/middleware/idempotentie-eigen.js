/* Routes met een rijker, domeineigen idempotentiecontract. De centrale
   antwoordkas mag hun toestand-afhankelijke herhaalantwoord niet overstemmen.
   test/idempotentie.test.js houdt beide richtingen van deze lijst tegen de
   routebron: geen zelfdoener ontbreekt en geen uitzondering is betekenisloos. */
'use strict';

const EIGEN = [
  '/api/pay/',
  '/api/bank/',
  '/api/wbw/',
  '/api/pakket/',
  '/api/gast/',
  '/api/podium/',
  '/api/ov/',
  '/api/betaal/',
  '/api/supplier/pay/',
  '/api/supplier/pos/',
  '/api/supplier/giftcard/',
  '/api/supplier/ticket/',
  '/api/supplier/staff/invite',
  '/api/supplier/vracht/',
  '/api/rtgid/annuleer',
  '/api/salon/deal/claim',
  '/api/supplier/salon/deal/redeem',
  '/api/office/bank/mislukking',
  '/api/festival/verkoop/rond',
  '/api/giftcard/buy',
  '/api/supplier/betaalverzoek',
  '/api/appstore/koop',
  '/api/appstore/kantoor/teruggave'
];

const doetHetZelf = pad => EIGEN.some(p => pad.startsWith(p));
module.exports = { EIGEN, doetHetZelf };
