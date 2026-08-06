/* Foundation OS, deel "risico": het risicoregister per stad en landelijk.

   EEN RISICOREGISTER IS MEESTAL EEN SPREADSHEET DIE EEN KEER PER JAAR WORDT
   BIJGEWERKT VOOR DE ACCOUNTANT, en daarmee is het precies niets waard. Wat het
   wel waard maakt zijn twee dingen die software kan afdwingen en een
   spreadsheet niet: een risico kan niet op "beheerst" zonder dat er iets IS
   gedaan, en een herbeoordeling die verstrijkt valt op.

   GRENDEL 1: BEHEERST IS EEN BEWERING, EN DIE MOET GEDEKT ZIJN. Een zwaar
   risico (kans x impact vanaf 15) gaat niet op "beheerst" zonder maatregel,
   zonder eigenaar en zonder een herbeoordelingsdatum in de toekomst. Dat is
   geen bureaucratie: "beheerst" zonder die drie is een vinkje dat het bestuur
   laat denken dat er iets geregeld is.

   GRENDEL 2: EEN VERSTREKEN HERBEOORDELING WORDT GEREKEND, NIET OPGESLAGEN.
   Net als de gemiste subsidiekans komt hij terug als `verlopen`, elke keer dat
   je kijkt. Een register waarin oude regels stil blijven staan, meet alleen hoe
   lang niemand heeft gekeken.

   DE SCORE IS KANS x IMPACT, allebei 1 tot 5. Geen gewichten, geen formule met
   een correctiefactor -- die suggereren precisie die er niet is. Vijf klassen
   die iedereen in een bestuursvergadering meteen begrijpt is beter dan een
   getal dat uitgelegd moet worden. */

const CATEGORIEEN = ['financieel', 'reputatie', 'veiligheid', 'continuiteit', 'privacy', 'naleving', 'personeel'];
const STATUS = ['open', 'in_behandeling', 'beheerst', 'aanvaard', 'vervallen'];
const ZWAAR = 15;

