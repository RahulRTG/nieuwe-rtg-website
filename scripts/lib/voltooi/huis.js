/* ============================================================================
   VOLTOOIPROEF: LOGEREN BIJ LEDEN (link:huis, /apps/thuis.html) -- RTG Thuis.

   De belofte van het scherm: een lid zet zijn huis open voor andere leden, een
   ander lid vindt het, ziet de prijsopbouw en vraagt een verblijf aan -- er is
   dan nog niets afgeschreven. De host accepteert, de gast checkt in en uit,
   ze sturen elkaar een bericht en de gast laat een review achter. Een periode
   die bezet is, is voor een ander bezet. Over de routes die thuis.html zelf
   aanroept: /api/thuis/huis, /huizen, /zoek, /detail, /boek, /bord, /beslis,
   /mijn, /checkin, /checkuit, /bericht, /review en /reviews.

   WAT HIER NIET WORDT BEWEERD. Er wordt geen geld verplaatst: de boeking zegt
   zelf "er is nog niets afgeschreven", en dat is wat de proef meet. Een echt
   huis, een echte sleutel en een echte reiziger zijn buiten deze wereld.
   ========================================================================== */
'use strict';
const { nieuwLid, inloggen } = require('../voltooiwereld');

const HUIS = '/api/thuis/huis';
const HUIZEN = '/api/thuis/huizen';
const ZOEK = '/api/thuis/zoek';
const DETAIL = '/api/thuis/detail';
const BOEK = '/api/thuis/boek';
const BORD = '/api/thuis/bord';
const BESLIS = '/api/thuis/beslis';
const MIJN = '/api/thuis/mijn';
const CHECKIN = '/api/thuis/checkin';
const CHECKUIT = '/api/thuis/checkuit';
const BERICHT = '/api/thuis/bericht';
const BERICHTEN = '/api/thuis/berichten';
const REVIEW = '/api/thuis/review';
const REVIEWS = '/api/thuis/reviews';

const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const geen5xx = (r) => r && r.status > 0 && r.status < 500;

