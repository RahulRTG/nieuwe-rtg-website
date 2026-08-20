/* DE SOCIALE AFDRACHT: 30% van elke bijdrage, met een spoor per euro.

   WAT HIER STOND EN WAAROM HET LOSGEMAAKT MOEST. De 30% zat vast aan
   productnamen: "Foundation Pass" -> "Foundation allocation". Dat leest logisch
   tot je een tweede bron krijgt die geen pas is, of een verdeling die verandert.
   Dit is een ECONOMISCHE REGEL en geen eigenschap van een product:

       in aanmerking komende omzet
       -> 30% sociale afdracht
          |- 20% lokaal
          `- 10% RTFoundation

   DRIE GATEN DIE DIT SLUIT (PRIJZEN.md 4.8 en 4.9):

   1. De 20/10-splitsing stond nergens onderbouwd behalve in GAMEHALL.md par.
      12.5 -- over de SPELWERELD. De publieke voorwaarden noemden alleen de 30%.
   2. Wie "lokaal" is en waar dat geld landt, stond nergens. RTF_IBAN is een
      rekening.
   3. Er was geen spoor per bedrag: alleen een som. Achteraf aantonen waar een
      euro heen ging, kon niet -- en MARKT.md waarschuwt dat de 30% een
      handelspraktijk wordt zodra hij in marketing staat, en dan aantoonbaar moet
      zijn.

   DE REGELVERSIE IS HET VELD DAT HET VERSCHIL MAAKT. Elk bedrag draagt
   `regelVersie`. Verandert de verdeling ooit, dan blijven oude bedragen leesbaar
   onder de regel die TOEN gold. Zonder dat veld zou een wijziging met
   terugwerkende kracht de geschiedenis herschrijven -- en dan is "waar ging deze
   euro heen" een vraag met twee antwoorden.

   DE VIER TIJDSTEMPELS, en ze zijn geen van alle hetzelfde:

       gereserveerdOp  het bedrag is berekend en apart gezet
       betaalbaarOp    het mag uitbetaald worden (rekening bekend, termijn voldaan)
       afgewikkeldOp   het is echt overgemaakt
       (geen)          zolang een van de drie ontbreekt, is het niet af

   WAT DIT NIET IS: een tweede boekhouding, en ook niet de betaal-naad. Deze
   laag zegt WAT er verschuldigd is aan wie, met welke regel gerekend, en hoe
   ver het is. Het echte overmaken loopt via kern/fonds.js en de betaalopdracht.
   Dezelfde scheiding als bij ./fee.js en ./contract.js. */
'use strict';

/* De regels, met een versie. Een nieuwe verdeling komt erbij als NIEUWE versie;
   een bestaande wordt nooit gewijzigd. Dat is de hele reden dat er een tabel
   staat en geen constante: een constante die je aanpast, herschrijft het
   verleden. */
const REGELS = {
  'v1-2026': {
    versie: 'v1-2026',
    vanaf: '2026-01-01',
    totaalDeel: 0.30,
    delen: [
      { id: 'lokaal', deel: 0.20, label: 'Lokale impact',
        waarom: 'blijft in de omgeving van het lid: speeltuin, sporthal, school, cultuur, bibliotheek, mobiliteit' },
      { id: 'foundation', deel: 0.10, label: 'RTFoundation',
        waarom: 'de stichting zelf: onderwijs- en gezinsprogramma\'s over de omgeving heen' }
    ],
    /* De afdracht rekent over het bedrag EX btw. Btw is geen omzet van RTG maar
       geld van de Belastingdienst; 30% daarvan afdragen zou betekenen dat RTG
       een deel van de btw weggeeft en die zelf bijlegt. */
    exBtw: true
  }
};

const HUIDIGE_VERSIE = 'v1-2026';

const STATUS = {
  GERESERVEERD: 'GERESERVEERD',   // berekend en apart gezet
  BETAALBAAR: 'BETAALBAAR',       // bestemming bekend, mag weg
  AFGEWIKKELD: 'AFGEWIKKELD',     // echt overgemaakt
  VERVALLEN: 'VERVALLEN'          // de bron is teruggedraaid (terugbetaling, storno)
};

const OVERGANG = {
  [STATUS.GERESERVEERD]: [STATUS.BETAALBAAR, STATUS.VERVALLEN],
  [STATUS.BETAALBAAR]: [STATUS.AFGEWIKKELD, STATUS.VERVALLEN],
  [STATUS.AFGEWIKKELD]: [],
  [STATUS.VERVALLEN]: []
};

