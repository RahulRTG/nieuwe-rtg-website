/* RTG Stadsweefsel, deel "afhankelijkheden": wat sleept wat mee.

   Dit is wat een stadsplatform onderscheidt van een verzameling dashboards.
   Een dashboard zegt "transformator Kern is uitgevallen". Een stad wil weten
   dat daarmee twaalf lantaarns, twee laadpunten, een gemaal en drie
   Stadsdozen stil vallen, in welke buurten dat is, en welke van die dingen
   kritiek zijn.

   Drie vragen, drie functies:
   1. benedenstrooms(): wat valt er met dit object mee om? (gevolgen)
   2. bovenstrooms():   waar hangt dit object zelf van af? (oorzaken)
   3. uitval():         het volledige beeld bij een storing, inclusief de
                        geraakte gebieden en de getroffen stad-domeinen.

   En de omgekeerde vraag, die in de praktijk het meest oplevert:
   gemeenschappelijk() zoekt de gedeelde bovenstroomse bron van een stel
   objecten. Drie meldingen over donkere lantaarns in dezelfde straat zijn
   niet drie klussen maar een storing in de voedingsgroep. Zonder deze functie
   stuurt de stad drie monteurs naar drie palen die het geen van drieen zijn.

   BEGRENSD, EN DAT IS EEN KEUZE. De doorloop stopt bij MAX_DIEP niveaus en
   MAX_KNOPEN objecten. Een verkeerd gelegde relatie mag geen lus worden die
   het bord laat hangen; wat is afgekapt zegt het antwoord er zelf bij
   (afgekapt: true), want een stil afgekapte impactanalyse is gevaarlijker dan
   geen impactanalyse.

   Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
const MAX_DIEP = 6;
const MAX_KNOPEN = 400;

module.exports = (ctx) => {
  const { obj, rel, geo } = ctx;

  /* Loop het net af vanaf een object. richting 'uit' geeft de gevolgen,
     'in' de oorzaken. Bezochte knopen worden onthouden, dus een kringetje in
     de data (A voedt B, B voedt A) draait hier niet rond. */
  function loop(startId, richting) {
    rel.zorgRelaties();
    const gezien = new Set([startId]);
    const uit = [];
    let laag = [startId], diepte = 0, afgekapt = false;
    while (laag.length && diepte < MAX_DIEP) {
      diepte++;
      const volgende = [];
      for (const id of laag) {
        for (const b of rel.buren(id, { richting, alleenUitval: true })) {
          if (gezien.has(b.ander)) continue;
          if (gezien.size >= MAX_KNOPEN) { afgekapt = true; continue; }
          gezien.add(b.ander);
          const o = obj.object(b.ander);
          if (!o) continue;
          uit.push({ object: o, via: b.relatie.soort, vanaf: id, diepte });
          volgende.push(b.ander);
        }
      }
      laag = volgende;
      if (laag.length && diepte === MAX_DIEP) afgekapt = true;
    }
    return { rij: uit, afgekapt };
  }

  const benedenstrooms = (id) => loop(id, 'uit');
  const bovenstrooms = (id) => loop(id, 'in');

  /* De gedeelde bron van een stel objecten: welke bovenstroomse knoop zit
     boven ALLEMAAL? Geeft de diepste (dus meest specifieke) gemeenschappelijke
     bron terug, want "het transformatorstation" is een bruikbaarder antwoord
     dan "de stad". */
  function gemeenschappelijk(ids) {
    const echte = [...new Set(ids.filter(id => obj.object(id)))];
    if (echte.length < 2) return null;
    let gedeeld = null;
    for (const id of echte) {
      const boven = new Map(bovenstrooms(id).rij.map(x => [x.object.id, x.diepte]));
      if (gedeeld === null) { gedeeld = boven; continue; }
      for (const k of [...gedeeld.keys()]) {
        if (!boven.has(k)) gedeeld.delete(k);
        else gedeeld.set(k, Math.max(gedeeld.get(k), boven.get(k)));
      }
    }
    if (!gedeeld || !gedeeld.size) return null;
    // de minste stappen = het dichtstbij, en dus de meest waarschijnlijke oorzaak
    const beste = [...gedeeld.entries()].sort((a, b) => a[1] - b[1])[0];
    const o = obj.object(beste[0]);
    return o ? { object: obj.publiek(o), stappen: beste[1], onder: echte.length } : null;
  }

  /* Het volledige uitvalbeeld: wat gaat er mee om, waar, en hoe erg. Dit is
     de "wat als"-vraag die de boardroom stelt voordat er iets gebeurt, en de
     vraag die het rampbeeld stelt zodra er iets gebeurt. */
  function uitval({ id, minuten }) {
    const start = obj.object(id);
    if (!start) return { status: 404, error: 'Onbekend object.' };
    const { rij, afgekapt } = benedenstrooms(start.id);
    const perSoort = {}, perGebied = {}, domeinen = new Set();
    for (const x of rij) {
      const S = obj.SOORTEN[x.object.soort];
      perSoort[x.object.soort] = (perSoort[x.object.soort] || 0) + 1;
      const zone = geo.gebied(x.object.zone);
      if (zone) perGebied[zone.naam] = (perGebied[zone.naam] || 0) + 1;
      if (S && S.domein) domeinen.add(S.domein);
    }
    const kritiek = rij.filter(x => ['kritiek', 'hoog'].includes(x.object.risico)).map(x => obj.publiek(x.object));
    const min = Number(minuten) > 0 ? Math.round(Number(minuten)) : null;
    const zin = start.naam + ' valt uit' + (min ? ' (' + min + ' minuten)' : '') + ': ' +
      (rij.length ? rij.length + ' object(en) verliezen hun normale werking in ' + Object.keys(perGebied).join(', ') +
        (kritiek.length ? '; ' + kritiek.length + ' daarvan is kritiek of hoog-risico.' : '.')
        : 'er hangt niets aan dit object dat meevalt.');
    return { status: 200, object: obj.publiek(start), aantal: rij.length, afgekapt,
      geraakt: rij.map(x => ({ ...obj.publiek(x.object), via: x.via, diepte: x.diepte })).slice(0, 200),
      perSoort, perGebied, domeinen: [...domeinen], kritiek, samenvatting: zin,
      let_op: 'Dit is een berekening op het geregistreerde net, geen meting aan de echte infrastructuur.' };
  }

  return {
    benedenstrooms, bovenstrooms, gemeenschappelijk,
    api: {
      weefselUitval: uitval,
      weefselKeten: ({ id }) => {
        const o = obj.object(id);
        if (!o) return { status: 404, error: 'Onbekend object.' };
        const onder = benedenstrooms(o.id), boven = bovenstrooms(o.id);
        return { status: 200, object: obj.publiek(o),
          benedenstrooms: onder.rij.map(x => ({ ...obj.publiek(x.object), via: x.via, diepte: x.diepte })),
          bovenstrooms: boven.rij.map(x => ({ ...obj.publiek(x.object), via: x.via, diepte: x.diepte })),
          afgekapt: onder.afgekapt || boven.afgekapt };
      }
    }
  };
};
