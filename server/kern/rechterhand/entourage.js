/* Rechterhand (deelmodule): Entourage -- uw vaste reisgezelschap. De mensen die u
   meeneemt, met hun band, hun voorkeuren, hun dieet en hun documenten.
   Gemount via index.js.

   RONDE 5 -- wat elders geld kost, zit hier in de pas. Bij de bekende reisapps
   is "we waarschuwen u als een document verloopt" precies de functie waarvoor
   het jaarabonnement bestaat. Hier zit hij in de pas, en breder:

   1. NIET ALLEEN HET PASPOORT. Een visum, een rijbewijs, een reisverzekering of
      een vaccinatiebewijs laat u net zo goed verlopen, en dan staat u aan de
      balie. Elk document heeft nu zijn eigen vervaldatum, en er is EEN lijst die
      alles bij elkaar zet, op datum, met wat er al verlopen is bovenaan.
      Het oude veld `paspoortTot` blijft werken: dat wordt gelezen als een
      document van de soort paspoort. Een gegeven, een plek.
   2. HET GEZELSCHAP SAMENSTELLEN. De kop van deze module beloofde "in een
      oogwenk een gezelschap samenstellen", maar dat deed hij niet. Nu wel: u
      kiest de mensen, en u krijgt terug wat er ontbreekt (geen dieet bekend,
      geen telefoon, document verlopen of bijna) plus de dieetwensen op een rij
      voor wie de tafel reserveert.

   Wat hier NIET komt: inreisvereisten per land. Die veranderen per week en per
   nationaliteit; iets beweren wat wij niet kunnen naslaan is erger dan niets
   zeggen. De app waarschuwt over data die U heeft ingevuld, en zegt dat erbij. */
