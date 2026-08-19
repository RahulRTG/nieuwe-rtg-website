/* School (deelmodule): de les afronden, en wat de les onthoudt.

   De doelstelling van Teacher Flow, hard: een docent voert tijdens een normale
   les vrijwel niets in. Aan het eind staat er EEN vraag -- les afronden? -- met
   een concept dat het systeem zelf heeft opgemaakt uit wat er toch al gebeurde:
   de presentie van vandaag, de leerdoelen die vandaag aan de orde waren, en de
   denkpatronen die vandaag langskwamen. Een handeling: bevestigen.

   TEACHING MEMORY. Wat er bij het afronden wordt vastgelegd, komt volgend jaar
   terug bij hetzelfde leerdoel: "de vorige keer liep het hier vast, en dit
   werkte". Niet alleen het kind leert; de les leert.

   Vier grenzen die dit eerlijk houden:

   1. HET CONCEPT IS EEN CONCEPT. Het systeem rondt niets vanzelf af. Zonder
      bevestiging van een mens gebeurt er niets, en de naam van die mens staat
      erbij -- dat is dezelfde regel als bij het rapport.
   2. EEN LESVERSLAG GAAT OVER DE LES, NIET OVER KINDEREN. Er wordt geen enkele
      leerlingsleutel of naam in vastgelegd; van de presentie gaat alleen de
      TELLING mee. Wie er was, staat in de presentielijst en hoort niet in een
      verslag dat jaren blijft liggen.
   3. HET GEHEUGEN IS VAN DE SCHOOL EN NIET VAN DE LERAAR. Het staat op de
      school en niet in een kladblok dat vertrekt als de docent vertrekt --
      precies het punt van Institutional Memory. Met besluit, eigenaar en datum.
   4. GEEN SAMENVATTING OVER MENSEN. Wat er in de notitie staat, heeft een mens
      zelf getypt. Er wordt hier niets over een docent of een kind samengevat. */
const MAX_LESSEN = 2000;
const TOON = 5;

/* De VORM van een lesverslag staat hier, los van de route en zonder iets uit
   de omgeving. Dat is met opzet: een verslag blijft jaren liggen, dus wat erin
   mag staan hoort op een plek te staan die je kunt nalezen en vastzetten. De
   toets meet deze sleutelverzameling; er stilletjes een presentieregel met
   namen bij zetten, laat hem zakken. */
const VELDEN = ['id', 'klasCode', 'klas', 'fase', 'datum', 'door', 'at', 'doelen', 'aanwezig', 'werkte', 'liepVast'];

function verslagVan(k, d, id, at, scho) {
  const telling = d.telling && typeof d.telling === 'object'
    ? Object.fromEntries(Object.entries(d.telling).slice(0, 8)
      .map(([stand, n]) => [String(stand).slice(0, 20), Math.max(0, Number(n) || 0)]))
    : {};
  return { id, klasCode: k.code, klas: k.naam, fase: k.fase || null,
    datum: scho(d.datum, 10) || new Date().toISOString().slice(0, 10),
    door: scho(d.door, 60), at,
    doelen: (Array.isArray(d.doelen) ? d.doelen : []).map(x => String(x || '').trim()).filter(Boolean).slice(0, 20),
    /* Alleen de TELLING van de presentie. Wie er was staat in de presentielijst
       en hoort niet in een verslag dat de school jaren bewaart. */
    aanwezig: telling,
    werkte: scho(d.werkte, 300) || null,
    liepVast: scho(d.liepVast, 300) || null };
}

