/* Gewoonten: kleine dingen die u vaker wilt doen. Wandelen, lezen, medicijnen,
   even buiten, niet op de telefoon voor het slapen.

   DE REEKS IS EEN KEUZE, EN HIJ STAAT UIT. Voor sommige mensen werkt een teller
   van dagen-op-rij geweldig; voor anderen wordt hij precies de reden om te
   stoppen zodra hij breekt. Daarom staat hij per gewoonte uit tot het lid hem
   zelf aanzet, en gaat hij ook weer uit zonder dat er iets verloren gaat -- de
   afvinkjes blijven, alleen het tellertje verdwijnt.

   EN EEN GEBROKEN REEKS IS GEEN GEBEURTENIS. Er komt geen melding, geen "u
   heeft uw reeks van 12 verspeeld", geen rood. Wie een dag overslaat, ziet
   morgen gewoon weer een knop. Dat is het verschil tussen een hulpmiddel en een
   machine die u aan het werk zet (CLAUDE.md: geen verslavende patronen).

   WAT ER NIET IS: een percentage, een score, een ranglijst, en een "beste week
   ooit". Er staat een toets op die faalt zodra dat er alsnog in kruipt. */

const DAG = 86400000;
const MAX_GEWOONTEN = 12;
const MAX_DAGEN = 400;
const VENSTER = 14;               // hoeveel dagen het scherm terugkijkt

const dagVan = d => new Date(d).toISOString().slice(0, 10);

/* De reeks: hoeveel dagen op rij tot en met vandaag (of tot en met gisteren,
   want de dag is nog niet voorbij). Puur, en alleen gebruikt als het lid de
   teller aan heeft gezet. */
function reeksVan(dagen, nu = new Date()) {
  const gedaan = new Set(dagen || []);
  const vandaag = dagVan(nu);
  let teller = 0;
  let d = new Date(nu.getTime());
  // vandaag telt alleen mee als hij al af is; anders begint de reeks gisteren
  if (!gedaan.has(vandaag)) d = new Date(nu.getTime() - DAG);
  for (;;) {
    const s = dagVan(d);
    if (!gedaan.has(s)) break;
    teller++;
    d = new Date(d.getTime() - DAG);
  }
  return teller;
}

module.exports = ({ db, save, schoon, crypto }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/gewoonten', bezit: { gewoonten: 'lijst' } });
  const lijst = () => eigen.bak('gewoonten');
  const mijne = key => lijst().filter(g => g.key === key && g.status !== 'weg');

  function toon(g, nu) {
    const vandaag = dagVan(nu);
    const vanaf = dagVan(new Date(nu.getTime() - (VENSTER - 1) * DAG));
    const recent = (g.dagen || []).filter(d => d >= vanaf).sort();
    return {
      id: g.id, naam: g.naam, waarom: g.waarom || '',
      vandaagGedaan: (g.dagen || []).includes(vandaag),
      dagen: recent,
      venster: VENSTER,
      /* De teller gaat alleen mee naar buiten als hij AAN staat. Hem altijd
         meesturen en het scherm laten kiezen, betekent dat hij er ooit toch
         opduikt; wat er niet is, kan ook niet lekken. */
      reeksAan: !!g.reeksAan,
      ...(g.reeksAan ? { reeks: reeksVan(g.dagen, nu) } : {})
    };
  }

  function gewoontenVan(key, nu = new Date()) {
    return { ok: true, gewoonten: mijne(key).map(g => toon(g, nu)) };
  }

  function gewoonteMaak(key, body, nu = new Date()) {
    if (mijne(key).length >= MAX_GEWOONTEN) {
      return { status: 409, error: 'U heeft er al ' + MAX_GEWOONTEN + '. Dat is meer dan genoeg om aan te werken.' };
    }
    const naam = schoon(body.naam, 60);
    if (!naam) return { status: 400, error: 'Wat wilt u vaker doen?' };
    const g = { id: crypto.randomBytes(4).toString('hex'), key, naam,
      waarom: schoon(body.waarom, 200), reeksAan: body.reeksAan === true,
      dagen: [], status: 'loopt', gemaakt: nu.toISOString() };
    lijst().push(g); save();
    return { ok: true, gewoonte: toon(g, nu) };
  }

  /* Afvinken en weer afvinken: een tik zet hem aan, dezelfde tik zet hem uit.
     Geen aparte "toch niet"-knop, want dan is een vergissing een handeling. */
  function gewoonteTik(key, body, nu = new Date()) {
    const g = mijne(key).find(x => x.id === String(body.id || ''));
    if (!g) return { status: 404, error: 'Deze gewoonte staat niet op uw naam.' };
    const op = /^\d{4}-\d{2}-\d{2}$/.test(String(body.op || '')) ? String(body.op) : dagVan(nu);
    if (op > dagVan(nu)) return { status: 400, error: 'Een dag die nog moet komen valt niet af te vinken.' };
    if (!Array.isArray(g.dagen)) g.dagen = [];
    const i = g.dagen.indexOf(op);
    if (i >= 0) g.dagen.splice(i, 1);
    else {
      g.dagen.push(op);
      g.dagen.sort();
      if (g.dagen.length > MAX_DAGEN) g.dagen.splice(0, g.dagen.length - MAX_DAGEN);
    }
    save();
    return { ok: true, gewoonte: toon(g, nu) };
  }

  /* De teller aan of uit. Uitzetten gooit NIETS weg: de afvinkjes blijven, en
     wie hem later weer aanzet, ziet de reeks die er dan is. */
  function gewoonteReeks(key, body, nu = new Date()) {
    const g = mijne(key).find(x => x.id === String(body.id || ''));
    if (!g) return { status: 404, error: 'Deze gewoonte staat niet op uw naam.' };
    g.reeksAan = body.aan === true;
    save();
    return { ok: true, gewoonte: toon(g, nu) };
  }

  function gewoonteStop(key, body) {
    const g = mijne(key).find(x => x.id === String(body.id || ''));
    if (!g) return { status: 404, error: 'Deze gewoonte staat niet op uw naam.' };
    g.status = 'weg'; save();
    return { ok: true, gestopt: g.naam };
  }

  return { gewoontenVan, gewoonteMaak, gewoonteTik, gewoonteReeks, gewoonteStop };
};

module.exports.reeksVan = reeksVan;
module.exports.VENSTER = VENSTER;
