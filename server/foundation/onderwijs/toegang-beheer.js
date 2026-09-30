/* Het beheer van een RTFoundation-les door de leraar: de lescode roteren of
   intrekken, een leerling zijn toegang ontnemen, de les sluiten. Elke stap
   controleert de leraarssleutel opnieuw BINNEN de collectietransactie, zodat een
   intrekking die net op een andere instance landde niet overschreven wordt.
   Hoort bij ./toegang.js (CODECREDENTIALS.json, foundation.onderwijs_les_tokens). */
'use strict';

module.exports = ({ bearer, transactie, maakSleutel, dicht, kaal, nu, DOEL, SCOPE }) => {
  /* Beheer door de leraar, telkens opnieuw gecontroleerd BINNEN de transactie. */
  function alsLeraar(lesId, sleutel, werk) {
    const gezocht = bearer.hash(kaal(sleutel));
    return transactie(lessen => {
      const les = lessen[String(lesId || '')];
      if (!les || !les.leraar) return { status: 404, error: 'Deze les kennen we niet.' };
      if (!kaal(sleutel) || !bearer.zelfdeHash(les.leraar.code_hash, gezocht))
        return { status: 403, error: 'Alleen de begeleider kan dit doen.' };
      if (dicht(les)) return { status: 410, error: 'Deze les is al afgelopen.' };
      if (bearer.reden(les.leraar, { doel: DOEL.leraar, scope: SCOPE.leraar, negeerGebruik: true }))
        return { status: 403, error: 'Alleen de begeleider kan dit doen.' };
      return werk(les);
    });
  }
  const roteerLescode = (lesId, sleutel) => alsLeraar(lesId, sleutel, les => {
    bearer.intrekken(les.lescode, 'leraar', 'geroteerd');
    les.lescode_historie.push({ code_hash: les.lescode.code_hash, ingetrokken_at: les.lescode.ingetrokken_at,
      rotatie: les.lescode.rotatie });
    if (les.lescode_historie.length > 20) les.lescode_historie.shift();
    const nieuw = maakSleutel('lescode', les);
    nieuw.toegang.rotatie = (les.lescode.rotatie || 1) + 1;
    les.lescode = nieuw.toegang;
    return { ok: true, lescode: nieuw.code, toegang: bearer.publiek(les.lescode) };
  });
  const intrekLescode = (lesId, sleutel) => alsLeraar(lesId, sleutel, les => {
    bearer.intrekken(les.lescode, 'leraar', 'meedoen gestopt');
    return { ok: true, toegang: bearer.publiek(les.lescode) };
  });
  const intrekLeerling = (lesId, sleutel, studentId) => alsLeraar(lesId, sleutel, les => {
    const t = les.leerlingen[String(studentId || '')];
    if (!t) return { status: 404, error: 'Leerling niet gevonden.' };
    bearer.intrekken(t, 'leraar', 'toegang ingetrokken');
    return { ok: true, studentId: String(studentId) };
  });
  const sluit = (lesId, sleutel) => alsLeraar(lesId, sleutel, les => {
    les.gesloten_at = nu();
    bearer.intrekken(les.lescode, 'leraar', 'les gesloten');
    bearer.intrekken(les.leraar, 'leraar', 'les gesloten');
    for (const t of Object.values(les.leerlingen)) bearer.intrekken(t, 'leraar', 'les gesloten');
    return { ok: true, gesloten_at: les.gesloten_at };
  });

  return { roteerLescode, intrekLescode, intrekLeerling, sluit };
};