function magOvergaan(van, naar) {
  return Array.isArray(OVERGANG[van]) && OVERGANG[van].includes(naar);
}

function regelVan(versie) { return REGELS[versie] || REGELS[HUIDIGE_VERSIE]; }

/* Klopt een regel met zichzelf? Geeft null als het goed is, anders de zin.

   Waarom dit bestaat: 0.20 + 0.10 is in JavaScript 0.30000000000000004, dus een
   rechtstreekse vergelijking van de som met `totaalDeel` faalt op een regel die
   gewoon klopt. Wie dat een keer tegenkomt en "oplost" door de controle weg te
   halen, verliest de enige bewaking op een verdeling die NIET optelt -- en dan
   draagt RTG 30% af terwijl er maar 25% wordt verdeeld, of andersom.

   Vandaar: vergelijken in tienduizendsten, niet in drijvende komma. */
function regelKlopt(r) {
  if (!r || !Array.isArray(r.delen) || !r.delen.length) return 'de regel heeft geen delen';
  const som = Math.round(r.delen.reduce((s, d) => s + d.deel, 0) * 10000);
  const totaal = Math.round(r.totaalDeel * 10000);
  if (som !== totaal)
    return 'de delen tellen op tot ' + (som / 100) + '% en het totaal is ' + (totaal / 100) + '%';
  for (const d of r.delen) {
    if (!(d.deel > 0)) return 'deel ' + d.id + ' is niet groter dan nul';
    if (!d.waarom) return 'deel ' + d.id + ' zegt niet waar dat geld heen gaat';
  }
  return null;
}

/* De verdeling van een bedrag, volgens een regel. Geeft de delen EN het
   restant -- want de som van afgeronde delen is niet altijd het totaal, en dat
   verschil hoort zichtbaar te zijn in plaats van in de laatste post te
   verdwijnen.

   `bedragCenten` is het bedrag waarover gerekend wordt, al ex btw. Deze functie
   deelt niet door 1,21: wie dat hier zou doen, rekent het nog een keer als de
   aanroeper het al deed. Zie kern/fonds.js, dat de btw-kant kent. */
function verdeel(bedragCenten, versie) {
  const r = regelVan(versie);
  const basis = Math.max(0, Math.round(Number(bedragCenten) || 0));
  const totaal = Math.round(basis * r.totaalDeel);
  const delen = r.delen.map(d => ({ id: d.id, label: d.label, deel: d.deel,
    centen: Math.round(basis * d.deel) }));
  const som = delen.reduce((s, d) => s + d.centen, 0);
  return { regelVersie: r.versie, basisCenten: basis, totaalCenten: totaal, delen,
    /* Het afrondingsverschil, expliciet. Nul in verreweg de meeste gevallen; is
       het dat niet, dan hoort iemand te zien dat de delen niet exact optellen
       in plaats van dat het stil in een post wordt verstopt. */
    afrondingCenten: totaal - som };
}