async function loop(w, stap) {
  const merk = 'th' + Date.now().toString(36);
  const H = await nieuwLid(w, 'hsh');
  const G = await nieuwLid(w, 'hsg');
  const X = await nieuwLid(w, 'hsx');
  let huis = null, ref = null;
  const reizen = async (tok) => ((await w.post(MIJN, {}, tok || G.token)).data || {}).reizen || [];
  const mijnRef = async (tok) => (await reizen(tok)).find((b) => b.ref === ref) || null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'een lid zet zijn huis open; een ander lid vindt het op plaats en ziet de prijsopbouw voor zijn datums', async () => {
    const z = await w.post(HUIS, { huis: { titel: 'Finca ' + merk, plaats: 'Sant Josep', type: 'villa', prijs: 120, schoonmaak: 40, maxGasten: 4, slaapkamers: 2, bedden: 2, badkamers: 1 } }, H.token);
    huis = z.data && z.data.huis;
    const s = (await w.post(ZOEK, { plaats: 'Sant Josep', van: dag(30), tot: dag(33), gasten: 2 }, G.token)).data || {};
    const gevonden = (s.huizen || []).find((x) => x.id === (huis && huis.id));
    const d = await w.post(DETAIL, { id: huis && huis.id, van: dag(30), tot: dag(33) }, G.token);
    return { klopt: z.status === 200 && !!huis && !!gevonden && !!gevonden.prijsopbouw && d.status === 200,
      ziet: 'huis ' + z.status + ', gevonden: ' + !!gevonden + ', prijs ' + JSON.stringify(gevonden && gevonden.prijsopbouw && gevonden.prijsopbouw.totaal) };
  });

  await stap('voltooibaar', 'de gast vraagt drie nachten aan: aangevraagd, en er is nog niets afgeschreven', async () => {
    const b = await w.post(BOEK, { id: huis.id, van: dag(30), tot: dag(33), gasten: 2 }, G.token);
    const x = b.data && b.data.boeking;
    ref = x && x.ref;
    return { klopt: b.status === 200 && !!ref && x.status === 'aangevraagd' && /niets afgeschreven/.test(x.betaling || ''),
      ziet: b.status + ', ' + ref + ', ' + (x && x.status) + ' -- ' + (x && x.betaling) };
  });

  await stap('voltooibaar', 'de host ziet de aanvraag op zijn bord en accepteert; de gast ziet het verblijf bevestigd', async () => {
    const bord = (await w.post(BORD, {}, H.token)).data || {};
    const staat = (bord.aanvragen || []).some((a) => a.ref === ref);
    const b = await w.post(BESLIS, { ref, akkoord: true }, H.token);
    const r = await mijnRef();
    return { klopt: staat && b.status === 200 && r && r.status === 'bevestigd', ziet: 'op het bord: ' + staat + ', besluit ' + b.status + ', bij de gast ' + (r && r.status) };
  });

  await stap('voltooibaar', 'dezelfde periode is voor een ander lid bezet: het huis verdwijnt uit zijn zoekresultaat en boeken geeft 409', async () => {
    const s = (await w.post(ZOEK, { plaats: 'Sant Josep', van: dag(31), tot: dag(32) }, X.token)).data || {};
    const b = await w.post(BOEK, { id: huis.id, van: dag(31), tot: dag(32), gasten: 1 }, X.token);
    return { klopt: !(s.huizen || []).some((x) => x.id === huis.id) && b.status === 409, ziet: 'in de zoekresultaten: ' + (s.huizen || []).some((x) => x.id === huis.id) + ', boeken ' + b.status + ' (' + (b.data && b.data.error) + ')' };
  });

  await stap('voltooibaar', 'gast en host sturen elkaar een bericht over het verblijf, en lezen het allebei', async () => {
    const a = await w.post(BERICHT, { ref, tekst: 'Hoe laat kunnen we binnen ' + merk + '?' }, G.token);
    const b = await w.post(BERICHT, { ref, tekst: 'Vanaf vier uur ' + merk + '.' }, H.token);
    const bijG = JSON.stringify((await w.post(BERICHTEN, { ref }, G.token)).data || {});
    const bijH = JSON.stringify((await w.post(BERICHTEN, { ref }, H.token)).data || {});
    return { klopt: a.status === 200 && b.status === 200 && bijG.includes('Vanaf vier uur ' + merk) && bijH.includes('Hoe laat kunnen we binnen ' + merk),
      ziet: 'berichten ' + a.status + '/' + b.status + ', beide kanten lezen beide' };
  });

  await stap('voltooibaar', 'de gast checkt in en uit en laat een review achter die bij het huis staat', async () => {
    const i = await w.post(CHECKIN, { ref }, G.token);
    const u = await w.post(CHECKUIT, { ref }, G.token);
    const r = await w.post(REVIEW, { ref, sterren: 5, tekst: 'Rustig en schoon ' + merk }, G.token);
    const lijst = JSON.stringify((await w.post(REVIEWS, { id: huis.id }, X.token)).data || {});
    return { klopt: i.status === 200 && u.status === 200 && r.status === 200 && lijst.includes('Rustig en schoon ' + merk),
      ziet: 'checkin ' + i.status + ', checkuit ' + u.status + ', review ' + r.status + ', zichtbaar voor een ander lid: ' + lijst.includes('Rustig en schoon ' + merk) };
  });

  await stap('voltooibaar', 'bevoegdheid: zonder sessie niet zoeken, niet boeken en geen huis zetten (401)', async () => {
    const a = await w.post(ZOEK, { plaats: 'Sant Josep' });
    const b = await w.post(BOEK, { id: huis.id, van: dag(50), tot: dag(52) });
    const c = await w.post(HUIS, { huis: { titel: 'Anoniem', plaats: 'Ibiza' } });
    return { klopt: a.status === 401 && b.status === 401 && c.status === 401, ziet: 'zoek ' + a.status + ', boek ' + b.status + ', huis ' + c.status };
  });

  await stap('voltooibaar', 'bevoegdheid: een ander lid ziet de boeking niet, leest de berichten niet en beslist of wijzigt niets van de host', async () => {
    const m = await reizen(X.token);
    const br = await w.post(BERICHTEN, { ref }, X.token);
    const a = await w.post('/api/thuis/annuleer', { ref }, X.token);
    const z = await w.post(HUIS, { huis: { titel: 'Gekaapt', plaats: 'Ibiza' }, id: huis.id }, X.token);
    const bord = (await w.post(BORD, {}, X.token)).data || {};
    return { klopt: !m.some((b) => b.ref === ref) && br.status >= 400 && br.status < 500 && a.status === 404 && (z.status === 403 || z.status === 404) && (bord.huizen || 0) === 0,
      ziet: 'reizen ' + m.length + ', berichten ' + br.status + ', annuleer ' + a.status + ', huis wijzigen ' + z.status };
  });

  await stap('voltooibaar', 'bevoegdheid: een gratis account mag kijken maar niet boeken of hosten', async () => {
    const g = await nieuwLid(w, 'hsg', 'guest');
    const s = await w.post(ZOEK, { plaats: 'Sant Josep' }, g.token);
    const b = await w.post(BOEK, { id: huis.id, van: dag(60), tot: dag(63), gasten: 1 }, g.token);
    const h = await w.post(HUIS, { huis: { titel: 'Gast huis', plaats: 'Ibiza' } }, g.token);
    return { klopt: s.status === 200 && b.status === 403 && h.status === 403, ziet: 'zoek ' + s.status + ', boek ' + b.status + ', huis ' + h.status + ' (' + (b.data && b.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  const vorm = (b) => b && JSON.stringify([b.ref, b.status, b.van, b.tot, b.gasten, b.prijsopbouw && b.prijsopbouw.totaal]);
  const voor = vorm(await mijnRef());
  await w.herstart();

  await stap('persistent', 'na een nette herstart staat het verblijf er nog, uitgecheckt, met dezelfde prijs', async () => {
    const na = vorm(await mijnRef());
    return { klopt: !!voor && na === voor && voor.includes('uitgecheckt'), ziet: na === voor ? 'gelijk: ' + na : 'ANDERS: ' + na };
  });

  await stap('persistent', 'de host logt opnieuw in (een ander toestel) en ziet zijn huis en de review', async () => {
    const tok = await inloggen(w, H);
    const h = ((await w.post(HUIZEN, {}, tok)).data || {}).huizen || [];
    const r = JSON.stringify((await w.post(REVIEWS, { id: huis.id }, tok)).data || {});
    return { klopt: h.some((x) => x.id === huis.id) && r.includes('Rustig en schoon ' + merk), ziet: h.length + ' huis, review: ' + r.includes('Rustig en schoon ' + merk) };
  });

  await stap('persistent', 'het huis, de boeking en de review staan in de opslag zelf (gelezen buiten de server om)', async () => {
    const a = w.vindInOpslag('Finca ' + merk), b = w.vindInOpslag(ref), c = w.vindInOpslag('Rustig en schoon ' + merk);
    return { klopt: a.length >= 1 && b.length >= 1 && c.length >= 1, ziet: 'huis in ' + a.map((p) => p.bestand + '/' + (p.sleutel || p.tabel)).join(', ') + '; boeking ' + b.length + ', review ' + c.length };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op "aanvragen": een boeking, niet twee', async () => {
    const lijf = { id: huis.id, van: dag(40), tot: dag(43), gasten: 2 };
    const [a, b] = await w.dubbel(BOEK, lijf, G.token);
    const n = (await reizen()).filter((x) => x.van === dag(40) && x.huisId === huis.id).length;
    return { klopt: geen5xx(a) && geen5xx(b) && (a.status === 200 || b.status === 200) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' boeking(en)' };
  });

  await stap('herstelbaar', 'een dubbele tik op "huis opslaan": een huis, niet twee', async () => {
    /* het scherm stuurt per ingevuld huis een herhaalsleutel mee */
    const lijf = { idem: 'thuis-huis-' + merk, huis: { titel: 'Casita ' + merk, plaats: 'Santa Eulalia', prijs: 90, maxGasten: 2 } };
    const [a, b] = await w.dubbel(HUIS, lijf, H.token);
    const n = (((await w.post(HUIZEN, {}, H.token)).data || {}).huizen || []).filter((x) => x.titel === 'Casita ' + merk).length;
    return { klopt: geen5xx(a) && geen5xx(b) && n === 1, ziet: 'antwoorden ' + a.status + '/' + b.status + ', ' + n + ' huis/huizen' };
  });

  await stap('herstelbaar', 'een afgebroken aanvraag, daarna opnieuw: een boeking', async () => {
    const lijf = { id: huis.id, van: dag(70), tot: dag(72), gasten: 1 };
    const half = await w.afgebroken(BOEK, lijf, G.token);
    const opnieuw = await w.post(BOEK, lijf, G.token);
    const n = (await reizen()).filter((x) => x.van === dag(70) && x.huisId === huis.id).length;
    return { klopt: geen5xx(opnieuw) && n === 1, ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', ' + n + ' boeking(en)' };
  });

  await stap('herstelbaar', 'een crash direct na het besluit van de host en na een nieuw huis: bevestigd blijft bevestigd, en het huis opnieuw sturen maakt er geen tweede', async () => {
    const b = (await reizen()).find((x) => x.van === dag(40) && x.huisId === huis.id);
    const r = await w.post(BESLIS, { ref: b && b.ref, akkoord: true }, H.token);
    const lijf = { idem: 'thuis-huis-stroom-' + merk, huis: { titel: 'Stroomhuis ' + merk, plaats: 'Ibiza', prijs: 70, maxGasten: 2 } };
    const z = await w.post(HUIS, lijf, H.token);
    await w.crash();
    const na = (await reizen()).filter((x) => x.van === dag(40) && x.huisId === huis.id);
    const nog = await w.post(BESLIS, { ref: b && b.ref, akkoord: true }, H.token);
    const z2 = await w.post(HUIS, lijf, H.token);
    const n = (((await w.post(HUIZEN, {}, H.token)).data || {}).huizen || []).filter((x) => x.titel === 'Stroomhuis ' + merk).length;
    return { klopt: r.status === 200 && na.length === 1 && na[0].status === 'bevestigd' && nog.status === 409 && z.status === 200 && z2.status === 200 && n === 1,
      ziet: 'besluit ' + r.status + ', na SIGKILL ' + na.length + ' boeking (' + (na[0] && na[0].status) + '), nog eens beslissen ' + nog.status + '; huis opnieuw ' + z2.status + ', ' + n + ' huis' };
  });
}

module.exports = {
  functie: 'link:huis',
  ingang: '/apps/thuis.html',
  persona: 'lid',
  belofte: 'een lid zet zijn huis open, een ander lid vindt en vraagt het aan zonder dat er iets wordt afgeschreven, de host beslist, en het verblijf loopt van inchecken tot review -- een bezette periode blijft bezet, en niets gaat verloren of dubbel bij een herstart, een dubbeltik of een crash',
  grens: 'De proef loopt de routes van het scherm, niet het scherm zelf. Er wordt geen geld verplaatst (de boeking zegt zelf dat er niets is afgeschreven); annuleren met terugbetaling, de wenslijst, co-hosts, prijsadvies en zakelijk boeken worden niet gelopen. Inchecken kan in deze wereld op elke dag; een echte sleutel bestaat hier niet. Geen Redis of PostgreSQL.',
  loop
};
