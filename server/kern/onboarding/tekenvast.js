/* Dezelfde synchrone tekenmotor op de verse waarde onder het bestaande
   collectieslot. Geen tijdelijke db.data-wissel en geen tweede tekenmotor. */
'use strict';
module.exports = ({ bewerkCollectie, maakLokaal }) => async function tekenVast(scope, sess, naam, akkoord, expectedVersion) {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)
    return { status: 409, code: 'version_conflict', error: 'Open de actuele overeenkomst voordat u tekent.' };
  if (typeof bewerkCollectie !== 'function')
    return { status: 503, error: 'De ondertekening kan nu niet worden vastgelegd. Probeer het opnieuw.' };
  try {
    return await bewerkCollectie('onboarding', bron => {
      // Een weigering mag ook geen initialisatie of migratie opslaan.
      const data = { onboarding: JSON.parse(JSON.stringify(bron)) };
      const r = maakLokaal(data).teken(scope, sess, naam, akkoord, expectedVersion);
      if (!r.error) Object.assign(bron, data.onboarding);
      return r;
    });
  } catch (e) {
    console.warn('[onboarding] ondertekening niet bevestigd:', e && e.message);
    return { status: 503, error: 'De ondertekening is niet bevestigd. Probeer dezelfde opdracht opnieuw.' };
  }
};
