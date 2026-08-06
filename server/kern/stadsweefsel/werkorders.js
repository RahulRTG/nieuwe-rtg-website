/* RTG Stadsweefsel, deel "werkorders": van zaak naar uitgevoerd werk.

   Een zaak is wat de stad WEET, een werkorder is wat er GEBEURT. Die twee uit
   elkaar houden is niet netjesheid maar noodzaak: een zaak kan drie werkorders
   nodig hebben (een noodreparatie, een inspectie en een definitieve
   vervanging), en een werkorder kan bestaan zonder dat iemand iets meldde --
   gepland onderhoud is de helft van het werk van een stad.

   De keten: open -> toegewezen -> bezig -> klaar (of geannuleerd, met reden).
   Klaarmelden is het moment waarop alles samenkomt: het boekt de handeling in
   de ONDERHOUDSHISTORIE van het object, legt de kosten en de uren vast, en
   sluit de zaak zodra al haar werkorders klaar zijn. Daarmee weet de stad
   achteraf wat een probleem heeft gekost en hoe lang het duurde -- de twee
   getallen waar elke bestuurdersvraag op uitkomt.

   WAT HIER MET OPZET NIET STAAT: de aannemer is nu een naam op de order en
   geen partij met een contract, een SLA of een factuur. Dat is de volgende
   laag (contractanten, budgetten, prestatiemeting); zonder die laag zou een
   veld 'contractId' hier een belofte zijn die niemand waarmaakt.

   Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
const { schoon } = require('../util');

const STATUS = ['open', 'toegewezen', 'bezig', 'klaar', 'geannuleerd'];
const SOORTEN = ['storing', 'onderhoud', 'inspectie', 'vervanging', 'schouw'];
const MAX = 20000;

module.exports = (ctx) => {
  const { d, save, crypto, nu, geo, obj, zkn } = ctx;

  const orders = () => { if (!Array.isArray(d().weefselWerk)) d().weefselWerk = []; return d().weefselWerk; };
  const order = (id) => orders().find(w => w.id === String(id || '')) || null;
  const isOpen = (w) => !['klaar', 'geannuleerd'].includes(w.status);

  function werkorderMaak(inv) {
    inv = inv || {};
    const z = inv.zaakId ? zkn.zaak(inv.zaakId) : null;
    if (inv.zaakId && !z) return { status: 404, error: 'Onbekende zaak.' };
    const o = obj.object(inv.objectId) || (z && z.objectId ? obj.object(z.objectId) : null);
    const omschrijving = schoon(inv.omschrijving, 200) ||
      (z ? z.categorieLabel + ': ' + z.waarnemingen[z.waarnemingen.length - 1].tekst : '');
    if (!omschrijving) return { status: 400, error: 'Wat moet er gebeuren?' };
    const gebied = (z && z.gebied) || (o && o.gebied) || null;
    if (orders().length >= MAX) return { status: 429, error: 'De werkvoorraad zit vol.' };
    const w = {
      id: 'WO-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      zaakId: z ? z.id : null, objectId: o ? o.id : null, gebied,
      soort: SOORTEN.includes(inv.soort) ? inv.soort : (z ? 'storing' : 'onderhoud'),
      omschrijving, ploeg: schoon(inv.ploeg, 40) || (z ? z.ploeg : 'openbare werken'),
      organisatie: schoon(inv.organisatie, 60) || (o ? o.beheerder : 'RTG Stadsbeheer'),
      prioriteit: z ? z.prioriteit : (['laag', 'normaal', 'hoog', 'urgent'].includes(inv.prioriteit) ? inv.prioriteit : 'normaal'),
      status: 'open', uitvoerder: null, kosten: 0, uren: 0, notitie: null,
      door: schoon(inv.wie, 60) || 'weefsel', at: nu(), klaarAt: null
    };
    orders().unshift(w);
    if (z && !z.werkorders.includes(w.id)) z.werkorders.push(w.id);
    if (o && w.soort === 'storing' && o.status === 'in-dienst') o.status = 'storing';
    save();
    return { ok: true, werkorder: publiek(w) };
  }

  function publiek(w) {
    const o = w.objectId ? obj.object(w.objectId) : null;
    const z = w.zaakId ? zkn.zaak(w.zaakId) : null;
    return { ...w, plaats: geo.label(w.gebied), zaakRef: z ? z.ref : null,
      object: o ? { id: o.id, naam: o.naam, soort: o.soort, risico: o.risico, conditie: o.conditie } : null };
  }

  function werkorderZet({ id, status, uitvoerder, ploeg, wie }) {
    const w = order(id);
    if (!w) return { status: 404, error: 'Onbekende werkorder.' };
    if (['klaar', 'geannuleerd'].includes(w.status)) return { status: 400, error: 'Deze werkorder is al afgerond.' };
    if (status !== undefined) {
      if (!STATUS.includes(status)) return { status: 400, error: 'Kies een status: ' + STATUS.join(', ') + '.' };
      if (status === 'klaar') return { status: 400, error: 'Klaarmelden gaat via de klaarmelding (met naam en kosten).' };
      w.status = status;
      if (status === 'geannuleerd') { w.klaarAt = nu(); w.notitie = schoon(wie, 60) || w.notitie; }
    }
    if (uitvoerder !== undefined) { w.uitvoerder = schoon(uitvoerder, 60) || null; if (w.status === 'open' && w.uitvoerder) w.status = 'toegewezen'; }
    if (ploeg !== undefined) w.ploeg = schoon(ploeg, 40) || w.ploeg;
    save();
    return { ok: true, werkorder: publiek(w) };
  }

  /* Klaarmelden: het enige moment waarop de stad iets LEERT. De handeling gaat
     de onderhoudshistorie van het object in, de kosten en uren blijven staan,
     en als dit de laatste openstaande werkorder van de zaak was, gaat de zaak
     dicht -- inclusief het seintje terug naar de melder. */
  function werkorderKlaar({ id, wie, notitie, kosten, uren }) {
    const w = order(id);
    if (!w) return { status: 404, error: 'Onbekende werkorder.' };
    if (!isOpen(w)) return { status: 400, error: 'Deze werkorder is al afgerond.' };
    const naam = schoon(wie, 60) || 'veld';
    w.status = 'klaar'; w.klaarAt = nu(); w.uitvoerder = w.uitvoerder || naam;
    w.notitie = schoon(notitie, 200) || null;
    w.kosten = Number(kosten) > 0 ? Math.round(Number(kosten) * 100) / 100 : 0;
    w.uren = Number(uren) > 0 ? Math.round(Number(uren) * 10) / 10 : 0;
    if (w.objectId) obj.onderhoudBoek(w.objectId, { wat: w.omschrijving, wie: naam, kosten: w.kosten, werkorder: w.id });
    let zaakDicht = null;
    if (w.zaakId) {
      const nog = orders().filter(x => x.zaakId === w.zaakId && isOpen(x));
      if (!nog.length) zaakDicht = zkn.zaakKlaar(w.zaakId, naam, w.notitie);
    }
    save();
    return { ok: true, werkorder: publiek(w), zaakGesloten: zaakDicht ? zaakDicht.ref : null };
  }

  // de werkvoorraad, zoals de veld-app hem toont
  function werklijst(f) {
    f = f || {};
    let rij = orders().filter(isOpen);
    if (f.ploeg) rij = rij.filter(w => w.ploeg === String(f.ploeg));
    if (f.organisatie) rij = rij.filter(w => w.organisatie === String(f.organisatie));
    if (f.gebied) rij = rij.filter(w => w.gebied === f.gebied || geo.binnen(f.gebied, w.gebied));
    const rang = { urgent: 0, hoog: 1, normaal: 2, laag: 3 };
    return rij.sort((a, b) => (rang[a.prioriteit] - rang[b.prioriteit]) || (a.at - b.at));
  }

  // de zaak-motor maakt bij elke nieuwe zaak vanzelf werk aan (late binding,
  // want zaken.js is eerder gemount dan dit deel)
  ctx.werkVoorZaak = (z) => werkorderMaak({ zaakId: z.id, wie: 'weefsel' });

  return {
    STATUS, SOORTEN, werkorderMaak, werkorderZet, werkorderKlaar, werklijst, order, orders, isOpen, publiek,
    voorZaak: (zaakId) => orders().filter(w => w.zaakId === String(zaakId || '')),
    api: {
      weefselWerklijst: (f) => {
        const rij = werklijst(f);
        return { status: 200, aantal: rij.length, soorten: SOORTEN, werkorders: rij.slice(0, 200).map(publiek) };
      },
      weefselWerkorderMaak: werkorderMaak,
      weefselWerkorderZet: werkorderZet,
      weefselWerkorderKlaar: werkorderKlaar
    }
  };
};
