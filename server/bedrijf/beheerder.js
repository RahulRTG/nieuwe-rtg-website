/* ============================================================================
   DE BEHEERDER MAG OOK EEN MENS ZIJN.

   WAAROM DIT ER KOMT, en het is geen gemak maar een veiligheidsreparatie.

   Het beheer van een werkruimte ging tot nu toe uitsluitend op het
   BEHEER-TOKEN: een sleutel die geen persoon noemt. Daardoor liep elke zware
   handeling daarachter -- rollen geven, iemand uit dienst zetten, de hele
   werkruimte uitvoeren -- vast op dezelfde muur van VERTROUWEN.md laag 3:

     nodig, maar onmogelijk. Er is niemand om een tweede bevestiging aan te
     vragen.

   Zolang dat zo blijft, kan er geen poort voor die handelingen komen en staan
   ze in de simulatie als catastrofaal pad. Niet omdat er iets fout is aan de
   code eromheen, maar omdat er geen mens aan de knop staat.

   DUS MAG EEN LID MET DE DIRECTIE-ROL VOORTAAN OOK BEHEREN. En dat is precies
   waar dit gevaarlijk wordt, want directie draagt zestien van de achttien
   rechten -- maar niet `mens.gevoelig` en niet `it.beveiliging`.

   DE REGEL DIE DAT DICHTHOUDT: WIE BEHEERT ALS PERSOON, KAN NOOIT MEER GEVEN
   DAN HIJ ZELF HEEFT. Zonder die regel zou een directielid zichzelf de twee
   ontbrekende rechten toekennen en daarmee de rolgrens opheffen -- bevoegdheid
   die groeit door delegatie, exact wat VERTROUWEN.md laag 4 verbiedt. De
   controle is dan ook dezelfde functie: kern/vertrouwen/insluiting.js groeit().

   HET BEHEER-TOKEN BLIJFT WERKEN en houdt alle rechten. Dat is een sleutel voor
   de eigenaar van de werkruimte en voor het geval dat niemand meer binnen kan;
   hem afschaffen zou een deur dichtdoen die mensen buitensluit. Maar hij draagt
   nu wel een LABEL: `viaSleutel`. Wie dat leest, weet dat er geen mens achter
   deze handeling staat -- en de poort hieronder geeft dat door aan laag 3 als
   een GEMETEN eigenschap (geenPersoon) in plaats van als een lege plek.

   Het tweede moment zelf staat in ./bevestig.js: hier woont wie er mag, daar
   woont hoe hij zich opnieuw bewijst.
   ========================================================================== */
'use strict';

const { groeit } = require('../kern/vertrouwen/insluiting');

/* De rol die beheer mag doen. Bewust EEN rol en geen lijst: elke rol die je
   hieraan toevoegt, is een nieuwe weg naar het beheer van een werkruimte, en
   dat hoort een besluit te zijn en geen configuratie. */
const BEHEERROL = 'directie';

