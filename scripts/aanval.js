/* AANVALSRONDE -- het systeem van buitenaf bestoken.

   WAT DIT WEL IS: een batterij aanvallen tegen een DRAAIENDE server, met de
   houding van iemand die binnen wil komen in plaats van iemand die wil
   bevestigen dat zijn ontwerp klopt. Elke poging staat er met wat er gebeurde.

   WAT DIT NIET IS: een onafhankelijke pentest. Dit script is geschreven door
   dezelfde partij die de server schreef, en dat is een fundamentele beperking:
   je zoekt niet naar de aanname die je niet weet dat je hebt. De WAL-bug in de
   backups lag maanden onder een volledige testsuite en geen enkele eigen test
   raakte hem -- die vond ik pas door iets ECHT te doen in plaats van te
   controleren. Voor de lancering hoort hier een vreemd paar ogen overheen.

   Draai:  node scripts/aanval.js [http://127.0.0.1:3000]
   Exitcode 1 zodra er iets RAAK is, zodat hij als poort kan dienen. */
const BASIS = process.argv[2] || 'http://127.0.0.1:3000';
const raak = [];    // echt mis
const let_op = [];  // verdient een blik
const ok = [];      // aanval afgeslagen

const meld = (lijst, wat, hoe) => lijst.push({ wat, hoe });
const uniek = () => Math.random().toString(36).slice(2, 10);

