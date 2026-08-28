/* RTF Living Lab, deel "opslag": de bak, het schoonmaakwerk en het auditspoor.
   Elke andere module van deze map krijgt dit als context mee en raakt de
   database nooit zelf aan -- dan staat de vorm van de opslag op EEN plek.

   Wat hier bewust NIET in staat: de link tussen een deelnemersalias en een
   Foundation-profiel. Die staat in een eigen collectie (`livingLabKoppel`) en
   wordt door geen enkele studie-route gelezen; zie ./mensen.js voor waarom dat
   meer is dan opruimwerk. */
'use strict';

/* De hashketen onder het auditspoor; zie audit() verderop. */
const { noteerIn: ketenNoteerIn, verifieer: ketenVerifieer, top: ketenTop } = require('../../lib/keten');

module.exports = ({ db, save, crypto }) => {
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(5).toString('hex');
  /* Tekst die de gebruiker levert gaat door één zeef, hier. Hoeken eruit (geen
     HTML in een dossier), lengte af. Kort en saai, en juist daarom op één plek:
     zeventien varianten hiervan is hoe er ooit één zonder de trim bleef staan. */
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);
  const getal = (v, min, max) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
  const lijst = (v, n, max) => (Array.isArray(v) ? v : []).map(x => schoon(x, n || 80)).filter(Boolean).slice(0, max || 50);

  const TEKENS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = pre => pre + '-' + Array.from(crypto.randomBytes(7)).map(b => TEKENS[b % TEKENS.length]).join('');

  const eigen = require('../eigencollectie')({ db, domein: 'kern/livinglab/opslag', bezit: { livingLab: 'kaart', livingLabKoppel: 'lijst' } });
  const S = () => {
    const s = eigen.bak('livingLab');
    for (const k of ['labs', 'studies', 'themas', 'apparatuur', 'audit']) if (!Array.isArray(s[k])) s[k] = [];
    return s;
  };
  // de koppeltabel staat met opzet BUITEN S(): een studie-antwoord kan hem niet
  // per ongeluk meenemen, want hij zit niet in dezelfde boom.
  const K = () => eigen.bak('livingLabKoppel');

  /* ---------- het auditspoor ----------
     Elke handeling die iets vastlegt, tekent, weigert of verwijdert komt hier
     langs. Het spoor is append-only voor de code eromheen: er is geen functie
     die een regel wijzigt of wist, alleen de bewaartermijn van het lab knipt de
     staart (./bestuur.js). Wie het spoor mag lezen hangt aan het lab, niet aan
     de studie -- een toezichthouder moet juist kunnen zien wat er NIET doorging.

     AAN DE KETEN. "Append-only voor de code eromheen" is een afspraak, geen
     eigenschap: wie bij de database kan, wijzigt een regel zonder dat het
     ergens afwijkt. Elke regel draagt daarom de hash van zijn voorganger, zodat
     een wijziging of verwijdering MIDDEN in het spoor aantoonbaar breekt. Wat
     dat wel en niet tegenhoudt staat in de kop van lib/keten.js.

     LET OP BIJ HET LEZEN: de keten loopt over het HELE spoor, waarin de regels
     van alle labs door elkaar staan. Een op lab gefilterde weergave (auditlog()
     in ./bestuur.js) is daardoor zelf niet na te rekenen -- het onderliggende
     journaal wel. Dat is de juiste kant op: filteren mag het bewijs niet
     bepalen. */
  function audit(labId, wat, wie, over, extra) {
    return ketenNoteerIn(S().audit, {
      id: rid(), labId: String(labId || ''), wat: String(wat || '').slice(0, 60),
      wie: schoon(wie, 80) || 'onbekend', over: String(over || '').slice(0, 40),
      detail: schoon(extra, 300), at: nu()
    }, 20000);
  }

  /* De ketenstand van dit spoor, voor wie wil weten of het nog klopt. */
  function auditKeten() {
    const rij = S().audit;
    return Object.assign({ top: ketenTop(rij) }, ketenVerifieer(rij));
  }

  const vindLab = id => S().labs.find(l => l.id === String(id || '')) || null;
  const vindStudie = id => S().studies.find(s => s.id === String(id || '')) || null;

  /* Een studie draagt haar hele dossier in zich. De vorm staat hier zodat
     ./studie.js hem maakt en de rest van de map hem alleen invult -- een veld
     dat pas bij gebruik ontstaat, is een veld waarvan de helft van de code niet
     weet dat het kan ontbreken. */
  function leegDossier() {
    return {
      hypothese: { tekst: '', tegendeel: '', at: null },
      plan: { methoden: [], steekproef: 0, meetmomenten: 0, doel: '', rapportage: '', at: null },
      deelnemers: [],
      ethiek: { klasse: 'laag', vastgesteld: false, privacytoets: null, review: [], stopcriteria: [],
        toestemming: { regime: 'geen', ouderlijk: false, tekst: '' }, klachten: [], stilgelegd: null },
      observaties: [],
      datasets: [],
      bronnen: [],
      conclusies: [],
      reflectie: [],
      besluit: null,
      uitgangen: [],
      taken: [],
      documenten: [],
      besluitenlog: [],
      logboek: [],
      reserveringen: []
    };
  }

  return { nu, rid, schoon, getal, lijst, code, S, K, audit, auditKeten, vindLab, vindStudie, leegDossier, save };
};
