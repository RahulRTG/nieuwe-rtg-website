/* RTG Festival (deelmodule): DE NORM. Wat er ergens hoort te staan.

   HET GETAL IS VAN DE ORGANISATOR EN NIET VAN ONS, en dat is de hele reden dat
   dit bestand bestaat. "Vier man op Bar Lima" en "een extra per 250 mensen in
   de zone" zijn geen dingen die software kan weten: ze komen uit de ervaring
   van iemand die dit festival kent. Wat software wel kan, is dat getal over een
   heel terrein en een hele dag uitrekenen, en de gaten aanwijzen voordat ze er
   zijn. Zo is de voorspelling rekenwerk op een menselijk oordeel, en niet een
   model dat doet alsof het weet hoeveel bier er doorgaat.

   TWEE DELEN, WANT ZO WERKT HET ECHT. `vast` is wat er hoe dan ook moet staan
   zolang het open is; `per100` is wat er per honderd aanwezigen bij komt. Een
   toiletunit heeft twee schoonmakers nodig ongeacht de drukte; een bar niet.

   DE AANWEZIGEN KOMEN VAN DE DICHTSTBIJZIJNDE TELLENDE PLEK. Een bar telt geen
   mensen (./soorten.js: hij is doorvoer, geen bezetting), dus "per 250 in de
   zone" rekent op de zone waarin die bar ligt -- en de uitkomst zegt erbij op
   welke plek dat getal gemeten is. Wordt er nergens boven deze plek geteld, dan
   staat er alleen `vast` en meldt de uitkomst dat de rest niet te rekenen valt.
   Een meter zonder invoer hoort niets te beweren (LAT-regel 3).

   ER STAAT GEEN TWEEDE BLINDEVLEKMELDER IN. Hier stond even een vlag voor "op
   deze plek wordt niets geteld", en die is er weer uit. Twee redenen. De eerste
   is dat hij vrijwel onbereikbaar was: elke plek ligt in een terrein en een
   terrein telt, dus er is bijna altijd een tellende plek boven. De tweede weegt
   zwaarder: welke plekken een drempel hebben maar niet gemeten worden, staat al
   in ./uitzondering.js (`ongemeten`), en dat is de plek waar de cockpit het
   leest. Een tweede lijst met blinde vlekken, anders gerekend, loopt uit de pas
   met de eerste (LAT-regel 4). Wat hier wel staat is `gemetenOp` en `aanwezig`:
   waarop gerekend is, en met welk getal.

   WAT HIER NIET STAAT: een standaardnorm. Geen "meestal 1 op 250", geen
   startlijst met kengetallen. Zo'n lijst ziet eruit als kennis en is een gok,
   en hij wordt nooit meer weggehaald zodra hij er staat. */
'use strict';

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

