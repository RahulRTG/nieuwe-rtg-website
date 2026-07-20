/* Kern-module "rechterhand": de extra premium ROS-apps van de Lifestyle Pass,
   naast De Rechterhand-suite. Vier losse apps op hetzelfde prive-dossier per lid
   (db.data.lifestyle[key]): Reisboek (reisdossiers + draaiboek), Cellier (de
   wijnkelder met drinkvenster), Table (prive-diners en events) en Maison
   (huishouden en staf). Elke deelmodule krijgt dezelfde gedeelde helpers en een
   L(key) die het dossier opzet. Gedeelde context vanuit server.js. */
module.exports = ({ db, save, crypto, liveCodename, anthropic }) => {
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(4).toString('hex');
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);
  const isDatum = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
  const getal = (v, max) => Math.max(0, Math.min(max || 1e11, Math.round(Number(v) || 0)));

  // hetzelfde dossier als De Rechterhand; wij zorgen alleen dat onze vier lijsten bestaan
  function L(key) {
    if (!db.data.lifestyle) db.data.lifestyle = {};
    if (!db.data.lifestyle[key]) db.data.lifestyle[key] = {};
    const l = db.data.lifestyle[key];
    if (!Array.isArray(l.reizen)) l.reizen = [];
    if (!Array.isArray(l.cellier)) l.cellier = [];
    if (!Array.isArray(l.tables)) l.tables = [];
    if (!l.maison || typeof l.maison !== 'object') l.maison = { staf: [], taken: [], logboek: [] };
    return l;
  }

  const ctx = { db, save, rid, nu, schoon, isDatum, getal, L, liveCodename };
  const api = Object.assign({},
    require('./reisboek')(ctx),
    require('./cellier')(ctx),
    require('./table')(ctx),
    require('./maison')(ctx)
  );

  /* Rahul als adviseur binnen elke app, in de u-vorm: reisadviseur, sommelier,
     maître of huismeester -- eerlijk, kort en zonder een boeking te beloven. Hij
     krijgt een korte samenvatting van uw eigen gegevens in deze app als context. */
  const euro = c => '€ ' + Math.round(Number(c) || 0).toLocaleString('nl-NL');
  const ROLLEN = {
    reisboek: 'u bent de reisadviseur van dit Lifestyle Pass-lid. Denk mee over de reis, de route en de reisdocumenten. Wijs actief op documenten die verlopen.',
    cellier: 'u bent de sommelier van dit lid. Adviseer welke fles nu op dronk is, wat u zou schenken of laten liggen, en welke wijn bij welk gerecht past.',
    table: 'u bent de maître voor dit lid. Denk mee over het menu, de gangen, de wijnbegeleiding en een prettige tafelschikking, met oog voor de dieetwensen van de gasten.',
    maison: 'u bent de huismeester voor dit lid. Denk mee over het huishouden, de planning van de staf en de taken.'
  };
  function contextVan(app, key) {
    if (app === 'reisboek') { const d = api.reizen(key); const v = d.reizen.find(r => r.komend) || d.reizen[0]; return 'Reizen in het boek: ' + d.reizen.length + (v ? '. Eerstvolgende: ' + v.naam + (v.bestemming ? ' (' + v.bestemming + ')' : '') : '') + '. Documenten die aandacht vragen: ' + d.attenties.length + '.'; }
    if (app === 'cellier') { const d = api.cellier(key); return 'Kelder: ' + d.totaalFlessen + ' flessen, ' + d.opDronk + ' nu op dronk, kelderwaarde ' + euro(d.kelderwaarde) + '.'; }
    if (app === 'table') { const d = api.tables(key); const e = d.events.find(x => x.komend) || d.events[0]; return 'Gelegenheden: ' + d.events.length + (e ? '. Eerstvolgende: ' + e.naam + ' met ' + e.gastenAantal + ' gasten' + (e.gasten || []).filter(g => g.dieet).map(g => ' (' + g.naam + ': ' + g.dieet + ')').join('') : '') + '.'; }
    const d = api.maison(key); return 'Huishouden: ' + d.staf.length + ' personeelsleden, ' + d.openTaken + ' openstaande taken.';
  }
  async function rechterhandAI(key, app, vraag) {
    if (!ROLLEN[app]) return { status: 400, error: 'Onbekende app.' };
    const q = schoon(vraag, 400);
    const ctxTekst = contextVan(app, key);
    if (anthropic && q) {
      try {
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 300,
          system: require('../rahul').RAHUL_LEAD + ROLLEN[app] + ' Spreek het lid consequent aan met "u". Kort, concreet en eerlijk; ' +
            'u belooft nooit een boeking, tafel of levertijd die u niet zeker kunt waarmaken -- daarvoor schakelt u De Rechterhand in. Context (prive): ' + ctxTekst,
          messages: [{ role: 'user', content: q }]
        });
        const tekst = res.content && res.content[0] && res.content[0].text;
        if (tekst) return { status: 200, ok: true, antwoord: tekst };
      } catch (e) { /* val terug */ }
    }
    return { status: 200, ok: true, demo: true, antwoord: 'Tot uw dienst. ' + ctxTekst + ' Stel mij gerust een vraag; wat een boeking vraagt, zet ik voor u klaar bij De Rechterhand.' };
  }
  api.rechterhandAI = rechterhandAI;
  return api;
};
