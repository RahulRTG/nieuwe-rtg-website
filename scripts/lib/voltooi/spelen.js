/* ============================================================================
   VOLTOOIPROEF: SPELEN (link:spelen, /apps/spelen.html?pas=).

   De belofte van het scherm: een lid nodigt een vriend uit voor een potje, de
   vriend zegt ja, ze spelen om de beurt tot het potje klaar is, en de uitslag
   telt -- maar ALLEEN voor wie de 18+-poort haalt (progressieMag in
   kern/spellen/grens.js: een eigen account, het identiteitsbewijs door RTG
   gezien, en 18 of ouder). Onder die grens blijft het spel volledig speelbaar
   en wordt er niets van bewaard; dat is hier een eigen schakel, en hij leest de
   opslag zelf.

   Het potje is schaken, met het kortste mat dat bestaat (1. f3 e5 2. g4 Dh4#):
   vier zetten die het spel echt laten eindigen, zodat de uitslag geen
   aanname is. Het bord telt van rij 0 (zwart, hoofdletters) tot rij 7 (wit,
   kleine letters); veld = rij * 8 + kolom.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, geverifieerdLid, verbind, KANTOORWERELD } = require('../voltooiwereld');

const NIEUW = '/api/member/spel/nieuw';
const ANTWOORD = '/api/member/spel/antwoord';
const MIJN = '/api/member/spel/mijn';
const STAAT = '/api/member/spel/staat';
const ZET = '/api/member/spel/zet';
const UITSLAGEN = '/api/member/spel/uitslagen';
const STAND = '/api/member/spel/stand';

/* Narrenmat: f2-f3, e7-e5, g2-g4, Dd8-h4. */
const NARRENMAT = [{ van: 53, naar: 45 }, { van: 12, naar: 28 }, { van: 54, naar: 38 }, { van: 3, naar: 39 }];
const START = 'RNBQKBNRPPPPPPPP' + '.'.repeat(32) + 'pppppppprnbqkbnr';
/* Het bord na de eerste k zetten van het narrenmat: de spelersweergave toont
   het bord en de laatste zet, niet de lijst, dus zo telt de proef de zetten. */
function bordNa(k) {
  const b = START.split('');
  for (const z of NARRENMAT.slice(0, k)) { b[z.naar] = b[z.van]; b[z.van] = '.'; }
  return b.join('');
}
const zetten = (p) => { for (let k = 0; k <= NARRENMAT.length; k++) if (p && p.staat && p.staat.bord === bordNa(k)) return k; return -1; };

