/* ============================================================================
   VOLTOOIPROEF: RTG KRANT (link:krant, /apps/krant.html).

   De belofte van het scherm: "De kranten die nieuwsbedrijven binnen RTG
   uitgeven. Kies een titel om te lezen." Een lid ziet in de gids alleen
   kranten met gepubliceerde artikelen, opent er een in de huisstijl van de
   zaak, en leest een artikel -- met de correcties die de redactie openbaar
   maakte. Een concept bestaat voor de lezer niet. Over de routes die
   krant.html zelf aanroept: /api/krant/gids, /open en /artikel.

   De andere kant is echt: de redactie van De Ibiza Bode (een zaak met de
   werkvorm journalistiek, demo-code BODE) schrijft, publiceert, corrigeert en
   haalt terug langs /api/supplier/redactie/*. Een zaak zonder redactie kan
   dat niet.

   OPEN TOT DE ACCOUNTPLICHT STAAT. /api/krant/* is openbaar gebouwd; het
   besluit van 19 oktober 2026 (AGENTS.md) zegt dat gebruiken een account
   vraagt. De stap die dat meet, blijft open tot de deur dicht is -- die deur
   is van de agent Toegang en niet van deze proef.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen, KANTOORWERELD } = require('../voltooiwereld');

const GIDS = '/api/krant/gids';
const OPEN = '/api/krant/open';
const ARTIKEL = '/api/krant/artikel';
const BEWAAR = '/api/supplier/redactie/artikel/bewaar';
const PUBLICEER = '/api/supplier/redactie/artikel/publiceer';
const CONCEPT = '/api/supplier/redactie/artikel/concept';
const ZAAK = 'BODE';

const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function zaakSessie(w, code) {
  const r0 = await w.post('/api/supplier/roster', { code });
  /* Modus LOS: de partnerkant uit -> 503. Nette AFGEBROKEN-reden, geen crash op
     een ontbrekend veld verderop. */
  if (r0.status === 503) throw new Error('de partnerkant (leveranciers) staat uit: zaak ' + code + ' is in modus LOS niet bereikbaar');
  const roster = r0.data || {};
  const wie = (roster.staff || []).find((x) => x.role === 'manager');
  if (!wie) throw new Error('de zaak ' + code + ' heeft geen manager');
  const r = await w.post('/api/supplier/login', { code, staffId: wie.id, pin: '1234' });
  if (!r.data || !r.data.token) throw new Error('inloggen op ' + code + ' lukte niet (' + r.status + ')');
  return r.data.token;
}