module.exports = (ctx) => {
  const { save, rid, nu, schoon, isDatum, L } = ctx;
  const BANDEN = ['partner', 'familie', 'vriend', 'zakelijk', 'kind', 'overig'];
  const SOORTEN = ['paspoort', 'visum', 'rijbewijs', 'verzekering', 'vaccinatie', 'overig'];
  const VENSTER = 90;   // dagen vooruit waarin we waarschuwen
  const vandaag = () => new Date().toISOString().slice(0, 10);

  function E(key) { const l = L(key); if (!Array.isArray(l.entourage)) l.entourage = []; return l.entourage; }

  /* De documenten van een persoon, met het oude paspoortveld erbij gelezen. Zo
     ziet de rest van de module maar EEN soort gegeven. */
  function docsVan(p) {
    const uit = Array.isArray(p.documenten) ? p.documenten.slice() : [];
    if (p.paspoortTot && !uit.some(d => d.soort === 'paspoort')) {
      uit.push({ id: 'paspoort-oud', soort: 'paspoort', tot: p.paspoortTot, notitie: '' });
    }
    return uit;
  }

  function enPersoon(key, b) {
    const naam = schoon(b.naam, 80);
    if (!naam) return { status: 400, error: 'Naam van de persoon?' };
    const lijst = E(key);
    const rec = { naam, band: BANDEN.includes(b.band) ? b.band : 'overig', telefoon: schoon(b.telefoon, 40),
      dieet: schoon(b.dieet, 80), paspoortTot: isDatum(b.paspoortTot) ? b.paspoortTot : '',
      voorkeuren: schoon(b.voorkeuren, 200), notitie: schoon(b.notitie, 200) };
    if (b.id) { const p = lijst.find(x => x.id === b.id); if (!p) return { status: 404, error: 'Niet gevonden.' }; Object.assign(p, rec); save(); return { status: 200, ok: true }; }
    if (lijst.length >= 300) return { status: 400, error: 'De lijst is vol.' };
    lijst.unshift(Object.assign({ id: rid(), at: nu(), documenten: [] }, rec)); save();
    return { status: 200, ok: true };
  }
  function enPersoonWeg(key, id) { const l = L(key); l.entourage = E(key).filter(x => x.id !== id); save(); return { status: 200, ok: true }; }

  // Een document bij iemand zetten of bijwerken.
  function enDoc(key, b) {
    const p = E(key).find(x => x.id === b.id);
    if (!p) return { status: 404, error: 'Deze persoon staat niet in uw Entourage.' };
    if (!isDatum(b.tot)) return { status: 400, error: 'Tot welke datum is het geldig? (2027-04-01)' };
    if (!Array.isArray(p.documenten)) p.documenten = [];
    const rec = { soort: SOORTEN.includes(b.soort) ? b.soort : 'overig', tot: b.tot,
      nummer: schoon(b.nummer, 40), notitie: schoon(b.notitie, 200) };
    if (b.docId) {
      const d = p.documenten.find(x => x.id === b.docId);
      if (!d) return { status: 404, error: 'Dit document staat er niet bij.' };
      Object.assign(d, rec); save(); return { status: 200, ok: true };
    }
    if (p.documenten.length >= 20) return { status: 400, error: 'Deze persoon heeft al twintig documenten.' };
    p.documenten.unshift(Object.assign({ id: rid() }, rec));
    // het losse oude veld is nu overbodig zodra er een echt paspoortdocument is
    if (rec.soort === 'paspoort') p.paspoortTot = '';
    save();
    return { status: 200, ok: true };
  }
  function enDocWeg(key, b) {
    const p = E(key).find(x => x.id === b.id);
    if (!p || !Array.isArray(p.documenten)) return { status: 404, error: 'Niet gevonden.' };
    p.documenten = p.documenten.filter(d => d.id !== b.docId);
    save();
    return { status: 200, ok: true };
  }

  function entourage(key) {
    const lijst = E(key).slice().sort((a, b) => a.band.localeCompare(b.band) || String(a.naam).localeCompare(String(b.naam)));
    const t = vandaag(), grens = new Date(Date.now() + VENSTER * 86400000).toISOString().slice(0, 10);
    const attenties = [];
    for (const p of lijst) {
      for (const d of docsVan(p)) {
        if (!d.tot || d.tot > grens) continue;
        attenties.push({ id: p.id, docId: d.id, naam: p.naam, soort: d.soort, tot: d.tot, verlopen: d.tot < t });
      }
    }
    attenties.sort((a, b) => a.tot.localeCompare(b.tot));
    return { status: 200,
      gezelschap: lijst.map(p => Object.assign({}, p, { documenten: docsVan(p) })),
      banden: BANDEN, soorten: SOORTEN, aantal: lijst.length, venster: VENSTER, attenties,
      bron: 'Gebaseerd op de datums die u zelf invult. Inreisvereisten per land staan hier bewust niet in: die wisselen te snel om ze te beloven.' };
  }

  /* Een gezelschap samenstellen: wie gaat er mee, en wat ontbreekt er nog?
     Dit is de lijst die u anders met de hand maakt vlak voor vertrek. */
  function enGezelschap(key, b) {
    const ids = Array.isArray(b.ids) ? b.ids.slice(0, 40) : [];
    const mee = E(key).filter(p => ids.includes(p.id));
    if (!mee.length) return { status: 400, error: 'Kies eerst wie er meegaat.' };
    const t = vandaag(), grens = new Date(Date.now() + VENSTER * 86400000).toISOString().slice(0, 10);
    const punten = [], dieten = [];
    for (const p of mee) {
      const docs = docsVan(p);
      if (!docs.length) punten.push({ naam: p.naam, wat: 'geen enkel document vastgelegd' });
      for (const d of docs) {
        if (d.tot && d.tot < t) punten.push({ naam: p.naam, wat: d.soort + ' is verlopen (' + d.tot + ')' });
        else if (d.tot && d.tot <= grens) punten.push({ naam: p.naam, wat: d.soort + ' verloopt binnenkort (' + d.tot + ')' });
      }
      if (!p.telefoon) punten.push({ naam: p.naam, wat: 'geen telefoonnummer' });
      if (!p.dieet) punten.push({ naam: p.naam, wat: 'dieet onbekend' });
      else dieten.push({ naam: p.naam, dieet: p.dieet });
    }
    return { status: 200, personen: mee.length,
      namen: mee.map(p => p.naam), dieten, punten,
      gereed: punten.length === 0,
      tekst: punten.length === 0
        ? 'Dit gezelschap is compleet: iedereen heeft geldige papieren, een nummer en een bekend dieet.'
        : 'Er zijn ' + punten.length + ' punten die aandacht vragen voordat u vertrekt.' };
  }

  return { entourage, enPersoon, enPersoonWeg, enDoc, enDocWeg, enGezelschap };
};