async function post(pad, body, tok, extra) {
  const h = { 'Content-Type': 'application/json', ...(extra || {}) };
  if (tok) h.Authorization = 'Bearer ' + tok;
  try {
    const r = await fetch(BASIS + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
    return { status: r.status, tekst: await r.text() };
  } catch (e) { return { status: 0, tekst: String(e.message) }; }
}
async function haal(pad, tok) {
  const h = tok ? { Authorization: 'Bearer ' + tok } : {};
  try {
    const r = await fetch(BASIS + pad, { headers: h });
    return { status: r.status, tekst: await r.text() };
  } catch (e) { return { status: 0, tekst: String(e.message) }; }
}

/* Een lid aanmaken en het token teruggeven -- de meeste aanvallen hebben een
   geldig ingelogde aanvaller nodig (het gevaarlijke geval: WEL ingelogd, maar
   niet gerechtigd tot wat hij probeert). */
async function nieuwLid() {
  const u = uniek();
  const reg = await post('/api/auth/register', {
    name: 'Aanvaller ' + u, email: 'aanval-' + u + '@proef.test', phone: '0612345678',
    password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
  });
  try { return { token: JSON.parse(reg.tekst).token, u }; } catch (e) { return { token: null, u }; }
}

async function aanvallen() {
  // 0. leeft de server?
  const gezond = await haal('/api/health');
  if (gezond.status !== 200) { console.error('Server niet bereikbaar op ' + BASIS + ' (status ' + gezond.status + ').'); process.exit(2); }

  const A = await nieuwLid();
  const B = await nieuwLid();
  if (!A.token || !B.token) { console.error('Kon geen testleden aanmaken; is dit een verse, niet-productie server?'); process.exit(2); }

  /* 1. IDOR: kan B iets van A opvragen door diens sleutel te raden? Het
     inzagejournaal is de scherpste: daar staat "wie keek naar wie". */
  const inzB = await post('/api/privacy/inzage', { userId: 1, id: 1, overId: 1 }, B.token);
  try {
    const j = JSON.parse(inzB.tekst);
    if (Array.isArray(j.inzage) && j.inzage.length === 0) meld(ok, 'IDOR inzagejournaal', 'B krijgt alleen zijn eigen (lege) journaal');
    else meld(raak, 'IDOR inzagejournaal', 'B kreeg ' + (j.inzage || []).length + ' regel(s) terug -- mogelijk die van een ander');
  } catch (e) { meld(let_op, 'IDOR inzagejournaal', 'onverwacht antwoord: ' + inzB.status); }

  // 2. zonder token: komt een niet-ingelogde binnen op afgeschermde routes?
  for (const pad of ['/api/state', '/api/privacy/export', '/api/cv/get']) {
    const r = await post(pad, {}, null);
    if (r.status === 401 || r.status === 403) meld(ok, 'geen-token ' + pad, 'geweigerd (' + r.status + ')');
    else meld(raak, 'geen-token ' + pad, 'liet iemand zonder token toe (' + r.status + ')');
  }

  // 3. verzonnen/kapot token: accepteert de server rommel als sessie?
  for (const tok of ['onzin', 'Bearer x', 'a.b.c', A.token.slice(0, -3) + '000']) {
    const r = await post('/api/state', {}, tok);
    if (r.status === 401 || r.status === 403) meld(ok, 'kapot token', 'geweigerd (' + r.status + ')');
    else meld(raak, 'kapot token', 'een ongeldig token werd geaccepteerd (' + r.status + ')');
  }

  // 4. techniekbord: mag een gewoon lid het beveiligde bord in?
  const tech = await haal('/api/techniek/status', A.token);
  if (tech.status === 401 || tech.status === 403) meld(ok, 'techniekbord', 'gewoon lid geweigerd (' + tech.status + ')');
  else meld(raak, 'techniekbord', 'een gewoon lid kwam op het technische bord (' + tech.status + ')');

  // 5. backoffice: mag een gewoon lid de KYC-wachtrij zien (echte namen!)?
  const kyc = await post('/api/office/verifications', {}, A.token);
  if (kyc.status === 401 || kyc.status === 403) meld(ok, 'KYC-wachtrij', 'gewoon lid geweigerd (' + kyc.status + ')');
  else meld(raak, 'KYC-wachtrij', 'een gewoon lid zag de identiteitsverificaties (' + kyc.status + ')');

  /* 6. pas-escalatie: kan een aanvaller zich rechtstreeks als Business
     inschrijven? De merkregel zegt: alleen na menselijke goedkeuring. */
  const u = uniek();
  const biz = await post('/api/auth/register', {
    name: 'Zaak ' + u, email: 'biz-' + u + '@proef.test', phone: '0612345678',
    password: 'geheim12345', geboortedatum: '1985-01-01', tier: 'business', pasApp: 'business'
  });
  try {
    const t = JSON.parse(biz.tekst).token;
    if (!t) { meld(ok, 'pas-escalatie', 'zelf-registratie als Business geweigerd'); }
    else {
      const st = await post('/api/state', {}, t);
      const tier = (JSON.parse(st.tekst).state || {}).user.tier;
      if (tier === 'business') meld(raak, 'pas-escalatie', 'zelf-registratie gaf DIRECT een Business Pass (merkregel: alleen na menselijke goedkeuring)');
      else meld(ok, 'pas-escalatie', 'kreeg tier "' + tier + '" i.p.v. business');
    }
  } catch (e) { meld(ok, 'pas-escalatie', 'geen bruikbaar antwoord (' + biz.status + ')'); }

  // 7. echte naam lekken: staat er ergens in B's staat een achternaam?
  const stB = await post('/api/state', {}, B.token);
  if (/Aanvaller/.test(stB.tekst) && !new RegExp('Aanvaller ' + B.u).test(stB.tekst.replace(new RegExp('Aanvaller ' + B.u, 'g'), '')))
    meld(let_op, 'naamlek', "de eigen naam mag; controleer dat er geen ANDERE naam in staat");
  else meld(ok, 'naamlek', "geen vreemde naam in de eigen staat");

  // 8. WAF: worden bekende sondes geweigerd?
  for (const pad of ['/wp-admin', '/.env', '/../../etc/passwd', '/index.php?id=1%20union%20select']) {
    const r = await haal(pad);
    if (r.status === 403 || r.status === 404) meld(ok, 'WAF ' + pad, 'afgeslagen (' + r.status + ')');
    else meld(let_op, 'WAF ' + pad, 'onverwachte status ' + r.status);
  }

  // 9. injectie in de codenaam-zoeker: geen crash, geen dump
  const zoek = await post('/api/salon/feed', { q: "' OR 1=1 --" }, A.token);
  if (zoek.status >= 500) meld(raak, 'injectie salon', 'een rare query gaf een 500 (' + zoek.status + ')');
  else meld(ok, 'injectie salon', 'netjes afgehandeld (' + zoek.status + ')');

  // --- rapport ---
  const regel = (x) => '   - ' + x.wat + ': ' + x.hoe;
  console.log('\n=== RTG aanvalsronde tegen ' + BASIS + ' ===');
  console.log('\nAfgeslagen (' + ok.length + '):'); ok.forEach(x => console.log(regel(x)));
  if (let_op.length) { console.log('\nVerdient een blik (' + let_op.length + '):'); let_op.forEach(x => console.log(regel(x))); }
  if (raak.length) {
    console.log('\n!!! RAAK (' + raak.length + ') -- dit hoort dicht voor de lancering:');
    raak.forEach(x => console.log(regel(x)));
  } else {
    console.log('\nNiets raak in deze ronde. Dat is geruststellend, geen bewijs:');
    console.log('   dit script kent de aanvallen die IK kon bedenken. Een onafhankelijke');
    console.log('   pentest kent de aanvallen die ik niet zag. Doe die ook.');
  }
  console.log('');
  process.exit(raak.length ? 1 : 0);
}

aanvallen().catch(e => { console.error('aanvalsronde brak af:', e); process.exit(2); });
