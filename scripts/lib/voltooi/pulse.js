/* ============================================================================
   VOLTOOIPROEF: PULSE (link:pulse, /apps/pulse.html).

   De belofte, in de woorden van kern/pulse/index.js: het eigen microblog van
   RTG, 9+. Een lid schrijft een kort bericht, een ander lid vindt het onder
   Ontdek, waardeert het (een tweede tik haalt de waardering weer weg),
   reageert erop en legt het op zijn plank; wie het schreef haalt het weg en
   dan is het voor iedereen weg. Tien seconden tussen twee berichten van
   hetzelfde lid, geen spampomp; het Moment van de week is een enkel
   lichtpunt en geen ranglijst. Daarnaast de dagstemming van Wauw: een keuze
   uit het lijstje, een dag geldig.

   DE ONTVANGER is een tweede lid dat het bericht ziet en erop reageert.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const FEED = '/api/member/pulse/feed';
const POST = '/api/member/pulse/post';
const WEG = '/api/member/pulse/weg';
const LIKE = '/api/member/pulse/like';
const REACTIE = '/api/member/pulse/reactie';
const BEWAAR = '/api/member/pulse/bewaar';
const BEWAARD = '/api/member/pulse/bewaard';
const STEMMING = '/api/member/wauw/stemming';
const STEMMING_ZET = '/api/member/wauw/stemming/zet';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

async function loop(w, stap) {
  const merk = 'pl' + Date.now().toString(36);
  const A = await nieuwLid(w, 'pla');
  const B = await nieuwLid(w, 'plb');
  const feed = async (tok, soort) => ((((await w.post(FEED, { soort: soort || 'volgend' }, tok)).data) || {}).feed || []);
  const vind = async (tok, soort, id) => (await feed(tok, soort)).find((x) => x.id === id) || null;
  let post = null;

  await stap('voltooibaar', 'een leeg bericht wordt geweigerd; A schrijft er een met een tag en ziet het in zijn eigen feed', async () => {
    const leeg = await w.post(POST, { tekst: '   ' }, A.token);
    const r = await w.post(POST, { tekst: 'Mooie ochtend in de stad ' + merk + ' #ochtend' }, A.token);
    post = r.data && r.data.post;
    const eigen = post ? await vind(A.token, 'volgend', post.id) : null;
    return { klopt: leeg.status === 400 && r.status === 200 && !!post && !!eigen && eigen.eigen === true && (eigen.tags || []).includes('ochtend'),
      ziet: 'leeg: ' + leeg.status + ' (' + (leeg.data && leeg.data.error) + '); bericht ' + r.status + ', in eigen feed: ' + (eigen ? 'ja' : 'NEE') };
  });

  await stap('voltooibaar', 'B vindt het onder Ontdek en niet in zijn volgend-feed; B waardeert het, en nog eens tikken haalt de waardering weg', async () => {
    const ontdek = await vind(B.token, 'ontdek', post.id);
    const volgend = await vind(B.token, 'volgend', post.id);
    const aan = await w.post(LIKE, { id: post.id }, B.token);
    const uit = await w.post(LIKE, { id: post.id }, B.token);
    const weer = await w.post(LIKE, { id: post.id }, B.token);
    return { klopt: !!ontdek && !volgend && aan.status === 200 && aan.data.likes === 1 && aan.data.mijn === true && uit.status === 200 && uit.data.likes === 0 && weer.status === 200 && weer.data.likes === 1,
      ziet: 'ontdek: ' + (ontdek ? 'ja' : 'NEE') + ', volgend: ' + (volgend ? 'JA' : 'nee') + '; waardering ' + aan.data.likes + ' -> ' + uit.data.likes + ' -> ' + weer.data.likes };
  });

  await stap('voltooibaar', 'B reageert en legt het bericht op zijn plank; A ziet de reactie bij zijn bericht', async () => {
    const r = await w.post(REACTIE, { id: post.id, tekst: 'Geniet ervan ' + merk }, B.token);
    const b = await w.post(BEWAAR, { id: post.id, map: 'Later' }, B.token);
    const plank = (((await w.post(BEWAARD, {}, B.token)).data) || {}).bewaard || [];
    const bijA = await vind(A.token, 'volgend', post.id);
    return { klopt: r.status === 200 && b.status === 200 && plank.some((x) => x.id === post.id) && !!bijA && bijA.reacties.some((x) => x.tekst === 'Geniet ervan ' + merk) && bijA.likes === 1,
      ziet: 'reactie ' + r.status + ', plank ' + plank.length + ', bij A: ' + (bijA ? bijA.reacties.length + ' reactie(s), ' + bijA.likes + ' waardering' : 'WEG') };
  });

  await stap('bevoegd', 'een bericht dat niet bestaat is niet te waarderen; en B kan het bericht van A niet weghalen', async () => {
    const spook = await w.post(LIKE, { id: 'bestaat-niet-' + merk }, B.token);
    const vreemd = await w.post(WEG, { id: post.id }, B.token);
    const nog = await vind(A.token, 'volgend', post.id);
    return { klopt: spook.status === 404 && vreemd.status === 404 && !!nog, ziet: 'spook ' + spook.status + ', B haalt A weg: ' + vreemd.status + ' (' + (vreemd.data && vreemd.data.error) + '), bericht ' + (nog ? 'staat er' : 'WEG') };
  });

  await stap('voltooibaar', 'de dagstemming van Wauw: iets buiten het lijstje wordt geweigerd, een keuze uit het lijstje staat vandaag', async () => {
    const fout = await w.post(STEMMING_ZET, { emoji: 'emo-boos' }, A.token);
    const r = await w.post(STEMMING_ZET, { emoji: 'emo-blij' }, A.token);
    const s = ((await w.post(STEMMING, {}, A.token)).data) || {};
    return { klopt: fout.status === 400 && r.status === 200 && s.stemming === 'emo-blij', ziet: 'fout: ' + fout.status + ' (' + (fout.data && fout.data.error) + '); stemming ' + s.stemming };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify(await vind(A.token, 'volgend', post.id));
  await w.herstart();
  await stap('persistent', 'na een nette herstart staat het bericht er met zijn waardering en reactie, gelijk; B vindt het nog op zijn plank', async () => {
    const na = JSON.stringify(await vind(A.token, 'volgend', post.id));
    const plank = (((await w.post(BEWAARD, {}, B.token)).data) || {}).bewaard || [];
    return { klopt: voor.length > 2 && na === voor && plank.some((x) => x.id === post.id), ziet: (na === voor ? 'gelijk' : 'ANDERS') + ', plank ' + plank.length };
  });
  await stap('persistent', 'een nieuwe sessie van B (een ander toestel) ziet het bericht onder Ontdek met zijn eigen waardering erop', async () => {
    const C = await inloggen(w, B);
    const x = await vind(C, 'ontdek', post.id);
    return { klopt: !!x && x.mijnLike === true && x.likes === 1, ziet: x ? 'gevonden, mijnLike ' + x.mijnLike : 'NIET GEVONDEN' };
  });
  await stap('persistent', 'het bericht en de reactie staan in de opslag zelf (gelezen buiten de server om)', async () => {
    const p = w.vindInOpslag('Mooie ochtend in de stad ' + merk), r = w.vindInOpslag('Geniet ervan ' + merk);
    return { klopt: p.length >= 1 && r.length >= 1, ziet: 'bericht in ' + p.map((x) => x.sleutel || x.tabel).join(',') + '; reactie in ' + r.map((x) => x.sleutel || x.tabel).join(',') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'dubbeltik op "plaatsen": een bericht, niet twee (de tweede tik hoort "rustig aan")', async () => {
    await wacht(10100);
    const tekst = 'Dubbel ' + merk;
    const [a, b] = await w.dubbel(POST, { tekst }, A.token);
    const n = (await feed(A.token, 'volgend')).filter((x) => x.tekst === tekst).length;
    return { klopt: (a.status === 200 || b.status === 200) && geen5xx(a) && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' bericht(en)' };
  });
  await stap('herstelbaar', 'een afgebroken reactie en daarna opnieuw: precies een reactie', async () => {
    const tekst = 'Afgebroken ' + merk;
    const half = await w.afgebroken(REACTIE, { id: post.id, tekst }, B.token);
    const opnieuw = await w.post(REACTIE, { id: post.id, tekst }, B.token);
    const x = await vind(A.token, 'volgend', post.id);
    const n = x ? x.reacties.filter((r) => r.tekst === tekst).length : 0;
    return { klopt: opnieuw.status === 200 && n === 1, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' reactie(s)' };
  });
  await stap('herstelbaar', 'een crash direct na een waardering van A op zijn eigen bericht: hij staat er na de herstart', async () => {
    const r = await w.post(LIKE, { id: post.id }, A.token);
    await w.crash();
    const x = await vind(A.token, 'volgend', post.id);
    return { klopt: r.status === 200 && r.data.likes === 2 && !!x && x.likes === 2 && x.mijnLike === true, ziet: 'waardering ' + r.status + ' (' + (r.data && r.data.likes) + '), na SIGKILL ' + (x ? x.likes : '?') };
  });
  await stap('herstelbaar', 'een crash direct na het weghalen door A: het bericht is voor B weg, ook onder Ontdek en op zijn plank', async () => {
    const r = await w.post(WEG, { id: post.id }, A.token);
    await w.crash();
    const ontdek = await vind(B.token, 'ontdek', post.id);
    const plank = (((await w.post(BEWAARD, {}, B.token)).data) || {}).bewaard || [];
    const nogeens = await w.post(WEG, { id: post.id }, A.token);
    return { klopt: r.status === 200 && !ontdek && !plank.some((x) => x.id === post.id) && geen5xx(nogeens),
      ziet: 'weghalen ' + r.status + ', na SIGKILL ontdek: ' + (ontdek ? 'STAAT ER NOG' : 'weg') + ', plank: ' + plank.length + ', nog eens weghalen ' + nogeens.status };
  });
}

module.exports = {
  functie: 'link:pulse',
  ingang: '/apps/pulse.html',
  persona: 'lid',
  belofte: 'een lid schrijft een kort bericht, een ander lid vindt het onder Ontdek, waardeert het, reageert en bewaart het; wie het schreef haalt het weg en dan is het voor iedereen weg -- met de dagstemming van Wauw ernaast',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf. Volgen, melden, bewerken met versies en het Moment van de week zijn niet gelopen; de keuring van de tekst (kern/veilig.js) is niet uitgelokt. Twee leden, geen moderator. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