async function loop(w, stap) {
  const merk = 'kr' + Date.now().toString(36);
  const L = await nieuwLid(w, 'krl');
  const R = await zaakSessie(w, ZAAK);
  let art = null, concept = null;

  const krant = async (tok) => ((await w.post(OPEN, { code: ZAAK }, tok || L.token)).data) || {};
  const metTitel = (k, titel) => (k.artikelen || []).filter((a) => a.titel === titel);
  const lees = (id, tok) => w.post(ARTIKEL, { code: ZAAK, id }, tok || L.token);

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de redactie schrijft een concept: het lid vindt het niet in de krant en kan het niet openen', async () => {
    const b = await w.post(BEWAAR, { titel: 'Haven ' + merk, chapo: 'De haven krijgt een nieuwe kade.', inhoud: 'Eerste alinea.\n\nTweede alinea.', rubriek: 'Eiland' }, R);
    art = b.data && b.data.artikel;
    const k = await krant();
    const l = await lees(art && art.id);
    return { klopt: b.status === 200 && !!art && metTitel(k, 'Haven ' + merk).length === 0 && l.status === 404,
      ziet: 'concept ' + b.status + ', in de krant: ' + metTitel(k, 'Haven ' + merk).length + ', openen ' + l.status };
  });

  await stap('voltooibaar', 'de redactie publiceert: het lid ziet de krant in de gids, het artikel bovenaan, en leest de volledige tekst', async () => {
    const p = await w.post(PUBLICEER, { id: art.id, revisie: art.revisie }, R);
    const g = ((await w.post(GIDS, {}, L.token)).data || {}).lijst || [];
    const k = await krant();
    const l = await lees(art.id);
    const a = (l.data && l.data.artikel) || {};
    return { klopt: p.status === 200 && g.some((x) => x.code === ZAAK) && metTitel(k, 'Haven ' + merk).length === 1 &&
      l.status === 200 && a.inhoud === 'Eerste alinea.\n\nTweede alinea.' && a.versie === 1 && !!a.naam,
      ziet: 'publiceer ' + p.status + ', in de gids: ' + g.some((x) => x.code === ZAAK) + ', lezen ' + l.status + ' (versie ' + a.versie + ', ' + a.naam + ')' };
  });

  await stap('voltooibaar', 'een correctie vraagt een openbare toelichting, en het lid leest de nieuwe versie met die correctie erbij', async () => {
    art = ((await w.post('/api/supplier/redactie/artikel/haal', { id: art.id }, R)).data || {}).artikel || art;
    const b = await w.post(BEWAAR, { id: art.id, titel: 'Haven ' + merk, chapo: 'De haven krijgt een nieuwe kade.', inhoud: 'Eerste alinea, verbeterd.\n\nTweede alinea.', rubriek: 'Eiland', revisie: art.revisie }, R);
    const zonder = await w.post(PUBLICEER, { id: art.id, revisie: b.data && b.data.artikel.revisie }, R);
    const met = await w.post(PUBLICEER, { id: art.id, revisie: b.data && b.data.artikel.revisie, toelichting: 'Een jaartal stond verkeerd.' }, R);
    const a = ((await lees(art.id)).data || {}).artikel || {};
    return { klopt: b.status === 200 && zonder.status === 400 && met.status === 200 && a.versie === 2 && a.inhoud.startsWith('Eerste alinea, verbeterd') &&
      (a.correcties || []).some((c) => c.toelichting === 'Een jaartal stond verkeerd.'),
      ziet: 'zonder toelichting ' + zonder.status + ', met ' + met.status + ', lezer ziet versie ' + a.versie + ' met ' + (a.correcties || []).length + ' correctie' };
  });

  await stap('voltooibaar', 'de redactie haalt een tweede artikel terug: het verdwijnt voor het lid uit de krant', async () => {
    const b = await w.post(BEWAAR, { titel: 'Markt ' + merk, inhoud: 'Een markt op zaterdag.', rubriek: 'Eiland' }, R);
    concept = b.data && b.data.artikel;
    await w.post(PUBLICEER, { id: concept.id, revisie: concept.revisie }, R);
    const zichtbaar = metTitel(await krant(), 'Markt ' + merk).length;
    const x = await w.post(CONCEPT, { id: concept.id, toelichting: 'Nog niet bevestigd.' }, R);
    const na = metTitel(await krant(), 'Markt ' + merk).length;
    const l = await lees(concept.id);
    return { klopt: zichtbaar === 1 && x.status === 200 && na === 0 && l.status === 404,
      ziet: 'eerst ' + zichtbaar + ' in de krant, terughalen ' + x.status + ', daarna ' + na + ', openen ' + l.status };
  });

  await stap('voltooibaar', 'bevoegdheid: zonder account geen krant -- gebruiken vraagt een account (open tot de accountplicht deze deur sluit)', async () => {
    const g = await w.post(GIDS, {});
    const o = await w.post(OPEN, { code: ZAAK });
    const a = await w.post(ARTIKEL, { code: ZAAK, id: art.id });
    return { klopt: g.status === 401 && o.status === 401 && a.status === 401,
      ziet: 'gids ' + g.status + ', krant ' + o.status + ', artikel ' + a.status + (a.status === 200 ? ' -- de krant is nog openbaar' : '') };
  });

  await stap('voltooibaar', 'bevoegdheid: een lid publiceert niets en haalt niets terug in een krant', async () => {
    const b = await w.post(BEWAAR, { titel: 'Nep ' + merk, inhoud: 'nep' }, L.token);
    const x = await w.post(CONCEPT, { id: art.id, toelichting: 'weg' }, L.token);
    const k = await krant();
    return { klopt: b.status === 401 && x.status === 401 && metTitel(k, 'Haven ' + merk).length === 1 && metTitel(k, 'Nep ' + merk).length === 0,
      ziet: 'schrijven ' + b.status + ', terughalen ' + x.status + ', artikel staat er nog' };
  });

  await stap('voltooibaar', 'bevoegdheid: een zaak zonder redactie geeft geen krant uit, en raakt het artikel van een andere krant niet', async () => {
    const Z = await zaakSessie(w, 'KIKUNOI');
    const b = await w.post(BEWAAR, { titel: 'Restaurantnieuws ' + merk, inhoud: 'x' }, Z);
    const x = await w.post(CONCEPT, { id: art.id, toelichting: 'weg' }, Z);
    const l = await lees(art.id);
    return { klopt: b.status === 409 && x.status >= 400 && x.status < 500 && l.status === 200,
      ziet: 'schrijven ' + b.status + ' (' + (b.data && b.data.error) + '), terughalen ' + x.status + ', artikel nog ' + l.status };
  });

  /* ---------------- persistent ---------------- */
  const vorm = (k) => JSON.stringify(metTitel(k, 'Haven ' + merk).map((a) => [a.id, a.titel, a.publicatieversie, a.gepubliceerd]));
  const voor = vorm(await krant());
  const tekstVoor = JSON.stringify(((await lees(art.id)).data || {}).artikel.correcties);
  await w.herstart();

  await stap('persistent', 'na een nette herstart staat het artikel er, in dezelfde versie, met dezelfde correctie', async () => {
    const na = vorm(await krant());
    const a = ((await lees(art.id)).data || {}).artikel || {};
    return { klopt: voor.length > 4 && na === voor && JSON.stringify(a.correcties) === tekstVoor && a.versie === 2,
      ziet: (na === voor ? 'krant gelijk' : 'ANDERS: ' + na) + ', versie ' + a.versie };
  });

  await stap('persistent', 'een nieuwe sessie (een ander toestel) leest hetzelfde, en het teruggehaalde artikel blijft weg', async () => {
    const tok = await inloggen(w, L);
    const k = await krant(tok);
    return { klopt: vorm(k) === voor && metTitel(k, 'Markt ' + merk).length === 0, ziet: (vorm(k) === voor ? 'gelijk' : 'ANDERS') + ', teruggehaald: ' + metTitel(k, 'Markt ' + merk).length };
  });

  await stap('persistent', 'de gepubliceerde tekst staat in de opslag zelf (gelezen buiten de server om)', async () => {
    const plek = w.vindInOpslag('Eerste alinea, verbeterd.');
    return { klopt: plek.length >= 1, ziet: 'in ' + plek.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op een artikel geeft twee keer hetzelfde artikel', async () => {
    const [a, b] = await w.dubbel(ARTIKEL, { code: ZAAK, id: art.id }, L.token);
    const x = (a.data || {}).artikel || {}, y = (b.data || {}).artikel || {};
    return { klopt: a.status === 200 && b.status === 200 && x.inhoud === y.inhoud && x.versie === 2 && y.versie === 2, ziet: 'antwoorden ' + a.status + '/' + b.status };
  });

  await stap('herstelbaar', 'een dubbele tik op "publiceer": een publicatie en een versie, niet twee', async () => {
    const b = await w.post(BEWAAR, { titel: 'Strand ' + merk, inhoud: 'Het strand is open.', rubriek: 'Eiland' }, R);
    const x = b.data && b.data.artikel;
    const [p, q] = await w.dubbel(PUBLICEER, { id: x.id, revisie: x.revisie }, R);
    const k = metTitel(await krant(), 'Strand ' + merk);
    return { klopt: geen5xx(p) && geen5xx(q) && (p.status === 200 || q.status === 200) && k.length === 1 && k[0].publicatieversie === 1,
      ziet: 'antwoorden ' + p.status + '/' + q.status + ', ' + k.length + ' in de krant, versie ' + (k[0] && k[0].publicatieversie) };
  });

  await stap('herstelbaar', 'een afgebroken verzoek, daarna opnieuw lezen: het artikel is heel', async () => {
    const half = await w.afgebroken(ARTIKEL, { code: ZAAK, id: art.id }, L.token);
    const l = await lees(art.id);
    return { klopt: l.status === 200 && l.data.artikel.versie === 2, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + l.status };
  });

  await stap('herstelbaar', 'een crash direct na een publicatie: het artikel staat er na de herstart, een keer', async () => {
    const b = await w.post(BEWAAR, { titel: 'Stroom ' + merk, inhoud: 'Na de storm.', rubriek: 'Eiland' }, R);
    const x = b.data && b.data.artikel;
    const p = await w.post(PUBLICEER, { id: x.id, revisie: x.revisie }, R);
    await w.crash();
    const k = metTitel(await krant(), 'Stroom ' + merk);
    const l = await lees(x.id);
    return { klopt: p.status === 200 && k.length === 1 && l.status === 200, ziet: 'publiceer ' + p.status + ', na SIGKILL ' + k.length + ' in de krant, lezen ' + l.status };
  });
}

module.exports = {
  functie: 'link:krant',
  ingang: '/apps/krant.html',
  persona: 'lid',
  omgeving: KANTOORWERELD,
  belofte: 'een lid leest de kranten die nieuwsbedrijven binnen RTG publiceren, in hun huisstijl, met de correcties die de redactie openbaar maakte; een concept of een teruggehaald artikel bestaat voor de lezer niet -- ook na een herstart, een dubbeltik of een crash',
  grens: 'De proef loopt de leesroutes van het scherm en de redactieroutes van de zaak, niet de schermen zelf. De redactie is de demozaak BODE met haar demo-PIN. Of een lezer een account moet hebben, meet de bevoegdheidsstap; die blijft open zolang /api/krant/* openbaar is (besluit van 19 oktober 2026, deur van de agent Toegang). Geen Redis of PostgreSQL.',
  loop
};
