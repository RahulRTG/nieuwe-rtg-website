/* ============================================================================
   DE AUDITPROEF -- laat deze route een spoor na dat niemand kan wissen?

   DE KOLOM DIE DIT VULT. In de bewijsmatrix staat AUDIT ("blijft er een spoor
   achter dat niemand kan wissen") op ONGEMETEN voor elke route -- niet gezakt,
   want er werd niet eens gekeken. Deze proef kijkt, en hij doet dat van BUITEN:
   hij roept de route aan en vraagt daarna aan het spoor of daar een regel bij
   is gekomen die deze handeling noemt.

   DRIE STANDEN, en alleen de eerste is bewijs:

     bewezen    de oproep slaagde EN er staat een nieuwe regel in het spoor die
                deze methode en dit pad noemt.
     gezakt     de oproep slaagde en er kwam GEEN regel bij. Dat is hier wel
                een defect-oordeel, anders dan bij de idemproef: als een
                schrijfhandeling lukt zonder spoor, dan is er achteraf niet
                terug te vinden dat hij is gebeurd. Dat is precies wat deze
                kolom belooft.
     ongemeten  de oproep kwam niet door (400/401/403/503). Er is dan geen
                handeling geweest, dus valt er ook geen spoor te verwachten.

   DE IJKING, want een teller die je niet hebt zien bewegen meet niets
   (LAT.md regel 10). Drie keer, en ze meten alle drie iets anders:

   1. VOOR DE RONDE: twee keer achter elkaar de stand opvragen zonder er iets
      tussen te doen. Verandert die vanzelf, dan telt de meter zijn eigen
      leesverzoeken mee en is elke "bewezen" hierna waardeloos.
   2. VOOR DE RONDE, DE TEGENPROEF: een handeling die SLAAGT moet de stand laten
      oplopen, en een handeling die WORDT GEWEIGERD moet dat niet doen. Zonder
      dit tweede deel is deze hele proef een tautologie: het spoor wordt door
      een middleware voor alle routes geschreven, dus "er kwam een regel bij" is
      dan iets wat per definitie gebeurt en nooit iets tegenhoudt. Pas als je
      hebt gezien dat de meter ook STIL kan blijven, zegt zijn uitslag iets.
   3. NA DE RONDE: de keten nalopen. Een spoor waarvan de heelheid niet klopt,
      is geen spoor -- dan zegt deze proef dat en niet "alles bewezen".

   WAT DEZE PROEF NIET BEWIJST. Hij bewijst dat er een regel bij komt en dat de
   keten heel is; hij bewijst niet dat die regel het JUISTE verhaal vertelt (de
   goede actor bij de goede handeling), en ook niet dat een aanvaller met
   schrijftoegang tot de database de hele keten niet opnieuw kan uitrekenen.
   Voor dat laatste hoort het kopzegel periodiek buiten de deur te worden
   vastgelegd; dat staat in TAKEN.md en niet als belofte hier.
   ========================================================================== */
'use strict';

const isOk = (st) => st && st.status >= 200 && st.status < 300;

function weegSpoor(antwoord, gevonden) {
  if (!isOk(antwoord)) {
    return { stand: 'ongemeten', reden: 'de oproep deed geen werk (status ' + ((antwoord && antwoord.status) || 0) + ')' };
  }
  if (gevonden) return { stand: 'bewezen', reden: 'de handeling staat in het spoor' };
  return { stand: 'gezakt', reden: 'de oproep slaagde maar liet geen regel na in het spoor' };
}

/* `spoorVan(actie)` geeft { aantal, regels, keten } terug: de stand van het
   spoor, gefilterd op deze handeling. `stand()` geeft alleen de stand, voor de
   ijking vooraf. */
