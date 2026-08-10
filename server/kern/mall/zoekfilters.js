/* RTG Mall, deelbestand "zoekfilters": WAT ER WEGVALT, EN WAAROM.

   Afgesplitst uit ./zoek.js toen dat bestand tegen de tienkilobytegrens liep
   en er filters bij moesten (land, bezorging, bewaard, zakelijk). Dit is geen
   opdeling om de meter te plezieren: filteren is een eigen soort werk met een
   eigen soort fout, en het loont om ze op een hoop te hebben staan.

   DE REGEL DIE ELK FILTER HIER VOLGT: een filter dat iets wegneemt moet
   kunnen zeggen HOEVEEL het wegnam. Elk filter levert daarom een regel in
   `toegepast` op, met zijn naam en het aantal dat het liet vallen. Zonder dat
   is een lege Mall niet te onderscheiden van een kapotte Mall, en gaat iemand
   zoeken in de bronnen terwijl er gewoon een vinkje aanstond (LAT-regel 5).

   WAT HIER MET OPZET NIET STAAT: relevantie en volgorde. Wat een zoekopdracht
   BETEKENT staat in ./zoekweging.js, en dat onderscheid is er niet voor niets
   -- toen beschikbaarheid meewoog in de relevantie leverde "scooter huren
   ibiza" ringen, honing en villa's op. Toelaten en rangschikken zijn twee
   dingen. */

const LANDEN = /^[A-Z]{2}$/;

/* Bezorgt deze aanbieder tot aan de gekozen plek? Dit is bewust GEEN nieuwe
   afstandsregel: het is dezelfde `bedient` van ./plek.js, met de eis erbij dat
   het bereik een straal is en de zaak bezorging aan heeft staan. Een tweede
   afstandsberekening naast die van plek.js zou de klassieke dubbele waarheid
   zijn (LAT-regel 4). */
function bezorgtNaar(a, plekObj, bedient) {
  if (!a.bezorgt) return false;
  if (!plekObj) return true;
  return bedient(a, plekObj);
}

/* Alle filters op een rij. `opt` is de zoekvraag, `hulp` levert wat er van
   buiten nodig is. Geeft de overgebleven lijst terug plus wat elk filter
   wegnam. */
function filter(lijst, opt, hulp) {
  const { bedient, gekozen, bewaardeIds, collectieIds } = hulp;
  const toegepast = [];
  let res = lijst;
  const stap = (naam, fn) => {
    const voor = res.length;
    res = res.filter(fn);
    if (res.length !== voor) toegepast.push({ filter: naam, weggevallen: voor - res.length });
  };

  if (gekozen) stap('plek', a => bedient(a, gekozen));
  /* Het land. Dit is de stap van "een stad" naar "een werelddeel": wie op
     Spanje filtert ziet Ibiza, Madrid en Marbella naast elkaar. Aanbod zonder
     land valt hier weg en dat is juist -- een advertentie waarvan we het land
     niet weten in een landfilter stoppen is raden. */
  if (LANDEN.test(String(opt.land || '').toUpperCase())) {
    const land = String(opt.land).toUpperCase();
    stap('land', a => a.plek.land === land);
  }
  if (opt.verdieping) stap('verdieping', a => a.verdieping === String(opt.verdieping));
  if (opt.type) stap('type', a => a.type === String(opt.type));
  if (opt.aanbieder) stap('aanbieder', a => a.aanbieder.soort === String(opt.aanbieder));
  if (Number(opt.maxPrijs) > 0) stap('maxPrijs', a => a.prijs && a.prijs.bedrag <= Number(opt.maxPrijs));

  /* "Nu open": alleen wat de zaak zelf als open opgeeft. Een zaak zonder
     vastgelegde openingstijden (open === null) valt hier weg en wordt NIET als
     open meegeteld -- iemand voor niets door de regen sturen is erger dan een
     treffer missen. Zie de kop van ./stand.js. */
  if (opt.openNu) stap('openNu', a => a.open && a.open.open === true);
  // en "uitverkocht" hoort niet in een lijst waar je iets wilt kopen
  if (opt.opVoorraad) stap('opVoorraad', a => a.beschikbaar && !a.beschikbaar.uit);
  if (opt.bezorgt) stap('bezorgt', a => bezorgtNaar(a, gekozen, bedient));
  /* De zakelijke Mall: alleen wat er voor een zakelijke koper werkelijk anders
     uitziet. Zonder dit filter is "zakelijk kijken" alleen een andere prijs op
     dezelfde lijst, en dan is het geen ingang maar een instelling. */
  if (opt.zakelijkAlleen) stap('zakelijkAlleen', a => !!a.zakelijkePrijs);
  if (opt.bewaard) {
    const set = bewaardeIds instanceof Set ? bewaardeIds : new Set(bewaardeIds || []);
    stap('bewaard', a => set.has(a.id));
  }
  if (collectieIds) {
    const set = collectieIds instanceof Set ? collectieIds : new Set(collectieIds || []);
    stap('collectie', a => set.has(a.id));
  }
  /* Alleen zaken met een cijfer, en minstens dit cijfer. Het cijfer komt uit
     de reviews die leden na een afgeronde dienst gaven (kern/ervaring/
     rating.js) -- het is geen keurmerk van RTG, en dat staat er in de Mall bij.
     Aanbod zonder cijfer valt weg en dat is hier de bedoeling: wie op cijfer
     filtert vraagt om beoordeeld aanbod. */
  const minCijfer = Number(opt.minCijfer);
  if (minCijfer >= 1 && minCijfer <= 5) {
    stap('minCijfer', a => a.waardering && a.waardering.score >= minCijfer);
  }
  return { res, toegepast };
}

module.exports = { filter, bezorgtNaar };