module.exports = (sctx) => {
  const { beheerVan, lidVan, rollenVan, rechtenVan, RECHTEN, kern } = sctx;

  /* De poort voor beheerhandelingen. Levert null en heeft dan zelf al
     geantwoord -- dezelfde vorm als beheerVan en lidVan, zodat een aanroeper
     geen derde manier hoeft te leren. */
  function beheerderVan(req, res) {
    if (String((req.body || {}).beheerToken || '')) {
      const w = beheerVan(req, res); if (!w) return null;
      return { w, l: null, rechten: RECHTEN.slice(), viaSleutel: true, wie: 'beheer' };
    }
    const s = lidVan(req, res); if (!s) return null;
    if (!rollenVan(s.l).includes(BEHEERROL)) {
      res.status(403).json({ error: 'Beheer van deze werkruimte vraagt de rol "' + BEHEERROL +
        '", of het beheer-token.', rol: BEHEERROL });
      return null;
    }
    return { w: s.w, l: s.l, rechten: rechtenVan(s.l), viaSleutel: false, wie: s.l.naam || s.l.id };
  }

  /* WAT MAG DEZE BEHEERDER WEGGEVEN. Een sleutel mag alles; een mens nooit meer
     dan hij zelf heeft. Levert de rechten die er bij zouden komen, zodat de
     aanroeper er een leesbare weigering van kan maken in plaats van een 403
     zonder inhoud -- een poort die "nee" zegt zonder reden laat mensen gokken,
     en gokken tegen een poort ziet er in het logboek uit als een aanval. */
  function magGeven(b, rollen, rolTabel) {
    if (!b || b.viaSleutel) return { ok: true };
    const kind = [...new Set((rollen || [])
      .flatMap(id => (rolTabel.find(x => x.id === String(id && id.id ? id.id : id)) || {}).rechten || []))];
    const u = groeit(b.rechten, kind);
    if (!u.groeit) return { ok: true };
    return { ok: false, erbij: u.erbij,
      reden: 'U kunt niet meer weggeven dan u zelf heeft. Deze rollen zouden ' +
        u.erbij.map(r => '"' + r + '"').join(' en ') +
        ' toekennen, en dat recht heeft u niet. Vraag het aan iemand die het wel heeft, of gebruik het beheer-token.' };
  }

  /* DE ACTOR. Een gekoppeld lid draagt zijn RTG-sleutel, en dan is het DEZELFDE
     actor als in de techniekdeuren: een mens die daar een tenant vernietigt en
     hier een rol geeft, heeft een grondslag en een bereik en niet twee. Zonder
     koppeling is de lid-id de enige naam die er is, en die is per werkruimte
     uniek en niet daarbuiten -- vandaar de code ervoor. Een sleutel krijgt de
     werkruimtecode: hij is een deur en geen mens, en zijn gewoonte hoort niet
     op iemands naam te komen. */
  const actorVan = (b) => b.viaSleutel ? ('sleutel:' + b.w.code)
    : (b.l.rtgKey || (b.w.code + ':' + b.l.id));

  const F = () => {
    if (!kern.vertrouwen) throw new Error('De Trust Fabric is niet opgezet; een beheerpoort zonder laag 3 zou stilzwijgend doorlaten.');
    return kern.vertrouwen;
  };

  /* DE POORT VAN LAAG 3 OP EEN BEHEERHANDELING. Hier en niet in elke route: een
     deur die zelf een drempel verzint, is een tweede grens in dit huis en die
     loopt gegarandeerd uit de pas met de eerste (LAT.md regel 4).

     Levert null en heeft dan zelf geantwoord (428 met een bon om te bevestigen,
     of 403 als er niemand is om het aan te vragen). Levert hij een uitslag, dan
     hoort daar NA afloop een naAfloop() achteraan -- zie daar waarom die twee
     niet in een functie zitten. */
  function poortVoor(req, res, b, { soort, aantal, doel }) {
    const u = F().poort({
      actor: actorVan(b), soort, aantal, doel,
      sessie: b.viaSleutel ? null : String((req.body || {}).lidToken || ''),
      ver: b.viaSleutel ? F().geenPersoon('het beheer-token van deze werkruimte') : undefined,
      bon: (req.body || {}).bevestiging
    });
    if (!u.door) { res.status(u.status).json(u.antwoord); return null; }
    return u;
  }

  /* NA AFLOOP, en met opzet apart van de poort: op het moment van de poort weet
     niemand of de handeling is gelukt. Een grondslag die meetelt wat er is
     GEPROBEERD, is door de aanvaller zelf te verzetten, en een bon die
     "uitgevoerd" beweert voordat dat vaststaat is de bewering zonder bron waar
     deze hele laag tegen is. */
  function naAfloop(b, uitslag, { soort, aantal, doel }) {
    F().voltooid(actorVan(b), soort, aantal);
    return F().bonNaPoort(uitslag, { soort, doel, aantal, actor: actorVan(b), uitgevoerd: true,
      poort: b.viaSleutel ? 'beheer-token' : 'lid-token + rol ' + BEHEERROL });
  }

  /* De deur waar de mens zich opnieuw bewijst hangt HIER en niet in index.js:
     hij leest beheerderVan, en die staat pas hieronder klaar. Zo blijft er ook
     maar een plek waar de volgorde tussen die twee wordt vastgelegd. */
  const uit = { beheerderVan, magGeven, poortVoor, naAfloop, actorVan, BEHEERROL };
  require('./bevestig')(Object.assign({}, sctx, uit));
  return uit;
};
