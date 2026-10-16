/* VOLTOOIPROEF: RTG WERK OS (link:werkos, /apps/werk.html).

   De proef gebruikt de echte werkruimtedeur: een organisatie wordt gemaakt,
   een medewerker meldt zich aan, een beheerder laat hem toe en geeft hem de
   bestaande projectleidersrol. Daarna loopt alle werk via zijn lid-token.
   Geen route krijgt een testuitzondering en de tokens worden niet uit de
   opslag gelezen; alleen het resultaat wordt buiten de server om gecontroleerd. */
'use strict';

const MAAK = '/api/bedrijf/werkruimte/maak';
const AANMELD = '/api/bedrijf/lid/aanmeld';
const BESLUIT = '/api/bedrijf/lid/besluit';
const ROLLEN = '/api/bedrijf/lid/rollen';
const START = '/api/bedrijf/start';
const TAAK = '/api/bedrijf/taak/maak';
const TAKEN = '/api/bedrijf/taken';

const idem = (naam) => ('werkos-voltooi-' + naam + '-0000000000000000').slice(0, 80);
const lijf = (s, extra) => Object.assign({ werkruimte: s.werkruimte, lidToken: s.lidToken }, extra || {});

function taken(r) { return r && r.data && Array.isArray(r.data.taken) ? r.data.taken : []; }
function telTitel(r, titel) { return taken(r).filter((t) => t.titel === titel).length; }
function opgeslagen(w, code) {
  const boek = w.collectie('werkruimtes') || {};
  return boek[code] || null;
}

