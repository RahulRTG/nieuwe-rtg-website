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

  /* ---------- VAN TEGEL NAAR WIDGET ----------

     Een tegel toont een naam; een widget toont IETS. Het verschil doet ertoe op
     een bureaublad: daar heb je de ruimte om te kijken zonder te klikken.

     DRIE REGELS, EN DE EERSTE IS DE BELANGRIJKSTE.

     1. EEN WIDGET VERZINT NIETS. Hij toont wat een echt endpoint teruggeeft, of
        hij toont niets. Geen voorbeeldsaldo, geen "3 documenten" die nergens
        vandaan komt. Een app zonder bron blijft gewoon een nette kaart met zijn
        naam -- dat is eerlijk en het is nog steeds een deur.
     2. FULL SCREEN IS DE APP. Elke widget heeft dezelfde beweging: uitklappen
        opent het echte ding via openItem(), met alle bestaande regels (de
        algemene pin voor prive-apps, de vensterlaag op een breed scherm). De
        widget is dus geen kopie van de app maar zijn voorkant.
     3. EEN BRON DIE STUK IS, ZEGT DAT. Geen lege kaart die eruitziet als "u
        heeft niets", want dat is een bewering. Bij een fout blijft de kaart
        staan zonder cijfer, en dat leest als "nog niet bekend".

     De bronnen zijn de endpoints die het lid toch al aanroept; een widget voegt
     geen nieuw verkeer toe dat er niet al was. */
  const WIDGETBRON = {
    'link:balans': { pad: '/balans', lees: d => (d && d.adviezen && d.adviezen[0] && d.adviezen[0].tekst) || null },
    'tab:betalen': { pad: '/pay/overzicht', lees: d => (d && typeof d.saldo === 'number') ? eur(d.saldo / 100) : null },
    'link:wallet': { pad: '/pay/overzicht', lees: d => (d && typeof d.saldo === 'number') ? eur(d.saldo / 100) : null }
  };
  const widgetCache = new Map();   // pad -> belofte, zodat twee widgets op dezelfde bron er samen een ophalen

  function widgetHaal(pad) {
    if (!widgetCache.has(pad)) widgetCache.set(pad, API.call(pad, {}).catch(() => null));
    return widgetCache.get(pad);
  }

  /* De widget. Kop met glyf en naam, een lijf dat gevuld wordt als er een bron
     is, en een uitklap-knop die de app opent. De hele kaart is aanklikbaar --
     een widget die je alleen via een klein knopje kunt openen, is een raadsel. */
  function wingWidget(item) {
    const naamVan = it => it.startsWith('tab:') ? tabNaam(it.slice(4)) : ((itemDef(it) || {}).naam || it);
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'wing-widget'; el.dataset.sleutel = item;
    el.setAttribute('aria-label', T('wings.open', 'Open') + ' ' + naamVan(item));

    const kop = document.createElement('span'); kop.className = 'wing-kop';
    const vak = document.createElement('span'); vak.className = 'os-tegel';
    const inhoud = tegelInhoud(item);
    if (inhoud) vak.appendChild(inhoud);
    const naam = document.createElement('span'); naam.className = 'wing-naam';
    naam.textContent = naamVan(item);
    const vol = document.createElement('span'); vol.className = 'wing-vol';
    vol.textContent = '↗';                       // de uitklap-pijl: full screen = de app
    vol.setAttribute('aria-hidden', 'true');
    kop.appendChild(vak); kop.appendChild(naam); kop.appendChild(vol);
    el.appendChild(kop);

    const bron = WIDGETBRON[item];
    if (bron) {
      const lijf = document.createElement('span'); lijf.className = 'wing-lijf';
      lijf.textContent = ' ';                    // ruimte reserveren, geen tekst beweren
      el.appendChild(lijf);
      widgetHaal(bron.pad).then(d => {
        const w = d ? bron.lees(d) : null;
        // niets gevonden of bron stuk: het lijf blijft leeg. Zie regel 3.
        if (w != null) { lijf.textContent = String(w); el.classList.add('heeft-waarde'); }
      });
    }
    el.addEventListener('click', () => openItem(item));
    return el;
  }

  function wingVul(kolom, items) {
    kolom.textContent = '';
    for (const item of items) {
      if (!itemZichtbaar(item)) continue;   // uit in de boardroom, of niet voor deze pas
      kolom.appendChild(wingWidget(item));
    }
  }