module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, S, eigenVeld, klasVan, presentieLijst } = sctx;
  const dag = () => new Date().toISOString().slice(0, 10);
  const L = (sch) => { if (!Array.isArray(sch.lessen)) sch.lessen = []; return sch.lessen; };

  const schoolVanKlas = (k) => (k.schoolCode ? eigenVeld(S(), k.schoolCode) : null);

  /* Wat was er vandaag aan de orde: de leerdoelen uit huiswerk dat vandaag
     afliep en uit toetsen waaraan vandaag is gewerkt. Dat is geen gok maar wat
     er staat; kloppen doet het pas als de leraar het bevestigt. */
  function doelenVanVandaag(k, vandaag) {
    const uit = new Set();
    for (const h of (k.huiswerk || [])) if (h.doel && (h.deadline === vandaag || String(h.at || '').slice(0, 10) === vandaag)) uit.add(h.doel);
    for (const t of (k.toetsen || [])) {
      const gewerkt = Object.values(t.werk || {}).some(w => String(w.at || t.at || '').slice(0, 10) === vandaag);
      if (gewerkt || String(t.at || '').slice(0, 10) === vandaag) for (const d of (t.doelen || [])) uit.add(d);
    }
    return [...uit].slice(0, 20);
  }

  /* ---------- het concept: wat het systeem zelf al weet ---------- */
  router.post('/school/les/concept', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const sch = schoolVanKlas(k);
    const vandaag = schoon(req.body.datum, 10) || dag();
    const lijst = (presentieLijst && sch ? presentieLijst(sch) : [])
      .filter(p => p.klasCode === k.code && p.datum === vandaag);
    // alleen de TELLING per stand: wie er was, hoort in de presentielijst
    const telling = {};
    for (const les of lijst) for (const r of (les.regels || [])) telling[r.stand] = (telling[r.stand] || 0) + 1;
    const patronen = [];
    for (const [doel, perDoel] of Object.entries(k.patronen || {}))
      for (const [id, rij] of Object.entries(perDoel))
        if (String(rij.laatst || '').slice(0, 10) === vandaag) patronen.push({ doel, denkfout: id, aantal: rij.aantal });

    res.json({ ok: true, datum: vandaag, klas: { code: k.code, naam: k.naam },
      presentie: { gezet: lijst.length > 0, uren: lijst.length, telling },
      doelen: doelenVanVandaag(k, vandaag), patronen: patronen.slice(0, 10),
      alAfgerond: L(sch || {}).some(x => x.klasCode === k.code && x.datum === vandaag),
      uitleg: 'Dit is een concept uit wat er vandaag al gebeurde. Er wordt niets vastgelegd tot u het bevestigt.' });
  });

  /* ---------- afronden: een handeling, door een mens ---------- */
  router.post('/school/les/rond-af', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const sch = schoolVanKlas(k);
    if (!sch) return res.status(404).json({ error: 'Deze klas hoort niet bij een school.' });
    if (req.body.bevestigd !== true)
      return res.status(400).json({ error: 'Een les wordt afgerond door een mens die bevestigt, niet vanzelf.' });
    if (!schoon(req.body.door, 60)) return res.status(400).json({ error: 'Zet uw naam erbij; een lesverslag zonder eigenaar is van niemand.' });
    const les = verslagVan(k, req.body || {}, rid(6), nu(), schoon);
    L(sch).unshift(les);
    sch.lessen = L(sch).slice(0, MAX_LESSEN);
    save();
    res.json({ ok: true, les: { id: les.id, datum: les.datum, doelen: les.doelen.length },
      uitleg: 'Vastgelegd op uw naam. Dit komt terug bij dezelfde leerdoelen, ook als u er dan niet meer bent.' });
  });

  /* ---------- Teaching Memory: wat weten we van deze stof ---------- */
  router.post('/school/les/geheugen', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const sch = schoolVanKlas(k);
    const doel = String(req.body.doel || '').trim();
    const alles = L(sch || {}).filter(x => !doel || (x.doelen || []).includes(doel));
    const eerder = alles.filter(x => x.werkte || x.liepVast).slice(0, TOON)
      .map(x => ({ datum: x.datum, klas: x.klas, door: x.door, werkte: x.werkte, liepVast: x.liepVast, doelen: x.doelen }));
    res.json({ ok: true, doel: doel || null, eerder, aantal: alles.length,
      uitleg: eerder.length
        ? 'Wat eerdere lessen over deze stof hebben opgeschreven, met wie het opschreef en wanneer.'
        : 'Over deze stof is nog niets opgeschreven. Wat u bij het afronden noteert, staat hier de volgende keer.' });
  });
};
module.exports.verslagVan = verslagVan;
module.exports.VELDEN = VELDEN;
