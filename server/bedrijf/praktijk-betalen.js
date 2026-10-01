'use strict';
// Alleen een verwijzing naar de centrale betaalwaarheid. De ontvanger wordt
// door de installatiebeheerder aan een werkruimte gebonden, nooit door de gast.
const V = require('./praktijk-vorm');
const RECHTEN = ['werkruimte', 'project', 'klant', 'geld', 'geld.goedkeuren'];
module.exports = ({ kern = {}, db, save, log, rechtenVan }, env = process.env) => {
  const bw = kern.betaalWaarheid, betaal = kern.betaal;
  function ontvanger(w, x) {
    if (!bw || !betaal || env.RTG_BETALEN_UIT === '1') return null;
    let kaart; try { kaart = JSON.parse(env.RTG_WERK_BETAALONTVANGERS || '{}'); } catch { return null; }
    const o = kaart && Object.hasOwn(kaart, w.code) && kaart[w.code];
    // Deze eerste rail ontvangt op de bestaande platformrekening. Een naam
    // invullen opent geen Connected Account of automatische leveranciersuitbetaling.
    if (!o || o.soort !== 'platform' || typeof o.naam !== 'string' || !o.naam.trim() || o.naam.length > 120 ||
        o.bestemming || !['stripe', 'mollie', 'adyen'].includes(o.aanbieder) ||
        !Array.isArray(o.valutas) || !o.valutas.includes(x.valuta)) return null;
    if (o.aanbieder === 'mollie' && x.decimalen !== 2) return null;
    // Deze providerafwijkingen vragen een expliciete adapter, geen stilzwijgende
    // factor 100. Bron: docs.stripe.com/currencies en Adyen currency-codes.
    if (o.aanbieder === 'stripe' && ['ISK','UGX'].includes(x.valuta)) return null;
    if (o.aanbieder === 'adyen' && ['CLP','CVE','IDR','ISK'].includes(x.valuta)) return null;
    const rail = betaal.mogelijkheden().rails.find(r => r.id === o.aanbieder && r.echt);
    return rail ? { soort: 'platform', naam: o.naam.trim(), aanbieder: o.aanbieder } : null;
  }
  function basis() {
    try {
      const u = new URL(env.RTG_WERK_BETAAL_ORIGIN || '');
      if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash) return null;
      return u.origin;
    } catch { return null; }
  }
  const record = (w, p, x) => {
    const r = bw && bw.van(x.betalingRef);
    return r && r.soort === 'werk-opdracht' && r.context?.werkruimte === w.code && r.bronRef === p.id ? r : null;
  };
  function bevoegd(w, x) {
    const id = x.betaalVerzoek?.door;
    if (!id) return env.NODE_ENV !== 'production' && x.betaalVerzoek?.door === null;
    const l = V.pak(w.leden, id);
    return !!(l && l.status === 'actief' && !l.extern && RECHTEN.every(r => rechtenVan(l).includes(r)));
  }
  function beeld(w, p, x) {
    const r = record(w, p, x), o = ontvanger(w, x);
    const beschikbaar = !!(o && basis() && Number.isSafeInteger(x.bedragMinor) && x.bedragMinor > 0);
    return { beschikbaar, aangezet: !!x.betaalVerzoek, ontvanger: r?.context?.ontvanger?.naam || o?.naam || null,
      stand: r ? bw.publiek(r) : null,
      magStarten: beschikbaar && bevoegd(w, x) && ['bevestigd', 'ingepland', 'uitgevoerd', 'afgerond'].includes(x.stand) &&
        (!r || ['AANGEMAAKT', 'WACHT_OP_KLANT', 'IN_BEHANDELING'].includes(r.status)),
      uitleg: beschikbaar ? 'U bevestigt bij de betaalprovider. RTG verwerkt de terugmelding automatisch.' :
        'Online betalen is voor deze werkplek en valuta nog niet ingericht.' };
  }
  function instellen(g, b) {
    if (g.alleenLezen || g.l.extern || !RECHTEN.every(r => g.rechten.includes(r)))
      return V.fout('U heeft ook rechten voor geld en goedkeuring nodig.', 403);
    const p = V.project(g.w, b.projectId), x = V.details(g.w, p);
    if (!p) return V.fout('Deze opdracht is niet gevonden.', 404);
    if (b.versie !== x.versie) return V.fout('De opdracht is gewijzigd. Vernieuw eerst.', 409);
    if (x.betalingRef) return V.fout('Er is al een betaling gestart. Stem deze eerst af in de betaaladministratie.', 409);
    if (typeof b.aan !== 'boolean') return V.fout('Kies aan of uit.');
    if (b.aan && (!['bevestigd', 'ingepland', 'uitgevoerd'].includes(x.stand) || !beeld(g.w,p,x).beschikbaar))
      return V.fout('Bevestig eerst de opdracht en richt de betaalontvanger in.', 409);
    x.betaalVerzoek = b.aan ? { door: g.l.id || null, ontvanger: ontvanger(g.w,x) } : null;
    x.versie++; log(g.w,g.l,'praktijk-betaalverzoek',p.id); return { ok:true };
  }
  function voorbereid(g,b) {
    const { w,p,x,d } = g, v = beeld(w,p,x);
    if (!v.magStarten || b.akkoord !== true || b.versie !== x.versie)
      return V.fout('Vernieuw de afspraak en bevestig de actuele betaalopdracht.', 409);
    const o = ontvanger(w,x);
    if (JSON.stringify(o) !== JSON.stringify(x.betaalVerzoek.ontvanger))
      return V.fout('De betaalontvanger is gewijzigd. Vraag de organisatie om controle.', 409);
    let r = record(w,p,x);
    if (x.betalingRef && !r) return V.fout('De betaalverwijzing vraagt controle.', 409);
    if (r && (r.centen !== x.bedragMinor || r.valuta !== x.valuta.toLowerCase() ||
        JSON.stringify(r.context.ontvanger) !== JSON.stringify(o))) return V.fout('De betaling vraagt controle.', 409);
    if (!r) {
      r = bw.maak({ actor:'werk:'+w.code+':'+p.id, idem:'opdracht', soort:'werk-opdracht', bronRef:p.id,
        centen:x.bedragMinor, valuta:x.valuta, context:{ werkruimte:w.code, ontvanger:o, linkId:d.id } });
      if (r.valuta !== x.valuta.toLowerCase() || r.context?.werkruimte !== w.code ||
          JSON.stringify(r.context?.ontvanger) !== JSON.stringify(o)) return V.fout('De bestaande betaling vraagt controle.',409);
      x.betalingRef = r.id;
    }
    bw.bereidVoor(r.id, { aanbieder:o.aanbieder, methode:o.aanbieder === 'stripe' ? 'hosted' : 'online',
      omschrijving:'RTG opdracht '+p.id, returnUrl:basis()+'/apps/werk.html#betaling-terug',
      webhookUrl:basis()+'/api/betaal/webhook/mollie' });
    save(); return { ok:true, id:r.id };
  }
  if (bw) bw.registreerAfhandeling('werk-opdracht', r => {
    const w = V.pak(db.data.werkruimtes,r.context?.werkruimte), p = w && V.project(w,r.bronRef), x = w && V.details(w,p);
    if (!p || x.betalingRef !== r.id || x.bedragMinor !== r.centen || x.valuta.toLowerCase() !== r.valuta)
      throw new Error('De betaalopdracht vraagt afstemming met de werkruimte.');
    // Geen gekopieerde betaald-vlag, geen automatische uitvoering of leveranciersboeking.
  });
  return { beeld, instellen, voorbereid, record };
};
