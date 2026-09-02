/* Foundation OS, deel "geld": de bronnen (donaties, subsidies, sponsoring) en
   het beeld per stad.

   DE KERN VAN DEZE MODULE IS EEN VERBOD. Geoormerkt geld gaat niet naar iets
   anders. Twintigduizend euro voor het jongerenproject in Haarlem is geen
   twintigduizend euro voor de stichting die toevallig in Haarlem binnenkwam;
   het is een belofte aan de gever, en bij een subsidie ook een terugbetaal-
   risico. Daarom is een bron hier geen bedrag in een pot maar een eigen rij met
   een bestemming eraan vast, en kan een uitgave alleen bronnen aanspreken die
   bij het project horen. Zie geld-uitgaven.js voor die controle.

   HERBESTEMMEN KAN, MAAR NOOIT STIL. Er zijn echte gevallen waarin geld moet
   verschuiven: een project gaat niet door, een gever geeft toestemming. Dat kan
   hier -- landelijk, met een reden, met een auditregel, en alleen als de gever
   het bij binnenkomst niet heeft uitgesloten. Wat NIET kan, is het gaandeweg
   laten weglekken doordat niemand meer weet waar het vandaan kwam.

   DRIE GETALLEN PER BRON, EN ZE ZIJN NIET HETZELFDE:
     - binnen   : wat er is toegezegd of ontvangen;
     - besteed  : wat er goedgekeurd is uitgegeven;
     - gereserveerd: wat er is aangevraagd maar nog niet besloten.
   Wie alleen "binnen minus besteed" toont, laat een stad tweemaal hetzelfde
   geld uitgeven zolang de eerste aanvraag nog op een besluit wacht. */

const SOORTEN = ['donatie', 'maandelijkse_donatie', 'sponsoring', 'goederen', 'subsidie', 'eigen_middelen'];
const HERBESTEMMING = ['nooit', 'met_toestemming', 'vrij'];

