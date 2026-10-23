/* ============================================================================
   VOLTOOIPROEF: VRIENDEN IN HET GEZIN (link:vrienden, /apps/foundation/vrienden.html).

   De belofte van het scherm: een kind van 15 of jonger zoekt en verbindt niet
   zelf; zijn ouder voegt een vriendje toe, de ouder van dat vriendje keurt
   goed, en pas dan kunnen de twee elkaar berichten sturen. Elke ouder ziet wie
   er in de kring van zijn kind staat. Een ander gezin, een vreemde ouder of het
   kind zelf kan die stappen niet overslaan.

   DE WERELD. Twee gezinnen, elk met een eigenaar-account dat RTG heeft gezien
   (een kind toevoegen vraagt een gecontroleerd paspoort) en een kind van tien
   (../voltooigezin.js, accountplicht aan). Een derde gezin is de vreemde ouder.
   Alles loopt over /api/rtf/social, met code en token van het gezinsprofiel in
   het lijf, zoals soc() in vrienden.html.

   EEN BERICHT DRAAGT EEN HERHAALSLEUTEL PER OPGESTELD BERICHT (RTGId in het
   scherm, kern/comm/bericht.js): een dubbele tik, een nieuwe poging na een
   afgebroken verzoek en een herhaling na een crash zijn hetzelfde bericht; een
   bewust tweede "ja" krijgt een eigen sleutel.
   ========================================================================== */
'use strict';
const { GEZINSWERELD, accountGezin } = require('../voltooigezin');

const CONNECTIONS = '/api/rtf/social/connections';
const FIND = '/api/rtf/social/find';
const CONNECT = '/api/rtf/social/connect';
const OUDERVOEG = '/api/rtf/social/oudervoeg';
const GOEDKEUREN = '/api/rtf/social/goedkeuren';
const DM = '/api/rtf/social/dm';
const DM_SEND = '/api/rtf/social/dm/send';
const KIND_CONTACTEN = '/api/rtf/social/kind/contacten';

