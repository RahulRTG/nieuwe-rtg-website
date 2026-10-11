/* ============================================================================
   DE LEDENKRUIS -- bewijs 6 (bevoegd) aan de schermkant van een LEDENscherm.

   WAAROM DIT BESTAAT. BETROUWBAARHEID.md par. 4f mat dat een ledenscherm zijn
   eigenaar niet bij id noemt: het bakent af op de SESSIE. De bevoegdronde stelde
   een ledenrij daarom samen uit twee registers -- IDOR.json (een ander lid) en
   ROLPROEF.json (een andere rol op een schrijfroute) -- en sinds de
   toestelbinding is ROLPROEF niet meer te hermeten (zijn ijklid kan niet meer
   opladen, en de proef zegt dan terecht "de meter is blind"). Daarmee stonden
   alle ledenrijen op NIET_GETEST.

   Dit is de kruisproef van de gezinsschermen, toegepast op een scherm dat op de
   sessie afbakent. Er is geen id om te verwisselen, dus wordt de SESSIE
   verwisseld: lid A opent het scherm, en elk verzoek dat het scherm doet wordt
   nagespeeld door IEMAND ANDERS -- een anonieme bezoeker, een ander lid, een
   zaak, het kantoor en een gezin. Dezelfde sleutelbos als elders
   (./proefsessies.js), geen nagebouwd token.

   WAT EEN ANDER NIET MAG, in drie waarnemingen:
     lek        hij krijgt 2xx en het antwoord draagt een merkteken van A;
     open       een HANDELING van A slaagt zonder sessie;
     aangetast  na alle pogingen van de anderen leest A zijn eigen stand niet
                meer byte voor byte terug (tijdstempels uitgezonderd).
   En wat het lid WEL moet kunnen: elk paar telt alleen als A zelf 2xx kreeg --
   bij het laden in de browser, en bij een handeling NADAT alle anderen het
   hadden geprobeerd, op hetzelfde levende object.

   DE MERKTEKENS en waarom een scenario ze levert. "B zag niets van A" is alleen
   een uitslag als er op het scherm iets VAN A stond. Een vers lid heeft op de
   meeste schermen niets; een route die iedereen dezelfde lijst geeft, zou dan
   groen staan. Daarom zaait een scenario uit scripts/lib/voltooi/ eerst iets
   dat alleen van A is (een tekst die A zelf schreef, de ids van zijn sessies)
   en noemt het merkteken. Zonder zaai zijn de merktekens alleen A's identiteit
   (nummer, e-mail, telefoon, sessie-id; de codenaam niet, zie identiteit()), en dan telt een rij alleen
   als een route VAN HET SCHERM ZELF (niet de gedeelde schil) er een droeg.

   WAT DIT NIET BEWIJST, en dat staat in elke uitslag: wat het scherm bij het
   laden en de zaai/handelingen van het scenario aanroept, en niets daarbuiten;
   een merkteken dat een ander op een andere manier zou kunnen afleiden zonder
   het woordelijk te krijgen; en geen andere ZAAK of ander KANTOOR dan het
   proefaccount van de sleutelbos.
   ========================================================================== */
'use strict';

const ANDEREN = ['anoniem', 'ander lid', 'zaak', 'kantoor', 'gezin'];
const GRENS = 'het scherm bij het laden plus de zaai en handelingen van zijn scenario; nagespeeld door een anonieme bezoeker, ' +
  'een ander lid, een zaak, het kantoor en een gezin uit de sleutelbos; een lek is een merkteken van A in hun antwoord; ' +
  'van een stroom (event-stream) telt alleen de status, zijn inhoud wordt niet gelezen';

const ok = (s) => s >= 200 && s < 300;

/* Wat een ander bij EEN verzoek kreeg. */
/* `verzoek` is wat de ander zelf meestuurde (adres en lijf). Een merkteken dat
   daarin al staat, kan hij niet van A hebben gekregen: wie "bron: x" stuurt en
   "via: scherm:x" terugkrijgt, ziet zijn eigen woord. Zonder die uitzondering
   meldde de eerste ronde een lek op /api/mijn/post/zet dat er niet was. */
