/* Het Privekantoor, deelbestand "reputatie": de Reputation Office.

   De tweede van de drie kamers die als "in aanbouw" op de plattegrond stonden.
   Vier dingen:

     optredens     interviews, lezingen, panels, openingen -- met datum, met
                   woordvoerder, en met een embargo als dat er is
     lijnen        de afgesproken boodschap per onderwerp: wat u er wel over
                   zegt, en wat niet
     woordvoerders wie er namens u praat, en waarover
     vermeldingen  wat er over u is verschenen, met de teneur erbij

   EN NU HET STUK DAT DE MOEITE WAARD IS OM OP TE SCHRIJVEN: wij monitoren het
   web niet. Er is geen scraper, geen persdienst en geen waarschuwing als er
   ergens iets over u verschijnt. `vermeldingen` is een dossier dat U of onze
   mensen bijhouden.

   Dat is een keuze en geen tekortkoming. Een "reputatiebewaking" die in
   werkelijkheid een zoekopdracht op uw naam is, wekt precies het vertrouwen dat
   je niet moet wekken -- u zou erop rekenen dat u het hoort, en dan hoort u het
   niet. Liever een leeg dossier waarvan iedereen weet dat het met de hand wordt
   gevuld, dan een vol dashboard dat suggereert dat het compleet is. Zodra er een
   echte persdienst achter zit, staat het hier, en dan mag deze alinea weg.

   HET EMBARGO IS WEL ECHT. Een optreden met een embargodatum komt in de Control
   Tower te staan, en tot die datum staat er bij dat het niet naar buiten mag.
   Dat is het soort ding dat je vergeet en dat niet te repareren is.

   Gemount via ./index.js. */
'use strict';

const SOORTEN = ['interview', 'lezing', 'panel', 'opening', 'opname', 'overig'];
const TENEUR = ['positief', 'neutraal', 'negatief'];

module.exports = (ctx) => {
  const { db, save, nu, rid, schoon, isDatum } = ctx;
  const levens = require('../levensdossier')({ db }).voor('bureau');

  function R(key) {
    const r = levens.veld(key, 'reputatie');
    for (const v of ['optredens', 'lijnen', 'woordvoerders', 'vermeldingen']) if (!Array.isArray(r[v])) r[v] = [];
    return r;
  }
  function lees(key) {
    const r = levens.leesVeld(key, 'reputatie');
    return { optredens: r.optredens || [], lijnen: r.lijnen || [],
      woordvoerders: r.woordvoerders || [], vermeldingen: r.vermeldingen || [] };
  }

  function rpOptreden(key, x) {
    const wat = schoon(x.wat, 120);
    if (!wat) return { status: 400, error: 'Waar gaat het optreden over?' };
    const r = R(key);
    const rec = { wat, soort: SOORTEN.includes(x.soort) ? x.soort : 'overig',
      datum: isDatum(x.datum) ? x.datum : '', waar: schoon(x.waar, 100),
      woordvoerder: schoon(x.woordvoerder, 80),
      embargoTot: isDatum(x.embargoTot) ? x.embargoTot : '', notitie: schoon(x.notitie, 400) };
    if (x.id) {
      const o = r.optredens.find(y => y.id === x.id);
      if (!o) return { status: 404, error: 'Dit optreden staat er niet.' };
      Object.assign(o, rec); save(); return { status: 200, ok: true };
    }
    if (r.optredens.length >= 300) return { status: 400, error: 'De lijst is vol.' };
    r.optredens.unshift(Object.assign({ id: rid(), at: nu() }, rec)); save();
    return { status: 200, ok: true };
  }
  function rpOptredenWeg(key, id) { const r = R(key); r.optredens = r.optredens.filter(x => x.id !== id); save(); return { status: 200, ok: true }; }

  /* De lijn per onderwerp. `nooit` is het veld dat het verschil maakt tussen een
     boodschap en een briefing: niet alleen wat u erover zegt, maar waar u het
     niet over hebt. Dat is precies wat iemand die namens u praat moet weten. */
  function rpLijn(key, x) {
    const onderwerp = schoon(x.onderwerp, 80);
    if (!onderwerp) return { status: 400, error: 'Over welk onderwerp?' };
    const r = R(key);
    const rec = { onderwerp, lijn: schoon(x.lijn, 600), nooit: schoon(x.nooit, 400) };
    if (x.id) {
      const l = r.lijnen.find(y => y.id === x.id);
      if (!l) return { status: 404, error: 'Niet gevonden.' };
      Object.assign(l, rec); save(); return { status: 200, ok: true };
    }
    if (r.lijnen.length >= 200) return { status: 400, error: 'De lijst is vol.' };
    r.lijnen.unshift(Object.assign({ id: rid(), at: nu() }, rec)); save();
    return { status: 200, ok: true };
  }
  function rpLijnWeg(key, id) { const r = R(key); r.lijnen = r.lijnen.filter(x => x.id !== id); save(); return { status: 200, ok: true }; }

  function rpWoordvoerder(key, x) {
    const naam = schoon(x.naam, 80);
    if (!naam) return { status: 400, error: 'Wie is het?' };
    const r = R(key);
    const rec = { naam, rol: schoon(x.rol, 60), telefoon: schoon(x.telefoon, 40),
      waarover: schoon(x.waarover, 200) };
    if (x.id) {
      const w = r.woordvoerders.find(y => y.id === x.id);
      if (!w) return { status: 404, error: 'Niet gevonden.' };
      Object.assign(w, rec); save(); return { status: 200, ok: true };
    }
    if (r.woordvoerders.length >= 100) return { status: 400, error: 'De lijst is vol.' };
    r.woordvoerders.unshift(Object.assign({ id: rid(), at: nu() }, rec)); save();
    return { status: 200, ok: true };
  }
  function rpWoordvoerderWeg(key, id) { const r = R(key); r.woordvoerders = r.woordvoerders.filter(x => x.id !== id); save(); return { status: 200, ok: true }; }

  function rpVermelding(key, x) {
    const waar = schoon(x.waar, 120);
    if (!waar) return { status: 400, error: 'Waar is het verschenen?' };
    const r = R(key);
    if (r.vermeldingen.length >= 1000) r.vermeldingen.pop();
    r.vermeldingen.unshift({ id: rid(), waar, op: isDatum(x.op) ? x.op : new Date().toISOString().slice(0, 10),
      teneur: TENEUR.includes(x.teneur) ? x.teneur : 'neutraal', notitie: schoon(x.notitie, 400) });
    save();
    return { status: 200, ok: true };
  }
  function rpVermeldingWeg(key, id) { const r = R(key); r.vermeldingen = r.vermeldingen.filter(x => x.id !== id); save(); return { status: 200, ok: true }; }

  function reputatie(key) {
    const r = lees(key);
    const t = new Date().toISOString().slice(0, 10);
    return { status: 200,
      optredens: r.optredens, lijnen: r.lijnen, woordvoerders: r.woordvoerders,
      vermeldingen: r.vermeldingen.slice(0, 100),
      onderEmbargo: r.optredens.filter(o => o.embargoTot && o.embargoTot >= t).length,
      soorten: SOORTEN, teneuren: TENEUR,
      bron: 'Dit dossier houdt u zelf bij, samen met onze mensen. Wij monitoren het web NIET: er staat hier niets in wat niemand heeft ingevoerd.' };
  }

  return { reputatie, rpOptreden, rpOptredenWeg, rpLijn, rpLijnWeg,
    rpWoordvoerder, rpWoordvoerderWeg, rpVermelding, rpVermeldingWeg };
};