async function draaiAuditproef({ post, routes, tokenVoor, lijfVoor, hernieuw, spoorVan, stand, maxRoutes, wacht, ijking }) {
  const perRoute = {};
  const tel = { bewezen: 0, gezakt: 0, ongemeten: 0 };
  let gedaan = 0, hernieuwd = 0;

  /* IJKING 1: beweegt de meter uit zichzelf? */
  const s1 = await stand();
  const s2 = await stand();
  if (s1 == null || s2 == null) return { meterStuk: 'het spoor was niet op te vragen; zonder die lezing meet deze proef niets' };
  if (s1 !== s2) {
    return { meterStuk: 'de stand van het spoor liep op zonder dat er iets gebeurde (' + s1 + ' -> ' + s2 +
      '); dan telt hij zijn eigen leesverzoeken mee en zegt "bewezen" hierna niets' };
  }

  /* IJKING 2: kan de meter ook stil blijven? Een geweigerde handeling hoort
     geen spoor te maken, een geslaagde wel. Ziet deze proef dat verschil niet,
     dan meet hij niets en hoort hij dat te zeggen. */
  let ijkUitslag = null;
  if (ijking) {
    const voorFout = await stand();
    await ijking.geweigerd();
    const naFout = await stand();
    if (naFout !== voorFout) {
      return { meterStuk: 'een GEWEIGERDE handeling liet toch een spoor na (' + voorFout + ' -> ' + naFout +
        '); dan zegt "er kwam een regel bij" niets over of de handeling echt gebeurde' };
    }
    const voorGoed = await stand();
    await ijking.geslaagd();
    if (wacht) await wacht(60);
    const naGoed = await stand();
    if (naGoed <= voorGoed) {
      return { meterStuk: 'een GESLAAGDE handeling liet geen spoor na (' + voorGoed + ' -> ' + naGoed +
        '); de meter staat stil en elke "gezakt" hierna zou aan het instrument liggen' };
    }
    ijkUitslag = { geweigerdStil: true, geslaagdGeteld: naGoed - voorGoed };
  }

  for (const r of routes) {
    if (maxRoutes && Object.keys(perRoute).length >= maxRoutes) break;
    const actie = r.method + ' ' + r.pad;
    const voor = await stand();

    let st = await post(r.pad, lijfVoor(r), tokenVoor(r.rol));
    gedaan++;
    /* Een dood token maakt van elke volgende route een 401, en dan meldt de
       ronde "niets gemeten" over honderden routes zonder dat iets klaagt --
       dezelfde meetfout als in de invoer- en idemproef, dezelfde reparatie. */
    if (st.status === 401 && hernieuw) {
      if (await hernieuw(r.rol)) { hernieuwd++; st = await post(r.pad, lijfVoor(r), tokenVoor(r.rol)); gedaan++; }
    }

    let gevonden = false, na = voor;
    if (isOk(st)) {
      /* HET SPOOR WORDT NA HET ANTWOORD GESCHREVEN (res.finish), dus het kan
         een tel later landen dan het antwoord bij ons is. Een keer opnieuw
         kijken hoort daarbij; twee keer niets is geen vertraging meer. */
      for (let poging = 0; poging < 2 && !gevonden; poging++) {
        if (poging && wacht) await wacht(60);
        const spoor = await spoorVan(actie);
        na = spoor && spoor.aantal != null ? spoor.aantal : na;
        gevonden = !!(spoor && Array.isArray(spoor.regels) && spoor.regels.some(x => x.actie === actie));
      }
    }

    const o = weegSpoor(st, gevonden);
    tel[o.stand]++;
    perRoute[actie] = { methode: r.method, pad: r.pad, rol: r.rol, audit: o.stand, reden: o.reden,
      status: st.status, spoorVoor: voor, spoorNa: na };
  }

  return { perRoute, telling: tel, oproepen: gedaan, hernieuwd, ijking: ijkUitslag, meterStuk: null };
}

const CONTROL = {
  control: 'AUDITSPOOR',
  wat: 'elke geslaagde schrijfhandeling laat een regel na die niemand ongemerkt kan wijzigen',
  eigenaar: 'Techniek',
  bewijs: ['test/auditspoor.test.js'],
  bewijsstuk: 'AUDITPROEF.json -- per route of er een spoor achterbleef, plus de ketencontrole',
  dekking: { register: 'AUDITPROEF.json', beproefd: 'gemeten.bewezen',
    totaal: 'gemeten.beoordeeld', eenheid: 'schrijfroutes die werkelijk werk deden',
    tellers: { gezakt: 'gemeten.gezakt', ongemeten: 'gemeten.ongemeten',
      blindeRondes: 'gemeten.blindeRondes', ketenHeel: 'gemeten.ketenHeel' } },
  grens: 'kijkt van BUITEN: hij ziet dat er een regel bij komt en dat de keten heel is. Hij ' +
    'controleert niet of die regel het juiste verhaal vertelt (de goede actor bij de goede ' +
    'handeling), en hij zegt niets over iemand met schrijftoegang tot de database die de HELE ' +
    'keten opnieuw uitrekent -- daarvoor moet het kopzegel buiten de deur worden vastgelegd.'
};

module.exports = { draaiAuditproef, weegSpoor, CONTROL };