function maakAllocatie({ db, save, nu }) {
  const tijd = nu || (() => Date.now());
  function rij() {
    if (!db.data) db.data = {};
    if (!Array.isArray(db.data.socialeAfdrachten)) db.data.socialeAfdrachten = [];
    return db.data.socialeAfdrachten;
  }

  function zet(a, naar, velden) {
    if (!magOvergaan(a.status, naar))
      return { error: 'Een sociale afdracht kan niet van ' + a.status + ' naar ' + naar + '.' };
    a.status = naar;
    Object.assign(a, velden || {});
    save();
    return { ok: true, afdracht: a };
  }

  /* RESERVEREN: het moment dat een bijdrage binnenkomt. Gebeurt bij de BRON en
     niet achteraf, zodat het geld apart staat voordat het ergens anders heen
     kan. Dezelfde regel als in kern/fonds.js.

     `bron` zegt waar het vandaan komt (welke termijn, welk contract, welk lid op
     codenaam) -- nooit een echte naam, want dit is operationele data. */
  function reserveer({ bronSoort, bronId, codenaam, bedragCenten, versie }) {
    const v = verdeel(bedragCenten, versie);
    if (v.totaalCenten <= 0) return null;      // niets af te dragen is geen afdracht
    const a = {
      id: 'soc_' + Math.random().toString(36).slice(2, 10) + '_' + rij().length,
      bronSoort: String(bronSoort || 'onbekend'),
      bronId: bronId || null,
      codenaam: codenaam || null,
      basisCenten: v.basisCenten,
      centen: v.totaalCenten,
      delen: v.delen,
      afrondingCenten: v.afrondingCenten,
      regelVersie: v.regelVersie,
      status: STATUS.GERESERVEERD,
      lokaleBestemming: null,
      foundationBestemming: null,
      gereserveerdOp: tijd(),
      betaalbaarOp: null,
      afgewikkeldOp: null
    };
    rij().unshift(a);
    if (rij().length > 20000) rij().length = 20000;
    save();
    return a;
  }

  /* BETAALBAAR: de bestemmingen zijn bekend. Zonder bestemming geen betaalbaar
     -- dat is precies de stand waarin de RTFoundation-afdracht nu staat zolang
     RTF_IBAN leeg is, en die stand hoort een naam te hebben in plaats van een
     boolean die "nog niet" en "niet nodig" door elkaar haalt. */
  function maakBetaalbaar(a, { lokaal, foundation }) {
    if (!a) return { error: 'geen afdracht' };
    if (!lokaal && !foundation)
      return { error: 'Zonder bestemming kan een afdracht niet betaalbaar worden.' };
    return zet(a, STATUS.BETAALBAAR, {
      lokaleBestemming: lokaal || null,
      foundationBestemming: foundation || null,
      betaalbaarOp: tijd()
    });
  }

  function wikkelAf(a, ref) {
    if (!a) return { error: 'geen afdracht' };
    return zet(a, STATUS.AFGEWIKKELD, { afgewikkeldOp: tijd(), uitbetaalRef: ref || null });
  }

  /* VERVALLEN: de bron is teruggedraaid. Een terugbetaald lidmaatschap hoort
     geen sociale afdracht achter te laten -- anders draagt RTG af over geld dat
     het heeft teruggegeven. Een AFGEWIKKELDE afdracht kan niet meer vervallen;
     die is weg, en dat terughalen is een nieuwe handeling en geen statuswijziging. */
  function verval(a, reden) {
    if (!a) return { error: 'geen afdracht' };
    return zet(a, STATUS.VERVALLEN, { vervalReden: String(reden || '').slice(0, 200) });
  }

  /* Het bord: wat is gereserveerd, wat kan weg, wat is er uit. Per deel, want
     "30% is afgedragen" zegt niets als het lokale deel al twee jaar wacht. */
  function stand(filter) {
    filter = filter || {};
    const alle = rij().filter(a => (!filter.versie || a.regelVersie === filter.versie) &&
      (!filter.status || a.status === filter.status));
    const som = (lijst, veld) => lijst.reduce((s, a) => s + (a[veld] || 0), 0);
    const perDeel = {};
    for (const a of alle) {
      if (a.status === STATUS.VERVALLEN) continue;
      for (const d of a.delen || []) {
        const p = perDeel[d.id] = perDeel[d.id] || { label: d.label, gereserveerd: 0, betaalbaar: 0, afgewikkeld: 0 };
        if (a.status === STATUS.GERESERVEERD) p.gereserveerd += d.centen;
        else if (a.status === STATUS.BETAALBAAR) p.betaalbaar += d.centen;
        else if (a.status === STATUS.AFGEWIKKELD) p.afgewikkeld += d.centen;
      }
    }
    return {
      aantal: alle.length,
      basisCenten: som(alle.filter(a => a.status !== STATUS.VERVALLEN), 'basisCenten'),
      totaalCenten: som(alle.filter(a => a.status !== STATUS.VERVALLEN), 'centen'),
      openCenten: som(alle.filter(a => a.status === STATUS.GERESERVEERD || a.status === STATUS.BETAALBAAR), 'centen'),
      afgewikkeldCenten: som(alle.filter(a => a.status === STATUS.AFGEWIKKELD), 'centen'),
      vervallenCenten: som(alle.filter(a => a.status === STATUS.VERVALLEN), 'centen'),
      perDeel,
      regels: Object.values(REGELS).map(r => ({ versie: r.versie, totaalDeel: r.totaalDeel,
        delen: r.delen.map(d => ({ id: d.id, deel: d.deel, label: d.label, waarom: d.waarom })) }))
    };
  }

  const vind = id => rij().find(a => a.id === String(id || '')) || null;
  function lijst(filter) {
    filter = filter || {};
    return rij().filter(a => (!filter.status || a.status === filter.status) &&
      (!filter.bronId || a.bronId === filter.bronId)).slice(0, 200);
  }

  return { STATUS, reserveer, maakBetaalbaar, wikkelAf, verval, stand, lijst, vind, rij };
}

module.exports = { maakAllocatie, verdeel, regelVan, regelKlopt, REGELS, HUIDIGE_VERSIE, STATUS, OVERGANG, magOvergaan };
