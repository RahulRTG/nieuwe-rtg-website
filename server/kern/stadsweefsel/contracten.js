/* RTG Stadsweefsel, deel "contracten": de aannemer als PARTIJ, niet als naam.

   Tot nu toe stond er op een werkorder een tekstje ("RTG Stadsbeheer") en
   daarmee kon de stad wel tellen wat een probleem kostte, maar niet of degene
   die het oploste zijn afspraken haalde. Dat is het verschil tussen
   administratie en bedrijfsvoering.

   Een CONTRACT bindt drie dingen aan elkaar:
   - een SCOPE: welke objectsoorten, in welk gebied. Daarmee weet een werkorder
     zelf welke partij hem hoort te doen, in plaats van dat een mens dat elke
     keer intikt (en de helft van de tijd anders).
   - een SLA per prioriteit: binnen hoeveel uur wordt er GEREAGEERD en binnen
     hoeveel dagen HERSTELD. Twee klokken, want ze meten iets anders: een
     aannemer die binnen het uur ter plaatse is en het daarna drie weken laat
     liggen, haalt maar de helft.
   - tarieven en een looptijd, zodat kosten en einddatum navolgbaar zijn.

   DE KLOK STOPT BIJ EEN HANDELING, NIET BIJ EEN STATUS. De reactieklok stopt
   zodra de werkorder een uitvoerder heeft (iemand heeft hem opgepakt), de
   herstelklok pas bij het klaarmelden. Dat is met opzet: een status die je zelf
   kunt zetten zonder dat er iets gebeurt, is geen prestatie.

   Wat hier NIET staat: facturen. Een contract kent tarieven en een werkorder
   kent kosten, maar de gang naar de facturatiemotor is een eigen stap met een
   eigen goedkeuring, en die verzin ik hier niet bij.

   Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
const { schoon } = require('../util');

const UUR = 3600000, DAG = 86400000;
const PRIOS = ['laag', 'normaal', 'hoog', 'urgent'];
// een redelijke standaard-SLA; per contract te overschrijven
const SLA_STANDAARD = {
  reactieUur: { urgent: 2, hoog: 8, normaal: 48, laag: 120 },
  herstelDagen: { urgent: 1, hoog: 5, normaal: 21, laag: 60 }
};

module.exports = (ctx) => {
  const { d, save, crypto, nu, geo, obj } = ctx;

  const contracten = () => { if (!Array.isArray(d().weefselContracten)) d().weefselContracten = []; return d().weefselContracten; };
  const contract = (id) => contracten().find(c => c.id === String(id || '')) || null;
  const loopt = (c) => c.actief && (!c.eind || c.eind >= nu());

  function contractMaak(inv) {
    inv = inv || {};
    const partij = schoon(inv.partij, 80);
    if (!partij) return { status: 400, error: 'Welke partij voert het werk uit?' };
    const soorten = (Array.isArray(inv.soorten) ? inv.soorten : []).map(s => String(s)).filter(s => obj.SOORTEN[s]);
    if (!soorten.length) return { status: 400, error: 'Kies minstens een objectsoort: ' + Object.keys(obj.SOORTEN).join(', ') + '.' };
    const gebied = inv.gebied ? geo.gebied(inv.gebied) : null;
    if (inv.gebied && !gebied) return { status: 404, error: 'Onbekend gebied.' };
    const eind = Number(inv.eind);
    const c = {
      id: 'CT-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      partij, soorten, gebied: gebied ? gebied.id : null,
      sla: sla(inv.sla), tarief: { uur: getal(inv.tariefUur, 65), voorrijden: getal(inv.tariefVoorrijden, 40) },
      start: nu(), eind: Number.isFinite(eind) && eind > nu() ? eind : null,
      actief: true, door: schoon(inv.wie, 60) || 'kantoor', at: nu()
    };
    contracten().push(c);
    save();
    return { ok: true, contract: publiek(c) };
  }
  const getal = (v, standaard) => (Number(v) > 0 ? Math.round(Number(v) * 100) / 100 : standaard);

  // een SLA overnemen, veld voor veld, met de standaard als bodem: een half
  // ingevulde SLA mag geen gaten laten waar dan stilletjes "geen norm" staat
  function sla(inv) {
    const uit = { reactieUur: {}, herstelDagen: {} };
    for (const p of PRIOS) {
      uit.reactieUur[p] = getal(inv && inv.reactieUur && inv.reactieUur[p], SLA_STANDAARD.reactieUur[p]);
      uit.herstelDagen[p] = getal(inv && inv.herstelDagen && inv.herstelDagen[p], SLA_STANDAARD.herstelDagen[p]);
    }
    return uit;
  }

  function publiek(c) {
    return { ...c, gebiedNaam: c.gebied ? geo.label(c.gebied) : 'de hele stad',
      loopt: loopt(c), soortenLabel: c.soorten.map(s => obj.SOORTEN[s].label) };
  }

  function contractZet({ id, actief, eind, tariefUur, sla: nieuweSla, wie }) {
    const c = contract(id);
    if (!c) return { status: 404, error: 'Onbekend contract.' };
    if (actief !== undefined) c.actief = !!actief;
    if (eind !== undefined) { const e = Number(eind); c.eind = Number.isFinite(e) && e > 0 ? e : null; }
    if (tariefUur !== undefined) c.tarief.uur = getal(tariefUur, c.tarief.uur);
    if (nieuweSla !== undefined) c.sla = sla(nieuweSla);
    c.door = schoon(wie, 60) || c.door;
    save();
    return { ok: true, contract: publiek(c) };
  }

  /* Welk contract hoort bij dit werk? Het meest SPECIFIEKE lopende contract
     wint: een contract voor een klein gebied gaat voor een stadsbreed contract,
     en een contract voor weinig soorten gaat voor een dat alles dekt. Anders
     zou het toeval van de invoervolgorde bepalen wie er moet komen. */
  function voorWerk(w) {
    const o = w.objectId ? obj.object(w.objectId) : null;
    const kandidaten = contracten().filter(c => loopt(c) &&
      (!o || c.soorten.includes(o.soort)) &&
      (!c.gebied || (w.gebied && (c.gebied === w.gebied || geo.binnen(c.gebied, w.gebied)))));
    if (!kandidaten.length) return null;
    const diepte = (c) => (c.gebied ? geo.pad(c.gebied).length : 0);
    return kandidaten.sort((a, b) => (diepte(b) - diepte(a)) || (a.soorten.length - b.soorten.length))[0];
  }

  /* De SLA-klok op een werkorder zetten. Dit hangt aan werkorders.js via de
     ctx (late binding), zodat elke werkorder -- uit een zaak of uit gepland
     onderhoud -- zijn deadlines krijgt op het moment dat hij ontstaat. */
  function klokZet(w) {
    const c = voorWerk(w);
    if (!c) return null;
    const p = PRIOS.includes(w.prioriteit) ? w.prioriteit : 'normaal';
    w.contractId = c.id;
    w.organisatie = c.partij;
    w.slaReactieVoor = w.at + c.sla.reactieUur[p] * UUR;
    w.slaHerstelVoor = w.at + c.sla.herstelDagen[p] * DAG;
    return c;
  }

  /* Beoordelen op het moment dat het gebeurt, niet achteraf uitrekenen. Een
     deadline die je pas bij het rapport toetst, verschuift mee met wanneer je
     kijkt; een vinkje dat op het moment zelf is gezet, staat vast. */
  function reactieBoek(w) {
    if (!w.slaReactieVoor || w.reactieAt) return;
    w.reactieAt = nu();
    w.reactieBinnenSla = w.reactieAt <= w.slaReactieVoor;
  }
  function herstelBoek(w) {
    if (!w.slaHerstelVoor || w.herstelBinnenSla !== undefined) return;
    w.herstelBinnenSla = nu() <= w.slaHerstelVoor;
  }

  /* De prestatie van een partij. Alleen AFGERONDE werkorders tellen: wat nog
     loopt is geen uitslag. Loopt er iets over zijn deadline zonder dat het af
     is, dan staat dat er apart bij -- dat is de vorm waar een gemiddelde
     overheen kijkt. */
  function prestatie({ contractId, vanaf, tot } = {}) {
    const orders = ctx.werk.orders().filter(w => {
      if (contractId && w.contractId !== String(contractId)) return false;
      if (vanaf && w.at < Number(vanaf)) return false;
      if (tot && w.at > Number(tot)) return false;
      return !!w.contractId;
    });
    const perContract = {};
    for (const w of orders) {
      const c = contract(w.contractId);
      const r = perContract[w.contractId] || (perContract[w.contractId] = {
        contractId: w.contractId, partij: c ? c.partij : 'onbekend',
        open: 0, afgerond: 0, reactieOpTijd: 0, reactieGemeten: 0,
        herstelOpTijd: 0, herstelGemeten: 0, teLaatOpen: 0, kosten: 0, uren: 0
      });
      if (w.reactieAt) { r.reactieGemeten++; if (w.reactieBinnenSla) r.reactieOpTijd++; }
      if (w.status === 'klaar') {
        r.afgerond++; r.kosten += w.kosten || 0; r.uren += w.uren || 0;
        if (w.herstelBinnenSla !== undefined) { r.herstelGemeten++; if (w.herstelBinnenSla) r.herstelOpTijd++; }
      } else if (!['geannuleerd'].includes(w.status)) {
        r.open++;
        if (w.slaHerstelVoor && nu() > w.slaHerstelVoor) r.teLaatOpen++;
      }
    }
    const pct = (deel, geheel) => (geheel ? Math.round(deel / geheel * 100) : null);
    return { status: 200, partijen: Object.values(perContract).map(r => ({
      ...r, kosten: Math.round(r.kosten * 100) / 100,
      reactiePct: pct(r.reactieOpTijd, r.reactieGemeten),
      herstelPct: pct(r.herstelOpTijd, r.herstelGemeten),
      let_op: r.teLaatOpen ? r.teLaatOpen + ' werkorder(s) staan open EN over hun hersteltermijn; die tellen nog in geen enkel percentage mee' : null
    })) };
  }

  ctx.slaVoorWerk = klokZet;
  ctx.slaReactie = reactieBoek;
  ctx.slaHerstel = herstelBoek;

  return {
    SLA_STANDAARD, contract, contracten, voorWerk, klokZet, publiek,
    api: {
      weefselContracten: () => ({ status: 200, standaardSla: SLA_STANDAARD, aantal: contracten().length,
        contracten: contracten().map(publiek) }),
      weefselContractMaak: contractMaak,
      weefselContractZet: contractZet,
      weefselPrestatie: prestatie
    }
  };
};