async function loop(w, stap) {
  const merk = Date.now().toString(36);
  const A = await accountGezin(w, 'vrienda', { kind: true });
  const B = await accountGezin(w, 'vriendb', { kind: true });
  const C = await accountGezin(w, 'vriendc', { kind: true });
  const soc = (s, pad, b) => w.post(pad, Object.assign({ code: s.code, token: s.token }, b || {}));
  const ik = async (s) => (await soc(s, CONNECTIONS)).data || {};
  const ka = await ik(A.kind), kb = await ik(B.kind), kc = await ik(C.kind);
  const verbonden = (c, met) => (c.connections || []).some((x) => x.key === met);
  const berichten = async (s, met) => (((await soc(s, DM, { withKey: met })).data) || {}).messages || [];
  const HOI = 'Kom je zaterdag voetballen? ' + merk;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'het kind van tien zoekt en verbindt niet zelf: dat doet zijn ouder', async () => {
    const f = await soc(A.kind, FIND, { q: kb.codename });
    const c = await soc(A.kind, CONNECT, { key: kb.me });
    return { klopt: ka.beschermd === true && f.status === 403 && c.status === 403 && /ouder/.test((f.data && f.data.error) || ''),
      ziet: 'beschermd ' + ka.beschermd + ', zoeken ' + f.status + ', verbinden ' + c.status };
  });

  await stap('voltooibaar', 'de ouder van A voegt het kind van B toe; het wacht op de ouder van B, die het verzoek ziet', async () => {
    const v = await soc(A.gezin, OUDERVOEG, { kindHandle: ka.me, codenaam: kb.codename });
    const ob = await ik(B.gezin);
    const wacht = (ob.teKeuren || []).find((x) => x.kindHandle === kb.me && x.anderKey === ka.me);
    return { klopt: v.status === 200 && v.data.status === 'wacht-op-ouder' && !!wacht && !verbonden(await ik(A.kind), kb.me),
      ziet: 'toevoegen ' + v.status + ' (' + (v.data && v.data.status) + '), bij de ouder van B ' + (ob.teKeuren || []).length + ' te keuren' };
  });

  await stap('voltooibaar', 'de ouder van B keurt goed: pas nu zijn de twee kinderen verbonden', async () => {
    const g = await soc(B.gezin, GOEDKEUREN, { kindHandle: kb.me, anderKey: ka.me, akkoord: true });
    return { klopt: g.status === 200 && g.data.status === 'verbonden' && verbonden(await ik(A.kind), kb.me) && verbonden(await ik(B.kind), ka.me),
      ziet: 'goedkeuren ' + g.status + ' (' + (g.data && g.data.status) + ')' };
  });

  await stap('voltooibaar', 'kind A stuurt een bericht, kind B leest het, en de ouder van A ziet B in de kring van zijn kind', async () => {
    const s = await soc(A.kind, DM_SEND, { toKey: kb.me, text: HOI });
    const m = await berichten(B.kind, ka.me);
    const kc2 = await soc(A.gezin, KIND_CONTACTEN, { kindHandle: ka.me });
    return { klopt: s.status === 200 && m.some((x) => x.text === HOI && x.from === ka.me) && kc2.status === 200 && JSON.stringify(kc2.data).includes(kb.codename),
      ziet: 'sturen ' + s.status + ', B leest ' + m.length + ' bericht, kring bij de ouder ' + kc2.status };
  });

  /* Bevoegdheid. */
  await stap('bevoegd', 'bevoegdheid: zonder gezinssessie geen kring, geen bericht en geen toevoeging', async () => {
    const c = await w.post(CONNECTIONS, {});
    const d = await w.post(DM_SEND, { toKey: kb.me, text: 'anoniem' });
    const o = await w.post(OUDERVOEG, { kindHandle: ka.me, codenaam: kc.codename });
    return { klopt: [c.status, d.status, o.status].every((x) => x === 401 || x === 403), ziet: 'kring ' + c.status + ', bericht ' + d.status + ', toevoegen ' + o.status };
  });

  await stap('bevoegd', 'bevoegdheid: een vreemde ouder voegt niemand toe voor andermans kind, keurt niets goed en leest de chat niet', async () => {
    const o = await soc(C.gezin, OUDERVOEG, { kindHandle: ka.me, codenaam: kc.codename });
    const g = await soc(C.gezin, GOEDKEUREN, { kindHandle: kb.me, anderKey: ka.me, akkoord: false });
    const d = await soc(C.kind, DM, { withKey: ka.me });
    const s = await soc(C.kind, DM_SEND, { toKey: ka.me, text: 'van een vreemde' });
    return { klopt: o.status >= 400 && g.status === 403 && d.status === 403 && s.status === 403 && verbonden(await ik(A.kind), kb.me) && !verbonden(await ik(A.kind), kc.me),
      ziet: 'vreemde ouder: toevoegen ' + o.status + ', keuren ' + g.status + '; vreemd kind: lezen ' + d.status + ', sturen ' + s.status };
  });

  await stap('bevoegd', 'bevoegdheid: het kind keurt zelf niets goed en voegt niemand toe, ook niet voor zichzelf', async () => {
    const v = await soc(A.gezin, OUDERVOEG, { kindHandle: ka.me, codenaam: kc.codename });
    const g = await soc(C.kind, GOEDKEUREN, { kindHandle: kc.me, anderKey: ka.me, akkoord: true });
    const o = await soc(A.kind, OUDERVOEG, { kindHandle: ka.me, codenaam: kc.codename });
    return { klopt: v.status === 200 && g.status === 403 && o.status === 403 && !verbonden(await ik(A.kind), kc.me),
      ziet: 'verzoek naar C ' + (v.data && v.data.status) + ', kind C keurt zelf ' + g.status + ', kind A voegt zelf toe ' + o.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart zijn de kinderen nog verbonden en staat het bericht er nog; het verzoek naar C wacht nog', async () => {
    const m = await berichten(B.kind, ka.me);
    const oc = await ik(C.gezin);
    return { klopt: verbonden(await ik(A.kind), kb.me) && m.some((x) => x.text === HOI) && (oc.teKeuren || []).some((x) => x.anderKey === ka.me),
      ziet: m.length + ' bericht, ' + (oc.teKeuren || []).length + ' verzoek te keuren bij C' };
  });

  await stap('persistent', 'een read-only lezer vindt het bericht in de opslag; het hangt aan een profielsleutel en niet aan een e-mailadres', async () => {
    const v = w.vindInOpslag(HOI);
    const m = (await berichten(B.kind, ka.me)).find((x) => x.text === HOI) || {};
    return { klopt: v.length > 0 && m.from === ka.me && /^rtf:/.test(m.from) && !JSON.stringify(m).includes(A.email),
      ziet: 'bericht in ' + [...new Set(v.map((p) => p.bestand + (p.sleutel ? ':' + p.sleutel : ':' + p.tabel)))].join(', ') };
  });

  await stap('persistent', 'de ouder opent na de herstart vanuit zijn account een nieuwe sessie voor zijn kind, en daarin staat dezelfde chat', async () => {
    const s = await w.post('/api/rtf/eigen-gezin/sessie', { profielId: A.kind.profielId }, A.token);
    const m = s.data && s.data.token ? await berichten({ code: s.data.code, token: s.data.token }, kb.me) : [];
    return { klopt: s.status === 200 && m.some((x) => x.text === HOI), ziet: 'nieuwe kindersessie ' + s.status + ', ' + m.length + ' bericht' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op Goedkeuren verbindt een keer', async () => {
    const [a, b] = await w.dubbel(GOEDKEUREN, { code: C.gezin.code, token: C.gezin.token, kindHandle: kc.me, anderKey: ka.me, akkoord: true });
    const n = ((await ik(A.kind)).connections || []).filter((x) => x.key === kc.me).length;
    return { klopt: [a.status, b.status].includes(200) && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + n + ' verbinding met C' };
  });

  await stap('herstelbaar', 'een dubbele tik op Toevoegen zet een verzoek klaar en geen twee', async () => {
    const D = await accountGezin(w, 'vriendd', { kind: true });
    const kd = await ik(D.kind);
    const [a, b] = await w.dubbel(OUDERVOEG, { code: A.gezin.code, token: A.gezin.token, kindHandle: ka.me, codenaam: kd.codename });
    const n = ((await ik(D.gezin)).teKeuren || []).filter((x) => x.anderKey === ka.me).length;
    return { klopt: [a.status, b.status].includes(200) && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + n + ' verzoek bij de ouder van D' };
  });

  await stap('herstelbaar', 'een afgebroken bericht en daarna opnieuw met dezelfde sleutel: het staat er precies een keer', async () => {
    const T = 'Neem je bal mee ' + merk;
    const lijf = { code: A.kind.code, token: A.kind.token, toKey: kb.me, text: T, idem: 'dm-' + merk + '-half' };
    const half = await w.afgebroken(DM_SEND, lijf);
    const opnieuw = await w.post(DM_SEND, lijf);
    const n = (await berichten(B.kind, ka.me)).filter((x) => x.text === T).length;
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', bij B ' + n + ' bericht' };
  });

  await stap('herstelbaar', 'een crash direct na een bericht verliest het niet, en dezelfde sleutel daarna verdubbelt het niet', async () => {
    const T = 'Tot zaterdag ' + merk;
    const lijf = { toKey: kb.me, text: T, idem: 'dm-' + merk + '-crash' };
    const s = await soc(A.kind, DM_SEND, lijf);
    await w.crash();
    const nogEens = await soc(A.kind, DM_SEND, lijf);
    const n = (await berichten(B.kind, ka.me)).filter((x) => x.text === T).length;
    return { klopt: s.status === 200 && nogEens.status === 200 && n === 1, ziet: 'sturen ' + s.status + ', na SIGKILL dezelfde sleutel ' + nogEens.status + ', bij B ' + n + ' bericht' };
  });

  await stap('herstelbaar', 'een dubbele tik op Stuur met dezelfde sleutel is een bericht', async () => {
    const T = 'Dubbel getikt ' + merk;
    const [a, b] = await w.dubbel(DM_SEND, { code: A.kind.code, token: A.kind.token, toKey: kb.me, text: T, idem: 'dm-' + merk + '-dubbel' });
    const n = (await berichten(B.kind, ka.me)).filter((x) => x.text === T).length;
    return { klopt: a.status === 200 && b.status === 200 && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', bij B ' + n + ' bericht' };
  });
}

module.exports = {
  functie: 'link:vrienden',
  ingang: '/apps/foundation/vrienden.html',
  persona: 'gezin',
  omgeving: GEZINSWERELD,
  belofte: 'een kind zoekt niet zelf: zijn ouder voegt een vriendje toe, de ouder van dat vriendje keurt goed, en pas dan sturen de kinderen elkaar berichten -- een vreemde ouder, een ander gezin of het kind zelf slaat die stappen niet over',
  grens: 'De proef loopt over /api/rtf/social, de routes die het scherm aanroept, niet door het scherm zelf. Snaps, verhalen, de contactpin, bellen (WebRTC) en de live stroom lopen hier niet mee. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