async function loop(w, stap) {
  const sessie = {};
  let beheerToken = null;
  const hoofdTitel = 'Voltooiproef veilig werk';

  await stap('voltooibaar', 'een organisatie opent een werkruimte en krijgt het beheer-token precies een keer', async () => {
    const r = await w.post(MAAK, { naam: 'Voltooiproef WorkOS', idem: idem('ruimte') });
    sessie.werkruimte = r.data && r.data.werkruimte;
    beheerToken = r.data && r.data.beheerToken;
    return { klopt: r.status === 200 && /^W[A-Z0-9]+$/.test(sessie.werkruimte || '') && !!beheerToken,
      ziet: 'status ' + r.status + ', werkruimte ' + (sessie.werkruimte || 'afwezig') };
  });

  await stap('voltooibaar', 'een medewerker meldt zich aan, wordt door beheer toegelaten en krijgt projectrecht', async () => {
    const a = await w.post(AANMELD, { werkruimte: sessie.werkruimte, naam: 'Werkproef', functie: 'projectleider' });
    sessie.lidToken = a.data && a.data.lidToken;
    const lidId = a.data && a.data.lidId;
    const b = await w.post(BESLUIT, { werkruimte: sessie.werkruimte, beheerToken, lidId, akkoord: true });
    const r = await w.post(ROLLEN, { werkruimte: sessie.werkruimte, beheerToken, lidId,
      rollen: ['projectleider'], reden: 'Voltooiproef van de bestaande WorkOS-deur' });
    return { klopt: a.status === 200 && a.data.status === 'wacht' && !!sessie.lidToken &&
      b.status === 200 && b.data.lid.status === 'actief' && r.status === 200 && r.data.lid.rechten.includes('project'),
      ziet: 'aanmelden ' + a.status + ', toelaten ' + b.status + ', rol ' + r.status };
  });

  await stap('voltooibaar', 'de medewerker opent zijn rolgebonden startscherm', async () => {
    const r = await w.post(START, lijf(sessie));
    return { klopt: r.status === 200 && r.data.wie.naam === 'Werkproef' && r.data.wie.rollen.includes('projectleider') &&
      r.data.snelleActies.some((a) => a.pad === TAAK),
      ziet: 'status ' + r.status + ', rol ' + (r.data && r.data.wie && r.data.wie.rollen.join(',')) };
  });

  await stap('voltooibaar', 'de medewerker maakt een taak en ziet haar terug in dezelfde werkruimte', async () => {
    const r = await w.post(TAAK, lijf(sessie, { titel: hoofdTitel, prioriteit: 'hoog', idem: idem('hoofd') }));
    const l = await w.post(TAKEN, lijf(sessie));
    return { klopt: r.status === 200 && l.status === 200 && telTitel(l, hoofdTitel) === 1,
      ziet: 'maken ' + r.status + ', lijst bevat ' + telTitel(l, hoofdTitel) };
  });

  await w.herstart();
  await stap('persistent', 'na een nette herstart blijft het lid-token bij exact dezelfde werkruimte horen', async () => {
    const r = await w.post(START, lijf(sessie));
    return { klopt: r.status === 200 && r.data.werkruimte.code === sessie.werkruimte && r.data.wie.naam === 'Werkproef',
      ziet: 'status ' + r.status + ', werkruimte ' + (r.data && r.data.werkruimte && r.data.werkruimte.code) };
  });
  await stap('persistent', 'na de herstart staat de taak nog precies een keer in de API', async () => {
    const r = await w.post(TAKEN, lijf(sessie));
    return { klopt: r.status === 200 && telTitel(r, hoofdTitel) === 1,
      ziet: 'status ' + r.status + ', aantal ' + telTitel(r, hoofdTitel) };
  });
  await stap('persistent', 'een read-only lezer vindt dezelfde taak in de werkruimteopslag', async () => {
    const ruimte = opgeslagen(w, sessie.werkruimte);
    const rijen = ruimte && Object.values(ruimte.taken || {}).filter((t) => t.titel === hoofdTitel);
    return { klopt: !!ruimte && rijen.length === 1 && !JSON.stringify(ruimte).includes(sessie.lidToken),
      ziet: 'opslag bevat ' + (rijen ? rijen.length : 0) + ' taak en geen rauw lid-token' };
  });

  await stap('herstelbaar', 'een dubbele tik met dezelfde herhaalsleutel maakt geen tweede taak', async () => {
    const sleutel = idem('dubbel');
    const body = lijf(sessie, { titel: 'Een dubbele tik', idem: sleutel });
    const a = await w.post(TAAK, body);
    const b = await w.post(TAAK, body);
    const l = await w.post(TAKEN, lijf(sessie));
    return { klopt: a.status === 200 && b.status === 200 && b.data.herhaald === true &&
      a.data.taak.id === b.data.taak.id && telTitel(l, 'Een dubbele tik') === 1,
      ziet: 'eerste ' + a.status + ', herhaling ' + b.status + ', aantal ' + telTitel(l, 'Een dubbele tik') };
  });

  await stap('herstelbaar', 'een afgebroken verzoek kan met dezelfde sleutel veilig worden hervat', async () => {
    const sleutel = idem('afgebroken');
    const body = lijf(sessie, { titel: 'Afgebroken werk hervat', idem: sleutel });
    const half = await w.afgebroken(TAAK, body);
    const opnieuw = await w.post(TAAK, body);
    const l = await w.post(TAKEN, lijf(sessie));
    return { klopt: opnieuw.status === 200 && telTitel(l, 'Afgebroken werk hervat') === 1,
      ziet: 'afgebroken ' + (half.afgebroken ? 'door client' : 'status ' + half.status) +
        ', opnieuw ' + opnieuw.status + ', aantal ' + telTitel(l, 'Afgebroken werk hervat') };
  });

  await stap('herstelbaar', 'een crash direct na taakbevestiging verliest of verdubbelt de taak niet', async () => {
    const r = await w.post(TAAK, lijf(sessie, { titel: 'Werk na stroomstoring', idem: idem('crash') }));
    await w.crash();
    const opnieuw = await w.post(TAAK, lijf(sessie, { titel: 'Werk na stroomstoring', idem: idem('crash') }));
    const l = await w.post(TAKEN, lijf(sessie));
    return { klopt: r.status === 200 && opnieuw.status === 200 && opnieuw.data.herhaald === true &&
      telTitel(l, 'Werk na stroomstoring') === 1,
      ziet: 'bevestigd ' + r.status + ', na SIGKILL herhaald=' + (opnieuw.data && opnieuw.data.herhaald) +
        ', aantal ' + telTitel(l, 'Werk na stroomstoring') };
  });
}

module.exports = {
  functie: 'link:werkos',
  ingang: '/apps/werk.html',
  persona: 'werkruimtelid',
  belofte: 'een toegelaten medewerker opent zijn eigen WorkOS-werkruimte, maakt werk aan en vindt dat na een herstart, netwerkherhaling en crash precies een keer terug',
  grens: 'De proef loopt de bestaande WorkOS-routes en opslag, niet de browserpresentatie. Hij meet één projecttaak en niet alle bedrijfsmodules; PostgreSQL-, Redis- en multi-instance-uitval blijven buiten deze lokale testwereld.',
  loop
};