function andersOordeel({ status, tekst }, merktekens, { handeling = false, wie = '', verzoek = '' } = {}) {
  if (status === 429 || status === 0) return 'onbeslist';
  if (!ok(status)) return 'geweigerd';
  const raak = merktekens.find((m) => m && !String(verzoek).includes(m.replace(/^scherm:/, '')) && String(tekst || '').includes(m));
  if (raak) return 'lek';
  if (handeling && wie === 'anoniem') return 'open';
  return 'eigen';
}

/* Tijdstempels wegstrepen: een stand die alleen een "laatst gezien" anders heeft,
   is niet aangetast. Getallen blijven staan -- een teller die verschuift is wel
   een verandering. */
function vlak(tekst) {
  return String(tekst || '').replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g, 'T');
}

/* Het oordeel over een rij. `paren`: { pad, soort ('laden'|'handeling'), a,
   anderen: { wie: uitslag } } (soort ook 'lezer'). `onderwerp`: droeg een eigen route van het
   scherm een merkteken van A? `aangetast`: lezers van A die na de pogingen
   anders terugkwamen. */
function kruisOordeel({ paren, onderwerp, aangetast = [], fout = null }) {
  if (fout) return { status: 'NIET_GETEST', reden: 'de kruisproef kon niet lopen: ' + fout, gekruist: [] };
  const telt = paren.filter((p) => ok(p.a));
  const gekruist = [...new Set(telt.filter((p) => !Object.values(p.anderen).includes('onbeslist')).map((p) => p.pad))].sort();
  const lek = telt.find((p) => Object.values(p.anderen).includes('lek'));
  if (lek) {
    const wie = Object.entries(lek.anderen).find(([, u]) => u === 'lek')[0];
    return { status: 'GEBLOKKEERD_DOOR_DEFECT', gekruist, reden: wie + ' kreeg ' + lek.pad + ' met een merkteken van lid A erin' };
  }
  const open = telt.find((p) => Object.values(p.anderen).includes('open'));
  if (open) return { status: 'GEBLOKKEERD_DOOR_DEFECT', gekruist, reden: 'de handeling ' + open.pad + ' van lid A slaagde zonder sessie' };
  if (aangetast.length) {
    return { status: 'GEBLOKKEERD_DOOR_DEFECT', gekruist,
      reden: 'na de pogingen van de anderen las lid A ' + aangetast.join(', ') + ' anders terug: iemand anders veranderde zijn stand' };
  }
  if (!telt.length) return { status: 'NIET_GETEST', gekruist, reden: 'geen enkel verzoek waarin lid A zelf binnenkwam; er viel niets te kruisen' };
  /* Het eigen lid WEL: een lezer of handeling van het scenario die A zelf
     geweigerd kreeg, maakt van "de anderen werden geweigerd" geen uitslag --
     een route die iedereen weigert, is niet bevoegd maar dicht. */
  const eigenWeg = paren.filter((p) => p.soort !== 'laden' && !ok(p.a));
  if (eigenWeg.length) {
    return { status: 'NIET_GETEST', gekruist,
      reden: 'lid A kwam zelf niet binnen bij ' + eigenWeg.map((p) => p.pad + ' (' + p.a + ')').slice(0, 3).join(', ') + '; het eigen lid hoort het wel te kunnen' };
  }
  if (!onderwerp) {
    return { status: 'NIET_GETEST', gekruist,
      reden: 'geen eigen route van het scherm droeg iets van lid A; "een ander zag niets" is dan geen uitslag' };
  }
  const onbeslist = telt.filter((p) => Object.values(p.anderen).includes('onbeslist'));
  if (onbeslist.length) return { status: 'NIET_GETEST', gekruist, reden: onbeslist.length + ' paren onbeslist door de rem (429), o.a. ' + onbeslist[0].pad };
  const handelingen = telt.filter((p) => p.soort === 'handeling').length;
  return { status: 'BEWEZEN', gekruist,
    reden: telt.length + ' verzoeken van lid A (' + handelingen + ' handelingen) nagespeeld door ' + ANDEREN.join(', ') +
      ': geen lek, geen handeling zonder sessie, de stand van A onaangetast; ' + GRENS };
}

/* ---- de meting ---------------------------------------------------------- */

