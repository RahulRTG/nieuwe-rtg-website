/* ============================================================================
   VOLTOOIPROEF: LOGBOEK (link:logboek, /apps/geld.html#logboek).

   De belofte, in de woorden van kern/rechterhand/logboek.js: het onderhoud van
   kostbaar bezit (een jacht, een oldtimer). Per object de basisgegevens en
   daaronder de regels -- keuringen, servicebeurten, reparaties, verzekeringen --
   met datum, kosten en de datum waarop het weer aan de beurt is. Het overzicht
   seint wat binnenkort verloopt.
   ========================================================================== */
'use strict';
const { lifestyleLid, KANTOORWERELD } = require('../voltooiwereld');
const { bewaarblok } = require('../voltooiboek');

const BOEK = '/api/member/rechterhand/logboek';
const OBJECT = '/api/member/rechterhand/logboek/object';
const OBJECT_WEG = '/api/member/rechterhand/logboek/object/weg';
const REGEL = '/api/member/rechterhand/logboek/regel';
const REGEL_WEG = '/api/member/rechterhand/logboek/regel/weg';

const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function loop(w, stap) {
  const merk = 'lb' + Date.now().toString(36);
  const lid = await lifestyleLid(w, 'lgb');
  const T = lid.token;
  const boek = async (tok) => { const r = await w.post(BOEK, {}, tok || T); return r.status === 200 ? r.data : null; };
  const obj = async (naam) => ((await boek()) || { objecten: [] }).objecten.find((o) => o.naam === naam);
  let jacht = null;

  await stap('voltooibaar', 'het lid zet een jacht in zijn logboek', async () => {
    const r = await w.post(OBJECT, { naam: 'Jacht ' + merk, soort: 'jacht', merk: 'Feadship', bouwjaar: 2015, registratie: 'NL-1' }, T);
    jacht = await obj('Jacht ' + merk);
    return { klopt: r.status === 200 && !!jacht && jacht.soort === 'jacht' && jacht.bouwjaar === 2015 && jacht.regelAantal === 0, ziet: jacht ? jacht.soort + ' ' + jacht.bouwjaar : 'niet gevonden' };
  });

  await stap('voltooibaar', 'een servicebeurt van gisteren en een keuring die over drie weken weer moet: kosten tellen op, de keuring seint', async () => {
    const a = await w.post(REGEL, { objectId: jacht.id, wat: 'Motorservice', soort: 'service', datum: dag(-1), kosten: 4200 }, T);
    const b = await w.post(REGEL, { objectId: jacht.id, wat: 'Veiligheidskeuring', soort: 'keuring', datum: dag(-340), volgende: dag(21), kosten: 800 }, T);
    const k = await boek();
    const o = k.objecten.find((x) => x.id === jacht.id);
    const at = k.attenties.filter((x) => x.object === 'Jacht ' + merk);
    return { klopt: a.status === 200 && b.status === 200 && o.regelAantal === 2 && o.kosten === 5000 && o.laatste.wat === 'Motorservice' && at.length === 1 && at[0].soort === 'keuring' && at[0].verlopen === false,
      ziet: o.regelAantal + ' regels, kosten ' + o.kosten + ', laatste ' + (o.laatste && o.laatste.wat) + ', attentie ' + (at[0] && at[0].wat + ' op ' + at[0].volgende) };
  });

  await stap('voltooibaar', 'een regel zonder object wordt geweigerd met de reden', async () => {
    const r = await w.post(REGEL, { objectId: 'bestaatniet', wat: 'Iets' }, T);
    return { klopt: r.status === 404 && /Kies eerst een object/.test(r.data.error), ziet: r.status + ' (' + (r.data && r.data.error) + ')' };
  });

  await stap('voltooibaar', 'de keuring weghalen haalt ook de attentie weg; de kosten zakken mee', async () => {
    const k0 = await boek();
    const keuring = k0.regels.find((x) => x.wat === 'Veiligheidskeuring' && x.objectId === jacht.id);
    const x = await w.post(REGEL_WEG, { id: keuring.id }, T);
    const k = await boek();
    const o = k.objecten.find((y) => y.id === jacht.id);
    return { klopt: x.status === 200 && o.kosten === 4200 && k.attenties.filter((a) => a.object === 'Jacht ' + merk).length === 0, ziet: 'kosten ' + o.kosten + ', attenties ' + k.attenties.length };
  });

  await stap('voltooibaar', 'een object weghalen neemt zijn regels mee: er blijft geen wees-regel achter', async () => {
    const r = await w.post(OBJECT, { naam: 'Oldtimer ' + merk, soort: 'oldtimer' }, T);
    const ot = await obj('Oldtimer ' + merk);
    await w.post(REGEL, { objectId: ot.id, wat: 'APK ' + merk, soort: 'keuring', datum: dag(-2), kosten: 90 }, T);
    const x = await w.post(OBJECT_WEG, { id: ot.id }, T);
    const k = await boek();
    return { klopt: r.status === 200 && x.status === 200 && !k.objecten.some((o) => o.id === ot.id) && !k.regels.some((g) => g.wat === 'APK ' + merk),
      ziet: k.objecten.length + ' object(en), APK-regel ' + (k.regels.some((g) => g.wat === 'APK ' + merk) ? 'BLEEF' : 'mee weg') };
  });

  await bewaarblok(w, stap, {
    T, lid, merk, wat: 'object',
    alle: async (tok) => { const k = await boek(tok); return k ? k.objecten : null; },
    naamVan: (o) => o.naam,
    maak: (naam) => ({ pad: OBJECT, lijf: { naam, soort: 'auto', bouwjaar: 1967 } }),
    weg: (o) => ({ pad: OBJECT_WEG, lijf: { id: o.id } })
  });
}

module.exports = {
  functie: 'link:logboek',
  ingang: '/apps/geld.html#logboek',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een Lifestyle-lid houdt het onderhoud van zijn kostbaar bezit bij: per object de beurten, keuringen en kosten, en het overzicht seint wat binnenkort weer moet',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Er wordt geen afspraak bij een werf of garage gemaakt; een regel is een aantekening van het lid. De Lifestyle Pass komt van het eigenaarsaccount van de testomgeving (zie Reisboek). Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
