/* Automatische Capability Graph voor Magnaat.

   Deze scanner leest uitsluitend de lokale RTG-code. Hij voert geen route uit
   en opent geen datastore. Apps, API-deuren, functieflags en kantoorkamers
   worden samengebracht tot speelbare werkproces-families. Een codescan kan zo
   nieuwe mogelijkheden signaleren zonder productie te wijzigen. */

const path = require('path');
const crypto = require('crypto');
const { nu: klokNu } = require('../lib/klok');
const kantoorVan = require('./magnaat-kantoorregels');
const bronnen = require('./magnaat-capabilities-bronnen');

function menselijk(s) {
  return String(s || '').replace(/^\/+|\/+$/g, '').replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function risicoVan(route) {
  if (/bank|pay|betaal|krediet|rekening|paspoort|rtgid|auth|webauthn|verify|kluis|boardroom|techniek/i.test(route)) return 'rood';
  if (/member|staff|office|bericht|dm|chat|care|zorg|sollicit|personeel/i.test(route)) return 'geel';
  return 'groen';
}

function rolVan(bron, methode, kantoor, risico) {
  const zwaar = methode !== 'GET' || /maak|zet|wijzig|verwijder|beslis|bevestig|annuleer|nood|herstel|modus|instelling|publiceer|blokkeer|bevries|autoriseer/i.test(bron);
  if (kantoor.id === 'boardroom') return 'Boardroom-regisseur';
  if (risico === 'rood' || zwaar) return kantoor.naam + '-coördinator';
  return kantoor.naam + '-medewerker';
}

function controleId(soort, sleutel) {
  return soort + ':' + crypto.createHash('sha256').update(soort + '|' + sleutel).digest('hex').slice(0, 18);
}

function workflowFamilie(route) {
  const delen = String(route).split('/').filter(Boolean);
  return '/' + delen.slice(0, Math.min(3, delen.length)).join('/');
}

function besteApp(familie, apps) {
  const woorden = familie.split('/').filter(x => x && x !== 'api' && !['member', 'office', 'supplier', 'staff'].includes(x));
  let beste = null, score = 0;
  for (const app of apps) {
    const bron = (app.pad + ' ' + app.naam).toLowerCase();
    const s = woorden.reduce((n, w) => n + (bron.includes(w) ? 1 : 0), 0);
    if (s > score) { score = s; beste = app; }
  }
  return score ? { pad: beste.pad, naam: beste.naam } : { pad: '/apps/app.html', naam: 'RTG OS' };
}

module.exports = ({
  root = path.resolve(__dirname, '../..'), functies,
  volledigeWerkprocessen = [], werkrouteFabriek = null
}) => {
  function scan() {
    const bron = bronnen.scan(root);
    const apps = bron.apps;
    const endpoints = bron.endpoints;
    const kantoren = bronnen.leesKantoren(root, functies);
    const flags = Array.isArray(functies && functies.FUNCTIES) ? functies.FUNCTIES : [];
    const prefixen = flags.flatMap(f => (f.paden || []).map(p => ({ id: f.id, pad: p })));
    const groepen = new Map();

    for (const endpoint of endpoints) {
      const familie = workflowFamilie(endpoint.route);
      if (!groepen.has(familie)) groepen.set(familie, []);
      groepen.get(familie).push(endpoint);
    }

    /* Bouw eerst de feitelijke procesbronnen. De optionele fabriek krijgt exact
       die ontdekte bronnen en mag daar volledige synthetische werkdossiers van
       maken. Alleen structureel valide routes tellen daarna als matrixbewijs. */
    const workflowBronnen = [...groepen.entries()].map(([familie, acties]) => {
      const gekoppeld = flags.filter(f => (f.paden || []).some(p => acties.some(a => a.route.startsWith(p))));
      const kantoor = kantoorVan(familie);
      const risico = risicoVan(familie);
      const rol = rolVan(familie, acties.some(a => a.methode !== 'GET') ? 'POST' : 'GET', kantoor, risico);
      return {
        id: 'code:' + familie.replace(/^\/api\//, '').replace(/\//g, ':'),
        naam: menselijk(familie.replace(/^\/api\//, '')),
        familie, domein: familie.split('/')[2] || 'platform', kantoor, rol,
        risico, geregistreerd: gekoppeld.length > 0,
        functieIds: gekoppeld.map(f => f.id), app: besteApp(familie, apps),
        acties: acties.map(a => ({ methode: a.methode, route: a.route })),
        actieAantal: acties.length,
        spelstappen: ['Dossier aannemen', 'Brongegevens controleren', 'Actie in trainingskopie uitvoeren', 'Resultaat dubbel controleren', 'Overdracht en afsluiting vastleggen']
      };
    });
    const automatischeWerkprocessen = typeof werkrouteFabriek === 'function'
      ? werkrouteFabriek(workflowBronnen).filter(w => w && typeof w.id === 'string' &&
        Array.isArray(w.codeFamilies) && w.codeFamilies.length > 0 &&
        Array.isArray(w.stappen) && w.stappen.length >= 5 &&
        w.stappen[0] && w.stappen[0].soort === 'software' &&
        /^\/apps\/[^?#]+\.html$/.test(w.stappen[0].schermPad || ''))
      : [];
    const matrix = require('./magnaat-dekkingsmatrix')({
      root, flags, volledigeWerkprocessen: volledigeWerkprocessen.concat(automatischeWerkprocessen)
    });
    const workflows = workflowBronnen.map(w => {
      const koppeling = matrix.werkproces(
        { familie: w.familie },
        w.acties.map(a => Object.assign({ familie: w.familie }, a)),
        w.kantoor, w.rol, w.geregistreerd
      );
      return Object.assign({}, w, {
        bronstand: koppeling.bronstand,
        signalen: koppeling.signalen,
        dekking: koppeling.dekking
      });
    }).sort((a, b) => b.actieAantal - a.actieAantal || a.naam.localeCompare(b.naam));

    const domeinen = {};
    for (const endpoint of endpoints) {
      const domein = endpoint.route.split('/')[2] || 'platform';
      domeinen[domein] = (domeinen[domein] || 0) + 1;
    }
    const ongedekt = endpoints.filter(e => !prefixen.some(p => e.route.startsWith(p.pad)));
    const apiPunten = endpoints.map(e => {
      const kantoor = kantoorVan(e.route);
      const risico = risicoVan(e.route);
      const rol = rolVan(e.route, e.methode, kantoor, risico);
      const familie = workflowFamilie(e.route);
      const koppeling = matrix.api(Object.assign({ familie }, e), kantoor, rol);
      return {
        id: controleId('api', e.sleutel), soort: 'api', sleutel: e.sleutel,
        naam: e.methode + ' · ' + menselijk(e.route.replace(/^\/api\//, '')),
        route: e.route, methode: e.methode, bestand: e.bestand, toegang: e.toegang,
        familie, kantoor, rol, risico, bronstand: koppeling.bronstand,
        signalen: koppeling.signalen,
        functieIds: koppeling.functieIds, dekking: koppeling.dekking
      };
    });
    const schermPunten = apps.map(a => {
      const kantoor = kantoorVan(a.pad);
      const risico = risicoVan(a.pad);
      const rol = rolVan(a.pad, 'GET', kantoor, risico);
      const koppeling = matrix.scherm({ route: a.pad, sleutel: a.pad, bestand: a.bestand }, kantoor, rol);
      return {
        id: controleId('scherm', a.pad), soort: 'scherm', sleutel: a.pad,
        naam: a.naam, route: a.pad, methode: null, bestand: a.bestand,
        toegang: /kantoor|office|boardroom|techniek|personeel/i.test(a.pad) ? 'office' : 'member',
        familie: a.pad, kantoor, rol, risico, bronstand: koppeling.bronstand,
        signalen: koppeling.signalen,
        functieIds: koppeling.functieIds, dekking: koppeling.dekking
      };
    });
    const functiePunten = flags.map(f => {
      const bron = [f.id, f.naam, f.categorie, ...(f.paden || [])].join(' ');
      const kantoor = kantoorVan(bron);
      const risico = risicoVan(bron);
      const rol = rolVan(bron, 'POST', kantoor, risico);
      const basis = { sleutel: f.id, route: (f.paden || [])[0] || null, bestand: 'server/functies.js' };
      const koppeling = matrix.functie(basis, kantoor, rol);
      return {
        id: controleId('functie', f.id), soort: 'functie', sleutel: f.id,
        naam: f.naam, route: (f.paden || [])[0] || null, methode: null,
        bestand: 'server/functies.js', toegang: 'member', familie: f.categorie,
        kantoor, rol, risico, bronstand: koppeling.bronstand,
        signalen: koppeling.signalen,
        functieIds: koppeling.functieIds, dekking: koppeling.dekking
      };
    });
    const workflowPunten = workflows.map(w => ({
      id: controleId('werkproces', w.id), soort: 'werkproces', sleutel: w.id,
      naam: w.naam, route: w.familie, methode: null, bestand: null,
      toegang: w.acties.some(a => /office/.test(a.route)) ? 'office' : 'member',
      familie: w.familie, kantoor: Object.assign({}, w.kantoor), rol: w.rol, risico: w.risico,
      bronstand: w.bronstand, signalen: Object.assign({}, w.signalen),
      functieIds: w.functieIds.slice(), dekking: w.dekking
    }));
    const controlepunten = apiPunten.concat(schermPunten, functiePunten, workflowPunten)
      .sort((a, b) => a.kantoor.naam.localeCompare(b.kantoor.naam) || a.naam.localeCompare(b.naam));
    const dekkingsmatrix = matrix.samenvat(controlepunten);
    const vingerafdruk = crypto.createHash('sha256').update(JSON.stringify({
      apps: apps.map(a => a.pad), endpoints: endpoints.map(e => e.sleutel),
      kantoren: kantoren.map(k => k.id), flags: flags.map(f => f.id)
    })).digest('hex');

    return {
      versie: 2, gescand: klokNu(), vingerafdruk,
      cijfers: {
        functieFlags: flags.length, functiePrefixen: prefixen.length,
        apps: apps.length, apiActies: endpoints.length, kantoren: kantoren.length,
        werkprocessen: workflows.length, automatischeWerkprocessen: automatischeWerkprocessen.length,
        ongedekteApiActies: ongedekt.length,
        controlepunten: controlepunten.length, volledigGekoppeld: dekkingsmatrix.volledig,
        dekkingsgaten: dekkingsmatrix.metGaten, dekkingspercentage: dekkingsmatrix.percentage
      },
      motor: bron.motor,
      apps, endpoints, kantoren, workflows, automatischeWerkprocessen,
      controlepunten, dekkingsmatrix,
      domeinen: Object.entries(domeinen).map(([id, aantal]) => ({ id, aantal })).sort((a, b) => b.aantal - a.aantal),
      ongedekt: ongedekt.map(e => e.sleutel)
    };
  }

  return { scan };
};
