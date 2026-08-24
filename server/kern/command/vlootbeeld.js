/* HET VLOOTBEELD -- alle organisaties in één beeld, en de plek waar dat beeld
   ophoudt.

   TWEE DINGEN MOETEN HIER TEGELIJK WAAR ZIJN, en ze trekken tegengesteld.

   Support moet van ALLE organisaties naar ÉÉN werkruimte kunnen zakken zonder
   van gereedschap te wisselen -- anders wordt één externe storing bij achthonderd
   klanten achthonderd tickets, en dan zoekt achthonderd keer iemand hetzelfde
   uit. Dat is de reden dat deze laag bestaat.

   En tegelijk mag "ik kan tot op werkruimteniveau kijken" niet betekenen "ik mag
   alles lezen". Vandaar de regel die dit bestand zijn vorm geeft: **het
   vlootbeeld toont wat RTG zonder uitnodiging mag zien, en houdt op waar de
   uitnodiging begint.** Je kunt hier zien dat een organisatie bestaat, hoe zij is
   ingericht in aantallen, in welke levensloopstand zij zit en of er een
   bijstandssessie loopt. Wat er IN die werkruimte gebeurt, staat er niet -- daar
   is ./bijstand.js voor, en die begint bij de klant.

   EN ER STAAT GEEN BESCHIKBAARHEIDSCIJFER PER KLANT. Niet uit voorzichtigheid
   maar omdat de meting het niet draagt: server/meting.js telt per routepatroon
   en kent geen tenant. Een platformcijfer als "uw beschikbaarheid" presenteren is
   preciezer dan de meting en dus onwaar; kern/tenant/bewijs.js weigert dat al om
   dezelfde reden, en die weigering wordt hier niet omzeild.

   EEN HOOFDINCIDENT IS ÉÉN INCIDENT. De incidenten komen uit ./incident.js en
   hangen aan een VERMOGEN, niet aan een klant. Er staat dus bij hoeveel
   organisaties er zijn, en er staat NIET bij hoeveel er iets van hebben gemerkt
   -- want dat is precies het getal dat niemand hier kan tellen. */
'use strict';

/* Wat dit beeld structureel niet kan, met de reden. Zelfde soort blok als
   `nietGemeten` bij een incident, en om dezelfde reden: een lijst die alleen
   toont wat hij heeft, leest als een volledige lijst. */
const NIET_TE_ZIEN = [
  { wat: 'hoeveel organisaties een storing werkelijk hebben gemerkt',
    waarom: 'de meting telt per routepatroon (server/meting.js) en draagt geen tenant. Het aantal ' +
      'organisaties hieronder is wat er BESTAAT, niet wat er geraakt is.' },
  { wat: 'een beschikbaarheidscijfer per organisatie',
    waarom: 'om dezelfde reden. kern/tenant/bewijs.js weigert dat cijfer al aan de klant; het hier wel ' +
      'tonen zou betekenen dat wij intern een getal gebruiken dat wij extern onwaar noemen.' },
  { wat: 'wat er binnen een werkruimte gebeurt',
    waarom: 'dat begint bij een uitnodiging van de klant (kern/command/bijstand.js). Dit beeld toont wat RTG ' +
      'zonder die uitnodiging mag zien, en houdt daar op.' }
];

