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
  'van een stroom (event-stream) telt alleen de status, zijn inhoud wordt niet gelezen; een weigering (4xx) wordt niet op ' +
  'merktekens gelezen; de codenaam mag zichtbaar zijn op de routes in CODENAAM_ZICHTBAAR';

const ok = (s) => s >= 200 && s < 300;

/* Wat een ander bij EEN verzoek kreeg.

   TWEE SOORTEN MERKTEKEN, en het verschil is de hele les van de tweede
   tegenlezing. Een TEKST (een titel, een notitie, een adres dat A schreef) wordt
   bij het naspelen door een ander VERVANGEN door een eigen waarde
   (vervangTekst() hieronder): de ander stuurt dus nooit A's woord mee, en elk
   spoor van A's tekst in zijn antwoord is een lek. Eerder gold de uitzondering
   "hij stuurde het zelf", en die maakte de meter blind voor precies de waarden
   die het scenario in A's lijf zette -- een kring/mail die de kring van een ander
   teruggaf, bleef groen omdat het adres in het verzoek stond. Een OBJECT (het id
   van A's feit, melding, moment, map, sessie) blijft juist staan, want dat IS de
   IDOR-proef; komt het terug in het antwoord op een verzoek dat het zelf
   meestuurde, dan is dat geen lek (de handeling zelf wordt dan als `inbreuk`
   beoordeeld als hij slaagde). */
function andersOordeel({ status, tekst }, merktekens, { handeling = false, object = false, wie = '', verzoek = '', pad = '' } = {}) {
  if (status === 429 || status === 0) return 'onbeslist';
  if (!ok(status)) return 'geweigerd';
  const raak = merktekens.find((m) => {
    const waarde = typeof m === 'string' ? m : m && m.waarde;
    if (!waarde) return false;
    if (m.zichtbaarOp && m.zichtbaarOp.includes(pad)) return false;
    if (m.soort === 'object' && String(verzoek).includes(waarde)) return false;
    return String(tekst || '').includes(waarde);
  });
  if (raak) return 'lek';
  if (handeling && wie === 'anoniem') return 'open';
  /* Een handeling op een OBJECT van A (een id van zijn feit, zijn melding, zijn
     sessie) hoort voor ieder ander te mislukken. Een 2xx daarop is geen "eigen"
     antwoord maar een inbreuk, ook als het antwoord niets van A laat zien: de
     tegenlezer liet deel() in alle ledgers zoeken, een ander lid maakte een
     deelcode op A's feit -- en de kruis bleef groen. */
  if (handeling && object) return 'inbreuk';
  return 'eigen';
}

/* WAAR DE CODENAAM VAN A ZICHTBAAR MAG ZIJN voor een ander, met de reden. Buiten
   deze routes is hij een merkteken zoals elk ander: de codenaam is het pseudoniem
   dat een ander lid in een GEDEELDE ruimte mag zien, niet een vrijbrief voor elke
   route. Een verklaring en geen afleiding -- wie hier een route toevoegt, zegt
   waarom die ruimte gedeeld is. */
const CODENAAM_ZICHTBAAR = {
  '/api/residentie/betreed': 'binnenlopen in een zaal van de Residence: wie binnenkomt ziet wie er al is, op codenaam (server/routes/member/residentie.js)',
  '/api/residentie/stap': 'een stap in een gedeelde zaal: het antwoord is de zaal met wie erin staat, op codenaam',
  '/api/residentie/zeg': 'iets zeggen in een gedeelde zaal: wie er is hoort het, met de codenaam van wie het zei',
  '/api/residentie/emote': 'een emote in een gedeelde zaal: zichtbaar voor wie er is, op codenaam'
};

/* Een tekst-merkteken van A vervangen door een eigen waarde van de ander, in het
   adres en het lijf van een verzoek dat een ander naspeelt. Objecten blijven. */
function vervangTekst(s, merktekens, wie) {
  let uit = String(s == null ? '' : s);
  merktekens.forEach((m, i) => {
    const waarde = typeof m === 'string' ? m : m && m.waarde;
    const soort = typeof m === 'string' ? 'tekst' : (m.soort || 'tekst');
    if (!waarde || soort !== 'tekst') return;
    uit = uit.split(waarde).join('ander' + i + '-' + String(wie).replace(/\W/g, '') + '-x');
  });
  return uit;
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
  const inbreuk = telt.find((p) => Object.values(p.anderen).includes('inbreuk'));
  if (inbreuk) {
    const wie = Object.entries(inbreuk.anderen).find(([, u]) => u === 'inbreuk')[0];
    return { status: 'GEBLOKKEERD_DOOR_DEFECT', gekruist, reden: wie + ' kreeg 2xx op ' + inbreuk.pad + ', een handeling op een object van lid A' };
  }
  const open = telt.find((p) => Object.values(p.anderen).includes('open'));
  if (open) return { status: 'GEBLOKKEERD_DOOR_DEFECT', gekruist, reden: 'de handeling ' + open.pad + ' van lid A slaagde zonder sessie' };
  if (aangetast.length) {
    /* `aangetast`: [{ pad, na }] -- na wiens pogingen de stand van A anders
       terugkwam. Dat is een tijdsvolgorde en geen bewijs van de oorzaak: het
       label zegt daarom "anders na de pogingen van X", niet "X veranderde". */
    const a = aangetast.map((x) => (typeof x === 'string' ? { pad: x, na: null } : x));
    return { status: 'GEBLOKKEERD_DOOR_DEFECT', gekruist,
      reden: 'lid A las ' + a.map((x) => x.pad + (x.na ? ' (anders na de pogingen van ' + x.na + ')' : '')).join(', ') +
        ' anders terug dan voor de pogingen van de anderen' };
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
      ': geen lek, geen handeling zonder sessie, geen handeling op een object van A, de stand van A onaangetast; ' + GRENS };
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
  /* De codenaam is een merkteken, behalve op de routes in CODENAAM_ZICHTBAAR. */
  const codenaam = u.codename ? [{ waarde: String(u.codename), zichtbaarOp: Object.keys(CODENAAM_ZICHTBAAR) }] : [];
  const sid = sidVan(token);
  return [u.number, u.email, u.phone].filter((x) => x && String(x).length >= 6).map(String).concat(codenaam,
    sid ? [{ waarde: sid, soort: 'object' }] : []);
}

