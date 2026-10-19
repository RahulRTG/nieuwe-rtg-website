/* ============================================================================
   VOLTOOIPROEF: TABLE (link:table, /apps/table.html).

   De belofte, in de woorden van kern/rechterhand/table.js: prive-diners en
   events. Per gelegenheid een gastenlijst met dieet en tafelindeling, een menu
   per gang, en de praktische gegevens -- netjes bewaard en herbruikbaar.
   Het lid is een Lifestyle-lid langs het menselijke besluit van het kantoor
   (../voltooiwereld.js lifestyleLid; de schakels van dat besluit staan in het
   scenario van Reisboek).
   ========================================================================== */
'use strict';
const { lifestyleLid, KANTOORWERELD } = require('../voltooiwereld');
const { bewaarblok } = require('../voltooiboek');

const LIJST = '/api/member/rechterhand/table';
const ZET = '/api/member/rechterhand/table/zet';
const WEG = '/api/member/rechterhand/table/weg';
const GAST = '/api/member/rechterhand/table/gast';
const GAST_ZET = '/api/member/rechterhand/table/gast/zet';
const GAST_WEG = '/api/member/rechterhand/table/gast/weg';
const MENU = '/api/member/rechterhand/table/menu';
const MENU_WEG = '/api/member/rechterhand/table/menu/weg';

