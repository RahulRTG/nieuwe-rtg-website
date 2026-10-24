/* Status lezen schept geen opgeslagen scope of profiel. Oude veldvormen
   worden op een kopie getoond; alleen een echte schrijver migreert de opslag. */
'use strict';
module.exports = ({ db, standaardScope, standaardMoment }) => {
  function normaliseerScope(sc) {
    for (const v of (sc && sc.velden) || []) {
      if (v.id === 'paspoort' && v.label === 'Paspoort of ID-kaart') v.label = 'Voorkant van je paspoort';
      if (!v.moment && standaardMoment(v.id)) v.moment = standaardMoment(v.id);
    }
    return sc;
  }
  function scopeLezen(scope) {
    const sc = db.data.onboarding && db.data.onboarding.scopes && db.data.onboarding.scopes[scope];
    return sc ? normaliseerScope(JSON.parse(JSON.stringify(sc))) : standaardScope();
  }
  function profielLezen(pid) {
    const p = db.data.onboarding && db.data.onboarding.profielen && db.data.onboarding.profielen[pid];
    return p || { velden: {}, ondertekend: {} };
  }
  return { scopeLezen, profielLezen, normaliseerScope };
};
