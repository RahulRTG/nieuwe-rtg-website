/* Kern-module "rechterhand": de extra premium ROS-apps van de Lifestyle Pass,
   naast De Rechterhand-suite. Vier losse apps op hetzelfde prive-dossier per lid
   (db.data.lifestyle[key]): Reisboek (reisdossiers + draaiboek), Cellier (de
   wijnkelder met drinkvenster), Table (prive-diners en events) en Maison
   (huishouden en staf). Elke deelmodule krijgt dezelfde gedeelde helpers en een
   L(key) die het dossier opzet. Gedeelde context vanuit server.js. */
module.exports = ({ db, save, crypto, liveCodename, anthropic, DATA_DIR }) => {
  const fs = require('fs');
  const path = require('path');
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(4).toString('hex');
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);
  const isDatum = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
  const getal = (v, max) => Math.max(0, Math.min(max || 1e11, Math.round(Number(v) || 0)));

  /* Versleuteling-at-rest voor de gevoeligste velden (Nalatenschap): waar iets
     ligt, contactgegevens en persoonlijke wensen. AES-256-GCM met een sleutel die
     apart in de datamap staat (lifestyle.key), buiten de database. Waarden krijgen
     een "enc:"-prefix; oude platte waarden blijven leesbaar (zachte migratie). */
  function laadSleutel() {
    const dir = DATA_DIR || path.join(__dirname, '..', '..', 'data');
    const f = path.join(dir, 'lifestyle.key');
    try { if (fs.existsSync(f)) return fs.readFileSync(f); } catch (e) {}
    const k = crypto.randomBytes(32);
    try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(f, k, { mode: 0o600 }); } catch (e) {}
    return k;
  }
  const SLEUTEL = laadSleutel();
  function enc(text) {
    if (text == null || text === '') return text;
    try {
      const iv = crypto.randomBytes(12);
      const c = crypto.createCipheriv('aes-256-gcm', SLEUTEL, iv);
      const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
      return 'enc:' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
    } catch (e) { return text; }
  }
  function dec(blob) {
    if (typeof blob !== 'string' || !blob.startsWith('enc:')) return blob;
    try {
      const buf = Buffer.from(blob.slice(4), 'base64');
      const d = crypto.createDecipheriv('aes-256-gcm', SLEUTEL, buf.subarray(0, 12));
      d.setAuthTag(buf.subarray(12, 28));
      return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
    } catch (e) { return ''; }
  }

  // hetzelfde dossier als De Rechterhand; wij zorgen alleen dat onze lijsten bestaan
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

  const ctx = { db, save, rid, nu, schoon, isDatum, getal, L, liveCodename, enc, dec };
  const api = Object.assign({},
    require('./reisboek')(ctx),
    require('./cellier')(ctx),
    require('./table')(ctx),
    require('./maison')(ctx),
    require('./garderobe')(ctx),
    require('./mecenaat')(ctx),
    require('./nalatenschap')(ctx),
    require('./logboek')(ctx),
    require('./cercle')(ctx)
  );

  /* Rahul als adviseur binnen elke app, in de u-vorm: reisadviseur, sommelier,
     maître of huismeester -- eerlijk, kort en zonder een boeking te beloven. Hij
     krijgt een korte samenvatting van uw eigen gegevens in deze app als context. */
  const euro = c => '€ ' + Math.round(Number(c) || 0).toLocaleString('nl-NL');
  const ROLLEN = {
    reisboek: 'u bent de reisadviseur van dit Lifestyle Pass-lid. Denk mee over de reis, de route en de reisdocumenten. Wijs actief op documenten die verlopen.',
    cellier: 'u bent de sommelier van dit lid. Adviseer welke fles nu op dronk is, wat u zou schenken of laten liggen, en welke wijn bij welk gerecht past.',
    table: 'u bent de maître voor dit lid. Denk mee over het menu, de gangen, de wijnbegeleiding en een prettige tafelschikking, met oog voor de dieetwensen van de gasten.',
    maison: 'u bent de huismeester voor dit lid. Denk mee over het huishouden, de planning van de staf en de taken.',
    garderobe: 'u bent de stylist en garderobier van dit lid. Denk mee over wat bij welke gelegenheid past, over kleur- en stofcombinaties en over wat de garderobe nog mist. Verzin geen merken die het lid niet zelf noemt.',
    mecenaat: 'u bent de filantropie-adviseur van dit lid. Denk mee over een evenwichtige spreiding van de giften over de thema\'s, over toezeggingen die nog openstaan en over de rol van de RTFoundation, die 30% van de bijdragen naar liefdadigheid brengt. U geeft geen fiscaal of juridisch advies; daarvoor verwijst u naar een adviseur.',
    nalatenschap: 'u bent de discrete adviseur voor de nalatenschap van dit lid. Denk mee over welke documenten en vertrouwenspersonen nog ontbreken en over hoe het lid zijn wensen helder vastlegt. U bent uiterst discreet. U geeft geen juridisch advies; voor het opstellen verwijst u naar de notaris of advocaat.',
    logboek: 'u bent de vlootbeheerder van dit lid. Denk mee over het onderhoud van jacht, jet of oldtimer, over wat binnenkort aan de beurt is en over de kosten. Wijs actief op wat verloopt.',
    cercle: 'u bent de clubsecretaris van dit lid. Denk mee over de besloten clubs en lidmaatschappen, over waar het lid als gast terecht kan via reciprociteit en over het gebruik van de gastpassen.'
  };
  function contextVan(app, key) {
    if (app === 'reisboek') { const d = api.reizen(key); const v = d.reizen.find(r => r.komend) || d.reizen[0]; return 'Reizen in het boek: ' + d.reizen.length + (v ? '. Eerstvolgende: ' + v.naam + (v.bestemming ? ' (' + v.bestemming + ')' : '') : '') + '. Documenten die aandacht vragen: ' + d.attenties.length + '.'; }
    if (app === 'cellier') { const d = api.cellier(key); return 'Kelder: ' + d.totaalFlessen + ' flessen, ' + d.opDronk + ' nu op dronk, kelderwaarde ' + euro(d.kelderwaarde) + '.'; }
    if (app === 'table') { const d = api.tables(key); const e = d.events.find(x => x.komend) || d.events[0]; return 'Gelegenheden: ' + d.events.length + (e ? '. Eerstvolgende: ' + e.naam + ' met ' + e.gastenAantal + ' gasten' + (e.gasten || []).filter(g => g.dieet).map(g => ' (' + g.naam + ': ' + g.dieet + ')').join('') : '') + '.'; }
    if (app === 'garderobe') { const d = api.garderobe(key); const top = Object.entries(d.perCategorie).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => k + ' (' + n + ')').join(', '); return 'Garderobe: ' + d.aantal + ' stuks' + (top ? ', vooral ' + top : '') + '. Vaklui: ' + d.vaklui.length + '.'; }
    if (app === 'mecenaat') { const d = api.mecenaat(key); return 'Filantropie: ' + d.giften.length + ' giften, betaald ' + euro(d.betaald) + ', toegezegd ' + euro(d.toegezegd) + ', via de RTFoundation ' + euro(d.viaFoundation) + '.'; }
    if (app === 'nalatenschap') { const d = api.nalatenschap(key); return 'Nalatenschap: ' + d.documenten.length + ' documenten, ' + d.contacten.length + ' vertrouwenspersonen, ' + d.wensen.length + ' vastgelegde wensen. (De inhoud is versleuteld; ik ken alleen de aantallen en de titels.)'; }
    if (app === 'logboek') { const d = api.logboek(key); return 'Logboek: ' + d.objecten.length + ' objecten, ' + d.attenties.length + ' punten die aandacht vragen, onderhoudskosten ' + euro(d.totaalKosten) + '.'; }
    if (app === 'cercle') { const d = api.cercle(key); return 'Cercle: ' + d.aantal + ' clubs in ' + d.steden + ' steden, ' + d.gastpassen + ' gastpassen beschikbaar.'; }
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
