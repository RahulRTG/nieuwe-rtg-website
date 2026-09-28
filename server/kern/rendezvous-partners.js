/* De gedeelde Connection-partnerregels, vertaald naar Rendez-vous-projecties. */
'use strict';

module.exports = ({ Projection, partnerSuppliers, partnerBookings }) => {
  const ConnectionPartner = require('./connection-partner');
  const leveranciers = () => typeof partnerSuppliers === 'function' ? partnerSuppliers() : [];
  const boekingen = () => typeof partnerBookings === 'function' ? partnerBookings() : [];

  const partnerCandidates = (program, context) => ConnectionPartner.candidates(leveranciers(), program,
    { ...(context || {}), bookings: boekingen() }).map(s => Projection.project(Projection.NAMES.CONNECTION_PARTNER_OFFICE, {
      code: s.code, name: s.name, city: s.city, location: s.loc && s.loc.label, program,
      services: ConnectionPartner.stored(s, program).services
    }));

  const partnerEligible = (code, program, context) => {
    const s = leveranciers().find(x => x.code === code);
    const reserveringen = boekingen();
    return !!(s && ConnectionPartner.eligible(s, program, { ...(context || {}), bookings: reserveringen,
      activeBookings: ConnectionPartner.activeBookings(reserveringen, code, context && context.date, context && context.time) }).ok);
  };

  return { partnerCandidates, partnerEligible };
};
