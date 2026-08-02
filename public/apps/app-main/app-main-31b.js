  /* ---------- DE WINGS: de werkbank naast de console ----------

     Op de computer kan de middenconsole niet groter. Dat is gemeten en geen
     keuze: --e wordt begrensd door 1.48cqh omdat het beginscherm in EEN scherm
     past zonder scrollen, dus op een 900px hoog venster staat --e op 12,5px --
     dezelfde maat als op een telefoon, hoe breed het scherm ook is. Een bredere
     verhouding verandert daar niets aan (nagerekend: bij 4:3 blijft --e 12,5px,
     de hoogte is bindend en niet de breedte).

     De breedte die daardoor overblijft is waar de wings voor zijn. Ze rekken de
     app niet op maar zetten er iets NAAST: dezelfde tegels, dezelfde vormtaal,
     dezelfde openregels (openItem, dus ook de algemene pin voor prive-apps).

     STANDAARD DE ZAKELIJKE APPS. Wie de app op een computer opent zit te werken;
     op een telefoon niet. Links de werkbank (RTG Office met document, rekenblad
     en presentatie; bestellen, website-maker, browser), rechts de administratie
     (balans, logboek, wie betaalt wat, bank, RTG-code, werk). Allemaal apps die
     al bestaan -- de wings verzinnen niets, ze halen naar voren.

     AANPASBAAR, EN DAT IS GEEN BIJZAAK. De standaard is een vermoeden over wat
     iemand doet, geen feit. Drie standen per app (uit/links/rechts), bewaard per
     pas. Wie alles uitzet houdt lege flanken, en dan is het weer de tablet.

     WAAROM DIT HIER STAAT EN NIET IN EEN EIGEN DEELBESTAND. De bron in
     public/apps/app-main/ is op GROOTTE geknipt, niet op functiegrenzen. Een
     nieuw deel tussen 59 en 60 belandde daardoor midden in een functie die
     nooit wordt aangeroepen: geen syntaxfout, geen uitzondering, gewoon code die
     er staat en nooit gebeurt. Dit is het einde van de OS-IIFE, en dat is met
     een probe in de browser vastgesteld (LINKS object, openItem function,
     pas string) en niet met accolades tellen. */

  const WING_KEY = () => 'rtg_os_wings_' + (pas || 'rtg');
  const WING_STANDAARD = {
    links:  ['link:office', 'tab:bestellen', 'link:sitemaker', 'link:browser'],
    /* 'link:bank' stond hier eerst: die bestaat niet in de registry (hij zit in
       de map Geld als tab) en viel er dus stil uit. Een standaard die naar een
       app wijst die er niet is, is een belofte in tekst -- weg. */
    rechts: ['link:balans', 'link:logboek', 'link:wbw', 'link:rtgcode', 'tab:betalen', 'os:werk']
  };
  /* Waar je uit kunt kiezen: de zakelijke kant van de registry en niet alles.
     Een lijst van zestig apps is geen keuze maar een doolhof. */
  const WING_KEUZE = [
    'link:office', 'tab:bestellen', 'link:sitemaker', 'link:browser', 'link:juridisch',
    'link:balans', 'link:logboek', 'link:wbw', 'link:rtgcode',
    'tab:betalen', 'link:wallet', 'os:werk', 'link:ik', 'link:passkeys'
  ];

  function wingLees() {
    try {
      const r = JSON.parse(localStorage.getItem(WING_KEY()) || 'null');
      if (r && Array.isArray(r.links) && Array.isArray(r.rechts)) return r;
    } catch (e) {}
    return { links: WING_STANDAARD.links.slice(), rechts: WING_STANDAARD.rechts.slice() };
  }
  function wingBewaar(st) { try { localStorage.setItem(WING_KEY(), JSON.stringify(st)); } catch (e) {} }

  /* Een tegel in de flank: hetzelfde vak als op het springboard (tegelInhoud +
     openItem), zodat een app er hier niet anders uitziet en niet anders opent. */
  function wingTegel(item) {
    /* De naam. Een tab-app staat NIET in de registry -- itemDef geeft daar
       undefined en dan stond de ruwe sleutel ("tab:bestellen") als label in de
       flank. De tabbar is voor die apps de bron, net als op het springboard. */
    const naamVan = it => it.startsWith('tab:') ? tabNaam(it.slice(4)) : ((itemDef(it) || {}).naam || it);
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'wing-tegel'; el.dataset.sleutel = item;
    const vak = document.createElement('span');
    vak.className = 'os-tegel';
    const inhoud = tegelInhoud(item);
    if (inhoud) vak.appendChild(inhoud);
    const naam = document.createElement('span');
    naam.className = 'wing-naam';
    naam.textContent = naamVan(item);
    el.appendChild(vak); el.appendChild(naam);
    el.addEventListener('click', () => openItem(item));
    return el;
  }
  function wingVul(kolom, items) {
    kolom.textContent = '';
    for (const item of items) {
      if (!itemZichtbaar(item)) continue;   // uit in de boardroom, of niet voor deze pas
      kolom.appendChild(wingTegel(item));
    }
  }
