/* ============================================================================
   VOLTOOIPROEF: DE SALON (tab:salon, de stand 'salon' van /apps/app.html).

   HOE DE PROEF DE APP BEREIKT. De Salon heeft geen eigen adres: het is de stand
   achter de knop data-tab="salon" in de ledenapp (/apps/app.html). Die stand
   tekent de posts uit /api/state en bedient ze met /api/like en /api/comment
   (apps/app-main/app-main-58.js). Dit scenario loopt precies die routes, als
   een lid dat de stand koos -- geen verzonnen adres.

   De belofte, in de woorden van het scherm: een lid ziet de posts van De Salon,
   waardeert ze en reageert onder zijn codenaam; wat een lid voor zijn vrienden
   plaatste, ziet een vreemde niet. De besloten post wordt vooraf geplaatst langs
   /api/salon/plaats (de Salon-app); dat is de opzet, niet de belofte.

   De wereld is de kantoorwereld (RTG_DEMO): daarin staan de demoposts die de
   stand bij een vers lid toont.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, verbind, KANTOORWERELD } = require('../voltooiwereld');

const STAAT = '/api/state';
const LIKE = '/api/like';
const REACTIE = '/api/comment';
const PLAATS = '/api/salon/plaats';

async function loop(w, stap) {
  const merk = 'sl' + Date.now().toString(36);
  const A = await nieuwLid(w, 'sla');
  const B = await nieuwLid(w, 'slb');
  const C = await nieuwLid(w, 'slc');
  const gast = await nieuwLid(w, 'slg', 'guest');
  const band = await verbind(w, A, B);
  let open = null, besloten = null;
  const posts = async (T) => { const r = await w.post(STAAT, {}, T); return r.status === 200 ? ((r.data.state || {}).posts || []) : null; };
  const post = async (T, id) => ((await posts(T)) || []).find((p) => p.id === id) || null;
  const reacties = (p, tekst) => ((p && p.comments) || []).filter((c) => c.text === tekst);

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een lid kiest de stand Salon en ziet posts waarop hij mag reageren', async () => {
    const l = await posts(A.token);
    open = (l || []).find((p) => p.canEngage === true && !p.partner) || null;
    return { klopt: !!l && l.length > 0 && !!open, ziet: (l ? l.length : 'geen') + ' posts, reageerbaar: ' + (open && open.id) };
  });

  await stap('voltooibaar', 'het lid waardeert een post; een ander lid ziet de telling een hoger, de waardering blijft van het lid', async () => {
    const voor = (await post(B.token, open.id)).likes;
    const r = await w.post(LIKE, { postId: open.id, liked: true }, A.token);
    const bijB = await post(B.token, open.id);
    const bijA = await post(A.token, open.id);
    return { klopt: r.status === 200 && bijB.likes === voor + 1 && bijB.liked === false && bijA.liked === true,
      ziet: 'like ' + r.status + ', B ziet ' + voor + ' -> ' + bijB.likes + ', A liked=' + bijA.liked };
  });

  await stap('voltooibaar', 'het lid reageert; een ander lid leest de reactie onder de codenaam van het lid', async () => {
    const r = await w.post(REACTIE, { postId: open.id, text: 'Prachtig licht ' + merk, idem: 'voltooi-salon-een-' + merk }, A.token);
    const l = reacties(await post(B.token, open.id), 'Prachtig licht ' + merk);
    return { klopt: r.status === 200 && l.length === 1 && l[0].who === band.a.codenaam && l[0].who !== 'Voltooilid',
      ziet: 'reactie ' + r.status + ', B leest ' + l.length + ' van ' + (l[0] && l[0].who) };
  });

  await stap('voltooibaar', 'een post voor vrienden: de vriend ziet hem en reageert, een vreemde ziet hem niet', async () => {
    const p = await w.post(PLAATS, { tekst: 'Alleen voor vrienden ' + merk, publiek: 'vrienden' }, A.token);
    besloten = p.data && p.data.post && p.data.post.id;
    const bijB = await post(B.token, besloten);
    const r = await w.post(REACTIE, { postId: besloten, text: 'Mooi ' + merk, idem: 'voltooi-salon-vriend-' + merk }, B.token);
    const bijC = await post(C.token, besloten);
    return { klopt: p.status === 200 && !!besloten && !!bijB && r.status === 200 && bijC === null,
      ziet: 'plaats ' + p.status + ', vriend ziet ' + !!bijB + ' en reageert ' + r.status + ', vreemde ziet ' + !!bijC };
  });

  await stap('bevoegd', 'bevoegd: zonder inlog geven de stand, de waardering en de reactie 401', async () => {
    const s = await w.post(STAAT, {});
    const l = await w.post(LIKE, { postId: open.id, liked: true });
    const r = await w.post(REACTIE, { postId: open.id, text: 'anoniem ' + merk });
    return { klopt: s.status === 401 && l.status === 401 && r.status === 401, ziet: 'stand ' + s.status + ', like ' + l.status + ', reactie ' + r.status };
  });

  await stap('bevoegd', 'bevoegd: een vreemde kan op de besloten post niet waarderen of reageren, en de reactie van een ander niet terugdraaien', async () => {
    const l = await w.post(LIKE, { postId: besloten, liked: true }, C.token);
    const r = await w.post(REACTIE, { postId: besloten, text: 'Ik kijk mee ' + merk }, C.token);
    const terug = await w.post(LIKE, { postId: open.id, liked: false }, C.token);
    const bijA = await post(A.token, open.id);
    const bijB = await post(B.token, besloten);
    return { klopt: l.status === 404 && r.status === 404 && terug.status === 200 && bijA.liked === true && reacties(bijB, 'Ik kijk mee ' + merk).length === 0,
      ziet: 'like ' + l.status + ', reactie ' + r.status + '; ontliken door C ' + terug.status + ' laat A liked=' + bijA.liked };
  });

  await stap('bevoegd', 'bevoegd: een gratis account zonder pas leest mee maar waardeert en reageert niet bij leden', async () => {
    const zie = await posts(gast.token);
    const l = await w.post(LIKE, { postId: open.id, liked: true }, gast.token);
    const r = await w.post(REACTIE, { postId: open.id, text: 'gast ' + merk }, gast.token);
    return { klopt: !!zie && zie.length > 0 && l.status === 403 && r.status === 403 && /pas|leden/i.test((l.data && l.data.error) || ''),
      ziet: 'leest ' + (zie && zie.length) + ' posts, like ' + l.status + ' (' + (l.data && l.data.error || '').slice(0, 60) + '), reactie ' + r.status };
  });

  /* ---------------- persistent ---------------- */
  const voor = JSON.stringify(await post(B.token, open.id));
  await w.herstart();
  await stap('persistent', 'na een nette herstart ziet het andere lid dezelfde post, met de waardering en de reactie', async () => {
    const na = JSON.stringify(await post(B.token, open.id));
    return { klopt: voor.length > 2 && na === voor, ziet: na === voor ? 'gelijk (' + na.length + ' tekens)' : 'ANDERS' };
  });
  await stap('persistent', 'een nieuwe sessie van het lid ziet zijn eigen waardering en de besloten post', async () => {
    const T = await inloggen(w, A);
    const p = await post(T, open.id);
    const b = await post(T, besloten);
    return { klopt: !!p && p.liked === true && !!b && reacties(b, 'Mooi ' + merk).length === 1, ziet: 'liked=' + (p && p.liked) + ', besloten post met ' + (b && b.comments.length) + ' reactie' };
  });
  await stap('persistent', 'de reactie en de besloten post staan in de opslag zelf', async () => {
    const r = w.vindInOpslag('Prachtig licht ' + merk);
    const b = w.vindInOpslag('Alleen voor vrienden ' + merk);
    return { klopt: r.length >= 1 && b.length >= 1, ziet: 'reactie in ' + r.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') + '; post in ' + b.length + ' plek(ken)' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "plaatsen" (dezelfde sleutel, tegelijk) geeft een reactie, niet twee', async () => {
    const lijf = { postId: open.id, text: 'Dubbel ' + merk, idem: 'voltooi-salon-dubbel-' + merk };
    const [a, b] = await w.dubbel(REACTIE, lijf, A.token);
    const n = reacties(await post(B.token, open.id), 'Dubbel ' + merk).length;
    return { klopt: a.status === 200 && b.status === 200 && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + n + ' reactie(s)' };
  });
  await stap('herstelbaar', 'een afgebroken reactie, daarna opnieuw met dezelfde sleutel: precies een', async () => {
    const lijf = { postId: open.id, text: 'Half ' + merk, idem: 'voltooi-salon-half-' + merk };
    const half = await w.afgebroken(REACTIE, lijf, A.token);
    const opnieuw = await w.post(REACTIE, lijf, A.token);
    const n = reacties(await post(B.token, open.id), 'Half ' + merk).length;
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' reactie(s)' };
  });
  await stap('herstelbaar', 'een crash direct na een reactie, daarna dezelfde tik: niet verloren en niet verdubbeld', async () => {
    const lijf = { postId: open.id, text: 'Crash ' + merk, idem: 'voltooi-salon-crash-' + merk };
    const r = await w.post(REACTIE, lijf, A.token);
    await w.crash();
    const opnieuw = await w.post(REACTIE, lijf, A.token);
    const n = reacties(await post(B.token, open.id), 'Crash ' + merk).length;
    return { klopt: r.status === 200 && opnieuw.status === 200 && n === 1, ziet: 'reactie ' + r.status + ', na SIGKILL ' + opnieuw.status + ', ' + n + ' reactie(s)' };
  });
  await stap('herstelbaar', 'dezelfde sleutel met een andere tekst is een conflict, geen tweede reactie', async () => {
    const r = await w.post(REACTIE, { postId: open.id, text: 'Iets anders ' + merk, idem: 'voltooi-salon-crash-' + merk }, A.token);
    const n = reacties(await post(B.token, open.id), 'Iets anders ' + merk).length;
    return { klopt: r.status === 409 && n === 0, ziet: r.status + ' (' + (r.data && r.data.error) + '), ' + n + ' reactie(s)' };
  });
}

module.exports = {
  functie: 'tab:salon',
  ingang: '/apps/app.html',
  via: '#tab=salon',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid ziet de posts van De Salon, waardeert ze en reageert onder zijn codenaam; een post voor vrienden ziet alleen een vriend -- zonder inlog, als vreemde of zonder pas waardeert of reageert niemand, en een herstart, dubbele tik, afgebroken verzoek of crash verliest of verdubbelt niets',
  grens: 'De proef loopt de routes van de stand Salon in de ledenapp (/api/state, /api/like, /api/comment), niet het scherm zelf. Volgen, polls en aanbiedingen van partners vragen een zaak met een compleet Salon-profiel en lopen hier niet mee; de besloten post wordt geplaatst langs /api/salon/plaats van de Salon-app. De demoposts komen uit de kantoorwereld. Geen Redis of PostgreSQL in de wereld.',
  loop
};