async function roep(base, v, token) {
  const koppen = { 'content-type': 'application/json' };
  for (const [k, w] of Object.entries(v.koppen || {})) {
    if (/^authorization$/i.test(k)) continue;
    if (/^(x-|rtg-)/i.test(k)) koppen[k] = w;
  }
  if (token) koppen.authorization = 'Bearer ' + token;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);
    const r = await fetch(base + v.url, { method: v.methode, headers: koppen,
      body: v.methode === 'GET' || v.methode === 'HEAD' ? undefined : (v.lijf || '{}'), signal: ac.signal });
    clearTimeout(t);
    /* Een stroom eindigt nooit: de status telt, de inhoud is leeg (zie hierboven). */
    if (/event-stream/i.test(r.headers.get('content-type') || '')) { ac.abort(); return { status: r.status, tekst: '' }; }
    const tekst = await Promise.race([r.text().catch(() => ''), new Promise((k) => setTimeout(() => { ac.abort(); k(''); }, 5000))]);
    return { status: r.status, tekst };
  } catch (e) { return { status: 0, tekst: '' }; }
}

/* Een `w` in de vorm die de scenario's kennen (scripts/lib/voltooiwereld.js),
   over een gewone server: alleen post en basis. */
function wereldOver(base) {
  return {
    basis: base,
    async post(pad, lijf, tok, koppen) {
      const h = Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}, koppen || {});
      try {
        const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(lijf || {}) });
        return { status: r.status, data: await r.json().catch(() => null) };
      } catch (e) { return { status: 0, data: null }; }
    }
  };
}

function sidVan(token) {
  try { return Buffer.from(String(token).split('.')[0], 'base64url').toString('utf8').split('.').pop() || null; } catch (e) { return null; }
}

async function identiteit(w, token) {
  const s = await w.post('/api/state', {}, token);
  const u = (s.data && s.data.state && s.data.state.user) || {};
  /* GEEN codenaam. Die is in dit huis het pseudoniem dat een ander lid met opzet
     mag zien (de Residence, De Salon); de eerste volle ronde meldde daarop een
     "lek" in /api/residentie/betreed dat de aanwezigheid in een gedeelde zaal
     was. Nummer, e-mail, telefoon en sessie-id zijn wel van A alleen. */
  return [u.number, u.email, u.phone, sidVan(token)].filter((x) => x && String(x).length >= 6).map(String);
}

/* Een rij meten. `zaai` (optioneel, uit een scenario) geeft { lid, merktekens,
   lezers, handelingen }; zonder zaai is A `standaardLid`. `anderen` zijn de
   sessies van de sleutelbos ({ wie: token|null }). */
