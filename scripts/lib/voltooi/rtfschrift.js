/* ============================================================================
   VOLTOOIPROEF: HET SCHRIFT (link:rtfschrift, /apps/foundation/schrift.html).

   De belofte van het scherm: een leerling doet mee met een les, ziet het bord,
   de opgaven en de agenda van de begeleider, schrijft in zijn eigen schrift,
   levert een opgave in, vraagt de bijleshulp om mee te denken -- en zijn
   schrift is van hem: een klasgenoot of een andere les leest het niet, en wie
   de begeleider uit de les haalt, schrijft er niet meer in.

   DE WERELD. Het kind van een gezin met een eigenaar-account is de leerling; de
   ouder start de les via Leren & Groei en is de begeleider (../voltooigezin.js).
   Een klasgenoot doet mee met dezelfde lescode, een leerling van een andere les
   is de kruisproef.

   EEN OPEN SCHAKEL MET OPZET, dezelfde als bij het bord (./rtfbord.js): meedoen
   (/les/join) vraagt geen account; onder het besluit van 19 oktober 2026 hoort
   dat een 401 te geven, en het kind hoort mee te doen onder het account van
   zijn ouder. Die deur sluit de agent Toegang.
   ========================================================================== */
'use strict';
const { GEZINSWERELD, accountGezin, nieuweLes, doeMee, haal } = require('../voltooigezin');

const JOIN = '/api/foundation/les/join';
const OPSLAAN = '/api/foundation/schrift/opslaan';
const INLEVEREN = '/api/foundation/opgave/inleveren';
const AI = '/api/foundation/ai';
const TIP = '/api/foundation/tip';
const LES = '/api/foundation/les/';
const BORD = '/api/foundation/bord/';
const SCHRIFT = '/api/foundation/schrift/';
const OPGAVEN = '/api/foundation/opgaven/';

