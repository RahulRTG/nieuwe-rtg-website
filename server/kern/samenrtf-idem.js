/* Duurzame herhaalbinding voor handelingen binnen een RTF Samen-kamer. */
'use strict';

module.exports = ({ afdruk, iso }) => function idempotentie(
  k, soort, sess, idem, inhoud
) {
  const waarde = String(idem || '').trim().slice(0, 200);
  if (!waarde) return { fout: { status: 400,
    error: 'Een idempotentiesleutel is verplicht voor deze Samen-actie.' } };
  const sleutel = afdruk('rtf-samen-handeling|' + soort + '|' +
    sess.handle + '|' + waarde);
  const fingerprint = afdruk('rtf-samen-inhoud|' + soort + '|' + inhoud);
  k.handelingen = Array.isArray(k.handelingen) ? k.handelingen : [];
  const oud = k.handelingen.find(x => x.sleutel_hash === sleutel);
  if (oud) return oud.fingerprint_hash === fingerprint
    ? { herhaald: true }
    : { fout: { status: 409,
      error: 'Deze idempotentiesleutel hoort bij een andere Samen-actie.' } };
  k.handelingen.push({ sleutel_hash: sleutel,
    fingerprint_hash: fingerprint, soort, at: iso() });
  if (k.handelingen.length > 200) k.handelingen.shift();
  return { nieuw: true };
};