module.exports = (ctx) => {
  const { save, crypto, schoon, editieVind, dagVind, plekVind, plekPad, offset,
    duurVan, bezetting, PLEK_SOORTEN } = ctx;

  const bak = (e) => {
    if (!e.normen || typeof e.normen !== 'object') e.normen = {};
    return e.normen;
  };
  const getal = (v, max) => Math.max(0, Math.min(max, parseInt(v, 10) || 0));

  /* Loopt naar boven tot de eerste plek waar mensen geteld worden. Dezelfde
     vraag als telplekVan() in ./toegang.js stelt bij een scan, en met opzet
     hetzelfde antwoord: als de telling en de norm het over verschillende
     plekken zouden hebben, klopt het percentage nooit. */
  function telplekBoven(e, pid) {
    const pad = plekPad(e, pid);
    if (!pad) return null;
    return pad.find(p => (PLEK_SOORTEN[p.soort] || {}).telt) || null;
  }

  function normZet(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const plek = plekVind(e, d.plek);
    if (!plek) return { status: 404, error: 'Deze plek bestaat niet.' };

    const wat = schoon(d.wat, 40) || 'mensen';
    const vast = getal(d.vast, 10000);
    const per100 = getal(d.per100, 10000);
    if (!vast && !per100) return { status: 400, error: 'Een norm zonder aantal zegt niets: vul vast of per100 in.' };

    const van = String(d.van || ''), tot = String(d.tot || '');
    if (!HHMM.test(van) || !HHMM.test(tot)) return { status: 400, error: 'Geef begin en eind als uu:mm.' };

    /* HET VENSTER MOET OP EEN ECHTE DAG PASSEN. Een norm van 10:00 tot 18:00 op
       een festival dat om 20:00 opengaat, zou anders stil nooit meetellen -- en
       dan staat er een bemensing die niemand ooit ziet gebeuren (LAT-regel 5). */
    const dagId = d.dag ? String(d.dag) : null;
    const dagen = dagId ? [dagVind(e, dagId)] : (e.dagen || []);
    if (dagId && !dagen[0]) return { status: 404, error: 'Deze dag staat niet in de editie.' };
    const past = dagen.filter(Boolean).some(dg => {
      const v = offset(dg, van), t = offset(dg, tot);
      return v !== null && t !== null && t > v;
    });
    if (!past) {
      return { status: 400, error: dagId
        ? 'Die tijden vallen buiten de openingstijden van die dag.'
        : 'Die tijden vallen op geen enkele dag van deze editie binnen de openingstijden.' };
    }

    const b = bak(e);
    const velden = { plek: plek.id, wat, vast, per100, van, tot, dag: dagId };
    if (d.id) {
      const x = b[String(d.id)];
      if (!x) return { status: 404, error: 'Deze norm bestaat niet.' };
      Object.assign(x, velden);
      save();
      return { ok: true, norm: x };
    }
    if (Object.keys(b).length >= 2000) return { status: 400, error: 'Tot tweeduizend normen per editie.' };
    const x = { id: 'norm' + crypto.randomBytes(3).toString('hex'), ...velden };
    b[x.id] = x;
    save();
    return { ok: true, norm: x };
  }

  function normWeg(fid, eid, id) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const b = bak(e);
    if (!b[String(id || '')]) return { status: 404, error: 'Deze norm bestaat niet.' };
    delete b[String(id)];
    save();
    return { ok: true };
  }

  /* De normen die op deze dag gelden: die van de dag zelf plus die van elke
     dag. Zonder dag: alles, want dat is de inrichtingsvraag. */
  function normenVan(fid, eid, dagId) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const dag = dagId ? dagVind(e, dagId) : null;
    if (dagId && !dag) return { status: 404, error: 'Deze dag staat niet in de editie.' };
    const uit = Object.values(bak(e))
      .filter(n => !dag || !n.dag || n.dag === dag.id)
      .map(n => ({ ...n, plekNaam: (plekVind(e, n.plek) || {}).naam || null }))
      .sort((a, b) => a.van.localeCompare(b.van));
    return { ok: true, normen: uit };
  }

  /* DE VRAAG OP EEN MOMENT. Per norm die dan geldt: hoeveel er hoort te staan,
     waarop dat gerekend is, en of dat gemeten of alleen vast is.

     De aanwezigen komen uit de bezetting van NU en niet uit die van het moment
     waar naar gevraagd wordt. Vooruitkijken met een gemeten getal van straks
     kan niet -- dat getal bestaat nog niet. Dat staat dus zo in de uitkomst
     (`gerekendOpNu`), zodat een scherm het niet als voorspelling kan verkopen. */
  function vraagOp(fid, eid, vraag) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const v = vraag || {};
    const dag = dagVind(e, v.dag);
    if (!dag) return { status: 404, error: 'Deze dag staat niet in de editie.' };
    const nu = offset(dag, String(v.tijd || ''));
    if (nu === null) return { status: 400, error: 'Dat moment valt buiten deze dag.' };
    const vooruit = Math.max(0, Math.min(240, parseInt(v.vooruit, 10) || 0));
    const moment = Math.min(nu + vooruit, duurVan(dag));

    const tel = bezetting(fid, eid, dag.id);
    const aanwezigOp = new Map();
    if (tel.ok) for (const p of tel.plekken) aanwezigOp.set(p.id, p.aanwezig);

    const uit = [];
    for (const n of Object.values(bak(e))) {
      if (n.dag && n.dag !== dag.id) continue;
      const van = offset(dag, n.van), tot = offset(dag, n.tot);
      if (van === null || tot === null || moment < van || moment >= tot) continue;
      const plek = plekVind(e, n.plek);
      if (!plek) continue;
      const teller = telplekBoven(e, n.plek);
      const aanwezig = teller ? (aanwezigOp.get(teller.id) || 0) : null;
      const bij = (n.per100 && aanwezig !== null) ? Math.ceil((n.per100 * aanwezig) / 100) : 0;
      uit.push({ norm: n.id, plek: plek.id, plekNaam: plek.naam, wat: n.wat,
        nodig: n.vast + bij, vast: n.vast, per100: n.per100,
        van: n.van, tot: n.tot,
        gemetenOp: teller ? teller.naam : null, aanwezig });
    }
    uit.sort((a, b) => b.nodig - a.nodig);
    return { ok: true, dag: dag.id, moment, gerekendOpNu: true, vraag: uit };
  }

  return { normZet, normWeg, normenVan, vraagOp };
};
