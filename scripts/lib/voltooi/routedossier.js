/* ============================================================================
   VOLTOOIPROEF: HET ROUTEDOSSIER (link:routedossier, /apps/routedossier.html).

   De belofte, in de woorden van routes/office/dossier.js: "niet een cijfer over
   het huis, maar het antwoord op 'en wat weten we van DEZE?'". Een medewerker
   van het kantoor ziet per schakel (AUTH, ACL, INPUT, ...) hoeveel routes
   bewezen, gezakt of ongemeten zijn, filtert, bladert, en opent een route met
   al zijn cellen, elk met bron en reden.

   LEZEND, EN DAT IS HET PUNT VAN PERSISTENT EN HERSTELBAAR HIER. Het dossier
   wordt gelezen uit de router van de server en de registers in de repository;
   de route schrijft niets. Persistent betekent dus: na een herstart en een
   crash geeft hetzelfde filter hetzelfde antwoord, in een nieuwe kantoorsessie.
   Herstelbaar: een dubbele of afgebroken vraag verandert niets.

   DE DEUR IS DE KANTOORDEUR (officeAuth). Een lid, een zaak en een vreemde
   krijgen hem dicht, met een zin.
   ========================================================================== */
'use strict';
const { nieuwLid, KANTOORWERELD } = require('../voltooiwereld');

const DOSSIER = '/api/office/routedossier';
const ROUTE = { methode: 'POST', pad: '/api/arrival/request' };

const geen5xx = (r) => r && r.status > 0 && r.status < 500;
const kantoor = async (w) => {
  const o = await w.post('/api/office/login', { code: KANTOORWERELD.OFFICE_CODE });
  if (!o.data || !o.data.token) throw new Error('de kantoorinlog lukte niet (' + o.status + ')');
  return o.data.token;
};
/* Het deel van het antwoord dat over de routes gaat; `journaalGelezen` is een
   tijdstip van lezen en geen inhoud. */
const kern = (d) => JSON.stringify({ routes: d.routes, telling: d.telling, perSchakel: d.perSchakel, lijst: d.lijst });