const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function loop(w, stap) {
  const merk = 'tb' + Date.now().toString(36);
  const lid = await lifestyleLid(w, 'tab');
  const T = lid.token;
  const events = async (tok) => { const r = await w.post(LIJST, {}, tok || T); return r.status === 200 ? r.data.events : null; };
  const ev = async (naam) => ((await events()) || []).find((e) => e.naam === naam);
  let diner = null;

  await stap('voltooibaar', 'het lid zet een diner neer met datum, tijd en locatie; het staat als komend in de lijst', async () => {
    const z = await w.post(ZET, { naam: 'Diner ' + merk, datum: dag(12), tijd: '19:30', locatie: 'Herengracht' }, T);
    diner = z.data && z.data.event;
    const e = await ev('Diner ' + merk);
    return { klopt: z.status === 200 && !!e && e.komend === true && e.tijd === '19:30' && e.gastenAantal === 0, ziet: e ? e.datum + ' ' + e.tijd + ', komend=' + e.komend : 'niet gevonden' };
  });

  await stap('voltooibaar', 'drie gasten op de lijst, een met een dieet; het aantal gasten telt mee', async () => {
    const rs = [];
    for (const [naam, dieet] of [['Gast A', ''], ['Gast B', 'vegetarisch'], ['Gast C', '']]) rs.push(await w.post(GAST, { eventId: diner.id, naam, dieet }, T));
    const e = await ev('Diner ' + merk);
    const b = (e.gasten || []).find((g) => g.naam === 'Gast B');
    return { klopt: rs.every((r) => r.status === 200) && e.gastenAantal === 3 && !!b && b.dieet === 'vegetarisch', ziet: e.gastenAantal + ' gasten, Gast B: ' + (b && b.dieet) };
  });

  await stap('voltooibaar', 'een allergeen kiest het lid uit de EU-lijst en het lid ziet tot wanneer het bewaard blijft; een code buiten de lijst wordt geweigerd met de reden', async () => {
    const r = await w.post(GAST, { eventId: diner.id, naam: 'Gast D', allergenen: ['noten'] }, T);
    const fout = await w.post(GAST, { eventId: diner.id, naam: 'Gast E', allergenen: ['aardbei'] }, T);
    const e = await ev('Diner ' + merk);
    const d = (e.gasten || []).find((g) => g.naam === 'Gast D');
    const x = d ? await w.post(GAST_WEG, { eventId: diner.id, gastId: d.id }, T) : { status: 0 };
    return { klopt: r.status === 200 && !!d && d.allergenen.join() === 'noten' && d.dieetTot === dag(13) && fout.status === 400 && /lijst/.test((fout.data && fout.data.error) || '') && x.status === 200,
      ziet: 'Gast D: ' + (d && d.allergenen.join()) + ' t/m ' + (d && d.dieetTot) + '; aardbei: ' + fout.status + ' (' + (fout.data && fout.data.error) + ')' };
  });

  await stap('voltooibaar', 'de tafelindeling en een dieet wijzigen bij een bestaande gast; de rest blijft staan', async () => {
    const e0 = await ev('Diner ' + merk);
    const a = e0.gasten.find((g) => g.naam === 'Gast A');
    const r = await w.post(GAST_ZET, { eventId: diner.id, gastId: a.id, tafel: 'T1', dieet: 'geen schaaldieren' }, T);
    const e = await ev('Diner ' + merk);
    const na = e.gasten.find((g) => g.id === a.id);
    return { klopt: r.status === 200 && na.tafel === 'T1' && na.dieet === 'geen schaaldieren' && e.gastenAantal === 3, ziet: 'Gast A aan ' + na.tafel + ', ' + na.dieet };
  });

  await stap('voltooibaar', 'een menu van twee gangen met wijn; een gang weghalen laat de andere staan', async () => {
    const m1 = await w.post(MENU, { eventId: diner.id, gang: 'voorgerecht', gerecht: 'Coquilles', wijn: 'Chablis' }, T);
    const m2 = await w.post(MENU, { eventId: diner.id, gang: 'hoofdgerecht', gerecht: 'Tarbot' }, T);
    const e0 = await ev('Diner ' + merk);
    const voor = e0.menu.find((m) => m.gerecht === 'Coquilles');
    const x = await w.post(MENU_WEG, { eventId: diner.id, itemId: voor && voor.id }, T);
    const e = await ev('Diner ' + merk);
    return { klopt: m1.status === 200 && m2.status === 200 && x.status === 200 && e.menu.map((m) => m.gerecht).join(',') === 'Tarbot', ziet: 'menu: ' + e.menu.map((m) => m.gang + ' ' + m.gerecht).join(', ') };
  });

  await stap('voltooibaar', 'een gast afmelden haalt alleen die gast weg; een gast zonder naam wordt geweigerd met de reden', async () => {
    const e0 = await ev('Diner ' + merk);
    const c = e0.gasten.find((g) => g.naam === 'Gast C');
    const x = await w.post(GAST_WEG, { eventId: diner.id, gastId: c.id }, T);
    const leeg = await w.post(GAST, { eventId: diner.id, naam: '' }, T);
    const e = await ev('Diner ' + merk);
    return { klopt: x.status === 200 && e.gastenAantal === 2 && !e.gasten.some((g) => g.naam === 'Gast C') && leeg.status === 400 && /Naam van de gast/.test(leeg.data.error),
      ziet: e.gastenAantal + ' gasten over; lege naam: ' + leeg.status + ' (' + (leeg.data && leeg.data.error) + ')' };
  });

  await bewaarblok(w, stap, {
    T, lid, merk, wat: 'gelegenheid',
    alle: events,
    naamVan: (e) => e.naam,
    maak: (naam) => ({ pad: ZET, lijf: { naam, datum: dag(20), tijd: '20:00', locatie: 'Thuis' } }),
    weg: (e) => ({ pad: WEG, lijf: { id: e.id } })
  });
}

module.exports = {
  functie: 'link:table',
  ingang: '/apps/table.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een Lifestyle-lid organiseert een prive-diner: de gelegenheid, de gastenlijst met dieet en tafelindeling, en het menu per gang -- bewaard en herbruikbaar',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Er gaat geen uitnodiging naar de gasten: de gastenlijst is een lijst van het lid, en de gasten zijn geen accounts. De Lifestyle Pass komt van het eigenaarsaccount van de testomgeving (zie Reisboek). Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
