/* De eerste harde rand van de Economic Identity Graph: één sessie levert één
   opaque principalRef op. Namen en e-mailadressen komen nooit in economische
   feiten of proof-projecties terecht. */
'use strict';

function principalVoorSession(session) {
  const s = session || {};
  if (s.account && s.account.id) return 'acc:' + String(s.account.id);
  if (s.tier && s.tier !== 'guest') return 'sess:' + String(s.tier).toLowerCase();
  return null;
}

module.exports = { principalVoorSession };