module.exports = (ctx) => {
  const { nu, rid, schoon, naarCenten, euro, S, audit, wie, poort, save } = ctx;

  const vindBron = id => S().bronnen.find(b => b.id === String(id || '')) || null;
  const gereserveerd = bronId => S().uitgaven
    .filter(u => u.bronId === bronId && u.status === 'aangevraagd')
    .reduce((s, u) => s + u.centen, 0);
  const vrij = b => Math.max(0, b.centen - b.besteed - gereserveerd(b.id));

  const bronBeeld = b => ({ id: b.id, stad: b.stad, projectId: b.projectId, soort: b.soort,
    gever: b.anoniem ? 'anoniem' : b.gever, anoniem: !!b.anoniem, geoormerkt: !!b.projectId,
    herbestemming: b.herbestemming, binnen: euro(b.centen), besteed: euro(b.besteed),
    gereserveerd: euro(gereserveerd(b.id)), vrij: euro(vrij(b)),
    kenmerk: b.kenmerk, at: b.at });

  function lijst(req, stadId) {
    const w = wie(req);
    const g = poort(w, stadId, 'stad.lezen');
    if (!g.ok) return g;
    const bronnen = S().bronnen.filter(b => b.stad === g.stad.id);
    const uitgaven = S().uitgaven.filter(u => u.stad === g.stad.id);
    const som = (lijst, veld) => lijst.reduce((s, x) => s + (Number(x[veld]) || 0), 0);
    return { ok: true, soorten: SOORTEN, herbestemmingen: HERBESTEMMING,
      bronnen: bronnen.map(bronBeeld),
      totalen: {
        binnen: euro(som(bronnen, 'centen')),
        besteed: euro(som(bronnen, 'besteed')),
        geoormerkt: euro(som(bronnen.filter(b => b.projectId), 'centen')),
        vrij: euro(bronnen.reduce((s, b) => s + vrij(b), 0)),
        openAanvragen: uitgaven.filter(u => u.status === 'aangevraagd').length
      },
      uitgaven: uitgaven.slice(-100).reverse().map(u => ({ id: u.id, projectId: u.projectId,
        omschrijving: u.omschrijving, bedrag: euro(u.centen), status: u.status,
        door: u.door, besluitDoor: u.besluitDoor || null, reden: u.reden || '', at: u.at })) };
  }

  /* Een bron aanmaken. De bestemming wordt hier vastgelegd en daarna niet meer
     door de stad gewijzigd -- alleen herbestemmen kan, en dat is landelijk werk
     met een reden erbij (zie verplaats hieronder). */
  function bronMaak(req, b) {
    b = b || {};
    const w = wie(req);
    const g = poort(w, b.stad, 'geld.beheren', 'donations');
    if (!g.ok) return g;
    const soort = String(b.soort || '');
    if (!SOORTEN.includes(soort)) return { status: 400, error: 'Kies een soort (' + SOORTEN.join(', ') + ').' };
    const c = naarCenten(b.bedrag);
    if (c === null || c === 0) return { status: 400, error: 'Wat is het bedrag?' };
    const herb = String(b.herbestemming || 'met_toestemming');
    if (!HERBESTEMMING.includes(herb)) return { status: 400, error: 'Herbestemming is nooit, met_toestemming of vrij.' };
    let projectId = schoon(b.projectId, 20) || null;
    if (projectId) {
      const p = S().projecten.find(x => x.id === projectId);
      if (!p || p.stad !== g.stad.id) return { status: 400, error: 'Dat project hoort niet bij deze stad.' };
    }
    if (S().bronnen.length >= 100000) return { status: 400, error: 'Het bronnenregister zit vol.' };
    const bron = { id: rid(), stad: g.stad.id, projectId, soort,
      gever: schoon(b.gever, 120) || 'onbekend', anoniem: b.anoniem === true,
      centen: c, besteed: 0, herbestemming: herb, kenmerk: schoon(b.kenmerk, 60),
      door: w.key, at: nu() };
    /* De herkomstcontrole op grote en contante giften. Hij wordt HIER gezet en
       niet in een apart scherm dat iemand moet openen: een controle die pas
       ontstaat als er iemand aan denkt, ontstaat niet. Wat er dan gebeurt staat
       in herkomst.js -- die ene plek beslist of er gekeken moet worden. */
    const gemarkeerd = ctx.herkomstBepaal ? ctx.herkomstBepaal(bron) : null;
    S().bronnen.push(bron);
    audit(w.key, 'bron.maak', soort + ' ' + euro(c) + ' euro',
      projectId ? 'geoormerkt voor project ' + projectId : 'niet geoormerkt, stad ' + g.stad.naam);
    save();
    return { ok: true, bron: bronBeeld(bron),
      melding: gemarkeerd
        ? 'Dit is een ' + gemarkeerd.reden + '. Het geld staat stil tot het landelijke bestuur de herkomst heeft ' +
          'beoordeeld; tot dan kan er niets uit worden uitgegeven.'
        : undefined };
  }

  /* Herbestemmen en de bron-uit-subsidie staan in ./geld-bron.js: dat zijn de
     twee wegen waarlangs een bron ANDERS ontstaat of van bestemming verandert,
     en dit bestand liep tegen de 10 KB van keuringsregel 13. */
  const bron = require('./geld-bron')(ctx, { vindBron, bronBeeld });

  const uitgaven = require('./geld-uitgaven')(ctx, { vindBron, vrij, bronBeeld });

  return { lijst, bronMaak, verplaats: bron.verplaats, bronUitSubsidie: bron.bronUitSubsidie,
    bronUitCampagne: bron.bronUitCampagne, bronUitGift: bron.bronUitGift,
    vindBron, vrij, bronBeeld,
    uitgaveAanvraag: uitgaven.aanvraag, uitgaveBesluit: uitgaven.besluit,
    boekAanvraag: uitgaven.boekAanvraag,
    SOORTEN, HERBESTEMMING };
};
module.exports.SOORTEN = SOORTEN;
module.exports.HERBESTEMMING = HERBESTEMMING;
