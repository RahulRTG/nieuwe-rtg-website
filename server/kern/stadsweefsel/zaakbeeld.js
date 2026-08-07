/* RTG Stadsweefsel, deel "zaakbeeld": een zaak bijhouden en tonen.

   zaken.js is de INGANG (een waarneming binnen, duplicaat of niet); dit is wat
   er daarna met een zaak gebeurt: hoe hij naar buiten gaat, wie hem mag zien,
   hoe een behandelaar hem verzet, en de vraag die de stad slimmer maakt dan
   een meldingenlijst -- hangen deze open zaken onder een gedeelde oorzaak?

   De naad zit hier omdat die twee verschillend van aard zijn: de ingang moet
   streng en snel zijn (hij staat op het pad van elke melding), het beeld moet
   volledig en leesbaar zijn. Krijgt de gedeelde ctx plus de zaakhelpers. */
module.exports = (ctx, H) => {
  const { save, nu, geo, obj, afh } = ctx;
  const { zaken, zaak, open, schoon, CATS, STATUS, PRIOS } = H;

  /* Wat er van een zaak naar buiten gaat. De melder-codenamen blijven binnen:
     wie een zaak bekijkt hoort te zien DAT er vier mensen over belden, niet
     wie dat waren. De veldploeg heeft aan het aantal genoeg. */
  function publiek(z, { metMelders } = {}) {
    const o = z.objectId ? obj.object(z.objectId) : null;
    return {
      id: z.id, ref: z.ref, categorie: z.categorie, categorieLabel: z.categorieLabel,
      status: z.status, prioriteit: z.prioriteit, ploeg: z.ploeg,
      plaats: geo.label(z.gebied), gebied: z.gebied, zone: z.zone, lat: z.lat, lng: z.lng,
      object: o ? { id: o.id, naam: o.naam, soort: o.soort, risico: o.risico, status: o.status } : null,
      melders: z.waarnemingen.length, kanalen: [...new Set(z.waarnemingen.map(w => w.kanaal))],
      // de EERSTE waarneming is de omschrijving (de lijst staat nieuwste eerst):
      // wie als eerste belde, beschreef het probleem; de rest bevestigt het
      omschrijving: z.waarnemingen[z.waarnemingen.length - 1].tekst,
      waarnemingen: z.waarnemingen.map(w => ({ id: w.id, kanaal: w.kanaal, tekst: w.tekst, at: w.at,
        bronRef: w.bronRef, ...(metMelders ? { melder: w.melder } : {}) })),
      oorzaak: z.oorzaak, werkorders: z.werkorders.slice(), notities: z.notities.slice(0, 10),
      at: z.at, klaarAt: z.klaarAt, klaarDoor: z.klaarDoor
    };
  }

  /* De zaak zoals de MELDER hem mag zien, en dat is bewust minder dan publiek().

     Dit is een gat dat het samenvoegen zelf maakte. Zolang elke melding een
     eigen dossier was, kon een melder alleen zijn eigen tekst terugzien. Nu
     meerdere mensen op EEN zaak uitkomen, zou de gewone zaakweergave hem de
     vrije tekst van zijn buren tonen -- inclusief wat die erbij schreven. Dat
     botst met de belofte in Mijn Stad ("je melding is alleen voor jou en de
     veldploeg zichtbaar"), dus deze weergave draagt alleen de eigen tekst plus
     de stand. Het AANTAL melders mag er wel bij: dat een probleem breder speelt
     is geen gegeven van iemand anders. */
  function voorMelder(z, codenaam) {
    const mijn = z.waarnemingen.find(w => w.melder === codenaam);
    if (!mijn) return null;
    return { id: z.id, ref: z.ref, categorie: z.categorie, categorieLabel: z.categorieLabel,
      plaats: geo.label(z.gebied), status: z.status, prioriteit: z.prioriteit,
      tekst: mijn.tekst, at: mijn.at, melders: z.waarnemingen.length,
      klaarAt: z.klaarAt, klaarDoor: z.klaarDoor };
  }

  /* De gedeelde oorzaak. Zodra meerdere open zaken van dezelfde categorie aan
     verschillende objecten hangen, vraagt de motor aan de afhankelijkheidsgraaf
     of die objecten een gemeenschappelijke bron hebben. Zo ja: dat is geen
     bewijs, wel het eerste dat een mens moet nakijken. */
  function oorzaakZoek(categorie) {
    const rij = zaken().filter(z => open(z) && z.categorie === categorie && z.objectId);
    if (rij.length < 2) return null;
    const bron = afh.gemeenschappelijk(rij.map(z => z.objectId));
    if (!bron) return null;
    return { object: bron.object, zaken: rij.map(z => z.ref), stappen: bron.stappen,
      tekst: rij.length + ' open zaken (' + CATS[categorie] + ') hangen allemaal onder ' + bron.object.naam +
        '. Controleer die eerst: mogelijk een gedeelde oorzaak in plaats van ' + rij.length + ' losse klussen.' };
  }

  function zaakZet({ id, status, prioriteit, ploeg, notitie, wie }) {
    const z = zaak(id);
    if (!z) return { status: 404, error: 'Onbekende zaak.' };
    if (status !== undefined) {
      if (!STATUS.includes(status)) return { status: 400, error: 'Kies een status: ' + STATUS.join(', ') + '.' };
      z.status = status;
      if (status === 'klaar' || status === 'afgewezen') { z.klaarAt = nu(); z.klaarDoor = schoon(wie, 60) || 'kantoor'; }
    }
    if (prioriteit !== undefined) {
      if (!PRIOS.includes(prioriteit)) return { status: 400, error: 'Kies een prioriteit: ' + PRIOS.join(', ') + '.' };
      z.prioriteit = prioriteit;
    }
    if (ploeg !== undefined) z.ploeg = schoon(ploeg, 40) || z.ploeg;
    const n = schoon(notitie, 200);
    if (n) z.notities.unshift({ tekst: n, door: schoon(wie, 60) || 'kantoor', at: nu() });
    z.notities = z.notities.slice(0, 40);
    save();
    if (ctx.zaakSeintje) { try { ctx.zaakSeintje(z); } catch (e) { ctx.stil('seintje', e); } }
    return { ok: true, zaak: publiek(z) };
  }

  /* Een zaak sluiten vanuit het veld (via de werkorder); geen route, wel het
     pad waarlangs bijna elke zaak eindigt.

     HIER WORDT MET OPZET GEEN ONDERHOUD GEBOEKT. Dat doet de werkorder, en
     alleen die: daar staan de uitvoerder, de kosten en de uren. De eerste
     versie boekte het op allebei de plekken, en dan staat er in de historie
     van een lantaarnpaal twee keer dezelfde reparatie -- een keer met kosten
     en een keer met nul. Wie later "wat kost verlichting per jaar" vraagt,
     krijgt dan een antwoord dat van de volgorde van twee functies afhangt. */
  function zaakKlaar(id, wie, notitie) {
    const z = zaak(id);
    if (!z || !open(z)) return null;
    z.status = 'klaar'; z.klaarAt = nu(); z.klaarDoor = schoon(wie, 60) || 'veld';
    const n = schoon(notitie, 200);
    if (n) z.notities.unshift({ tekst: n, door: z.klaarDoor, at: nu() });
    save();
    if (ctx.zaakSeintje) { try { ctx.zaakSeintje(z); } catch (e) { ctx.stil('seintje', e); } }
    return z;
  }

  function lijst(f) {
    f = f || {};
    let rij = zaken();
    if (f.status) rij = rij.filter(z => z.status === String(f.status));
    else if (!f.alles) rij = rij.filter(open);
    if (f.categorie) rij = rij.filter(z => z.categorie === String(f.categorie));
    if (f.ploeg) rij = rij.filter(z => z.ploeg === String(f.ploeg));
    if (f.gebied) rij = rij.filter(z => z.gebied === f.gebied || geo.binnen(f.gebied, z.gebied));
    if (f.objectId) rij = rij.filter(z => z.objectId === String(f.objectId));
    return rij;
  }
  const vanMelder = (codenaam) => codenaam ? zaken().filter(z => z.waarnemingen.some(w => w.melder === codenaam)) : [];

  return { publiek, voorMelder, oorzaakZoek, zaakZet, zaakKlaar, lijst, vanMelder };
};
