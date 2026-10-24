/* Dezelfde synchrone tekenmotor op de verse waarde onder het bestaande
   collectieslot. Geen tijdelijke db.data-wissel en geen tweede tekenmotor. */
'use strict';
module.exports = ({ bewerkCollectie, maakLokaal, verifieerGezin }) => {
async function uitvoeren(scope, sess, naam, akkoord, expectedVersion, gezin) {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)
    return { status: 409, code: 'version_conflict', error: 'Open de actuele overeenkomst voordat u tekent.' };
  if (typeof bewerkCollectie !== 'function')
    return { status: 503, error: 'De ondertekening kan nu niet worden vastgelegd. Probeer het opnieuw.' };
  try {
    if (gezin && typeof verifieerGezin !== 'function') throw new Error('Gezinscontrole ontbreekt');
    return await bewerkCollectie(gezin ? { foundation: 'kaart', onboarding: 'kaart' } : 'onboarding', collecties => {
      // Een weigering mag ook geen initialisatie of migratie opslaan.
      const bron = gezin ? collecties.onboarding : collecties;
      let foundation;
      if (gezin) {
        foundation = structuredClone(collecties.foundation);
        const s = verifieerGezin(gezin.code, gezin.token, foundation);
        if (!s || s.gast) return { status: 403, error: 'Log opnieuw in bij je gezin.' };
        sess = { key: s.handle, tier: 'rtf', account: null };
      }
      const data = { onboarding: JSON.parse(JSON.stringify(bron)) };
      const r = maakLokaal(data).teken(scope, sess, naam, akkoord, expectedVersion);
      if (!r.error) {
        Object.assign(bron, data.onboarding);
        if (gezin) Object.assign(collecties.foundation, foundation);
      }
      return r;
    });
  } catch (e) {
    console.warn('[onboarding] ondertekening niet bevestigd:', e && e.message);
    return { status: 503, error: 'De ondertekening is niet bevestigd. Probeer dezelfde opdracht opnieuw.' };
  }
}
const tekenVast = (scope, sess, naam, akkoord, versie) => uitvoeren(scope, sess, naam, akkoord, versie);
tekenVast.gezin = (code, token, naam, akkoord, versie) => uitvoeren('rtg', null, naam, akkoord, versie, { code, token });
return tekenVast;
};