function maakVlootbeeld({ tenant, incident, bijstand, gezondheid }) {
  /* Lui, om dezelfde reden als in ./bijstand.js. */
  const T = () => (typeof tenant === 'function' ? tenant() : tenant) || {};
  const veilig = (doe, waarom) => {
    try { const w = doe(); return w == null ? { nietTeLezen: waarom } : w; }
    catch (e) { return { nietTeLezen: waarom + ' (' + e.message + ')' }; }
  };

  function organisaties() {
    const rijen = veilig(() => T().register.lijst(), 'het tenantregister is niet te lezen');
    if (rijen.nietTeLezen) return { fout: rijen.nietTeLezen, lijst: [] };
    const sessies = veilig(() => bijstand.lijst({ alleenLevend: true, max: 500 }), 'de sessies zijn niet te lezen');
    const perOrg = new Map();
    for (const s of (Array.isArray(sessies) ? sessies : [])) perOrg.set(s.org, s);
    return { lijst: rijen.map(t => ({
      org: t.org, naam: t.naam, modus: t.modus, actief: t.actief,
      werkruimtes: t.werkruimtes, zaken: t.zaken, groepen: t.groepen, merk: t.merk, bij: t.bij,
      levensloop: veilig(() => T().levensloop && T().levensloop.stand(t.org),
        'geen levensloop bekend'),
      bijstand: perOrg.get(t.org) || null
    })) };
  }

  /* HET HOOFDINCIDENT. Eén regel per lopend incident, met het aantal
     organisaties dat BESTAAT -- en de zin erbij dat dat niet het aantal geraakte
     is. Zonder die zin wordt "812 organisaties" binnen een week gelezen als
     "812 klanten hadden hier last van". */
  function hoofdincidenten(aantalOrgs) {
    const open = veilig(() => incident.lijst({ max: 50 }), 'de incidenten zijn niet te lezen');
    if (open.nietTeLezen) return { fout: open.nietTeLezen, lijst: [] };
    return { lijst: open.map(i => ({
      id: i.id, vermogen: i.vermogen, naam: i.naam, wat: i.wat, status: i.status,
      begonnen: i.begonnen, eigenaar: i.eigenaar,
      organisatiesInDeVloot: aantalOrgs,
      geraakteOrganisaties: null,
      let: 'Dit is ÉÉN incident en geen ' + aantalOrgs + ' meldingen. Hoeveel organisaties er werkelijk ' +
        'iets van merkten, is niet gemeten -- zie "niet te zien".'
    })) };
  }

  function beeld() {
    const orgs = organisaties();
    const n = orgs.lijst.length;
    const g = veilig(() => gezondheid.stand(), 'de gezondheidskaart is niet te lezen');
    const inc = hoofdincidenten(n);
    const actief = orgs.lijst.filter(o => o.actief);
    const metSessie = orgs.lijst.filter(o => o.bijstand);
    return {
      at: new Date().toISOString(),
      tel: { organisaties: n, actief: actief.length, stil: n - actief.length,
        werkruimtes: orgs.lijst.reduce((s, o) => s + o.werkruimtes, 0),
        metBijstand: metSessie.length,
        hoofdincidenten: inc.lijst.length },
      platform: g.nietTeLezen ? { nietTeLezen: g.nietTeLezen }
        : { oordeel: g.oordeel, tel: g.tel,
          stuk: g.vermogens.filter(v => v.oordeel === 'storing').map(v => ({ id: v.id, naam: v.naam })) },
      hoofdincidenten: inc.lijst, incidentFout: inc.fout || null,
      organisaties: orgs.lijst, organisatieFout: orgs.fout || null,
      nietTeZien: NIET_TE_ZIEN,
      let: 'Dit beeld toont wat RTG zonder uitnodiging mag zien. Wat er binnen een werkruimte gebeurt, ' +
        'begint bij een bijstandssessie die de klant zelf opent.'
    };
  }

  /* De afdaling: van de vloot naar ÉÉN organisatie. Hier houdt het op, en dat
     staat er met zoveel woorden in plaats van dat het scherm gewoon leeg blijft
     -- een lege diepte leest als "er is niets", en dat is iets anders dan "hier
     mag ik niet zonder toestemming". */
  /* "Bestaat niet" en "de bron is stuk" zijn TWEE uitslagen, en `veilig()`
     maakt er één van: die geeft `nietTeLezen` ook terug bij een lege waarde.
     Hier moet dat uit elkaar, want 404 en 503 vragen om iets heel anders van de
     lezer -- de een zoekt een typefout, de ander belt de beheerder. */
  function organisatie(org) {
    let t;
    try { t = T().register.haal(org); }
    catch (e) { return { error: 'Het tenantregister is niet te lezen (' + e.message + ').', status: 503 }; }
    if (!t) return { error: 'Die organisatie kennen we niet.', status: 404 };
    const sessies = veilig(() => bijstand.lijst({ org: t.org, max: 20 }), 'de sessies zijn niet te lezen');
    return {
      org: t.org, naam: t.naam, modus: t.modus, actief: t.actief !== false,
      /* CODES en geen inhoud: dat een werkruimte bestaat is structuur, wat erin
         staat is van de klant. */
      werkruimtes: (t.werkruimtes || []).slice(),
      zaken: (t.zaken || []).slice(),
      groepen: (t.groepen || []).length,
      levensloop: veilig(() => T().levensloop && T().levensloop.stand(t.org), 'geen levensloop bekend'),
      bewijs: veilig(() => T().bewijs && T().bewijs.stand(t.org), 'de bewijsstand is niet te lezen'),
      sessies: Array.isArray(sessies) ? sessies : [],
      dieper: {
        mag: false,
        waarom: 'Verder kijken dan deze aantallen vraagt een bijstandssessie, en die opent de organisatie ' +
          'zelf. Er is geen stand waarin RTG zichzelf die toegang geeft.',
        hoe: 'De klant vraagt bijstand vanuit zijn eigen werkruimte; daarna staat de sessie in de werkplek ' +
          'Bijstand met een niveau, een looptijd en een spoor dat hij live meeleest.'
      },
      nietTeZien: NIET_TE_ZIEN
    };
  }

  return { beeld, organisatie, NIET_TE_ZIEN };
}

module.exports = { maakVlootbeeld, NIET_TE_ZIEN };