async function loop(w, stap) {
  const A = await geverifieerdLid(w, 'spa');
  const B = await geverifieerdLid(w, 'spb');
  const C = await nieuwLid(w, 'spc');
  const D = await nieuwLid(w, 'spd');
  const ab = await verbind(w, A, B);
  const cd = await verbind(w, C, D);
  let potje = null;

  const staat = async (tok, id) => { const r = await w.post(STAAT, { id }, tok); return r.status === 200 ? r.data.potje : { fout: r.status }; };
  const uitslagen = async (tok) => (await w.post(UITSLAGEN, { hoeveel: 25 }, tok)).data || {};
  async function potjeTussen(X, Y, keyY) {
    const n = await w.post(NIEUW, { soort: 'schaak', grootte: 2, vrienden: [keyY] }, X.token);
    const id = n.data && n.data.id;
    const a = await w.post(ANTWOORD, { id, akkoord: true }, Y.token);
    if (n.status !== 200 || a.status !== 200) throw new Error('potje opzetten lukte niet (' + n.status + '/' + a.status + ')');
    return id;
  }
  async function speelUit(X, Y, id) {
    const uit = [];
    for (let i = 0; i < NARRENMAT.length; i++) uit.push((await w.post(ZET, { id, zet: NARRENMAT[i] }, (i % 2 ? Y : X).token)).status);
    return uit;
  }

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'A nodigt vriend B uit voor een potje schaak; het potje wacht op B en B ziet de uitnodiging', async () => {
    const n = await w.post(NIEUW, { soort: 'schaak', grootte: 2, vrienden: [ab.b.key] }, A.token);
    potje = n.data && n.data.id;
    const mb = await w.post(MIJN, {}, B.token);
    const tekst = JSON.stringify(mb.data || {});
    return { klopt: n.status === 200 && !!potje && mb.status === 200 && tekst.includes(potje),
      ziet: 'nieuw ' + n.status + ' (' + potje + '), B ziet de uitnodiging: ' + tekst.includes(potje) };
  });

  await stap('voltooibaar', 'B zegt ja: het potje loopt, A (wit) is aan zet en B wacht', async () => {
    const a = await w.post(ANTWOORD, { id: potje, akkoord: true }, B.token);
    const s = await staat(A.token, potje);
    return { klopt: a.status === 200 && a.data.gestart === true && s.status === 'bezig' && s.staat && s.staat.aanZet === 'w',
      ziet: 'antwoord ' + a.status + ' gestart=' + (a.data && a.data.gestart) + ', staat ' + s.status + ', aan zet ' + (s.staat && s.staat.aanZet) };
  });

  await stap('voltooibaar', 'zetten op de beurt: een zet buiten de beurt en een onmogelijke zet worden geweigerd met de reden', async () => {
    const buiten = await w.post(ZET, { id: potje, zet: NARRENMAT[1] }, B.token);
    const onmogelijk = await w.post(ZET, { id: potje, zet: { van: 53, naar: 29 } }, A.token);
    const s = await staat(B.token, potje);
    return { klopt: buiten.status === 409 && /aan zet/.test(buiten.data.error) && onmogelijk.status === 400 && /kan niet/.test(onmogelijk.data.error) &&
      s.staat.aanZet === 'w' && zetten(s) === 0,
      ziet: 'buiten de beurt ' + buiten.status + ' (' + buiten.data.error + '), onmogelijk ' + onmogelijk.status + ', ' + zetten(s) + ' zetten' };
  });

  await stap('voltooibaar', 'het narrenmat: vier zetten en het potje is klaar, met B als winnaar bij allebei', async () => {
    const z = await speelUit(A, B, potje);
    const sa = await staat(A.token, potje), sb = await staat(B.token, potje);
    return { klopt: z.every((x) => x === 200) && sa.status === 'klaar' && sb.status === 'klaar' && sa.winnaar === ab.b.codenaam && sb.winnaar === ab.b.codenaam,
      ziet: 'zetten ' + z.join('/') + ', status ' + sa.status + ', winnaar ' + sa.winnaar };
  });

  await stap('voltooibaar', 'de uitslag telt voor twee geverifieerde volwassenen: A verloor, B won, op codenaam', async () => {
    const ua = await uitslagen(A.token), ub = await uitslagen(B.token);
    const ra = (ua.uitslagen || []).find((x) => x.id === potje), rb = (ub.uitslagen || []).find((x) => x.id === potje);
    return { klopt: ua.progressie === true && !!ra && ra.ik === false && ra.tegen[0].codenaam === ab.b.codenaam && !!rb && rb.ik === true,
      ziet: 'A: progressie ' + ua.progressie + ', won=' + (ra && ra.ik) + '; B won=' + (rb && rb.ik) };
  });

  await stap('voltooibaar', 'de 18+-grens: twee leden zonder geverifieerd paspoort spelen hetzelfde potje helemaal uit, en er wordt niets bewaard', async () => {
    const id = await potjeTussen(C, D, cd.b.key);
    const z = await speelUit(C, D, id);
    const s = await staat(C.token, id);
    const uc = await uitslagen(C.token);
    const st = await w.post(STAND, {}, C.token);
    const opslag = (w.collectie('spelUitslagen') || []).filter((r) => r.id === id);
    return { klopt: z.every((x) => x === 200) && s.status === 'klaar' && uc.progressie === false && (uc.uitslagen || []).length === 0 &&
      /18 of ouder/.test(uc.reden || '') && st.status === 200 && opslag.length === 0 && !w.vindInOpslag(id).some((p) => p.sleutel === 'spelUitslagen'),
      ziet: 'zetten ' + z.join('/') + ', ' + s.status + '; uitslagen ' + (uc.uitslagen || []).length + ' (progressie ' + uc.progressie + '), in de opslag ' + opslag.length };
  });

  /* Bevoegdheid. */
  await stap('bevoegd', 'bevoegd: zonder inlog geven een nieuw potje, de staat, een zet en de uitslagen 401', async () => {
    const r = await Promise.all([w.post(NIEUW, { soort: 'schaak', grootte: 2 }), w.post(STAAT, { id: potje }), w.post(ZET, { id: potje, zet: NARRENMAT[0] }), w.post(UITSLAGEN, {})]);
    return { klopt: r.every((x) => x.status === 401), ziet: r.map((x) => x.status).join('/') };
  });

  await stap('bevoegd', 'bevoegd: een lid buiten het potje ziet het bord niet, zet niet mee en kan geen uitnodiging van een ander aannemen', async () => {
    const id = await potjeTussen(A, B, ab.b.key);
    const s = await w.post(STAAT, { id }, C.token);
    const z = await w.post(ZET, { id, zet: NARRENMAT[0] }, C.token);
    const n = await w.post(NIEUW, { soort: 'schaak', grootte: 2, vrienden: [ab.b.key] }, A.token);
    const a = await w.post(ANTWOORD, { id: n.data.id, akkoord: true }, C.token);
    const nog = await staat(A.token, id);
    return { klopt: s.status === 404 && z.status === 404 && a.status === 404 && zetten(nog) === 0,
      ziet: 'staat ' + s.status + ', zet ' + z.status + ', andermans uitnodiging ' + a.status + ', bord heeft ' + zetten(nog) + ' zetten' };
  });

  await stap('bevoegd', 'bevoegd: wie niet bevriend is, kan niet via de vriendenlijst uitgenodigd worden', async () => {
    const n = await w.post(NIEUW, { soort: 'schaak', grootte: 2, vrienden: [cd.a.key] }, A.token);
    const mc = await w.post(MIJN, {}, C.token);
    return { klopt: n.status === 400 && !!n.data.error && !n.data.id && ((mc.data && mc.data.uitnodigingen) || []).length === 0,
      ziet: 'nieuw ' + n.status + (n.data && n.data.error ? ' (' + n.data.error + ')' : '') + ', C heeft ' + ((mc.data && mc.data.uitnodigingen) || []).length + ' uitnodigingen' };
  });

  /* ---------------- persistent ---------------- */
  const lopend = await potjeTussen(A, B, ab.b.key);
  await w.post(ZET, { id: lopend, zet: NARRENMAT[0] }, A.token);
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat het afgelopen potje er nog, met dezelfde winnaar', async () => {
    const s = await staat(A.token, potje);
    return { klopt: s.status === 'klaar' && s.winnaar === ab.b.codenaam && zetten(s) === 4, ziet: s.status + ', winnaar ' + s.winnaar + ', ' + zetten(s) + ' zetten' };
  });
  await stap('persistent', 'een lopend potje overleeft de herstart midden in de partij: B is aan zet en zet gewoon door', async () => {
    const T = await inloggen(w, B);
    const s0 = await staat(T, lopend);
    const z = await w.post(ZET, { id: lopend, zet: NARRENMAT[1] }, T);
    return { klopt: s0.status === 'bezig' && s0.staat.aanZet === 'z' && zetten(s0) === 1 && z.status === 200,
      ziet: 'nieuwe sessie van B: ' + s0.status + ', aan zet ' + (s0.staat && s0.staat.aanZet) + ', zet ' + z.status };
  });
  await stap('persistent', 'de uitslag staat in de opslag zelf (gelezen buiten de server om), op codenaam en onder het potje', async () => {
    const rij = (w.collectie('spelUitslagen') || []).filter((r) => r.id === potje);
    const ua = await uitslagen(await inloggen(w, A));
    return { klopt: rij.length === 1 && rij[0].spelers.length === 2 && (ua.uitslagen || []).some((x) => x.id === potje),
      ziet: rij.length + ' rij in spelUitslagen, nieuwe sessie van A ziet hem: ' + (ua.uitslagen || []).some((x) => x.id === potje) };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "nodig uit en start" (tegelijk): een uitnodiging, niet twee', async () => {
    const lijf = { soort: 'schaak', grootte: 2, vrienden: [ab.b.key], codenamen: [], taal: 'nl', idem: 'voltooi-spel-dubbel-' + Date.now() };
    const [a, b] = await w.dubbel(NIEUW, lijf, A.token);
    const wacht = (((await w.post(MIJN, {}, B.token)).data || {}).uitnodigingen || []).filter((u) => [a.data && a.data.id, b.data && b.data.id].includes(u.id));
    return { klopt: a.status === 200 && b.status === 200 && a.data.id === b.data.id && wacht.length === 1,
      ziet: 'tikken ' + a.status + '/' + b.status + ', ids ' + (a.data && a.data.id) + '/' + (b.data && b.data.id) + ', B heeft ' + wacht.length + ' uitnodiging(en)' };
  });
  await stap('herstelbaar', 'een crash direct na "nodig uit en start", daarna dezelfde tik: een uitnodiging; dezelfde sleutel voor een ander spel is 409', async () => {
    const lijf = { soort: 'schaak', grootte: 2, vrienden: [ab.b.key], codenamen: [], taal: 'nl', idem: 'voltooi-spel-crash-' + Date.now() };
    const r = await w.post(NIEUW, lijf, A.token);
    await w.crash();
    const opnieuw = await w.post(NIEUW, lijf, A.token);
    const anders = await w.post(NIEUW, Object.assign({}, lijf, { soort: 'woord' }), A.token);
    const wacht = (((await w.post(MIJN, {}, B.token)).data || {}).uitnodigingen || []).filter((u) => u.id === (r.data && r.data.id));
    return { klopt: r.status === 200 && opnieuw.status === 200 && opnieuw.data.id === r.data.id && anders.status === 409 && wacht.length === 1,
      ziet: 'start ' + r.status + ', na SIGKILL ' + opnieuw.status + (opnieuw.data && opnieuw.data.herhaald ? ' (herhaald)' : '') + ', ander spel ' + anders.status + ', B heeft ' + wacht.length + ' uitnodiging' };
  });
  await stap('herstelbaar', 'een dubbele tik op een zet (tegelijk): de zet staat er een keer, de tweede tik hoort dat de ander aan zet is', async () => {
    const [a, b] = await w.dubbel(ZET, { id: lopend, zet: NARRENMAT[2] }, A.token);
    const s = await staat(B.token, lopend);
    return { klopt: [a.status, b.status].sort().join() === '200,409' && zetten(s) === 3 && s.staat.aanZet === 'z',
      ziet: 'tikken ' + a.status + '/' + b.status + ', ' + zetten(s) + ' zetten, aan zet ' + s.staat.aanZet };
  });
  await stap('herstelbaar', 'een afgebroken zet, daarna opnieuw: de partij eindigt een keer, met een uitslag', async () => {
    const half = await w.afgebroken(ZET, { id: lopend, zet: NARRENMAT[3] }, B.token);
    const opnieuw = await w.post(ZET, { id: lopend, zet: NARRENMAT[3] }, B.token);
    const s = await staat(A.token, lopend);
    const rij = (w.collectie('spelUitslagen') || []).filter((r) => r.id === lopend);
    return { klopt: [200, 409].includes(opnieuw.status) && s.status === 'klaar' && zetten(s) === 4 && rij.length === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + s.status + ', ' + rij.length + ' uitslag' };
  });
  await stap('herstelbaar', 'een crash direct na de matzet: het potje is klaar en de uitslag staat er een keer', async () => {
    const id = await potjeTussen(A, B, ab.b.key);
    const z = await speelUit(A, B, id);
    await w.crash();
    const s = await staat(A.token, id);
    const rij = (w.collectie('spelUitslagen') || []).filter((r) => r.id === id);
    const ub = await uitslagen(B.token);
    return { klopt: z.every((x) => x === 200) && s.status === 'klaar' && rij.length === 1 && (ub.uitslagen || []).filter((x) => x.id === id).length === 1,
      ziet: 'zetten ' + z.join('/') + ', na SIGKILL ' + s.status + ', ' + rij.length + ' uitslag in de opslag' };
  });
}

module.exports = {
  functie: 'link:spelen',
  ingang: '/apps/spelen.html?pas=',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid nodigt een vriend uit, ze spelen om de beurt tot het potje klaar is, en de uitslag telt alleen voor geverifieerde volwassenen -- onder die grens speelt het spel gewoon en wordt er niets bewaard; wie niet meespeelt ziet het bord niet en zet niet mee, en een herstart, dubbele tik, afgebroken zet of crash verliest of verdubbelt niets',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf, en alleen de lid-ingang (/api/member/spel/*); de gezinsingang /api/rtf/spel/* draait dezelfde motor maar loopt hier niet mee. Gespeeld is schaken; de andere spellen, de arcade, toernooien, teams, Rahul en het gedeelde scherm lopen niet mee. De identiteit keurt het eigenaarsaccount van de testomgeving goed. Geen Redis of PostgreSQL in de wereld.',
  loop
};
