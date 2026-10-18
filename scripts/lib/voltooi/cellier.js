/* ============================================================================
   VOLTOOIPROEF: CELLIER (link:cellier, /apps/cellier.html).

   De belofte, in de woorden van kern/rechterhand/cellier.js: de wijnkelder van
   het lid, per fles de jaargang, het aantal, de waarde en het drinkvenster; het
   overzicht wijst aan wat nu op dronk is en wat nog kan blijven liggen, met de
   kelderwaarde erbij. Een fles schenken telt af.

   Het lid is een Lifestyle-lid langs de enige weg die die pas geeft: een vers
   RTG-lid vraagt hem aan, een herleidbaar mens van het kantoor accepteert
   (./../voltooiwereld.js lifestyleLid; de schakels van dat besluit zelf staan in
   het scenario van Reisboek).
   ========================================================================== */
'use strict';
const { lifestyleLid, KANTOORWERELD } = require('../voltooiwereld');
const { bewaarblok } = require('../voltooiboek');

const KELDER = '/api/member/rechterhand/cellier';
const ZET = '/api/member/rechterhand/cellier/zet';
const WEG = '/api/member/rechterhand/cellier/weg';
const SCHENK = '/api/member/rechterhand/cellier/schenk';

const jaar = new Date().getFullYear();

async function loop(w, stap) {
  const merk = 'cl' + Date.now().toString(36);
  const lid = await lifestyleLid(w, 'cel');
  const T = lid.token;
  const kelder = async (tok) => { const k = await w.post(KELDER, {}, tok || T); return k.status === 200 ? k.data : null; };
  const fles = (k, naam) => ((k && k.flessen) || []).find((f) => f.naam === naam);
  let barolo = null;

  await stap('voltooibaar', 'een Lifestyle-lid opent een lege kelder', async () => {
    const k = await kelder();
    return { klopt: !!k && k.flessen.length === 0 && k.totaalFlessen === 0 && k.kelderwaarde === 0, ziet: k ? k.flessen.length + ' flessen, waarde ' + k.kelderwaarde : 'geen kelder' };
  });

  await stap('voltooibaar', 'zes flessen Barolo binnen het drinkvenster: op dronk, en de kelderwaarde telt mee', async () => {
    const z = await w.post(ZET, { naam: 'Barolo ' + merk, domein: 'Giacomo', kleur: 'rood', jaargang: jaar - 8, aantal: 6, waarde: 45, drinkVan: jaar - 2, drinkTot: jaar + 5 }, T);
    barolo = z.data && z.data.fles;
    const k = await kelder();
    const f = fles(k, 'Barolo ' + merk);
    return { klopt: z.status === 200 && !!f && f.staat === 'op dronk' && k.totaalFlessen === 6 && k.kelderwaarde === 270 && k.opDronk === 1,
      ziet: f ? f.aantal + 'x, ' + f.staat + ', kelderwaarde ' + k.kelderwaarde + ', op dronk ' + k.opDronk : 'niet gevonden' };
  });

  await stap('voltooibaar', 'een jonge wijn waarvan het venster nog moet beginnen: laten liggen, en hij telt niet als op dronk', async () => {
    const z = await w.post(ZET, { naam: 'Pauillac ' + merk, kleur: 'rood', jaargang: jaar - 2, aantal: 3, waarde: 120, drinkVan: jaar + 6, drinkTot: jaar + 25 }, T);
    const k = await kelder();
    const f = fles(k, 'Pauillac ' + merk);
    return { klopt: z.status === 200 && !!f && f.staat === 'laten liggen' && k.opDronk === 1 && k.totaalFlessen === 9 && k.kelderwaarde === 630,
      ziet: f ? f.staat + ', op dronk ' + k.opDronk + ', ' + k.totaalFlessen + ' flessen, waarde ' + k.kelderwaarde : 'niet gevonden' };
  });

  await stap('voltooibaar', 'een fles schenken telt af, en de kelderwaarde zakt mee', async () => {
    const s = await w.post(SCHENK, { id: barolo.id }, T);
    const k = await kelder();
    const f = fles(k, 'Barolo ' + merk);
    return { klopt: s.status === 200 && s.data.aantal === 5 && f.aantal === 5 && k.kelderwaarde === 585, ziet: 'schenk ' + s.status + ', nog ' + (f && f.aantal) + ', waarde ' + k.kelderwaarde };
  });

  await stap('voltooibaar', 'de laatste fles op: een volgende schenking wordt geweigerd met de reden, en het aantal blijft nul', async () => {
    const z = await w.post(ZET, { id: barolo.id, naam: 'Barolo ' + merk, kleur: 'rood', jaargang: jaar - 8, aantal: 1, waarde: 45, drinkVan: jaar - 2, drinkTot: jaar + 5 }, T);
    const s1 = await w.post(SCHENK, { id: barolo.id }, T);
    const s2 = await w.post(SCHENK, { id: barolo.id }, T);
    const k = await kelder();
    const f = fles(k, 'Barolo ' + merk);
    const zelfde = ((k && k.flessen) || []).filter((x) => x.naam === 'Barolo ' + merk).length;
    return { klopt: z.status === 200 && zelfde === 1 && s1.status === 200 && s2.status === 400 && /geen fles meer/.test(s2.data.error) && f.aantal === 0 && k.opDronk === 0,
      ziet: 'bijgewerkt (1 record), schenk ' + s1.status + ' dan ' + s2.status + ' (' + (s2.data && s2.data.error) + '), aantal ' + (f && f.aantal) };
  });

  await bewaarblok(w, stap, {
    T, lid, merk, wat: 'wijn',
    alle: async (tok) => { const k = await kelder(tok); return k ? k.flessen : null; },
    naamVan: (f) => f.naam,
    maak: (naam) => ({ pad: ZET, lijf: { naam, kleur: 'wit', jaargang: jaar - 3, aantal: 2, waarde: 30 } }),
    weg: (f) => ({ pad: WEG, lijf: { id: f.id } })
  });
}

module.exports = {
  functie: 'link:cellier',
  ingang: '/apps/cellier.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een Lifestyle-lid houdt zijn wijnkelder bij: per fles het aantal, de waarde en het drinkvenster, het overzicht zegt wat op dronk is, en een fles schenken telt af tot er geen meer is',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. De Lifestyle Pass komt van het eigenaarsaccount van de testomgeving (zie het scenario van Reisboek voor dat besluit). Inschenken is met opzet NIET ontdubbeld (een teller; zie server/lib/idemsleutels-rechterhand.js) en daarom niet als dubbeltik beproefd. De adviseur (/ai) loopt niet mee. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