async function loop(w, stap) {
  const merk = Date.now().toString(36);
  await accountGezin(w, 'schrift', { kind: true });
  const les = await nieuweLes(w, 'Aardrijkskunde', 'Ouder schrift');
  const elders = await nieuweLes(w, 'Muziek', 'Andere begeleider');
  const D = (b) => Object.assign({ code: les.lesId, token: les.token }, b);
  await w.post('/api/foundation/bord/stroke', D({ stroke: { tool: 'pen', kleur: '#ffffff', dikte: 3, points: [[1, 1], [9, 9]] } }));
  const OPG = 'Benoem drie rivieren ' + merk;
  const opg = ((await w.post('/api/foundation/opgave', D({ tekst: OPG }))).data || {}).opgave;
  await w.post('/api/foundation/agenda', D({ tekst: 'Topotoets ' + merk, datum: '2026-11-03' }));
  let kind = null, klasgenoot = null, buiten = null;
  const BLAD = [{ type: 'tekst', titel: 'Blad 1', inhoud: 'De Rijn, de Maas en de IJssel ' + merk },
    { type: 'tekening', titel: 'Kaartje', strokes: [{ tool: 'pen', points: [[2, 2], [5, 5]] }] }];
  const mijnSchrift = async (tok) => ((((await haal(w, SCHRIFT + les.lesId, tok || kind.token)).data) || {}).schrift || {}).pages || [];
  const K = (b) => Object.assign({ code: les.lesId, token: kind.token }, b);

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'het kind doet mee met de lescode en ziet het vak, het bord, de opgave en de agenda van de begeleider', async () => {
    kind = await doeMee(w, les.lescode, 'Kind schrift');
    const l = ((await haal(w, LES + les.lesId, kind.token)).data || {}).les || {};
    const b = (((await haal(w, BORD + les.lesId, kind.token)).data) || {}).strokes || [];
    return { klopt: l.vak === 'Aardrijkskunde' && (l.opgaven || []).some((o) => o.tekst === OPG) && (l.agenda || []).length === 1 && b.length === 1,
      ziet: 'vak ' + l.vak + ', ' + (l.opgaven || []).length + ' opgave, ' + (l.agenda || []).length + ' agendapunt, bord ' + b.length + ' streek' };
  });

  await stap('voltooibaar', 'het kind schrijft twee bladzijden in zijn schrift en leest ze terug', async () => {
    const r = await w.post(OPSLAAN, K({ pages: BLAD }));
    const p = await mijnSchrift();
    return { klopt: r.status === 200 && p.length === 2 && p[0].inhoud === BLAD[0].inhoud && p[1].type === 'tekening',
      ziet: 'opslaan ' + r.status + ', ' + p.length + ' bladzijden terug' };
  });

  await stap('voltooibaar', 'het kind levert de opgave in en de begeleider ziet het antwoord op naam', async () => {
    const i = await w.post(INLEVEREN, K({ opgaveId: opg && opg.id, antwoord: 'Rijn, Maas, IJssel' }));
    const o = (((await haal(w, OPGAVEN + les.lesId, les.token)).data) || {}).opgaven || [];
    const inz = Object.values((o.find((x) => opg && x.id === opg.id) || {}).inzendingen || {});
    return { klopt: i.status === 200 && inz.length === 1 && inz[0].naam === 'Kind schrift' && /Maas/.test(inz[0].antwoord),
      ziet: 'inleveren ' + i.status + ', begeleider ziet ' + inz.length + ' inzending van ' + (inz[0] && inz[0].naam) };
  });

  await stap('voltooibaar', 'de bijleshulp antwoordt op een vraag, en de tip van de dag staat er', async () => {
    const a = await w.post(AI, K({ messages: [{ role: 'user', content: 'Hoe onthoud ik de rivieren?' }] }));
    const t = await haal(w, TIP, null);
    return { klopt: a.status === 200 && typeof a.data.text === 'string' && a.data.text.length > 10 && t.status === 200 && !!(t.data && t.data.tip),
      ziet: 'bijles ' + a.status + (a.data && a.data.demo ? ' (zonder model: de vaste terugval)' : '') + ', tip ' + t.status };
  });

  /* Bevoegdheid. */
  await stap('voltooibaar', 'bevoegdheid: meedoen met een les zonder RTG-account wordt geweigerd (401)', async () => {
    const r = await w.post(JOIN, { lescode: les.lescode, naam: 'Anoniem ' + merk });
    return { klopt: r.status === 401, ziet: 'meedoen zonder account: ' + r.status + (r.status === 200 ? ' (de deur staat open: gemeld aan Toegang)' : '') };
  });

  await stap('voltooibaar', 'bevoegdheid: zonder lessleutel geen schrift lezen of schrijven, en geen inzending', async () => {
    const o = await w.post(OPSLAAN, { code: les.lesId, pages: [{ type: 'tekst', inhoud: 'zonder sleutel' }] });
    const l = await haal(w, SCHRIFT + les.lesId, null);
    const i = await w.post(INLEVEREN, { code: les.lesId, opgaveId: opg && opg.id, antwoord: 'x' });
    return { klopt: o.status === 403 && l.status === 403 && i.status === 403 && (await mijnSchrift()).length === 2,
      ziet: 'opslaan ' + o.status + ', lezen ' + l.status + ', inleveren ' + i.status };
  });

  await stap('voltooibaar', 'bevoegdheid: een klasgenoot leest zijn eigen schrift en niet dat van het kind; een leerling van een andere les komt er niet in', async () => {
    klasgenoot = await doeMee(w, les.lescode, 'Klasgenoot');
    buiten = await doeMee(w, elders.lescode, 'Van elders');
    const eigen = await mijnSchrift(klasgenoot.token);
    const vreemd = await haal(w, SCHRIFT + les.lesId, buiten.token);
    const vreemdOp = await w.post(OPSLAAN, { code: les.lesId, token: buiten.token, pages: [{ type: 'tekst', inhoud: 'erin' }] });
    const docentSchrift = await haal(w, SCHRIFT + les.lesId + '/' + kind.studentId, klasgenoot.token);
    return { klopt: eigen.length === 0 && vreemd.status === 403 && vreemdOp.status === 403 && docentSchrift.status === 403 && (await mijnSchrift()).length === 2,
      ziet: 'klasgenoot ziet ' + eigen.length + ' bladzijden, andere les leest ' + vreemd.status + ' en schrijft ' + vreemdOp.status + ', klasgenoot via de begeleidersroute ' + docentSchrift.status };
  });

  await stap('voltooibaar', 'bevoegdheid: haalt de begeleider de klasgenoot uit de les, dan schrijft die niet meer', async () => {
    const x = await w.post('/api/foundation/les/leerling/intrekken', D({ studentId: klasgenoot.studentId }));
    const o = await w.post(OPSLAAN, { code: les.lesId, token: klasgenoot.token, pages: [{ type: 'tekst', inhoud: 'na het intrekken' }] });
    return { klopt: x.status === 200 && o.status === 403, ziet: 'intrekken ' + x.status + ', daarna opslaan ' + o.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart leest het kind met zijn eigen sleutel dezelfde twee bladzijden', async () => {
    const p = await mijnSchrift();
    return { klopt: p.length === 2 && p[0].inhoud === BLAD[0].inhoud, ziet: p.length + ' bladzijden na de herstart' };
  });

  await stap('persistent', 'een read-only lezer vindt het schrift en het antwoord in de opslag', async () => {
    const s = w.vindInOpslag(BLAD[0].inhoud), a = w.vindInOpslag('Rijn, Maas, IJssel');
    return { klopt: s.length > 0 && a.length > 0, ziet: 'schrift in ' + s.length + ', antwoord in ' + a.length + ' vindplaats(en)' };
  });

  await stap('persistent', 'na de herstart ziet de begeleider de inzending nog, en blijft de ingetrokken klasgenoot buiten', async () => {
    const o = (((await haal(w, OPGAVEN + les.lesId, les.token)).data) || {}).opgaven || [];
    const n = Object.keys((o.find((x) => opg && x.id === opg.id) || {}).inzendingen || {}).length;
    const k = await haal(w, SCHRIFT + les.lesId, klasgenoot.token);
    return { klopt: n === 1 && k.status === 403, ziet: n + ' inzending, ingetrokken klasgenoot ' + k.status };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op Inleveren telt een inzending, met het laatste antwoord', async () => {
    const [a, b] = await w.dubbel(INLEVEREN, K({ opgaveId: opg && opg.id, antwoord: 'Rijn, Maas, IJssel, Schelde' }));
    const o = (((await haal(w, OPGAVEN + les.lesId, les.token)).data) || {}).opgaven || [];
    const inz = Object.values((o.find((x) => opg && x.id === opg.id) || {}).inzendingen || {});
    return { klopt: a.status === 200 && b.status === 200 && inz.length === 1 && /Schelde/.test(inz[0].antwoord),
      ziet: 'tikken ' + a.status + '/' + b.status + ', ' + inz.length + ' inzending' };
  });

  await stap('herstelbaar', 'een dubbele tik op Bewaar laat het schrift heel: drie bladzijden, geen zes', async () => {
    const drie = BLAD.concat([{ type: 'tekst', titel: 'Blad 3', inhoud: 'Huiswerk ' + merk }]);
    const [a, b] = await w.dubbel(OPSLAAN, K({ pages: drie }));
    const p = await mijnSchrift();
    return { klopt: a.status === 200 && b.status === 200 && p.length === 3, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + p.length + ' bladzijden' };
  });

  await stap('herstelbaar', 'een afgebroken bewaarbeurt en daarna opnieuw: het schrift staat er zoals het laatst bedoeld was', async () => {
    const vier = BLAD.concat([{ type: 'tekst', titel: 'Blad 3', inhoud: 'Huiswerk ' + merk }, { type: 'tekst', titel: 'Blad 4', inhoud: 'Nog een ' + merk }]);
    const half = await w.afgebroken(OPSLAAN, K({ pages: vier }));
    const opnieuw = await w.post(OPSLAAN, K({ pages: vier }));
    const p = await mijnSchrift();
    return { klopt: opnieuw.status === 200 && p.length === 4,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + p.length + ' bladzijden' };
  });

  await stap('herstelbaar', 'een crash direct na het bewaren verliest de bladzijden niet', async () => {
    const vijf = BLAD.concat([1, 2, 3].map((i) => ({ type: 'tekst', titel: 'Blad ' + (i + 2), inhoud: 'Blad ' + i + ' ' + merk })));
    const r = await w.post(OPSLAAN, K({ pages: vijf }));
    await w.crash();
    const p = await mijnSchrift();
    return { klopt: r.status === 200 && p.length === 5, ziet: 'bewaard ' + r.status + ', na SIGKILL ' + p.length + ' bladzijden' };
  });
}

module.exports = {
  functie: 'link:rtfschrift',
  ingang: '/apps/foundation/schrift.html',
  persona: 'gezin',
  omgeving: GEZINSWERELD,
  belofte: 'een leerling doet mee met een les, ziet bord, opgaven en agenda, schrijft in zijn eigen schrift, levert in en vraagt de bijleshulp -- een klasgenoot of een andere les leest zijn schrift niet, en wie uit de les is gehaald schrijft er niet meer in',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf: de live stroom (SSE) loopt hier niet mee, en de bijleshulp antwoordt zonder model met de vaste terugval. Meedoen vraagt geen account (/les/join); dat staat als open bevoegdheidsstap en is gemeld. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