/* Een rij meten. `zaai` (optioneel, uit een scenario) geeft { lid, merktekens
   (vrije tekst van A), objecten (ids van A's dingen), lezers, handelingen }; zonder zaai is A `standaardLid`. `anderen` zijn de
   sessies van de sleutelbos ({ wie: token|null }). */
async function meetRij({ rij, base, browser, maakContext, opslagVoor, anderen, eigenRoutes, zaai, standaardLid }) {
  const w = wereldOver(base);
  let A, merktekens, lezers = [], handelingen = [];
  if (zaai) {
    const z = await zaai(w);
    A = z.lid.token;
    merktekens = (z.merktekens || []).concat((z.objecten || []).filter(Boolean).map((o) => ({ waarde: String(o), soort: 'object' })),
      await identiteit(w, A));
    lezers = z.lezers || []; handelingen = z.handelingen || [];
  } else {
    A = standaardLid.token; merktekens = standaardLid.merktekens;
  }
  const waarden = merktekens.map((m) => (typeof m === 'string' ? m : m.waarde));
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
      lezerOnderwerp[i] = ok(r.status) && eigen(l.pad) && waarden.some((m) => r.tekst.includes(m));
    }
    return vlak(r.tekst);
  }));
  const voor = await leesStand();

  /* 3. De anderen, EEN VOOR EEN: eerst alle verzoeken van het laden, de lezers
     en de handelingen die A straks zelf doet (op hetzelfde levende object), en
     daarna leest A zijn stand terug. Zo zegt een aangetaste stand na WIENS
     pogingen hij anders was. */
  const paren = [
    ...geladenLijst.map((v) => ({ pad: v.pad, soort: 'laden', a: v.a, anderen: {}, v })),
    ...lezers.map((l, i) => ({ pad: l.pad, soort: 'lezer', a: lezerStatus[i], anderen: {},
      v: { methode: 'POST', url: l.pad, lijf: JSON.stringify(l.lijf || {}) } })),
    ...handelingen.map((h) => ({ pad: h.pad, soort: 'handeling', a: 0, anderen: {}, h }))
  ];
  const aangetast = [];
  let stand = voor;
  for (const wie of ANDEREN) {
    for (const p of paren) {
      if (p.h) {
        const koppen = p.h.kop ? await p.h.kop() : {};
        const lijf = vervangTekst(JSON.stringify(p.h.lijf || {}), merktekens, wie);
        p.anderen[wie] = andersOordeel(await roep(base, { methode: 'POST', url: p.h.pad, lijf, koppen }, anderen[wie]),
          merktekens, { handeling: true, object: !!p.h.object, wie, pad: p.pad, verzoek: p.h.pad + ' ' + lijf });
      } else {
        const v = Object.assign({}, p.v, { url: vervangTekst(p.v.url, merktekens, wie), lijf: vervangTekst(p.v.lijf, merktekens, wie) });
        p.anderen[wie] = andersOordeel(await roep(base, v, anderen[wie]), merktekens, { wie, pad: p.pad, verzoek: v.url + ' ' + v.lijf });
      }
    }
    const na = await leesStand();
    lezers.forEach((l, i) => { if (stand[i] !== na[i]) aangetast.push({ pad: l.pad, na: wie }); });
    stand = na;
  }

  /* Onderwerp: droeg een eigen route van het scherm (geladen of gelezen) iets van A? */
  const onderwerp = lezerOnderwerp.some(Boolean) ||
    geladenLijst.some((v) => ok(v.a) && eigen(v.pad) && waarden.some((m) => String(v.tekst || '').includes(m)));

  /* 5. En nu A zelf, op hetzelfde object. */
  for (const p of paren.filter((x) => x.h)) {
    const koppen = p.h.kop ? await p.h.kop() : {};
    p.a = (await roep(base, { methode: 'POST', url: p.h.pad, lijf: JSON.stringify(p.h.lijf || {}), koppen }, A)).status;
  }

  return Object.assign(kruisOordeel({ paren, onderwerp, aangetast }), { kruisparen: paren.map((p) => ({ pad: p.pad, soort: p.soort, a: p.a, anderen: p.anderen })) });
}

module.exports = { ANDEREN, GRENS, CODENAAM_ZICHTBAAR, vervangTekst, andersOordeel, kruisOordeel, vlak, meetRij, wereldOver, identiteit, sidVan };