module.exports = (ctx) => {
  const { nu, rid, schoon, S, audit, wie, poort, save } = ctx;

  const vind = id => S().risicos.find(r => r.id === String(id || '')) || null;
  const score = r => (Number(r.kans) || 0) * (Number(r.impact) || 0);
  const verlopen = r => !!r.herbeoordelenOp && Date.parse(r.herbeoordelenOp) < Date.now();

  const beeld = r => ({ id: r.id, stad: r.stad || null, titel: r.titel, omschrijving: r.omschrijving,
    categorie: r.categorie, kans: r.kans, impact: r.impact, score: score(r), zwaar: score(r) >= ZWAAR,
    status: r.status, maatregel: r.maatregel || '', eigenaar: r.eigenaar || null,
    herbeoordelenOp: r.herbeoordelenOp || null,
    // gerekend, niet opgeslagen: verlopen is een eigenschap van vandaag
    verlopen: verlopen(r) && !['vervallen', 'aanvaard'].includes(r.status),
    stappen: (r.stappen || []).slice(-20), at: r.at });

  /* Landelijke risico's hebben geen stad. Dat is geen uitzondering maar de
     kern: continuiteit van de hele stichting, de ANBI-status, een landelijke
     reputatiekwestie -- die horen niet in een stadsregister thuis. */
  function mag(req, stadId) {
    const w = wie(req);
    if (!stadId) {
      return w.landelijk ? { ok: true, w, stad: null } : { status: 403, error: 'Een landelijk risico registreert het landelijke bestuur.' };
    }
    const g = poort(w, stadId, 'stad.beheren');
    return g.ok ? { ok: true, w, stad: g.stad } : g;
  }

  function meld(req, b) {
    b = b || {};
    const g = mag(req, b.stad);
    if (!g.ok) return g;
    const titel = schoon(b.titel, 120);
    if (!titel) return { status: 400, error: 'Waar gaat dit risico over?' };
    const kans = Math.round(Number(b.kans) || 0);
    const impact = Math.round(Number(b.impact) || 0);
    if (kans < 1 || kans > 5 || impact < 1 || impact > 5) {
      return { status: 400, error: 'Kans en impact zijn allebei 1 tot 5. Vijf klassen die iedereen begrijpt, geen formule.' };
    }
    const r = { id: rid(), stad: g.stad ? g.stad.id : null, titel,
      omschrijving: schoon(b.omschrijving, 800),
      categorie: CATEGORIEEN.includes(b.categorie) ? b.categorie : 'continuiteit',
      kans, impact, status: 'open', maatregel: schoon(b.maatregel, 600),
      eigenaar: schoon(b.eigenaar, 60) || null,
      herbeoordelenOp: /^\d{4}-\d{2}-\d{2}$/.test(schoon(b.herbeoordelenOp, 10)) ? schoon(b.herbeoordelenOp, 10) : null,
      stappen: [], at: nu() };
    S().risicos.push(r);
    audit(g.w.key, 'risico.gemeld', r.id, titel + ' (' + kans + 'x' + impact + '=' + score(r) + ')');
    save();
    return { ok: true, risico: beeld(r) };
  }

  function zet(req, id, b) {
    b = b || {};
    const r = vind(id);
    if (!r) return { status: 404, error: 'Dit risico staat niet in het register.' };
    const g = mag(req, r.stad);
    if (!g.ok) return g;

    const nieuw = STATUS.includes(b.status) ? b.status : r.status;
    if (b.maatregel !== undefined) r.maatregel = schoon(b.maatregel, 600);
    if (b.eigenaar !== undefined) r.eigenaar = schoon(b.eigenaar, 60) || null;
    if (b.herbeoordelenOp !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(schoon(b.herbeoordelenOp, 10))) {
      r.herbeoordelenOp = schoon(b.herbeoordelenOp, 10);
    }
    if (b.kans !== undefined) {
      const k = Math.round(Number(b.kans) || 0);
      if (k >= 1 && k <= 5) r.kans = k;
    }
    if (b.impact !== undefined) {
      const i = Math.round(Number(b.impact) || 0);
      if (i >= 1 && i <= 5) r.impact = i;
    }

    /* GRENDEL 1. Een zwaar risico beheerst noemen vraagt drie dingen. Ze staan
       allemaal in het antwoord, want een weigering die niet zegt wat er
       ontbreekt, laat iemand raden. */
    if (nieuw === 'beheerst' && score(r) >= ZWAAR) {
      const mist = [];
      if (!r.maatregel || r.maatregel.length < 10) mist.push('een beheersmaatregel');
      if (!r.eigenaar) mist.push('een eigenaar');
      if (!r.herbeoordelenOp || Date.parse(r.herbeoordelenOp) <= Date.now()) mist.push('een herbeoordelingsdatum in de toekomst');
      if (mist.length) {
        return { status: 400, error: 'Dit risico weegt ' + score(r) + ' en kan niet op "beheerst" zonder ' + mist.join(', ') +
          '. Beheerst is een bewering; zonder die drie is het een vinkje.' };
      }
    }
    const oud = r.status;
    r.status = nieuw;
    if (!Array.isArray(r.stappen)) r.stappen = [];
    if (oud !== nieuw) r.stappen.push({ van: oud, naar: nieuw, door: g.w.key, at: nu() });
    audit(g.w.key, 'risico.zet', r.id, oud + ' -> ' + nieuw);
    save();
    return { ok: true, risico: beeld(r) };
  }

  function herbeoordeel(req, id, b) {
    b = b || {};
    const r = vind(id);
    if (!r) return { status: 404, error: 'Dit risico staat niet in het register.' };
    const g = mag(req, r.stad);
    if (!g.ok) return g;
    const datum = schoon(b.herbeoordelenOp, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || Date.parse(datum) <= Date.now()) {
      return { status: 400, error: 'Wanneer kijkt u er opnieuw naar? Een datum in de toekomst.' };
    }
    const notitie = schoon(b.notitie, 400);
    if (!notitie) return { status: 400, error: 'Wat is de stand nu? Een herbeoordeling zonder oordeel is alleen een nieuwe datum.' };
    r.herbeoordelenOp = datum;
    if (!Array.isArray(r.stappen)) r.stappen = [];
    r.stappen.push({ van: r.status, naar: r.status, notitie, door: g.w.key, at: nu() });
    audit(g.w.key, 'risico.herbeoordeeld', r.id, 'volgende keer ' + datum);
    save();
    return { ok: true, risico: beeld(r) };
  }

  function lijst(req, filter) {
    const f = filter || {};
    const w = wie(req);
    const mijn = w.landelijk ? null : [...new Set(w.zetels.map(z => z.stad))];
    let rijen = S().risicos.filter(r => {
      if (!r.stad) return !!w.landelijk;
      return !mijn || mijn.includes(r.stad);
    });
    if (f.stad) rijen = rijen.filter(r => r.stad === String(f.stad));
    if (f.categorie) rijen = rijen.filter(r => r.categorie === String(f.categorie));
    if (f.open) rijen = rijen.filter(r => !['vervallen', 'aanvaard'].includes(r.status));
    rijen = rijen.slice().sort((a, b) => score(b) - score(a));
    const zicht = rijen.map(beeld);
    return { ok: true, aantal: zicht.length, categorieen: CATEGORIEEN, statussen: STATUS, drempel: ZWAAR,
      zwaarEnOpen: zicht.filter(r => r.zwaar && !['beheerst', 'aanvaard', 'vervallen'].includes(r.status)).length,
      verlopen: zicht.filter(r => r.verlopen).length,
      risicos: zicht.slice(0, 200) };
  }

  return { meld, zet, herbeoordeel, lijst, vind, beeld, score, CATEGORIEEN, STATUS, ZWAAR };
};
module.exports.CATEGORIEEN = CATEGORIEEN;
module.exports.STATUS = STATUS;
