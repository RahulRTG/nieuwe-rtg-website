/* ============================================================================
   SCIM /Groups -- het gat tussen "de IdP verandert een groep" en "de rol gaat mee".

   HET PROBLEEM DAT DIT OPLOST. De identiteitsbrug las tot nu toe de claim
   `groups` uit het ID-token, en dat gebeurt alleen bij een INLOG. Zet een
   beheerder iemand vanochtend uit de groep "Haarlem-Managers", dan houdt die
   persoon zijn rol tot hij toevallig opnieuw inlogt -- en bij een SSO-sessie
   van dertig dagen is dat een maand. Voor een groep die toegang tot
   personeelsdossiers geeft, is dat een maand te lang.

   Met /Groups duwt de IdP de wijziging naar ons toe, en dan werkt hij meteen.

   WAT EEN GROEP HIER IS, EN WAT NIET. Een groep is een NAAM met leden, en verder
   niets: geen rechten, geen rollen, geen nesting. Wat een groep MAG staat in de
   groepsafbeelding van de tenant (kern/tenant/register.js), en die wordt door
   een mens gezet met het beheer-token van zijn eigen werkruimte. Zou een groep
   hier rechten kunnen dragen, dan bepaalt de IdP van de klant wat er in ONZE
   werkruimte mag -- en dan is de huisregel "aanmelden is niet binnen zijn"
   alsnog omzeild, alleen via een andere deur.

   GEEN GENESTE GROEPEN, en dat is een besluit. Een groep die een andere groep
   als lid heeft, maakt van "wie zit hierin" een grafiekvraag met cycli en
   diepte-limieten -- in de laag die bepaalt wie er bij een personeelsdossier
   mag. Een `member` met een `$ref` naar een Group wordt daarom geweigerd, met
   die reden, in plaats van stil genegeerd.

   DE LEDEN ZIJN RTG-ACCOUNT-ID'S en geen e-mailadressen: dat is dezelfde reden
   waarom sso/index.js op `sub` matcht en niet op adres. Een adres verandert.
   ========================================================================== */
'use strict';
const { datum: klokDatum } = require('../lib/klok');

const S = require('../accounts/state');
const groepSync = require('./groep-sync');

const MAX_LEDEN = 20000;

function zorgTabel(db) {
  const d = db || S.db;
  d.exec(`CREATE TABLE IF NOT EXISTS scim_groepen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org TEXT NOT NULL,
    naam TEXT NOT NULL,
    externe_id TEXT,
    leden TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    UNIQUE (org, naam)
  )`);
  d.exec('CREATE INDEX IF NOT EXISTS idx_scim_groep_org ON scim_groepen(org)');
  groepSync.zorgTabel(d);
}

const uitRij = (r) => (r ? { id: String(r.id), org: r.org, naam: r.naam, externeId: r.externe_id || null,
  leden: JSON.parse(r.leden || '[]'), bij: r.created_at } : null);

function vind(org, id) {
  return uitRij(S.db.prepare('SELECT * FROM scim_groepen WHERE org = ? AND id = ?').get(String(org), Number(id)));
}
function opNaam(org, naam) {
  return uitRij(S.db.prepare('SELECT * FROM scim_groepen WHERE org = ? AND naam = ?').get(String(org), String(naam)));
}
function lijst(org) {
  return S.db.prepare('SELECT * FROM scim_groepen WHERE org = ? ORDER BY naam').all(String(org)).map(uitRij);
}

/* Waar de identiteitsbrug om vraagt: in welke groepen zit dit account. Puur
   lezen, en met de NAMEN terug -- want dat is waar de groepsafbeelding op
   matcht, en een tweede sleutelvorm ertussen zou een tweede plek zijn waar de
   twee uit elkaar kunnen lopen. */
function groepenVan(org, userId) {
  const id = String(userId);
  return lijst(org).filter(g => g.leden.includes(id)).map(g => g.naam);
}