async function loop(w, stap) {
  let K = await kantoor(w);
  const lees = (lijf, tok) => w.post(DOSSIER, lijf || {}, tok === undefined ? K : tok);
  let overzicht = null, eerste = null;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'het kantoor opent het dossier: alle routes van de server, per schakel geteld, met de bron van elke schakel', async () => {
    const r = await lees({});
    overzicht = r.data;
    const s = (overzicht.schakels || []).find((x) => x.id === 'AUTH');
    return { klopt: r.status === 200 && overzicht.routes > 100 && overzicht.gedegradeerd === false && !!s && !!s.bron &&
      !!overzicht.perSchakel.AUTH && overzicht.lijst.totaal === overzicht.routes,
      ziet: r.status + ', ' + overzicht.routes + ' routes, ' + overzicht.schakels.length + ' schakels, herkomst: ' + overzicht.herkomst };
  });

  await stap('voltooibaar', 'filteren op schakel en staat geeft precies de routes in die staat, en de telling klopt met de balk', async () => {
    const r = await lees({ schakel: 'INPUT', staat: 'bewezen' });
    eerste = r.data;
    const res = eerste.lijst.resultaten || [];
    const alleBewezen = res.every((x) => x.cellen && x.cellen.INPUT && x.cellen.INPUT.staat === 'bewezen');
    return { klopt: r.status === 200 && eerste.lijst.totaal === overzicht.perSchakel.INPUT.bewezen && res.length > 0 && alleBewezen,
      ziet: eerste.lijst.totaal + ' routes met INPUT bewezen (balk zegt ' + overzicht.perSchakel.INPUT.bewezen + '), eerste pagina ' + res.length + (alleBewezen ? ', alle bewezen' : ', NIET ALLE BEWEZEN') };
  });

  await stap('voltooibaar', 'bladeren naar pagina 2 geeft de volgende routes, niet dezelfde', async () => {
    const r = await lees({ schakel: 'INPUT', staat: 'bewezen', pagina: 2 });
    const p1 = new Set((eerste.lijst.resultaten || []).map((x) => x.methode + ' ' + x.pad));
    const p2 = (r.data.lijst.resultaten || []).map((x) => x.methode + ' ' + x.pad);
    return { klopt: r.status === 200 && r.data.lijst.pagina === 2 && p2.length > 0 && p2.every((x) => !p1.has(x)),
      ziet: 'pagina ' + r.data.lijst.pagina + ' van ' + r.data.lijst.paginas + ', ' + p2.length + ' routes, overlap ' + p2.filter((x) => p1.has(x)).length };
  });

  await stap('voltooibaar', 'zoeken op een pad vindt de routes van dat domein', async () => {
    const r = await lees({ zoek: '/api/arrival/' });
    const res = r.data.lijst.resultaten || [];
    return { klopt: r.status === 200 && res.length >= 4 && res.every((x) => x.pad.includes('/api/arrival/')),
      ziet: r.data.lijst.totaal + ' routes: ' + res.map((x) => x.pad).join(', ').slice(0, 120) };
  });

  await stap('voltooibaar', 'een route openen geeft al zijn cellen in een van de vijf staten, en elke cel die niet bewezen is, zegt waarom -- ook als geen register hem noemt', async () => {
    const r = await lees(ROUTE);
    const cellen = Object.entries((r.data.route && r.data.route.cellen) || {});
    const staten = ['bewezen', 'gezakt', 'nvt', 'verklaard', 'ongemeten'];
    const vreemd = cellen.filter(([, c]) => !staten.includes(c.staat));
    const zonder = cellen.filter(([, c]) => c.staat !== 'bewezen' && c.staat !== 'nvt' && !c.reden);
    return { klopt: r.status === 200 && r.data.gevonden === true && cellen.length === overzicht.schakels.length && vreemd.length === 0 && zonder.length === 0,
      ziet: cellen.length + ' cellen: ' + cellen.map(([k, c]) => k + '=' + c.staat + (c.staat !== 'bewezen' && c.staat !== 'nvt' && !c.reden ? '(ZONDER REDEN)' : '')).join(', ') };
  });

  await stap('voltooibaar', 'een route die niet bestaat, zegt dat hij niet gevonden is -- geen leeg dossier', async () => {
    const r = await lees({ methode: 'POST', pad: '/api/bestaat/niet' });
    return { klopt: r.status === 200 && r.data.gevonden === false && r.data.gevraagd === 'POST /api/bestaat/niet', ziet: JSON.stringify(r.data) };
  });

  await stap('bevoegd', 'een lid, een zaak en een vreemde komen er niet in, en horen dat het de kantoordeur is', async () => {
    const lid = await nieuwLid(w, 'rdl');
    const rooster = await w.post('/api/supplier/roster', { code: 'BRISA' });
    const man = ((rooster.data && rooster.data.staff) || []).find((x) => x.role === 'manager');
    const z = man ? (await w.post('/api/supplier/login', { code: 'BRISA', staffId: man.id, pin: '1234' })).data.token : null;
    const a = await lees({}, lid.token), b = await lees({}, z), c = await lees({}, null);
    const dicht = [a, b, c].every((x) => x.status === 401 && /backoffice/i.test(x.data.error) && !x.data.routes);
    return { klopt: !!z && dicht, ziet: 'lid ' + a.status + ', zaak ' + b.status + ', vreemde ' + c.status + ' (' + (a.data && a.data.error) + ')' };
  });

  /* ---------------- persistent ---------------- */
  const voor = kern((await lees({ schakel: 'INPUT', staat: 'bewezen' })).data);
  const voorRoute = JSON.stringify((await lees(ROUTE)).data);
  await w.herstart();

  await stap('persistent', 'na een nette herstart geeft hetzelfde filter hetzelfde antwoord', async () => {
    const na = kern((await lees({ schakel: 'INPUT', staat: 'bewezen' })).data);
    return { klopt: voor.length > 100 && na === voor, ziet: na === voor ? 'gelijk (' + na.length + ' tekens)' : 'ANDERS' };
  });

  await stap('persistent', 'een nieuwe kantoorsessie ziet hetzelfde dossier van dezelfde route', async () => {
    K = await kantoor(w);
    const na = JSON.stringify((await lees(ROUTE)).data);
    return { klopt: na === voorRoute, ziet: na === voorRoute ? 'gelijk' : 'ANDERS: ' + na.slice(0, 100) };
  });

  await stap('persistent', 'het dossier schrijft niets: de opslag krijgt er geen collectie bij, en het antwoord draagt geen sessiesleutel', async () => {
    const sleutels = () => w.opslag('store.db', 'SELECT key FROM kv WHERE deleted = 0').map((x) => x.key).sort();
    const voorSleutels = sleutels();
    const r = await lees({});
    const erbij = sleutels().filter((k) => !voorSleutels.includes(k));
    return { klopt: r.status === 200 && erbij.length === 0 && !JSON.stringify(r.data).includes(K),
      ziet: 'collecties erbij na het lezen: ' + (erbij.join(', ') || 'geen') + '; sessiesleutel in het antwoord: ' + (JSON.stringify(r.data).includes(K) ? 'JA' : 'nee') };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele vraag geeft twee keer hetzelfde antwoord', async () => {
    const [a, b] = await w.dubbel(DOSSIER, { schakel: 'INPUT', staat: 'bewezen' }, K);
    return { klopt: a.status === 200 && b.status === 200 && kern(a.data) === kern(b.data) && kern(a.data) === voor,
      ziet: 'antwoorden ' + a.status + '/' + b.status + (kern(a.data) === kern(b.data) ? ', gelijk' : ', VERSCHILLEND') };
  });

  await stap('herstelbaar', 'een afgebroken vraag en opnieuw: hetzelfde antwoord', async () => {
    const half = await w.afgebroken(DOSSIER, ROUTE, K);
    const opnieuw = await lees(ROUTE);
    return { klopt: opnieuw.status === 200 && JSON.stringify(opnieuw.data) === voorRoute,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status };
  });

  await stap('herstelbaar', 'na een crash geeft het dossier hetzelfde antwoord, en de deur blijft dicht voor een vreemde', async () => {
    await w.crash();
    K = await kantoor(w);
    const na = kern((await lees({ schakel: 'INPUT', staat: 'bewezen' })).data);
    const v = await lees({}, null);
    return { klopt: na === voor && geen5xx(v) && v.status === 401, ziet: (na === voor ? 'gelijk' : 'ANDERS') + ', vreemde ' + v.status };
  });
}

module.exports = {
  functie: 'link:routedossier',
  ingang: '/apps/routedossier.html',
  persona: 'kantoor',
  omgeving: KANTOORWERELD,
  belofte: 'een medewerker van het kantoor ziet per schakel hoeveel routes bewezen, gezakt of ongemeten zijn, filtert en bladert, en opent een route met al zijn cellen en hun bron -- achter de kantoordeur, en na een herstart of crash hetzelfde',
  grens: 'De proef loopt de route van het scherm, niet het scherm zelf. Het dossier leest de registers zoals ze in deze checkout staan; of die registers zelf vers en juist zijn, is het werk van hun eigen proeven. De kantoorsessie is de gedeelde kantoorcode van de testwereld. Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
