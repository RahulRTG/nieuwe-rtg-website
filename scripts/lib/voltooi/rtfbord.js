/* ============================================================================
   VOLTOOIPROEF: HET DIGITALE SCHOOLBORD (link:rtfbord, /apps/foundation/bord.html).

   De belofte van het scherm: een begeleider start een les, tekent op het bord,
   zet opgaven en de agenda klaar, deelt de lescode, ziet wat de klas inlevert
   en leest een schrift -- en de klas kan het bord van de begeleider niet
   beschrijven. Een andere les komt er niet in.

   DE WERELD. De ouder van een gezin met een eigen RTG-account is de begeleider;
   hij start de les via Leren & Groei (/api/foundation/les/maak, zoals
   leren-groei.js dat doet) en het kind van het gezin doet mee met de lescode.
   Een tweede gezin start een eigen les: dat is de kruisproef.

   EEN OPEN SCHAKEL MET OPZET. /les/maak en /les/join vragen geen account: de
   lessleutel is het enige wat telt. Onder het besluit van 19 oktober 2026
   ("gebruiken vraagt een account") hoort een les maken zonder account een 401 te
   geven. Die deur sluit de agent Toegang; tot dan blijft de eerste
   bevoegdheidsstap hieronder open, en dat is de eerlijke stand.
   ========================================================================== */
'use strict';
const { GEZINSWERELD, accountGezin, nieuweLes, doeMee, haal } = require('../voltooigezin');

const MAAK = '/api/foundation/les/maak';
const STROKE = '/api/foundation/bord/stroke';
const UNDO = '/api/foundation/bord/undo';
const WIS = '/api/foundation/bord/wis';
const OPGAVE = '/api/foundation/opgave';
const INLEVEREN = '/api/foundation/opgave/inleveren';
const AGENDA = '/api/foundation/agenda';
const AGENDA_WEG = '/api/foundation/agenda/verwijder';
const ROTEER = '/api/foundation/les/code/roteer';
const JOIN = '/api/foundation/les/join';
const SCHRIFT_OPSLAAN = '/api/foundation/schrift/opslaan';
const BORD = '/api/foundation/bord/';
const OPGAVEN = '/api/foundation/opgaven/';
const SCHRIFT = '/api/foundation/schrift/';

const streek = (x) => ({ tool: 'pen', kleur: '#ffffff', dikte: 3, points: [[x, x], [x + 10, x + 5]] });

