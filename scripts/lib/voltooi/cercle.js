/* ============================================================================
   VOLTOOIPROEF: CERCLE (link:cercle, /apps/cercle.html).

   De belofte, in de woorden van kern/rechterhand/cercle.js: de besloten clubs
   van het lid over de hele wereld, met lidnummer, dresscode, reciprociteit en
   gastpassen -- en twee dingen waarvoor je elders een concierge betaalt:
   "ik ben volgende week in Milaan -- waar kan ik terecht, en op welk
   lidmaatschap?" (waarheen), en gastpassen met een boekhouding die vanzelf
   terugloopt en terug te draaien is.
   ========================================================================== */
'use strict';
const { lifestyleLid, KANTOORWERELD } = require('../voltooiwereld');
const { bewaarblok } = require('../voltooiboek');

const CERCLE = '/api/member/rechterhand/cercle';
const CLUB = '/api/member/rechterhand/cercle/club';
const CLUB_WEG = '/api/member/rechterhand/cercle/club/weg';
const GAST = '/api/member/rechterhand/cercle/gast';
const GAST_TERUG = '/api/member/rechterhand/cercle/gast/terug';
const WAARHEEN = '/api/member/rechterhand/cercle/waarheen';

async function loop(w, stap) {
  const merk = 'cr' + Date.now().toString(36);
  const lid = await lifestyleLid(w, 'crc');
  const T = lid.token;
  const cercle = async (tok) => { const r = await w.post(CERCLE, {}, tok || T); return r.status === 200 ? r.data : null; };
  const club = async (naam) => ((await cercle()) || { clubs: [] }).clubs.find((c) => c.naam === naam);
  let londen = null;

  await stap('voltooibaar', 'twee clubs in twee steden, een met reciprociteit als lijst en drie gastpassen', async () => {
    const a = await w.post(CLUB, { naam: 'Londen ' + merk, stad: 'Londen', lidnummer: 'L-1', dresscode: 'jasje', reciprociteit: 'Milaan Club ' + merk + '; Parijs Cercle', gastpassen: 3 }, T);
    const b = await w.post(CLUB, { naam: 'Amsterdam ' + merk, stad: 'Amsterdam', gastpassen: 0 }, T);
    const c = await cercle();
    londen = c.clubs.find((x) => x.naam === 'Londen ' + merk);
    return { klopt: a.status === 200 && b.status === 200 && c.aantal === 2 && c.steden === 2 && c.gastpassen === 3 && londen && londen.reciprociteit.length === 2,
      ziet: c.aantal + ' clubs in ' + c.steden + ' steden, ' + c.gastpassen + ' gastpassen, reciprociteit ' + (londen && londen.reciprociteit.length) };
  });

  await stap('voltooibaar', '"waar kan ik in Milaan terecht?": de club via reciprociteit, met het lidmaatschap waarop', async () => {
    const r = await w.post(WAARHEEN, { stad: 'Milaan' }, T);
    const via = r.data && r.data.viaGast.find((x) => x.club === 'Milaan Club ' + merk);
    return { klopt: r.status === 200 && r.data.eigen.length === 0 && !!via && via.via === 'reciprociteit van Londen ' + merk && /zelf heeft ingevuld/.test(r.data.bron),
      ziet: (via ? via.club.split(' ')[0] + ' ' + via.via.split(' ').slice(0, 3).join(' ') : 'niets') + '; bron zegt waar het vandaan komt' };
  });

  await stap('voltooibaar', 'een gastpas gebruiken: het saldo loopt terug en de gast staat in het logboek', async () => {
    const g = await w.post(GAST, { id: londen.id, wie: 'Zakenpartner ' + merk, stad: 'Londen' }, T);
    const c = await club('Londen ' + merk);
    return { klopt: g.status === 200 && g.data.gastpassen === 2 && c.gastpassen === 2 && c.gastlog.length === 1 && c.gastlog[0].wie === 'Zakenpartner ' + merk,
      ziet: 'saldo ' + c.gastpassen + ', logboek ' + c.gastlog.length };
  });

  await stap('voltooibaar', 'een vergissing terugdraaien: het saldo komt terug en de regel verdwijnt', async () => {
    const c0 = await club('Londen ' + merk);
    const t = await w.post(GAST_TERUG, { id: londen.id, gastId: c0.gastlog[0].id }, T);
    const c = await club('Londen ' + merk);
    return { klopt: t.status === 200 && c.gastpassen === 3 && c.gastlog.length === 0, ziet: 'saldo ' + c.gastpassen + ', logboek ' + c.gastlog.length };
  });

  await stap('voltooibaar', 'bij een club zonder gastpassen wordt een gast geweigerd met de reden', async () => {
    const a = await club('Amsterdam ' + merk);
    const g = await w.post(GAST, { id: a.id, wie: 'Iemand', stad: 'Amsterdam' }, T);
    const na = await club('Amsterdam ' + merk);
    return { klopt: g.status === 400 && /geen gastpassen meer/.test(g.data.error) && na.gastlog.length === 0, ziet: g.status + ' (' + (g.data && g.data.error) + ')' };
  });

  await bewaarblok(w, stap, {
    T, lid, merk, wat: 'club',
    alle: async (tok) => { const c = await cercle(tok); return c ? c.clubs : null; },
    naamVan: (c) => c.naam,
    maak: (naam) => ({ pad: CLUB, lijf: { naam, stad: 'Parijs', gastpassen: 1 } }),
    weg: (c) => ({ pad: CLUB_WEG, lijf: { id: c.id } })
  });

  await stap('herstelbaar', 'na de crashes klopt de gastboekhouding nog: saldo en logboek horen bij elkaar', async () => {
    const g = await w.post(GAST, { id: londen.id, wie: 'Na crash ' + merk, stad: 'Londen' }, T);
    await w.crash();
    const c = await club('Londen ' + merk);
    return { klopt: g.status === 200 && c.gastpassen === 2 && c.gastlog.length === 1, ziet: 'gast ' + g.status + ', na SIGKILL saldo ' + c.gastpassen + ' met ' + c.gastlog.length + ' regel' };
  });
}

module.exports = {
  functie: 'link:cercle',
  ingang: '/apps/cercle.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een Lifestyle-lid houdt zijn clubs bij, vraagt waar hij in een stad terecht kan en op welk lidmaatschap, en zijn gastpassen lopen met een boekhouding vanzelf terug',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Er wordt niets bij een club aangemeld; reciprociteit is wat het lid zelf invult en RTG houdt geen clubgids bij (dat zegt het antwoord ook). De Lifestyle Pass komt van het eigenaarsaccount van de testomgeving (zie Reisboek). Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
