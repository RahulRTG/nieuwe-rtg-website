/* ============================================================================
   VOLTOOIPROEF: RTG MEDIA (link:mediaos, /apps/media.html).

   De belofte van het scherm: een wereld over Klankwerk, Theater, Clips en
   Podium heen, met bij elk stuk waarom het er staat; een lid bewaart wat het
   wil houden en zet het in een eigen afspeellijst, en deelt die lijst om te
   LEZEN met iemand met wie het verbonden is (kern/mediaos/lijsten.js). De
   ander leest met zijn eigen ogen en verandert niets.

   De momentproef (MOMENTPROEF.json) loopt de deelbelofte "volgen en gewekt
   worden" (/api/mediaos/aanwezig/*); die loopt hier met opzet niet mee.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, verbind } = require('../voltooiwereld');

const WERELD = '/api/mediaos/wereld';
const BEWAAR = '/api/mediaos/bewaar';
const BIEB = '/api/mediaos/bieb';
const LIJSTEN = '/api/mediaos/lijsten';
const LIJST = '/api/mediaos/lijst';
const MAAK = '/api/mediaos/lijst/maak';
const ZET = '/api/mediaos/lijst/zet';
const STUK = '/api/mediaos/lijst/stuk';
const DEEL = '/api/mediaos/lijst/deel';

async function loop(w, stap) {
  const merk = 'mo' + Date.now().toString(36);
  const A = await nieuwLid(w, 'moa');
  const B = await nieuwLid(w, 'mob');
  const C = await nieuwLid(w, 'moc');
  const gast = await nieuwLid(w, 'mog', 'guest');
  const band = await verbind(w, A, B);
  /* De wereld is een catalogus over de vier domeinen; in een verse wereld
     staat er niets. B zet twee clips in RTG Clips, langs de route van dat
     scherm (de beelden blijven op zijn toestel; de server kent de kaart). */
  for (const t of ['Strand ' + merk, 'Haven ' + merk]) {
    const c = await w.post('/api/clips/maak', { titel: t, duurS: 12, mbGeschat: 1 }, B.token);
    if (c.status !== 200) throw new Error('B kon geen clip maken (' + c.status + ': ' + (c.data && c.data.error) + ')');
  }
  let stukken = [], lijst = null;

  const mijnLijsten = async (tok) => { const r = await w.post(LIJSTEN, {}, tok); return r.status === 200 ? r.data : null; };
  const metNaam = (d, naam) => ((d && d.lijsten) || []).filter((l) => l.naam === naam);
  const biebIds = async (tok) => { const r = await w.post(BIEB, {}, tok); return r.status === 200 ? (r.data.stukken || []).map((s) => s.id) : null; };

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een lid opent de wereld en ziet stukken, elk met de zin waarom het er staat', async () => {
    const r = await w.post(WERELD, { modus: 'alles' }, A.token);
    stukken = (r.data && (r.data.rijen || r.data.stukken)) || [];
    if (!stukken.length && r.data && Array.isArray(r.data.secties)) stukken = r.data.secties.flatMap((s) => s.stukken || s.rijen || []);
    return { klopt: r.status === 200 && stukken.length >= 2 && stukken.every((s) => s.id && s.titel && s.waarom),
      ziet: 'status ' + r.status + ', ' + stukken.length + ' stukken, eerste: ' + (stukken[0] && stukken[0].titel + ' -- ' + stukken[0].waarom) +
        (stukken.length ? '' : ', velden: ' + Object.keys(r.data || {}).join(',')) };
  });

  await stap('voltooibaar', 'het lid bewaart een stuk; het staat in zijn bibliotheek', async () => {
    const b = await w.post(BEWAAR, { id: stukken[0].id, aan: true }, A.token);
    const ids = await biebIds(A.token);
    return { klopt: b.status === 200 && b.data.bewaard === true && (ids || []).includes(stukken[0].id),
      ziet: 'bewaar ' + b.status + ', bieb: ' + JSON.stringify(ids) };
  });

  await stap('voltooibaar', 'het lid maakt een lijst, zet er twee stukken in en draait de volgorde om', async () => {
    const m = await w.post(MAAK, { naam: 'Rit ' + merk, idem: 'voltooi-media-lijst-' + merk }, A.token);
    lijst = m.data && m.data.lijst;
    const s1 = await w.post(STUK, { id: lijst && lijst.id, stukId: stukken[0].id }, A.token);
    const s2 = await w.post(STUK, { id: lijst && lijst.id, stukId: stukken[1].id }, A.token);
    const v = await w.post(STUK, { id: lijst && lijst.id, stukId: stukken[1].id, naar: 0 }, A.token);
    const l = await w.post(LIJST, { id: lijst && lijst.id }, A.token);
    const volgorde = ((l.data && l.data.stukken) || []).map((s) => s.id);
    return { klopt: m.status === 200 && s1.status === 200 && s2.status === 200 && v.status === 200 &&
      volgorde.join() === [stukken[1].id, stukken[0].id].join() && l.data.ikEigenaar === true,
      ziet: 'maak ' + m.status + ', erin ' + s1.status + '/' + s2.status + ', verplaats ' + v.status + ', volgorde ' + volgorde.join(' > ') };
  });

  await stap('voltooibaar', 'het lid deelt de lijst met een verbonden lid; dat ziet hem onder "met mij gedeeld", in dezelfde volgorde', async () => {
    const d = await w.post(DEEL, { id: lijst.id, codenaam: band.b.codenaam }, A.token);
    const m = await mijnLijsten(B.token);
    const l = await w.post(LIJST, { id: lijst.id }, B.token);
    const volgorde = ((l.data && l.data.stukken) || []).map((s) => s.id);
    return { klopt: d.status === 200 && ((m && m.metMij) || []).some((x) => x.id === lijst.id) && l.status === 200 &&
      l.data.ikEigenaar === false && volgorde.join() === [stukken[1].id, stukken[0].id].join(),
      ziet: 'delen ' + d.status + ', B leest ' + l.status + ' (eigenaar=' + (l.data && l.data.ikEigenaar) + ', van ' + (l.data && l.data.van) + ')' };
  });

  await stap('voltooibaar', 'bevoegd: zonder inlog geeft de wereld, de bibliotheek en het maken van een lijst 401', async () => {
    const a = await w.post(WERELD, {});
    const b = await w.post(BIEB, {});
    const c = await w.post(MAAK, { naam: 'Anoniem ' + merk });
    return { klopt: a.status === 401 && b.status === 401 && c.status === 401, ziet: 'wereld ' + a.status + ', bieb ' + b.status + ', maak ' + c.status };
  });

  await stap('voltooibaar', 'bevoegd: de lezer kan de gedeelde lijst niet wijzigen of weggooien en hoort waarom; een vreemde leest hem niet en ziet A\'s bibliotheek niet', async () => {
    const weg = await w.post(ZET, { id: lijst.id, weg: true }, B.token);
    const erin = await w.post(STUK, { id: lijst.id, stukId: stukken[0].id, aan: false }, B.token);
    const vreemd = await w.post(LIJST, { id: lijst.id }, C.token);
    const cDeelt = await w.post(DEEL, { id: lijst.id, codenaam: band.b.codenaam }, C.token);
    const cBieb = await biebIds(C.token);
    const nog = await w.post(LIJST, { id: lijst.id }, A.token);
    return { klopt: weg.status === 403 && /alleen de eigenaar/.test((weg.data && weg.data.error) || '') && erin.status === 403 &&
      vreemd.status === 404 && cDeelt.status === 404 && Array.isArray(cBieb) && cBieb.length === 0 && ((nog.data && nog.data.stukken) || []).length === 2,
      ziet: 'B weggooien ' + weg.status + ', B eruit ' + erin.status + ', C leest ' + vreemd.status + ', C deelt ' + cDeelt.status + ', C-bieb ' + JSON.stringify(cBieb) };
  });

  await stap('voltooibaar', 'bevoegd: delen met iemand met wie het lid niet verbonden is wordt geweigerd; een gratis account komt de Media OS niet in', async () => {
    const cc = ((await w.post('/api/member/connections', {}, C.token)).data || {}).codename;
    const d = await w.post(DEEL, { id: lijst.id, codenaam: cc }, A.token);
    const g = await w.post(WERELD, {}, gast.token);
    return { klopt: d.status === 403 && /verbonden/.test((d.data && d.data.error) || '') && g.status === 403 && /voor leden/.test((g.data && g.data.error) || ''),
      ziet: 'delen met vreemde ' + d.status + ' (' + (d.data && d.data.error) + '), gast ' + g.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staan de bibliotheek en de lijst er nog, in dezelfde volgorde', async () => {
    const ids = await biebIds(A.token);
    const l = await w.post(LIJST, { id: lijst.id }, A.token);
    const volgorde = ((l.data && l.data.stukken) || []).map((s) => s.id);
    return { klopt: (ids || []).includes(stukken[0].id) && volgorde.join() === [stukken[1].id, stukken[0].id].join(),
      ziet: 'bieb ' + JSON.stringify(ids) + ', lijst ' + volgorde.join(' > ') };
  });
  await stap('persistent', 'na de herstart leest het verbonden lid de gedeelde lijst nog in een nieuwe sessie', async () => {
    const T = await inloggen(w, B);
    const m = await mijnLijsten(T);
    const l = await w.post(LIJST, { id: lijst.id }, T);
    return { klopt: ((m && m.metMij) || []).some((x) => x.id === lijst.id) && l.status === 200 && ((l.data && l.data.stukken) || []).length === 2,
      ziet: 'nieuwe sessie: met mij gedeeld ' + ((m && m.metMij) || []).length + ', lijst ' + l.status };
  });
  await stap('persistent', 'de lijst staat in de opslag zelf (gelezen buiten de server om)', async () => {
    const plek = w.vindInOpslag('Rit ' + merk);
    return { klopt: plek.length >= 1, ziet: plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "Maak lijst" (dezelfde sleutel, tegelijk) geeft een lijst, niet twee', async () => {
    const lijf = { naam: 'Dubbel ' + merk, idem: 'voltooi-media-dubbel-' + merk };
    const [a, b] = await w.dubbel(MAAK, lijf, A.token);
    const n = metNaam(await mijnLijsten(A.token), 'Dubbel ' + merk).length;
    return { klopt: a.status === 200 && b.status === 200 && n === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + n + ' lijst(en)' };
  });
  await stap('herstelbaar', 'een afgebroken "Maak lijst", daarna opnieuw met dezelfde sleutel: precies een lijst', async () => {
    const lijf = { naam: 'Half ' + merk, idem: 'voltooi-media-half-' + merk };
    const half = await w.afgebroken(MAAK, lijf, A.token);
    const opnieuw = await w.post(MAAK, lijf, A.token);
    const n = metNaam(await mijnLijsten(A.token), 'Half ' + merk).length;
    return { klopt: opnieuw.status === 200 && n === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' lijst' };
  });
  await stap('herstelbaar', 'een crash direct na het maken, daarna dezelfde tik: de lijst staat er een keer', async () => {
    const lijf = { naam: 'Crash ' + merk, idem: 'voltooi-media-crash-' + merk };
    const r = await w.post(MAAK, lijf, A.token);
    await w.crash();
    const opnieuw = await w.post(MAAK, lijf, A.token);
    const n = metNaam(await mijnLijsten(A.token), 'Crash ' + merk).length;
    return { klopt: r.status === 200 && opnieuw.status === 200 && n === 1, ziet: 'maak ' + r.status + ', na SIGKILL ' + opnieuw.status + ', ' + n + ' lijst' };
  });
  await stap('herstelbaar', 'een crash direct na het weggooien van de gedeelde lijst: weg voor de eigenaar en voor de lezer', async () => {
    const x = await w.post(ZET, { id: lijst.id, weg: true }, A.token);
    await w.crash();
    const a = await w.post(LIJST, { id: lijst.id }, A.token);
    const b = await w.post(LIJST, { id: lijst.id }, B.token);
    return { klopt: x.status === 200 && a.status === 404 && b.status === 404, ziet: 'weg ' + x.status + ', na SIGKILL A ' + a.status + ', B ' + b.status };
  });
}

module.exports = {
  functie: 'link:mediaos',
  ingang: '/apps/media.html',
  persona: 'lid',
  belofte: 'een lid ziet de mediawereld met bij elk stuk waarom het er staat, bewaart wat het wil houden, maakt een eigen afspeellijst en deelt die om te lezen met wie het kent -- de lezer verandert niets, een vreemde ziet niets, en een herstart, dubbele tik, afgebroken verzoek of crash verliest of verdubbelt geen lijst',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf; er wordt niets afgespeeld. De stukken komen uit de seed van de testwereld. Volgen, meldingen en gewekt worden (/api/mediaos/aanwezig/*, de momentproef), de luisterkamer en de smaakregelaars lopen niet mee. Geen Redis of PostgreSQL in de wereld.',
  loop
};