async function meetRij({ rij, base, browser, maakContext, opslagVoor, anderen, eigenRoutes, zaai, standaardLid }) {
  const w = wereldOver(base);
  let A, merktekens, lezers = [], handelingen = [];
  if (zaai) {
    const z = await zaai(w);
    A = z.lid.token;
    merktekens = (z.merktekens || []).concat(await identiteit(w, A));
    lezers = z.lezers || []; handelingen = z.handelingen || [];
  } else {
    A = standaardLid.token; merktekens = standaardLid.merktekens;
  }
  const eigen = (p) => eigenRoutes.exact.has(p) || [...eigenRoutes.voor].some((v) => p.startsWith(v));

  /* 1. Het scherm openen als A en vastleggen wat het vraagt en krijgt. */
  const ctx = await maakContext(browser, opslagVoor({ lid: { sleutel: 'rtg_member_token', waarde: A } }));
  const page = await ctx.newPage();
  const geladen = new Map();
  const wacht = [];
  page.on('response', (res) => {
    const q = res.request();
    const u = new URL(q.url());
    if (!u.pathname.startsWith('/api/')) return;
    const k = q.method() + ' ' + u.pathname + u.search + ' ' + (q.postData() || '');
    if (geladen.has(k)) return;
    const v = { methode: q.method(), url: u.pathname + u.search, pad: u.pathname, lijf: q.postData() || '', koppen: q.headers(), a: res.status() };
    geladen.set(k, v);
    /* Een stroom (EventSource, een lang lopend antwoord) eindigt nooit; wie daar
       op res.text() wacht, hangt de hele ronde op -- dat gebeurde, een kwartier
       lang zonder melding. Daarom een grens, en een stroom telt als leeg. */
    const soort = String((res.headers() || {})['content-type'] || '');
    if (/event-stream/i.test(soort)) { v.tekst = ''; return; }
    wacht.push(Promise.race([res.text(), new Promise((r) => setTimeout(() => r(''), 5000))])
      .then((t) => { v.tekst = t; }, () => { v.tekst = ''; }));
  });
  try { await page.goto(base + rij.pad, { waitUntil: 'domcontentloaded', timeout: 20000 }); await page.waitForTimeout(2600); } catch (e) { /* telt hieronder als niets geladen */ }
  await Promise.all(wacht);
  await ctx.close();

  const geladenLijst = [...geladen.values()];

  /* 2. A's eigen stand vooraf. */
  const lezerStatus = [];
  const lezerOnderwerp = [];
  const leesStand = async () => Promise.all(lezers.map(async (l, i) => {
    const r = await roep(base, { methode: 'POST', url: l.pad, lijf: JSON.stringify(l.lijf || {}) }, A);
    if (lezerStatus[i] === undefined) {
      lezerStatus[i] = r.status;
      lezerOnderwerp[i] = ok(r.status) && eigen(l.pad) && merktekens.some((m) => r.tekst.includes(m));
    }
    return vlak(r.tekst);
  }));
  const voor = await leesStand();

  /* 3. De anderen. Eerst de verzoeken van het laden, dan de handelingen die A
     straks zelf doet -- op hetzelfde levende object. */
  const paren = [];
  for (const v of geladenLijst) {
    const p = { pad: v.pad, soort: 'laden', a: v.a, anderen: {} };
    for (const wie of ANDEREN) p.anderen[wie] = andersOordeel(await roep(base, v, anderen[wie]), merktekens, { wie, verzoek: v.url + ' ' + v.lijf });
    paren.push(p);
  }
  /* De lezers van het scenario: dezelfde routes van het scherm, ook als het
     scherm ze bij het laden niet aanriep. A's antwoord staat al in `voor`. */
  for (const [i, l] of lezers.entries()) {
    const v = { methode: 'POST', url: l.pad, lijf: JSON.stringify(l.lijf || {}) };
    const p = { pad: l.pad, soort: 'lezer', a: lezerStatus[i], anderen: {} };
    for (const wie of ANDEREN) p.anderen[wie] = andersOordeel(await roep(base, v, anderen[wie]), merktekens, { wie, verzoek: v.url + ' ' + v.lijf });
    paren.push(p);
  }
  for (const h of handelingen) {
    const p = { pad: h.pad, soort: 'handeling', a: 0, anderen: {} };
    for (const wie of ANDEREN) {
      const koppen = h.kop ? await h.kop() : {};
      p.anderen[wie] = andersOordeel(await roep(base, { methode: 'POST', url: h.pad, lijf: JSON.stringify(h.lijf || {}), koppen }, anderen[wie]),
        merktekens, { handeling: true, wie, verzoek: h.pad + ' ' + JSON.stringify(h.lijf || {}) });
    }
    paren.push(p);
  }

  /* Onderwerp: droeg een eigen route van het scherm (geladen of gelezen) iets van A? */
  const onderwerp = lezerOnderwerp.some(Boolean) ||
    geladenLijst.some((v) => ok(v.a) && eigen(v.pad) && merktekens.some((m) => String(v.tekst || '').includes(m)));

  /* 4. Is A's stand nog die van daarvoor? */
  const na = await leesStand();
  const aangetast = lezers.filter((l, i) => voor[i] !== na[i]).map((l) => l.pad);

  /* 5. En nu A zelf, op hetzelfde object. */
  for (const p of paren.filter((x) => x.soort === 'handeling')) {
    const h = handelingen.find((x) => x.pad === p.pad && !x.gedaan);
    h.gedaan = true;
    const koppen = h.kop ? await h.kop() : {};
    p.a = (await roep(base, { methode: 'POST', url: h.pad, lijf: JSON.stringify(h.lijf || {}), koppen }, A)).status;
  }

  return Object.assign(kruisOordeel({ paren, onderwerp, aangetast }), { kruisparen: paren.map((p) => ({ pad: p.pad, soort: p.soort, a: p.a, anderen: p.anderen })) });
}

module.exports = { ANDEREN, GRENS, andersOordeel, kruisOordeel, vlak, meetRij, wereldOver, identiteit, sidVan };
