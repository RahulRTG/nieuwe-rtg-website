/* ============================================================================
   VOLTOOIPROEF: HANGAR (link:hangar, /apps/hangar.html).

   De belofte, in de woorden van kern/rechterhand/hangar.js: per toestel het
   type, de registratie, de thuishaven en het aantal stoelen; daaronder de
   vluchten met vlieguren en bemanning. Het overzicht toont per toestel de
   laatst bekende positie (de aankomst van de recentste vlucht, anders de
   thuishaven), de eerstvolgende vlucht en de totale vlieguren.
   ========================================================================== */
'use strict';
const { lifestyleLid, KANTOORWERELD } = require('../voltooiwereld');
const { bewaarblok } = require('../voltooiboek');

const HANGAR = '/api/member/rechterhand/hangar';
const TOESTEL = '/api/member/rechterhand/hangar/toestel';
const TOESTEL_WEG = '/api/member/rechterhand/hangar/toestel/weg';
const VLUCHT = '/api/member/rechterhand/hangar/vlucht';
const VLUCHT_WEG = '/api/member/rechterhand/hangar/vlucht/weg';

const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function loop(w, stap) {
  const merk = 'hg' + Date.now().toString(36);
  const lid = await lifestyleLid(w, 'hgr');
  const T = lid.token;
  const hangar = async (tok) => { const r = await w.post(HANGAR, {}, tok || T); return r.status === 200 ? r.data : null; };
  const toestel = async (naam) => ((await hangar()) || { toestellen: [] }).toestellen.find((t) => t.naam === naam);
  let jet = null;

  await stap('voltooibaar', 'een jet met thuishaven Rotterdam: zonder vluchten staat hij op zijn thuishaven', async () => {
    const r = await w.post(TOESTEL, { naam: 'Jet ' + merk, type: 'jet', registratie: 'PH-RTG', basis: 'Rotterdam', stoelen: 8 }, T);
    jet = await toestel('Jet ' + merk);
    return { klopt: r.status === 200 && !!jet && jet.positie === 'Rotterdam' && jet.uren === 0 && jet.vluchtAantal === 0, ziet: jet ? jet.registratie + ' in ' + jet.positie : 'niet gevonden' };
  });

  await stap('voltooibaar', 'een gevlogen vlucht naar Nice verplaatst de positie en telt de uren', async () => {
    const r = await w.post(VLUCHT, { toestelId: jet.id, van: 'Rotterdam', naar: 'Nice', datum: dag(-3), tijd: '09:00', uren: 2.1, bemanning: 'Capt. V' }, T);
    const t = await toestel('Jet ' + merk);
    return { klopt: r.status === 200 && t.positie === 'Nice' && t.uren === 2.1 && t.vluchtAantal === 1, ziet: 'positie ' + t.positie + ', ' + t.uren + ' uur' };
  });

  await stap('voltooibaar', 'een geplande vlucht is de eerstvolgende, maar verplaatst de positie nog niet', async () => {
    const r = await w.post(VLUCHT, { toestelId: jet.id, van: 'Nice', naar: 'Olbia', datum: dag(5), tijd: '11:00', uren: 1 }, T);
    const h = await hangar();
    const t = h.toestellen.find((x) => x.id === jet.id);
    return { klopt: r.status === 200 && t.positie === 'Nice' && h.komend && h.komend.naar === 'Olbia' && h.totaalUren === 3.1,
      ziet: 'positie ' + t.positie + ', eerstvolgende naar ' + (h.komend && h.komend.naar) + ', totaal ' + h.totaalUren + ' uur' };
  });

  await stap('voltooibaar', 'een vlucht zonder toestel of zonder vertrekpunt wordt geweigerd met de reden', async () => {
    const a = await w.post(VLUCHT, { toestelId: 'bestaatniet', van: 'X' }, T);
    const b = await w.post(VLUCHT, { toestelId: jet.id, van: '' }, T);
    return { klopt: a.status === 404 && /Kies eerst een toestel/.test(a.data.error) && b.status === 400 && /luchthaven/.test(b.data.error),
      ziet: a.status + ' (' + (a.data && a.data.error) + '), ' + b.status + ' (' + (b.data && b.data.error) + ')' };
  });

  await stap('voltooibaar', 'de gevlogen vlucht weghalen: de positie valt terug op de thuishaven', async () => {
    const h0 = await hangar();
    const nice = h0.vluchten.find((v) => v.toestelId === jet.id && v.naar === 'Nice');
    const x = await w.post(VLUCHT_WEG, { id: nice.id }, T);
    const t = await toestel('Jet ' + merk);
    return { klopt: x.status === 200 && t.positie === 'Rotterdam' && t.vluchtAantal === 1, ziet: 'positie ' + t.positie + ', ' + t.vluchtAantal + ' vlucht' };
  });

  await bewaarblok(w, stap, {
    T, lid, merk, wat: 'toestel',
    alle: async (tok) => { const h = await hangar(tok); return h ? h.toestellen : null; },
    naamVan: (t) => t.naam,
    maak: (naam) => ({ pad: TOESTEL, lijf: { naam, type: 'helikopter', basis: 'Lelystad' } }),
    weg: (t) => ({ pad: TOESTEL_WEG, lijf: { id: t.id } })
  });
}

module.exports = {
  functie: 'link:hangar',
  ingang: '/apps/hangar.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een Lifestyle-lid houdt zijn toestellen en vluchten bij: per toestel de laatst bekende positie, de eerstvolgende vlucht en de vlieguren',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Er wordt geen vlucht geboekt of bij een luchtvaartdienst aangemeld; de positie is afgeleid uit wat het lid vastlegt, geen live-positie. De Lifestyle Pass komt van het eigenaarsaccount van de testomgeving (zie Reisboek). Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
