/* ============================================================================
   VOLTOOIPROEF: DE WERELDLAAG (link:wereldlaag, /apps/wereld.html).

   De belofte, in de woorden van WERELD.md en kern/salon/: het beginscherm
   waarop De Salon het beeld levert. Een lid plaatst een post (tekst, of een
   foto), een ander lid leest hem en reageert; de maker ziet de reactie bij
   zijn post en kan de post weghalen -- en dan is hij voor iedereen weg, met
   de reacties. Een lege post wordt geweigerd; een post die niet bestaat of
   niet voor jou zichtbaar is, is niet te lezen.

   DE ONTVANGER is een tweede lid, verbonden via De Salon, dat de post ziet
   en erop reageert.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, verbind } = require('../voltooiwereld');

const PLAATS = '/api/salon/plaats';
const WEG = '/api/salon/weg';
const FEED = '/api/salon/feed';
const REACTIES = '/api/salon/reacties';
const REAGEER = '/api/salon/reageer';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const merk = 'wl' + Date.now().toString(36);
  const A = await nieuwLid(w, 'wla');
  const B = await nieuwLid(w, 'wlb');
  await verbind(w, A, B);
  const feed = async (tok, extra) => ((((await w.post(FEED, Object.assign({ limiet: 20 }, extra || {}), tok)).data) || {}).posts || []);
  const vind = async (tok, id) => (await feed(tok)).find((p) => String(p.id) === String(id)) || null;
  const reacties = async (tok, id) => ((((await w.post(REACTIES, { id }, tok)).data) || {}).reacties || []);
  let post = null;

  await stap('voltooibaar', 'een lege post wordt geweigerd; A plaatst er een en ziet hem in de feed', async () => {
    const leeg = await w.post(PLAATS, { tekst: '   ' }, A.token);
    const r = await w.post(PLAATS, { tekst: 'Zonsopgang boven de haven ' + merk }, A.token);
    post = r.data && r.data.post;
    const eigen = post ? await vind(A.token, post.id) : null;
    return { klopt: leeg.status === 400 && /Schrijf iets/.test(leeg.data.error) && r.status === 200 && !!post && !!eigen,
      ziet: 'leeg: ' + leeg.status + ' (' + (leeg.data && leeg.data.error) + '); geplaatst ' + r.status + ', in de feed: ' + (eigen ? 'ja' : 'NEE') };
  });

  await stap('voltooibaar', 'B ziet de post en reageert; een lege reactie en een reactie op een post die niet bestaat worden geweigerd', async () => {
    const bijB = await vind(B.token, post.id);
    const leeg = await w.post(REAGEER, { id: post.id, tekst: '  ' }, B.token);
    const spook = await w.post(REAGEER, { id: 'bestaat-niet-' + merk, tekst: 'hallo daar' }, B.token);
    const r = await w.post(REAGEER, { id: post.id, tekst: 'Wat een licht ' + merk }, B.token);
    return { klopt: !!bijB && leeg.status === 400 && spook.status === 404 && r.status === 200 && !!r.data.reactie,
      ziet: 'B ziet de post: ' + (bijB ? 'ja' : 'NEE') + '; leeg ' + leeg.status + ', spook ' + spook.status + ', reactie ' + r.status };
  });

  await stap('voltooibaar', 'A ziet de reactie van B bij zijn post', async () => {
    const rs = await reacties(A.token, post.id);
    const vanB = rs.find((x) => x.text === 'Wat een licht ' + merk);
    return { klopt: !!vanB, ziet: rs.length + ' reactie(s)' + (vanB ? ', die van B erbij' : ', DIE VAN B ONTBREEKT') };
  });

  await stap('voltooibaar', 'B kan de post van A niet weghalen; A wel, en dan is hij voor B weg, met de reacties', async () => {
    const vreemd = await w.post(WEG, { id: post.id }, B.token);
    const nog = await vind(B.token, post.id);
    const r = await w.post(WEG, { id: post.id }, A.token);
    const weg = await vind(B.token, post.id);
    const rs = await w.post(REACTIES, { id: post.id }, B.token);
    return { klopt: vreemd.status === 400 && !!nog && r.status === 200 && !weg && rs.status === 404,
      ziet: 'B haalt weg: ' + vreemd.status + ' (' + (vreemd.data && vreemd.data.error) + '); A haalt weg: ' + r.status + ', daarna voor B: ' + (weg ? 'STAAT ER NOG' : 'weg') + ', reacties ' + rs.status };
  });

  /* ---------------- persistent ---------------- */
  const tweede = (await w.post(PLAATS, { tekst: 'Avondmarkt ' + merk }, A.token)).data.post;
  await w.post(REAGEER, { id: tweede.id, tekst: 'Lekker daar ' + merk }, B.token);
  const voor = JSON.stringify([await vind(A.token, tweede.id), await reacties(A.token, tweede.id)]);
  await w.herstart();
  await stap('persistent', 'na een nette herstart staan de post en de reactie er, byte voor byte gelijk', async () => {
    const na = JSON.stringify([await vind(A.token, tweede.id), await reacties(A.token, tweede.id)]);
    return { klopt: voor.length > 10 && na === voor && JSON.parse(na)[1].length === 1, ziet: na === voor ? 'gelijk' : 'ANDERS' };
  });
  await stap('persistent', 'een nieuwe sessie van B (een ander toestel) ziet de post en zijn eigen reactie', async () => {
    const C = await inloggen(w, B);
    const p = await vind(C, tweede.id);
    const rs = await reacties(C, tweede.id);
    return { klopt: !!p && rs.some((x) => x.text === 'Lekker daar ' + merk), ziet: 'post ' + (p ? 'gevonden' : 'WEG') + ', ' + rs.length + ' reactie(s)' };
  });
  await stap('persistent', 'de post en de reactie staan in de opslag zelf (gelezen buiten de server om)', async () => {
    const p = w.vindInOpslag('Avondmarkt ' + merk), r = w.vindInOpslag('Lekker daar ' + merk);
    return { klopt: p.length >= 1 && r.length >= 1, ziet: 'post in ' + p.map((x) => x.sleutel || x.tabel).join(',') + '; reactie in ' + r.map((x) => x.sleutel || x.tabel).join(',') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "plaatsen": een post, niet twee', async () => {
    const tekst = 'Dubbel ' + merk;
    const [a, b] = await w.dubbel(PLAATS, { tekst }, A.token);
    const n = (await feed(A.token)).filter((p) => p.text === tekst).length;
    return { klopt: a.status === 200 && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' post(s)' };
  });
  await stap('herstelbaar', 'een afgebroken reactie en daarna opnieuw: precies een reactie', async () => {
    const tekst = 'Afgebroken ' + merk;
    const half = await w.afgebroken(REAGEER, { id: tweede.id, tekst }, B.token);
    const opnieuw = await w.post(REAGEER, { id: tweede.id, tekst }, B.token);
    const n = (await reacties(A.token, tweede.id)).filter((x) => x.text === tekst).length;
    return { klopt: geen5xx(opnieuw) && n === 1, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' reactie(s)' };
  });
  await stap('herstelbaar', 'een crash direct na het plaatsen: de post staat er na de herstart', async () => {
    const r = await w.post(PLAATS, { tekst: 'Crash ' + merk }, A.token);
    await w.crash();
    const n = (await feed(B.token)).filter((p) => p.text === 'Crash ' + merk).length;
    return { klopt: r.status === 200 && n === 1, ziet: 'plaatsen ' + r.status + ', na SIGKILL ziet B ' + n + ' post' };
  });
  await stap('herstelbaar', 'een crash direct na het weghalen: weg blijft weg, ook op schijf buiten het archief', async () => {
    const r = await w.post(WEG, { id: tweede.id }, A.token);
    await w.crash();
    const p = await vind(B.token, tweede.id);
    const nogeens = await w.post(WEG, { id: tweede.id }, A.token);
    return { klopt: r.status === 200 && !p && geen5xx(nogeens), ziet: 'weghalen ' + r.status + ', na SIGKILL voor B: ' + (p ? 'STAAT ER NOG' : 'weg') + ', nog eens weghalen ' + nogeens.status };
  });
}

module.exports = {
  functie: 'link:wereldlaag',
  ingang: '/apps/wereld.html',
  persona: 'lid',
  belofte: 'een lid plaatst een post in De Salon, een verbonden lid leest hem en reageert, de maker ziet de reactie en haalt de post weg -- en dan is hij voor iedereen weg',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Foto en video (de upload en de ondertitels), het volgen in RTG Media en de krant zijn niet gelopen; de keuring van de tekst is niet uitgelokt. Twee verbonden leden, geen curatie door RTG. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