function maak(org, naam, leden, externeId) {
  const n = String(naam || '').trim();
  if (!n) { const e = new Error('Een groep heeft een displayName nodig.'); e.status = 400; e.scimType = 'invalidValue'; throw e; }
  if (opNaam(org, n)) { const e = new Error('Deze groep bestaat al.'); e.status = 409; e.scimType = 'uniqueness'; throw e; }
  const nu = klokDatum().toISOString();
  const r = S.db.prepare('INSERT INTO scim_groepen (org, naam, externe_id, leden, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(String(org), n, externeId ? String(externeId) : null, JSON.stringify(schoonLeden(leden)), nu);
  return vind(org, r.lastInsertRowid);
}

/* De route gebruikt deze vorm voor POST: groep + herstelmarkeringen zijn een
   enkele SQLite-commit. `maak` hierboven blijft de smalle opslagbewerking voor
   bestaande interne aanroepers en tests. */
function maakMetSync(org, naam, leden, externeId) {
  const n = String(naam || '').trim();
  if (!n) { const e = new Error('Een groep heeft een displayName nodig.'); e.status = 400; e.scimType = 'invalidValue'; throw e; }
  const schoon = schoonLeden(leden);
  if (opNaam(org, n)) { const e = new Error('Deze groep bestaat al.'); e.status = 409; e.scimType = 'uniqueness'; throw e; }
  const extern = externeId ? String(externeId) : null;
  const nu = klokDatum().toISOString();
  const afdruk = groepSync.vingerafdruk(n, schoon, extern);
  const id = groepSync.maakAtomair(org, schoon, afdruk, () =>
    S.db.prepare('INSERT INTO scim_groepen (org, naam, externe_id, leden, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(String(org), n, extern, JSON.stringify(schoon), nu).lastInsertRowid);
  return vind(org, id);
}

function isCreateRetry(org, groep, naam, leden, externeId) {
  if (!groep) return false;
  const afdruk = groepSync.vingerafdruk(naam, schoonLeden(leden), externeId ? String(externeId) : null);
  return groepSync.isCreateRetry(org, groep.id, afdruk);
}

function schoonLeden(leden) {
  const uit = [];
  for (const m of (Array.isArray(leden) ? leden : [])) {
    const waarde = m && typeof m === 'object' ? m.value : m;
    const soort = m && typeof m === 'object' ? String(m.type || '').toLowerCase() : '';
    /* Zie de kop: een groep in een groep maakt van de toegangsvraag een
       grafiekvraag. Weigeren met de reden, niet stil overslaan -- een IdP die
       nesting stuurt en er niets over hoort, denkt dat het werkt. */
    if (soort === 'group' || (m && m.$ref && /\/Groups\//.test(String(m.$ref)))) {
      const e = new Error('Een groep in een groep wordt hier niet ondersteund; zet de mensen er rechtstreeks in.');
      e.status = 400; e.scimType = 'invalidValue'; throw e;
    }
    const v = String(waarde == null ? '' : waarde).trim();
    if (v && !uit.includes(v)) uit.push(v);
    if (uit.length > MAX_LEDEN) {
      const e = new Error('Een groep draagt hier hooguit ' + MAX_LEDEN + ' leden.');
      e.status = 400; e.scimType = 'tooLarge'; throw e;
    }
  }
  return uit;
}

function zetLeden(org, id, leden) {
  const g = vind(org, id);
  if (!g) { const e = new Error('Onbekende groep binnen deze organisatie.'); e.status = 404; throw e; }
  S.db.prepare('UPDATE scim_groepen SET leden = ? WHERE org = ? AND id = ?')
    .run(JSON.stringify(schoonLeden(leden)), String(org), Number(id));
  return vind(org, id);
}

function hernoem(org, id, naam) {
  const g = vind(org, id);
  if (!g) { const e = new Error('Onbekende groep binnen deze organisatie.'); e.status = 404; throw e; }
  const n = String(naam || '').trim();
  if (!n) return g;
  const botst = opNaam(org, n);
  if (botst && botst.id !== g.id) { const e = new Error('Er bestaat al een groep met die naam.'); e.status = 409; e.scimType = 'uniqueness'; throw e; }
  S.db.prepare('UPDATE scim_groepen SET naam = ? WHERE org = ? AND id = ?').run(n, String(org), Number(id));
  return vind(org, id);
}

/* Weghalen wist de groep en niets anders: de ACCOUNTS blijven staan. Een
   groep opheffen is geen ontslag, en de rollen die eraan hingen vervallen
   vanzelf zodra de brug opnieuw rekent -- daar hoort geen tweede pad voor te
   zijn dat mensen kan uitzetten. */
function haalWeg(org, id) {
  const g = vind(org, id);
  if (!g) { const e = new Error('Onbekende groep binnen deze organisatie.'); e.status = 404; throw e; }
  S.db.prepare('DELETE FROM scim_groepen WHERE org = ? AND id = ?').run(String(org), Number(id));
  return g;
}

/* Een PATCH van SCIM uitpakken. IdP's sturen leden op drie manieren, en ze doen
   het alle drie: replace van de hele lijst, add van een paar, en remove met een
   filter in het pad (`members[value eq "7"]`). Wat we niet herkennen laten we
   staan en melden we als "niets herkend", zodat de routelaag 400 kan geven in
   plaats van stil te doen alsof het gelukt is. */
function uitPatch(body, huidig) {
  const ops = body && Array.isArray(body.Operations) ? body.Operations : [];
  let leden = (huidig || []).slice();
  let naam = null;
  let herkend = 0;

  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    const soort = String(op.op || '').toLowerCase();
    const pad = String(op.path || '');
    const kalePad = pad.replace(/\[.*$/, '').toLowerCase();

    if (kalePad === 'displayname' || (!pad && op.value && typeof op.value === 'object' && op.value.displayName)) {
      naam = String(pad ? op.value : op.value.displayName || '');
      herkend++;
      continue;
    }
    if (kalePad !== 'members' && !(!pad && op.value && typeof op.value === 'object' && 'members' in op.value)) continue;

    const rauw = pad ? op.value : op.value.members;
    if (soort === 'replace' && !/\[/.test(pad)) { leden = schoonLeden(rauw); herkend++; continue; }
    if (soort === 'add') {
      for (const v of schoonLeden(rauw)) if (!leden.includes(v)) leden.push(v);
      herkend++; continue;
    }
    if (soort === 'remove') {
      /* `members[value eq "7"]` -- het id staat in het pad en niet in de waarde. */
      const m = /value\s+eq\s+"([^"]+)"/i.exec(pad);
      if (m) { leden = leden.filter(x => x !== m[1]); herkend++; continue; }
      if (rauw) { const weg = schoonLeden(rauw); leden = leden.filter(x => !weg.includes(x)); herkend++; continue; }
      leden = []; herkend++; continue;          // remove zonder filter: de hele lijst leeg
    }
  }
  return { leden, naam, herkend };
}

module.exports = { zorgTabel, vind, opNaam, lijst, groepenVan,
  markeerSync: groepSync.markeer, wachtendeSync: groepSync.wachtende, syncKlaar: groepSync.klaar,
  maak, maakMetSync, isCreateRetry, createSyncKlaar: groepSync.createKlaar,
  zetLeden, hernoem, haalWeg, uitPatch, schoonLeden, MAX_LEDEN };
