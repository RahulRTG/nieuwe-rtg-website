'use strict';
const { opslagVoor } = require('./proefsessies');

async function post(url, lijf, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(lijf) });
  return r.json().catch(() => null);
}

/* Echte, tijdelijke lessleutels voor de twee Foundation-schermen die de
   liegronde meet. Dit staat bewust niet in proefsessies.js: dat bestand hoort
   ook bij bevoegdheidsmetingen, terwijl deze fixture alleen waarheid meet. */
async function haalSchoolsessies(basis, sessies) {
  const lid = sessies && sessies.lid && sessies.lid.waarde;
  const ouder = sessies && sessies.gezin && sessies.gezin.waarde;
  if (typeof lid !== 'string' || !ouder || !ouder.code || !ouder.token) return null;
  const profiel = await post(basis + '/api/foundation/gezin/profiel/maak', {
    code: ouder.code, token: ouder.token, naam: 'Leerling proef', rol: 'kind', geboortedatum: '2016-04-12', pin: '5678'
  });
  const profielId = profiel && profiel.profiel && profiel.profiel.id;
  if (!profielId) return null;
  const gekozen = await post(basis + '/api/foundation/gezin/profiel/kies', { code: ouder.code, token: ouder.token, profielId, pin: '5678' });
  if (!gekozen || !gekozen.token) return null;
  const kind = { code: ouder.code, token: gekozen.token, profiel: gekozen.profiel };
  const les = await post(basis + '/api/foundation/les/maak', {
    vak: 'Waarheidsproef', naam: 'Begeleider proef', idem: 'liegronde-les-' + Date.now().toString(36)
  }, lid);
  if (!les || !les.lesId || !les.token || !les.lescode) return null;
  const deelname = await post(basis + '/api/foundation/les/join', {
    lescode: les.lescode, naam: 'Leerling proef', gezinCode: kind.code, gezinToken: kind.token
  });
  if (!deelname || !deelname.token || !deelname.lesId) return null;
  return {
    bord: { lokaal: opslagVoor({ gezin: sessies.gezin }),
      tijdelijk: { rtf_docent: { code: les.lesId, token: les.token, lescode: les.lescode } } },
    schrift: { lokaal: opslagVoor({ gezin: { ...sessies.gezin, waarde: kind } }),
      tijdelijk: { rtf_leerling: { code: deelname.lesId, token: deelname.token, naam: 'Leerling proef' } } }
  };
}

module.exports = { haalSchoolsessies };
