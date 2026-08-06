/* RTG Stadsweefsel, deel "begroting": van beleidsdoel naar meetbare uitkomst.

   Dit is de keten die in bijna elk stadsplatform ontbreekt, en het is precies
   de keten waar een bestuurder in denkt:

     beleidsdoel -> budget -> project -> werkorders -> uitgaven -> uitkomst

   Elke schakel bestaat hier al los (werkorders dragen kosten, indicatoren
   meten uitkomsten); wat ontbrak was het touw ertussen. Zonder dat touw kun je
   wel zeggen wat er is uitgegeven, maar niet WAARAAN in bestuurlijke zin, en al
   helemaal niet of het iets heeft opgeleverd.

   DE UITKOMST IS EEN METING, GEEN VINKJE. Een project draagt de indicator
   waarop het wil scoren en de NULMETING op het moment dat het start. Bij het
   afsluiten wordt dezelfde indicator opnieuw gemeten en staat het verschil er.
   Dat is bewust streng: een project dat zijn effect niet kan meten, mag dat
   opschrijven ("geen indicator gekozen"), maar het kan niet doen alsof.

   DRIE DINGEN DIE HIER MET OPZET NIET GEBEUREN. Er wordt geen geld verplaatst
   (RTG Pay en de bank hebben hun eigen poorten met hun eigen goedkeuring), een
   overschrijding wordt niet geblokkeerd maar GEMELD (een reparatie stoppen
   omdat een potje leeg is, is een besluit van een mens), en een project sluit
   zichzelf niet af. Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
const { schoon } = require('../util');

module.exports = (ctx) => {
  const { d, save, crypto, nu, geo, werk, ind } = ctx;

  const doelen = () => { if (!Array.isArray(d().weefselDoelen)) d().weefselDoelen = []; return d().weefselDoelen; };
  const projecten = () => { if (!Array.isArray(d().weefselProjecten)) d().weefselProjecten = []; return d().weefselProjecten; };
  const doel = (id) => doelen().find(x => x.id === String(id || '')) || null;
  const project = (id) => projecten().find(x => x.id === String(id || '')) || null;
  const euro = (v) => (Number(v) > 0 ? Math.round(Number(v) * 100) / 100 : 0);

  /* Wat een project kostte en wat het deed (uitgaven uit de werkorders, de
     nulmeting/eindmeting en het verschil) staat in ./begrotingcijfers.js.
     Hier wonen de BESLUITEN, daar het rekenwerk. */
  const { meetIndicator, besteed, publiek, effectVan } =
    require('./begrotingcijfers')({ ctx, nu, geo, ind, werk, doel });

  function doelMaak({ naam, omschrijving, jaar, indicator, wie }) {
    const n = schoon(naam, 100);
    if (!n) return { status: 400, error: 'Welk doel wil de stad bereiken?' };
    const j = Number(jaar);
    const x = { id: 'D-' + crypto.randomBytes(3).toString('hex').toUpperCase(), naam: n,
      omschrijving: schoon(omschrijving, 300) || null,
      jaar: Number.isFinite(j) && j >= 2000 ? Math.round(j) : new Date(nu()).getFullYear(),
      indicator: schoon(indicator, 40) || null, door: schoon(wie, 60) || 'kantoor', at: nu() };
    doelen().push(x);
    save();
    return { ok: true, doel: x };
  }

  /* Een project onder een doel, met een budget en -- als het kan -- een
     nulmeting. Die nulmeting wordt NU vastgelegd en niet achteraf gereconstrueerd:
     achteraf is elke startwaarde de waarde die het beste uitkomt. */
  function projectStart({ doelId, naam, budget, gebied, indicator, besluitId, wie }) {
    const dl = doel(doelId);
    if (!dl) return { status: 404, error: 'Onbekend doel.' };
    const n = schoon(naam, 100);
    if (!n) return { status: 400, error: 'Hoe heet het project?' };
    const b = euro(budget);
    if (!b) return { status: 400, error: 'Wat is het budget?' };
    /* HET MANDAAT BIJT HIER. Boven de ambtelijke grens is een uitgave geen
       uitgave meer maar een besluit, en dan moet er een AANGENOMEN besluit van
       het juiste orgaan onder liggen dat het bedrag ook echt dekt. Een mandaat
       dat alleen in een beleidsstuk staat en nergens een deur dichthoudt, is
       een mening (kern/stadsweefsel/bestuur.js). */
    const eis = ctx.bes.mandaat({ bedrag: b });
    if (eis.besluitNodig) {
      if (!besluitId) return { status: 403, error: 'EUR ' + b + ' valt buiten het ambtelijk mandaat: ' + eis.reden + ' Geef het kenmerk van dat besluit mee.' };
      const dek = ctx.bes.dekt(besluitId, { orgaan: eis.orgaan, bedrag: b });
      if (!dek.ok) return { status: 403, error: dek.reden };
    }
    const g = gebied ? geo.gebied(gebied) : null;
    if (gebied && !g) return { status: 404, error: 'Onbekend gebied.' };
    const ind = schoon(indicator, 40) || dl.indicator || null;
    const p = {
      id: 'P-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      doelId: dl.id, naam: n, budget: b, gebied: g ? g.id : null, indicator: ind,
      besluitId: besluitId ? String(besluitId) : null, mandaat: eis.rol,
      nulmeting: ind ? meetIndicator(ind, g ? g.id : null) : null,
      werkorders: [], status: 'loopt', door: schoon(wie, 60) || 'kantoor', at: nu(),
      eindmeting: null, afgeslotenAt: null, afgeslotenDoor: null, evaluatie: null
    };
    projecten().push(p);
    save();
    return { ok: true, project: publiek(p) };
  }

  // werk aan een project hangen: dat geeft "uitgaven" straks betekenis
  function koppelWerk({ projectId, werkorderId }) {
    const p = project(projectId);
    if (!p) return { status: 404, error: 'Onbekend project.' };
    if (p.status !== 'loopt') return { status: 400, error: 'Dit project is afgesloten.' };
    const w = werk.order(werkorderId);
    if (!w) return { status: 404, error: 'Onbekende werkorder.' };
    if (p.werkorders.includes(w.id)) return { ok: true, project: publiek(p), bestond: true };
    p.werkorders.push(w.id);
    save();
    return { ok: true, project: publiek(p) };
  }

  /* Afsluiten: dezelfde indicator opnieuw meten en het verschil vastleggen.
     Een project zonder indicator kan ook worden afgesloten, maar dan staat er
     letterlijk dat het effect niet is gemeten -- dat is eerlijker dan een
     evaluatietekst die suggereert van wel. */
  function projectSluit({ projectId, wie, evaluatie }) {
    const p = project(projectId);
    if (!p) return { status: 404, error: 'Onbekend project.' };
    if (p.status !== 'loopt') return { status: 400, error: 'Dit project is al afgesloten.' };
    const nog = p.werkorders.map(id => werk.order(id)).filter(w => w && !['klaar', 'geannuleerd'].includes(w.status));
    if (nog.length) return { status: 400, error: 'Er staan nog ' + nog.length + ' werkorder(s) open; sluit die eerst of annuleer ze.' };
    p.status = 'afgesloten'; p.afgeslotenAt = nu(); p.afgeslotenDoor = schoon(wie, 60) || 'kantoor';
    p.evaluatie = schoon(evaluatie, 500) || null;
    p.eindmeting = p.indicator ? meetIndicator(p.indicator, p.gebied) : null;
    save();
    return { ok: true, project: publiek(p), effect: effectVan(p) };
  }

  function beeld({ jaar } = {}) {
    const j = Number(jaar) > 0 ? Math.round(Number(jaar)) : null;
    const rij = doelen().filter(x => !j || x.jaar === j).map(x => {
      const eigen = projecten().filter(p => p.doelId === x.id).map(publiek);
      return { ...x, projecten: eigen,
        budget: Math.round(eigen.reduce((s, p) => s + p.budget, 0) * 100) / 100,
        uitgegeven: Math.round(eigen.reduce((s, p) => s + p.uitgegeven, 0) * 100) / 100,
        afgesloten: eigen.filter(p => p.status === 'afgesloten').length };
    });
    return { status: 200, jaar: j, doelen: rij,
      let_op: 'Er wordt hier geen geld verplaatst: dit is de administratie van doel, budget en werk, niet de betaalrail.' };
  }

  return {
    doel, project, besteed, effectVan,
    api: {
      weefselBegroting: beeld,
      weefselDoelMaak: doelMaak,
      weefselProjectMaak: projectStart,
      weefselProjectKoppel: koppelWerk,
      weefselProjectSluit: projectSluit,
      weefselProject: ({ id }) => {
        const p = project(id);
        return p ? { status: 200, project: publiek(p), effect: effectVan(p) } : { status: 404, error: 'Onbekend project.' };
      }
    }
  };
};