async function loop(w, stap) {
  const merk = Date.now().toString(36);
  const ouder = await accountGezin(w, 'bord', { kind: true });
  const ander = await accountGezin(w, 'anders');
  const les = await nieuweLes(w, 'Rekenen', 'Ouder bord');
  const vreemd = await nieuweLes(w, 'Taal', 'Ouder anders');
  const D = (lijf) => Object.assign({ code: les.lesId, token: les.token }, lijf);
  const bord = (tok) => haal(w, BORD + les.lesId, tok || les.token);
  const opgaven = (tok) => haal(w, OPGAVEN + les.lesId, tok || les.token);
  const OPG = 'Maak paragraaf 3.2, opgave 1 tot 8 ' + merk;
  let kind = null, opg = null, lescode = les.lescode;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de begeleider tekent drie streken en neemt er een terug: het bord toont er twee', async () => {
    const r = [];
    for (const x of [10, 20, 30]) r.push((await w.post(STROKE, D({ stroke: streek(x) }))).status);
    const u = await w.post(UNDO, D({}));
    const b = await bord();
    const n = ((b.data && b.data.strokes) || []).length;
    return { klopt: r.every((s) => s === 200) && u.status === 200 && n === 2, ziet: 'streken ' + r.join('/') + ', terug ' + u.status + ', bord ' + n + ' streken' };
  });

  await stap('voltooibaar', 'de begeleider zet een opgave en twee agendapunten, en haalt er een weg', async () => {
    const o = await w.post(OPGAVE, D({ tekst: OPG }));
    opg = o.data && o.data.opgave;
    await w.post(AGENDA, D({ tekst: 'Toets hoofdstuk 3 ' + merk, datum: '2026-11-02' }));
    const a = await w.post(AGENDA, D({ tekst: 'Boek meenemen ' + merk, datum: '' }));
    const weg = (a.data.agenda || []).find((x) => /Boek meenemen/.test(x.tekst));
    const na = await w.post(AGENDA_WEG, D({ itemId: weg && weg.id }));
    const l = await opgaven();
    return { klopt: o.status === 200 && ((l.data && l.data.opgaven) || []).some((x) => x.tekst === OPG) &&
      na.status === 200 && na.data.agenda.length === 1 && /Toets/.test(na.data.agenda[0].tekst),
      ziet: 'opgave ' + o.status + ', agenda na weghalen ' + (na.data && na.data.agenda.length) + ' punt' };
  });

  await stap('voltooibaar', 'het kind doet mee met de lescode, ziet het bord, levert de opgave in, en de begeleider ziet de inzending', async () => {
    kind = await doeMee(w, lescode, 'Kind bord');
    const b = await bord(kind.token);
    const i = await w.post(INLEVEREN, { code: les.lesId, token: kind.token, opgaveId: opg && opg.id, antwoord: 'Antwoord ' + merk });
    const o = ((await opgaven()).data || {}).opgaven || [];
    const inz = (o.find((x) => opg && x.id === opg.id) || {}).inzendingen || {};
    return { klopt: ((b.data && b.data.strokes) || []).length === 2 && i.status === 200 && Object.keys(inz).length === 1,
      ziet: 'kind ziet ' + ((b.data && b.data.strokes) || []).length + ' streken, inleveren ' + i.status + ', ' + Object.keys(inz).length + ' inzending' };
  });

  await stap('voltooibaar', 'de begeleider leest het schrift van het kind, en vernieuwt de lescode: de oude opent niets meer', async () => {
    await w.post(SCHRIFT_OPSLAAN, { code: les.lesId, token: kind.token, pages: [{ type: 'tekst', titel: 'Blad 1', inhoud: 'Mijn sommen ' + merk }] });
    const s = await haal(w, SCHRIFT + les.lesId + '/' + kind.studentId, les.token);
    const r = await w.post(ROTEER, D({}));
    const oud = await w.post(JOIN, { lescode, naam: 'Laatkomer oud' });
    const nieuw = await w.post(JOIN, { lescode: r.data && r.data.lescode, naam: 'Laatkomer nieuw' });
    lescode = r.data && r.data.lescode;
    const tekst = JSON.stringify((s.data && s.data.schrift) || {});
    return { klopt: s.status === 200 && tekst.includes('Mijn sommen ' + merk) && r.status === 200 && oud.status >= 400 && oud.status < 500 && nieuw.status === 200,
      ziet: 'schrift ' + s.status + ', vernieuwen ' + r.status + ', oude code ' + oud.status + ', nieuwe code ' + nieuw.status };
  });

  /* Bevoegdheid. */
  await stap('voltooibaar', 'bevoegdheid: een les maken zonder RTG-account wordt geweigerd (401)', async () => {
    const r = await w.post(MAAK, { vak: 'Anoniem', naam: 'Niemand', idem: 'anoniem-' + merk });
    return { klopt: r.status === 401, ziet: 'les maken zonder account: ' + r.status + (r.status === 200 ? ' (de deur staat open: gemeld aan Toegang)' : '') };
  });

  await stap('voltooibaar', 'bevoegdheid: zonder lessleutel geen streek, geen opgave en geen bord om te lezen', async () => {
    const s = await w.post(STROKE, { code: les.lesId, stroke: streek(90) });
    const o = await w.post(OPGAVE, { code: les.lesId, tekst: 'Zonder sleutel' });
    const b = await haal(w, BORD + les.lesId, null);
    const n = (((await bord()).data || {}).strokes || []).length;
    return { klopt: s.status === 403 && o.status === 403 && b.status === 403 && n === 2,
      ziet: 'streek ' + s.status + ', opgave ' + o.status + ', bord lezen ' + b.status + ', bord ' + n + ' streken' };
  });

  await stap('voltooibaar', 'bevoegdheid: de begeleider van een andere les tekent hier niet, wist niet en leest geen opgaven of schrift', async () => {
    const V = { code: les.lesId, token: vreemd.token };
    const s = await w.post(STROKE, Object.assign({ stroke: streek(70) }, V));
    const x = await w.post(WIS, V);
    const o = await haal(w, OPGAVEN + les.lesId, vreemd.token);
    const sc = await haal(w, SCHRIFT + les.lesId + '/' + kind.studentId, vreemd.token);
    const n = (((await bord()).data || {}).strokes || []).length;
    return { klopt: [s.status, x.status, o.status, sc.status].every((c) => c === 403) && n === 2 && !!ander.gezin,
      ziet: 'andere les: streek ' + s.status + ', wissen ' + x.status + ', opgaven ' + o.status + ', schrift ' + sc.status + '; bord ' + n + ' streken' };
  });

  await stap('voltooibaar', 'bevoegdheid: het kind is leerling en geen begeleider: het tekent niet, wist niet en zet geen opgave', async () => {
    const K = { code: les.lesId, token: kind.token };
    const s = await w.post(STROKE, Object.assign({ stroke: streek(80) }, K));
    const x = await w.post(WIS, K);
    const o = await w.post(OPGAVE, Object.assign({ tekst: 'Van het kind' }, K));
    const sc = await haal(w, SCHRIFT + les.lesId + '/' + kind.studentId, kind.token);
    const n = (((await bord()).data || {}).strokes || []).length;
    return { klopt: [s.status, x.status, o.status, sc.status].every((c) => c === 403) && n === 2,
      ziet: 'kind: streek ' + s.status + ', wissen ' + x.status + ', opgave ' + o.status + ', schrift van een ander ' + sc.status + '; bord ' + n + ' streken' };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staan het bord, de opgave met de inzending en de agenda er nog, met dezelfde sleutel', async () => {
    const b = await bord();
    const o = ((await opgaven()).data || {}).opgaven || [];
    const a = await w.post(AGENDA, D({ tekst: 'Na de herstart ' + merk }));
    const inz = Object.keys((o.find((x) => opg && x.id === opg.id) || {}).inzendingen || {}).length;
    return { klopt: ((b.data && b.data.strokes) || []).length === 2 && inz === 1 && a.status === 200 && a.data.agenda.some((x) => /Toets/.test(x.tekst)),
      ziet: 'bord ' + ((b.data && b.data.strokes) || []).length + ' streken, ' + inz + ' inzending, agenda ' + (a.data && a.data.agenda.length) };
  });

  await stap('persistent', 'een read-only lezer vindt de opgave en het schrift in de opslag', async () => {
    const o = w.vindInOpslag(OPG), s = w.vindInOpslag('Mijn sommen ' + merk);
    return { klopt: o.length > 0 && s.length > 0,
      ziet: 'opgave in ' + [...new Set(o.map((p) => p.bestand + (p.sleutel ? ':' + p.sleutel : '')))].join(', ') + ', schrift in ' + s.length + ' rij(en)' };
  });

  await stap('persistent', 'na de herstart ziet het kind met zijn eigen sleutel hetzelfde bord', async () => {
    const b = await bord(kind.token);
    return { klopt: b.status === 200 && ((b.data && b.data.strokes) || []).length === 2, ziet: 'kind ' + b.status + ', ' + ((b.data && b.data.strokes) || []).length + ' streken' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op + zet een agendapunt een keer neer', async () => {
    const T = 'Excursie ' + merk;
    const [a, b] = await w.dubbel(AGENDA, D({ tekst: T, datum: '2026-11-09', idem: 'ag-' + merk + '-dubbel' }));
    const n = ((b.data && b.data.agenda) || []).filter((x) => x.tekst === T).length;
    return { klopt: a.status === 200 && b.status === 200 && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + n + ' keer in de agenda' };
  });

  await stap('herstelbaar', 'een dubbele tik op Zet zet een opgave een keer neer', async () => {
    const T = 'Leer de tafel van 7 ' + merk;
    const [a, b] = await w.dubbel(OPGAVE, D({ tekst: T, idem: 'opg-' + merk + '-dubbel' }));
    const n = (((await opgaven()).data || {}).opgaven || []).filter((x) => x.tekst === T).length;
    return { klopt: a.status === 200 && b.status === 200 && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + n + ' opgave' };
  });

  await stap('herstelbaar', 'een afgebroken opgave en daarna opnieuw: de opgave staat er een keer', async () => {
    const T = 'Lees hoofdstuk 4 ' + merk;
    const half = await w.afgebroken(OPGAVE, D({ tekst: T, idem: 'opg-' + merk + '-half' }));
    const opnieuw = await w.post(OPGAVE, D({ tekst: T, idem: 'opg-' + merk + '-half' }));
    const n = (((await opgaven()).data || {}).opgaven || []).filter((x) => x.tekst === T).length;
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' opgave' };
  });

  await stap('herstelbaar', 'een crash direct na een streek verliest hem niet: het bord en de klas zien hem na de herstart', async () => {
    const s = await w.post(STROKE, D({ stroke: streek(55) }));
    await w.crash();
    const b = await bord(), k = await bord(kind.token);
    const n = ((b.data && b.data.strokes) || []).length, nk = ((k.data && k.data.strokes) || []).length;
    return { klopt: s.status === 200 && n === 3 && nk === 3, ziet: 'streek ' + s.status + ', na SIGKILL bord ' + n + ', kind ziet ' + nk };
  });
}

module.exports = {
  functie: 'link:rtfbord',
  ingang: '/apps/foundation/bord.html',
  persona: 'gezin',
  omgeving: GEZINSWERELD,
  belofte: 'een begeleider start een les, tekent op het bord, zet opgaven en de agenda klaar, deelt een lescode die hij kan vernieuwen, ziet de inzendingen en leest een schrift -- de klas en een andere les beschrijven zijn bord niet',
  grens: 'De proef loopt over de routes die het scherm en Leren & Groei aanroepen, niet door het scherm zelf: de live stroom (SSE) en de presentielijst van de klas lopen hier niet mee. De les zelf vraagt geen account (/les/maak en /les/join); dat staat als open bevoegdheidsstap en is gemeld. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
