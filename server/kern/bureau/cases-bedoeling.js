/* De externe zaakopdracht: ontvangst en zaak delen dezelfde levensdossier-
   transactie. De synchrone interne caseOpen blijft de enige zaakbouwer. */
'use strict';
const { createHash } = require('node:crypto');
const { SOORTEN } = require('./cases-soorten');
module.exports = ({ bewerkCollectie, schoon, maakCases }) => async (key, b = {}) => {
  if (typeof b.idem !== 'string' || !b.idem.trim() || b.idem.length > 200)
    return { status: 400, error: 'Een opdrachtsleutel is vereist. Herhaal een onzekere opdracht met dezelfde sleutel.' };
  if (!key) return { status: 403, error: 'Een eigen dossier is vereist.' };
  if (typeof bewerkCollectie !== 'function')
    return { status: 503, error: 'Duurzame opslag is niet beschikbaar. Bewaar uw opdrachtsleutel.' };
  const dat = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) ? String(d) : '';
  const soort = SOORTEN.includes(b.soort) ? b.soort : 'regulier';
  const inhoud = { titel: schoon(b.titel,120), wat: schoon(b.wat,1200), soort,
    domein: schoon(b.domein,40) || 'huishouden', van: dat(b.van), tot: dat(b.tot)||dat(b.van),
    bedragCenten: Math.max(0,Math.min(1e11,Math.round(Number(b.bedragCenten)||0))),
    knopen: (Array.isArray(b.knopen)?b.knopen:[]).slice(0,40).map(x=>schoon(x,80)).filter(Boolean),
    registreerNaam: soort==='inkoop'?schoon(b.registreerNaam,100):'',
    registreerSoort: soort==='inkoop'&&schoon(b.registreerNaam,100)?schoon(b.registreerSoort,30)||'overig':'' };
  if (!inhoud.titel) return { status: 400, error: 'Waarmee kunnen wij u van dienst zijn?' };
  const hash = x => createHash('sha256').update(x).digest('hex');
  const opdracht = hash(JSON.stringify([String(key), b.idem]));
  const afdruk = hash(JSON.stringify(inhoud));
  return bewerkCollectie('lifestyle', bron => {
    const levens = require('../levensdossier').opCollectie(bron).voor('bureau');
    const ontvangsten = levens.veld(key, 'caseOntvangsten');
    const oud = ontvangsten[opdracht];
    if (oud) {
      if (oud.afdruk !== afdruk) return { status: 409, error: 'Deze opdrachtsleutel hoort bij andere inhoud. Begin bewust een nieuwe opdracht.' };
      const zaak = levens.leesVeld(key,'cases').find(c => c.id === oud.id);
      if (!zaak) return { status: 410, error: 'Deze opdracht is al ontvangen; de zaak is gearchiveerd. Er is geen nieuwe zaak aangemaakt.' };
      return { status: 200, ok: true, herhaald: true, zaak };
    }
    const r = maakCases(levens).caseOpen(key, inhoud);
    if (r.ok) ontvangsten[opdracht] = { id: r.zaak.id, afdruk };
    return r;
  });
};
