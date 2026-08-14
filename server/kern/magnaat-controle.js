/* Magnaat Codecontrole.

   Iedere door de Capability Graph gevonden API-actie, app-pagina,
   functievlag en werkproces wordt automatisch een controlepunt. De toestand
   hieronder is uitsluitend een override voor de Magnaat-trainingswereld. Een
   schakelaar kan dus gameplay en oefentaken stilzetten, maar nooit ongemerkt
   een productie-endpoint van RTG uitschakelen.

   Rechten:
   - medewerker: zien en toegewezen testtaken uitvoeren;
   - coördinator/regisseur: eigen groen/gele punten en taken beheren;
   - boardroom: alle kamers, rode punten en herindeling beheren. */

const VERSIE = 1;
const STATUSSEN = ['operationeel', 'aandacht', 'onderhoud', 'gestopt'];
const TESTSTATUSSEN = ['niet-getest', 'bezig', 'geslaagd', 'mislukt'];
const TAAKSTATUSSEN = ['open', 'bezig', 'geblokkeerd', 'klaar'];

const klok = require('../lib/klok');

module.exports = ({ wereldState, getGraph, save = () => {}, crypto, nu = klok.nu }) => {
  if (typeof wereldState !== 'function' || typeof getGraph !== 'function') throw new Error('Magnaat Codecontrole mist de wereld of Capability Graph.');

  const schoon = (v, max = 240) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max);
  const nieuwId = voor => voor + '-' + crypto.randomBytes(6).toString('hex');

  function state() {
    const wereld = wereldState();
    if (!wereld.controle || wereld.controle.versie !== VERSIE) {
      wereld.controle = { versie: VERSIE, overrides: {}, taken: [], audit: [] };
    }
    const s = wereld.controle;
    if (!s.overrides || typeof s.overrides !== 'object') s.overrides = {};
    if (!Array.isArray(s.taken)) s.taken = [];
    if (!Array.isArray(s.audit)) s.audit = [];
    return s;
  }

  function graph() {
    const g = getGraph();
    return g && Array.isArray(g.controlepunten) ? g : { controlepunten: [], kantoren: [], cijfers: {} };
  }

  function rolNiveau(rol, boardroom) {
    if (boardroom) return 3;
    if (/coördinator|coordinator|regisseur|manager/i.test(String(rol || ''))) return 2;
    if (/trainee/i.test(String(rol || ''))) return 0;
    return rol ? 1 : 0;
  }

  function actorContext(ctx) {
    return {
      key: schoon(ctx && ctx.key, 100) || 'onbekend',
      boardroom: !!(ctx && ctx.boardroom),
      kantoorId: schoon(ctx && ctx.kantoorId, 80),
      rol: schoon(ctx && ctx.rol, 100),
      niveau: rolNiveau(ctx && ctx.rol, ctx && ctx.boardroom)
    };
  }

  function kantoorOpId(id) {
    return graph().kantoren.find(k => k.id === id) || null;
  }

  function rollenVoor(kantoor, puntRol) {
    if (!kantoor) return [];
    return [...new Set([
      kantoor.naam + '-medewerker', kantoor.naam + '-coördinator', 'Trainee',
      puntRol
    ].filter(Boolean))];
  }

  function puntRuw(id) {
    return graph().controlepunten.find(p => p.id === schoon(id, 80)) || null;
  }

  function puntMetOverride(bron) {
    if (!bron) return null;
    const o = state().overrides[bron.id] || {};
    const kantoor = kantoorOpId(o.kantoorId) || bron.kantoor;
    return Object.assign({}, bron, {
      kantoor: Object.assign({}, kantoor),
      rol: schoon(o.rol, 100) || bron.rol,
      aan: o.aan !== false,
      status: STATUSSEN.includes(o.status) ? o.status : 'operationeel',
      teststatus: TESTSTATUSSEN.includes(o.teststatus) ? o.teststatus : 'niet-getest',
      laatsteCheck: o.laatsteCheck || null,
      bijgewerkt: o.bijgewerkt || null,
      productieGewijzigd: false
    });
  }

  function zelfdeKantoor(ctx, punt) {
    return !!(ctx.kantoorId && punt.kantoor && ctx.kantoorId === punt.kantoor.id);
  }

  function rechtenVoor(ctx, punt) {
    ctx = actorContext(ctx);
    const eigen = zelfdeKantoor(ctx, punt);
    const rood = punt.risico === 'rood';
    return {
      magZien: ctx.boardroom || eigen,
      magUitvoeren: ctx.boardroom || (eigen && ctx.niveau >= 1 && punt.aan),
      magWijzigen: ctx.boardroom || (eigen && ctx.niveau >= 2 && !rood),
      magTakenMaken: ctx.boardroom || (eigen && ctx.niveau >= 2),
      magHerindelen: ctx.boardroom,
      reden: rood && !ctx.boardroom ? 'Rode controlepunten vragen een boardroom-besluit.'
        : !eigen && !ctx.boardroom ? 'Dit controlepunt hoort bij een ander kantoor.'
          : ctx.niveau < 1 ? 'Een trainee kan kijken maar niet zelfstandig uitvoeren.' : ''
    };
  }

  function audit(actor, actie, detail, puntId, taakId) {
    const s = state();
    s.audit.unshift({ id: nieuwId('ctl-log'), actor: schoon(actor, 100), actie: schoon(actie, 60), detail: schoon(detail, 400), puntId: puntId || null, taakId: taakId || null, at: nu() });
    if (s.audit.length > 500) s.audit.length = 500;
  }

  function taakAantallen() {
    const uit = {};
    for (const t of state().taken) {
      if (!uit[t.puntId]) uit[t.puntId] = { open: 0, totaal: 0 };
      uit[t.puntId].totaal += 1;
      if (t.status !== 'klaar') uit[t.puntId].open += 1;
    }
    return uit;
  }

  function publiekPunt(ctx, bron, aantallen) {
    const p = puntMetOverride(bron);
    const taken = aantallen[p.id] || { open: 0, totaal: 0 };
    return {
      id: p.id, soort: p.soort, sleutel: p.sleutel, naam: p.naam,
      route: p.route, methode: p.methode, bestand: p.bestand,
      toegang: p.toegang, familie: p.familie, kantoor: p.kantoor,
      rol: p.rol, risico: p.risico, aan: p.aan, status: p.status,
      teststatus: p.teststatus, laatsteCheck: p.laatsteCheck,
      bijgewerkt: p.bijgewerkt, productieGewijzigd: false,
      taken, rechten: rechtenVoor(ctx, p)
    };
  }

  function publiekTaak(t) {
    const punt = puntMetOverride(puntRuw(t.puntId));
    return {
      id: t.id, puntId: t.puntId, titel: t.titel, omschrijving: t.omschrijving,
      kantoor: punt ? punt.kantoor : { id: t.kantoorId, naam: t.kantoorNaam },
      punt: punt ? { naam: punt.naam, soort: punt.soort, route: punt.route, risico: punt.risico } : null,
      toegewezenRol: t.toegewezenRol, prioriteit: t.prioriteit, status: t.status,
      bewijs: t.bewijs || '', gemaaktDoor: t.gemaaktDoor, gemaakt: t.gemaakt,
      bijgewerkt: t.bijgewerkt, afgerond: t.afgerond || null
    };
  }

  function zichtbareTaken(ctx, kantoorId) {
    ctx = actorContext(ctx);
    const coordinator = ctx.niveau >= 2;
    return state().taken.filter(t => {
      const punt = puntMetOverride(puntRuw(t.puntId));
      if (!punt) return false;
      if (kantoorId && punt.kantoor.id !== kantoorId) return false;
      if (ctx.boardroom) return true;
      if (punt.kantoor.id !== ctx.kantoorId) return false;
      return coordinator || t.toegewezenRol === ctx.rol || t.toegewezenRol === 'Iedereen';
    }).map(publiekTaak);
  }

  function samenvatting(punten) {
    const uit = { totaal: punten.length, aan: 0, uit: 0, operationeel: 0, aandacht: 0, onderhoud: 0, gestopt: 0, getest: 0, rood: 0 };
    for (const p of punten) {
      p.aan ? uit.aan += 1 : uit.uit += 1;
      if (uit[p.status] !== undefined) uit[p.status] += 1;
      if (p.teststatus === 'geslaagd') uit.getest += 1;
      if (p.risico === 'rood') uit.rood += 1;
    }
    uit.dekkingPct = punten.length ? 100 : 0;
    uit.testPct = punten.length ? Math.round(uit.getest / punten.length * 1000) / 10 : 0;
    return uit;
  }

  function kantoorSamenvattingen(ctx, alle, aantallen) {
    const per = new Map();
    for (const bron of alle) {
      const p = publiekPunt(ctx, bron, aantallen);
      if (!per.has(p.kantoor.id)) per.set(p.kantoor.id, { kantoor: p.kantoor, punten: [] });
      per.get(p.kantoor.id).punten.push(p);
    }
    return [...per.values()].map(x => Object.assign({ kantoor: x.kantoor }, samenvatting(x.punten)))
      .sort((a, b) => b.totaal - a.totaal || a.kantoor.naam.localeCompare(b.kantoor.naam));
  }

  function overzicht(context, filters = {}) {
    const ctx = actorContext(context);
    const g = graph();
    const aantallen = taakAantallen();
    const gekozenKantoor = ctx.boardroom ? schoon(filters.kantoorId, 80) : ctx.kantoorId;
    const zoek = schoon(filters.zoek, 100).toLowerCase();
    const soort = ['api', 'scherm', 'functie', 'werkproces'].includes(filters.soort) ? filters.soort : '';
    const status = STATUSSEN.includes(filters.status) ? filters.status : '';
    const pagina = Math.max(1, Math.floor(Number(filters.pagina) || 1));
    const limiet = Math.min(100, Math.max(10, Math.floor(Number(filters.limiet) || 40)));
    // Gebruik de actuele kantoorindeling. Een door de boardroom verplaatst punt
    // verdwijnt daarmee ook echt uit het oude kantooroverzicht.
    const zichtbaarBron = g.controlepunten.filter(p => ctx.boardroom || puntMetOverride(p).kantoor.id === ctx.kantoorId);
    const allePubliek = zichtbaarBron.map(p => publiekPunt(ctx, p, aantallen));
    const gefilterd = allePubliek.filter(p => {
      if (gekozenKantoor && p.kantoor.id !== gekozenKantoor) return false;
      if (soort && p.soort !== soort) return false;
      if (status && p.status !== status) return false;
      if (zoek && ![p.naam, p.sleutel, p.route, p.bestand, p.rol].join(' ').toLowerCase().includes(zoek)) return false;
      return true;
    });
    const start = (pagina - 1) * limiet;
    const kantoorVoorRollen = kantoorOpId(gekozenKantoor || ctx.kantoorId);
    return {
      ok: true, versie: VERSIE,
      omgeving: 'Magnaat-trainingscontrole; productie blijft ongewijzigd',
      codeVingerafdruk: g.vingerafdruk ? g.vingerafdruk.slice(0, 12) : null,
      actor: { boardroom: ctx.boardroom, kantoorId: ctx.kantoorId || null, rol: ctx.rol || null, niveau: ctx.niveau },
      rechten: {
        magWijzigen: ctx.boardroom || ctx.niveau >= 2,
        magTakenMaken: ctx.boardroom || ctx.niveau >= 2,
        magHerindelen: ctx.boardroom,
        roodAlleenBoardroom: true
      },
      dekking: {
        totaal: g.controlepunten.length,
        api: g.controlepunten.filter(p => p.soort === 'api').length,
        schermen: g.controlepunten.filter(p => p.soort === 'scherm').length,
        functies: g.controlepunten.filter(p => p.soort === 'functie').length,
        werkprocessen: g.controlepunten.filter(p => p.soort === 'werkproces').length,
        gekoppeld: g.controlepunten.length, percentage: g.controlepunten.length ? 100 : 0
      },
      samenvatting: samenvatting(allePubliek),
      kantoren: kantoorSamenvattingen(ctx, g.controlepunten, aantallen),
      rollen: rollenVoor(kantoorVoorRollen, null),
      filters: { kantoorId: gekozenKantoor || '', zoek, soort, status, pagina, limiet },
      paginering: { pagina, limiet, totaal: gefilterd.length, paginas: Math.max(1, Math.ceil(gefilterd.length / limiet)) },
      punten: gefilterd.slice(start, start + limiet),
      taken: zichtbareTaken(ctx, gekozenKantoor).slice(0, 120),
      audit: (ctx.boardroom ? state().audit : state().audit.filter(a => {
        const punt = puntMetOverride(puntRuw(a.puntId));
        return punt && punt.kantoor.id === ctx.kantoorId;
      })).slice(0, 80)
    };
  }

  function zet(context, puntId, wijziging = {}) {
    const ctx = actorContext(context);
    const bron = puntRuw(puntId);
    if (!bron) return { status: 404, error: 'Dit codecontrolepunt bestaat niet meer in de actuele scan.' };
    let punt = puntMetOverride(bron);
    const rechten = rechtenVoor(ctx, punt);
    const wilHerindelen = wijziging.kantoorId !== undefined || wijziging.rol !== undefined;
    if (wilHerindelen && !rechten.magHerindelen) return { status: 403, error: 'Alleen de boardroom mag een codepunt naar een ander kantoor of rol verplaatsen.' };
    if (!wilHerindelen && !rechten.magWijzigen) return { status: 403, error: rechten.reden || 'Deze rol mag dit controlepunt niet wijzigen.' };
    const s = state();
    const o = s.overrides[bron.id] || {};
    const wijzigingen = [];
    if (wijziging.kantoorId !== undefined) {
      const kantoor = kantoorOpId(schoon(wijziging.kantoorId, 80));
      if (!kantoor) return { status: 400, error: 'Kies een kantoor uit de actuele RTG-kantoorstructuur.' };
      o.kantoorId = kantoor.id;
      if (wijziging.rol === undefined) o.rol = kantoor.naam + '-coördinator';
      wijzigingen.push('kantoor ' + kantoor.naam);
      punt = Object.assign({}, punt, { kantoor });
    }
    if (wijziging.rol !== undefined) {
      const rol = schoon(wijziging.rol, 100);
      if (!rol) return { status: 400, error: 'Een verantwoordelijke rol is verplicht.' };
      o.rol = rol;
      wijzigingen.push('rol ' + rol);
    }
    if (wijziging.aan !== undefined) {
      if (typeof wijziging.aan !== 'boolean') return { status: 400, error: 'De schakelstand moet aan of uit zijn.' };
      o.aan = wijziging.aan;
      if (!wijziging.aan) o.status = 'gestopt';
      else if (o.status === 'gestopt') o.status = 'operationeel';
      wijzigingen.push(wijziging.aan ? 'sandbox aan' : 'sandbox uit');
    }
    if (wijziging.status !== undefined) {
      const status = schoon(wijziging.status, 30);
      if (!STATUSSEN.includes(status)) return { status: 400, error: 'Onbekende controlestatus.' };
      o.status = status;
      if (status === 'gestopt') o.aan = false;
      wijzigingen.push('status ' + status);
    }
    if (wijziging.teststatus !== undefined) {
      const teststatus = schoon(wijziging.teststatus, 30);
      if (!TESTSTATUSSEN.includes(teststatus)) return { status: 400, error: 'Onbekende teststatus.' };
      o.teststatus = teststatus;
      o.laatsteCheck = nu();
      wijzigingen.push('test ' + teststatus);
    }
    if (!wijzigingen.length) return { status: 400, error: 'Geef een status-, schakel-, test- of rolwijziging door.' };
    o.bijgewerkt = nu();
    o.door = ctx.key;
    s.overrides[bron.id] = o;
    audit(ctx.key, 'controlepunt-gewijzigd', punt.naam + ' · ' + wijzigingen.join(' · '), bron.id, null);
    save();
    return { ok: true, punt: publiekPunt(ctx, bron, taakAantallen()), waarschuwing: 'Alleen de Magnaat-trainingsstand is gewijzigd; productie bleef ongewijzigd.' };
  }

  function taakMaak(context, puntId, invoer = {}) {
    const ctx = actorContext(context);
    const punt = puntMetOverride(puntRuw(puntId));
    if (!punt) return { status: 404, error: 'Dit codecontrolepunt bestaat niet.' };
    const rechten = rechtenVoor(ctx, punt);
    if (!rechten.magTakenMaken) return { status: 403, error: rechten.reden || 'Alleen de coördinator van dit kantoor kan taken maken.' };
    const prioriteit = ['laag', 'normaal', 'hoog', 'kritiek'].includes(invoer.prioriteit) ? invoer.prioriteit : 'normaal';
    const toegestaan = rollenVoor(punt.kantoor, punt.rol).concat('Iedereen');
    const toegewezenRol = schoon(invoer.toegewezenRol, 100) || punt.rol;
    if (!toegestaan.includes(toegewezenRol) && !ctx.boardroom) return { status: 400, error: 'Wijs de taak toe aan een rol uit dit kantoor.' };
    const taak = {
      id: nieuwId('ctl-taak'), puntId: punt.id,
      titel: schoon(invoer.titel, 160) || 'Controleer · ' + punt.naam,
      omschrijving: schoon(invoer.omschrijving, 500) || 'Voer een synthetische werking-, grens- en overdrachtstest uit. Leg bewijs vast zonder productiegegevens.',
      kantoorId: punt.kantoor.id, kantoorNaam: punt.kantoor.naam,
      toegewezenRol, prioriteit, status: 'open', bewijs: '',
      gemaaktDoor: ctx.key, gemaakt: nu(), bijgewerkt: nu(), afgerond: null
    };
    state().taken.unshift(taak);
    if (state().taken.length > 2000) state().taken.length = 2000;
    const o = state().overrides[punt.id] || {};
    o.teststatus = 'bezig'; o.bijgewerkt = nu();
    state().overrides[punt.id] = o;
    audit(ctx.key, 'testtaak-gemaakt', taak.titel + ' → ' + toegewezenRol, punt.id, taak.id);
    save();
    return { ok: true, taak: publiekTaak(taak) };
  }

  function taakZet(context, taakId, status, bewijs) {
    const ctx = actorContext(context);
    const taak = state().taken.find(t => t.id === schoon(taakId, 100));
    if (!taak) return { status: 404, error: 'Deze controletaak bestaat niet.' };
    const punt = puntMetOverride(puntRuw(taak.puntId));
    if (!punt) return { status: 409, error: 'Het gekoppelde codepunt staat niet meer in de scan.' };
    const eigenRol = taak.toegewezenRol === ctx.rol || taak.toegewezenRol === 'Iedereen';
    const mag = ctx.boardroom || (zelfdeKantoor(ctx, punt) && (ctx.niveau >= 2 || eigenRol));
    if (!mag) return { status: 403, error: 'Deze taak is niet aan uw kantoorrol toegewezen.' };
    status = schoon(status, 30);
    if (!TAAKSTATUSSEN.includes(status)) return { status: 400, error: 'Onbekende taakstatus.' };
    bewijs = schoon(bewijs, 600);
    if (status === 'klaar' && bewijs.length < 8) return { status: 400, error: 'Leg kort testbewijs vast voordat de taak wordt afgerond.' };
    taak.status = status;
    taak.bewijs = bewijs || taak.bewijs;
    taak.bijgewerkt = nu();
    taak.afgerond = status === 'klaar' ? nu() : null;
    const o = state().overrides[punt.id] || {};
    if (status === 'klaar') { o.teststatus = 'geslaagd'; o.laatsteCheck = nu(); }
    else if (status === 'geblokkeerd') { o.teststatus = 'mislukt'; o.laatsteCheck = nu(); o.status = 'aandacht'; }
    else o.teststatus = 'bezig';
    o.bijgewerkt = nu();
    state().overrides[punt.id] = o;
    audit(ctx.key, 'testtaak-' + status, taak.titel + (bewijs ? ' · ' + bewijs : ''), punt.id, taak.id);
    save();
    return { ok: true, taak: publiekTaak(taak), punt: publiekPunt(ctx, puntRuw(punt.id), taakAantallen()) };
  }

  function zelftest(context, puntId) {
    const ctx = actorContext(context);
    const bron = puntRuw(puntId);
    const punt = puntMetOverride(bron);
    if (!punt) return { status: 404, error: 'Dit codecontrolepunt bestaat niet meer in de actuele scan.' };
    const rechten = rechtenVoor(ctx, punt);
    if (!rechten.magZien) return { status: 403, error: 'Dit codepunt hoort bij een andere kantoorruimte.' };
    if (!punt.aan) return { status: 423, error: 'Zet dit codepunt eerst aan voordat u de veilige zelftest uitvoert.' };
    if (!rechten.magUitvoeren) return { status: 403, error: rechten.reden || 'Deze kantoorrol mag de zelftest niet uitvoeren.' };

    const controles = [
      { naam: 'Registerkoppeling', geslaagd: !!(punt.id && punt.sleutel && punt.naam) },
      { naam: 'Kantoor en eigenaar', geslaagd: !!(punt.kantoor && punt.kantoor.id && punt.rol) }
    ];
    if (punt.soort === 'api') {
      controles.push(
        { naam: 'API-route', geslaagd: /^\/api\//.test(punt.route || '') },
        { naam: 'HTTP-methode', geslaagd: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(punt.methode) },
        { naam: 'Routebestand', geslaagd: /^server\/.*\.js$/.test(punt.bestand || '') }
      );
    } else if (punt.soort === 'scherm') {
      controles.push(
        { naam: 'App-route', geslaagd: /^\/apps\/.*\.html$/.test(punt.route || '') },
        { naam: 'Schermbestand', geslaagd: /^public\/apps\/.*\.html$/.test(punt.bestand || '') }
      );
    } else if (punt.soort === 'functie') {
      controles.push(
        { naam: 'Functievlag', geslaagd: !!punt.sleutel },
        { naam: 'Functieregister', geslaagd: punt.bestand === 'server/functies.js' }
      );
    } else if (punt.soort === 'werkproces') {
      controles.push(
        { naam: 'Procesfamilie', geslaagd: !!punt.familie },
        { naam: 'Procesroute', geslaagd: /^\/api\//.test(punt.route || '') }
      );
    }
    const geslaagd = controles.every(c => c.geslaagd);
    const s = state();
    const o = s.overrides[bron.id] || {};
    o.teststatus = geslaagd ? 'geslaagd' : 'mislukt';
    o.laatsteCheck = nu();
    o.bijgewerkt = o.laatsteCheck;
    o.laatsteTest = controles.map(c => ({ naam: c.naam, geslaagd: c.geslaagd }));
    if (!geslaagd && (!o.status || o.status === 'operationeel')) o.status = 'aandacht';
    s.overrides[bron.id] = o;
    audit(ctx.key, 'veilige-zelftest-' + (geslaagd ? 'geslaagd' : 'mislukt'), punt.naam + ' · ' + controles.filter(c => !c.geslaagd).map(c => c.naam).join(', '), punt.id, null);
    save();
    return {
      ok: true, geslaagd, controles,
      punt: publiekPunt(ctx, bron, taakAantallen()),
      bewijs: 'Statische route-, register- en eigenaarscontrole in de Magnaat-trainingsomgeving; productie is niet aangeroepen.'
    };
  }

  function beschikbaar(soort, sleutel) {
    const bron = graph().controlepunten.find(p => p.soort === soort && p.sleutel === sleutel);
    return bron ? puntMetOverride(bron).aan : true;
  }

  function korteSamenvatting(context) {
    const ctx = actorContext(context);
    const g = graph();
    const bronnen = ctx.boardroom ? g.controlepunten : g.controlepunten.filter(p => puntMetOverride(p).kantoor.id === ctx.kantoorId);
    const aantallen = taakAantallen();
    const punten = bronnen.map(p => publiekPunt(ctx, p, aantallen));
    return Object.assign({ takenOpen: zichtbareTaken(ctx).filter(t => t.status !== 'klaar').length }, samenvatting(punten));
  }

  return { overzicht, zet, taakMaak, taakZet, zelftest, beschikbaar, korteSamenvatting, _state: state };
};
