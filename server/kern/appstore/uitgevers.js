/* ============================================================================
   DE UITGEVERS -- wie mag hier publiceren, en wie heeft dat besloten.

   Afgesplitst van ./index.js toen die over de 10 KB-keuringsgrens ging, en langs
   een echte naad: "wie mag hier publiceren" is een andere vraag dan "welke versie
   draait er". De eerste gaat over een PARTIJ en wordt door een mens van RTG
   beantwoord; de tweede gaat over BYTES en wordt per inzending opnieuw gesteld.

   De twee regels die dit bestand dragen:

   1. AANVRAGEN DOET DE PARTIJ, TOELATEN DOET EEN MENS VAN RTG. Dat is geen
      formaliteit maar het moment waarop er een aanspreekbare rechtspersoon
      achter een app komt te staan. Een besluit zonder naam wordt geweigerd:
      een besluit dat niemand heeft genomen, is geen besluit.

   2. EEN GESCHORSTE UITGEVER VERLIEST ZIJN ETALAGE ONMIDDELLIJK. Zou dat pas bij
      de volgende publicatie gebeuren, dan blijft een app van een partij waar we
      net afscheid van namen gewoon draaien bij de leden. Dat is grens 5.
   ========================================================================== */
'use strict';

const STATUS_UITGEVER = ['aangevraagd', 'toegelaten', 'geweigerd', 'geschorst'];

/* TWEE SOORTEN UITGEVER, en het verschil is geen etiket maar een BEVOEGDHEID.

   Besloten op 27 augustus 2026: een geverifieerd PERSOON mag publiceren, maar
   alleen gratis. Betaalde distributie blijft een rechtspersoon vragen -- daar
   hangen btw, de afdracht en een aanspreekbare partij aan, en die drie zijn niet
   aan een natuurlijk persoon op te hangen zonder dat RTG iets belooft wat het
   niet kan waarmaken.

   Dat het geen boolean is, is met opzet. WAARDE.md houdt in dit huis vast dat
   uitbetaalbaar aan een BEVOEGDHEID hangt en nooit aan een vlag; dezelfde
   redenering geldt hier. `magPrijsVragen` geeft daarom een REDEN terug en niet
   alleen een ja of nee, want die reden is wat de mens te lezen krijgt. */
const SOORTEN = ['rechtspersoon', 'persoon'];

/* De leeftijd waarop een mens een uitgeversplek kan vragen. Publiceren is een
   verbintenis. Onder die grens blijft bouwen en uitproberen volledig mogelijk
   (rtg new, rtg dev) -- net als bij de progressielaag, waar het spel gewoon
   speelbaar blijft en alleen het BEWAREN buiten het potje stopt (CLAUDE.md). */
const UITGEVER_LEEFTIJD = 18;

/* MAG DEZE MENS EEN UITGEVERSPLEK VRAGEN? Een pure functie, en met opzet: de
   ROUTE weet wie er inlogt, maar de REGEL is een huisregel en hoort niet in een
   route te wonen waar geen toets bij kan. De route levert twee feiten aan (is de
   identiteit door RTG gezien, en hoe oud is deze mens); wat die feiten betekenen
   staat hier.

   `leeftijd` mag ontbreken en dat is dan GEEN ja: zonder geboortedatum is de
   leeftijd niet vast te stellen, en niet vast te stellen is in dit huis nooit
   hetzelfde als in orde (BESTUUR.md). */
function mensMagUitgeven({ geverifieerd, leeftijd } = {}) {
  if (!geverifieerd) {
    return { mag: false, status: 403, error: 'Publiceren in de App Store vraagt een door RTG geverifieerde identiteit. '
      + 'Laat eerst je paspoort zien; daarna kun je een uitgeversplek aanvragen.' };
  }
  /* `Number(null)` en `Number('')` zijn allebei 0, en nul is hier geen leeftijd
     maar een ontbrekend gegeven. Zonder deze regel leest een mens zonder
     geboortedatum de melding "vanaf 18 jaar", terwijl er in werkelijkheid niets
     te meten viel -- en dat is precies het verschil dat dit huis niet wegpoetst
     (BESTUUR.md: niet vast te stellen is een eigen uitslag). */
  const n = (leeftijd === null || leeftijd === undefined || leeftijd === '') ? NaN : Number(leeftijd);
  if (!Number.isFinite(n)) {
    return { mag: false, status: 403, error: 'Je leeftijd is hier niet vast te stellen, en dat is geen ja: '
      + 'een uitgeversplek is er vanaf ' + UITGEVER_LEEFTIJD + ' jaar.' };
  }
  if (n < UITGEVER_LEEFTIJD) {
    return { mag: false, status: 403, error: 'Een uitgeversplek is er vanaf ' + UITGEVER_LEEFTIJD + ' jaar: publiceren is een verbintenis. '
      + 'Bouwen en uitproberen kan gewoon -- met rtg new en rtg dev draait je app lokaal op de echte brug.' };
  }
  return { mag: true };
}

module.exports = function maakUitgevers({ S, save, nu, boek, eigen, norm }) {
  /* ---------------------------------------------------------------- uitgevers */

  function uitgever(org) { return eigen(S().uitgevers, norm(org)); }
  const magInzenden = (org) => { const u = uitgever(org); return !!u && u.status === 'toegelaten'; };

  /* Aanvragen doet de partij zelf; TOELATEN doet een mens van RTG. Dat is geen
     formaliteit: dit is het moment waarop er een aanspreekbare rechtspersoon
     achter een app komt te staan. Een aanvraag die al bestaat, wordt bijgewerkt
     zolang er nog niet over besloten is -- twee aanvragen van dezelfde org zou
     betekenen dat "de uitgever" op twee plekken staat (LAT-regel 4). */
  function uitgeverAanvragen({ org, naam, contact, leverancier, soort, persoonKey }) {
    const o = norm(org);
    const srt = SOORTEN.includes(soort) ? soort : 'rechtspersoon';
    if (!/^[A-Z0-9][A-Z0-9-]{1,30}$/.test(o)) return { status: 400, error: 'Een organisatiecode bestaat uit hoofdletters, cijfers en streepjes.' };
    const nm = String(naam || '').trim().slice(0, 120);
    const ct = String(contact || '').trim().slice(0, 160);
    if (nm.length < 2) return { status: 400, error: 'Vul de naam in waaronder je publiceert; die staat straks bij elke app.' };
    if (ct.length < 5) return { status: 400, error: 'Vul een contactadres in waarop RTG je kan bereiken over een inzending.' };
    const bestaand = uitgever(o);
    if (bestaand && bestaand.status === 'toegelaten') return { status: 200, ok: true, uitgever: publiekU(bestaand), al: true };
    if (bestaand && bestaand.status === 'geschorst') return { status: 403, error: 'Deze uitgever is geschorst. Reden: ' + (bestaand.reden || 'niet vastgelegd') + '.' };
    /* De SOORT wordt bij het aanmaken gezet en daarna nooit meer, ook niet door
       een tweede aanvraag: hij bepaalt wat deze uitgever mag (zie
       magPrijsVragen), en een bevoegdheid die je met een volgend verzoek kunt
       omzetten is geen bevoegdheid. */
    const u = bestaand && bestaand.status === 'aangevraagd'
      ? Object.assign(bestaand, { naam: nm, contact: ct, leverancier: leverancier || bestaand.leverancier || null, at: nu() })
      : { org: o, naam: nm, contact: ct, leverancier: leverancier || null, soort: srt,
          persoonKey: srt === 'persoon' ? String(persoonKey || '') || null : null,
          status: 'aangevraagd', reden: null, at: nu(), besloten: null };
    S().uitgevers[o] = u;
    boek('uitgever-aangevraagd', o, leverancier || null, { naam: nm });
    save();
    return { status: 200, ok: true, uitgever: publiekU(u) };
  }

  /* De mens van RTG beslist. `door` is wie er tekent en gaat mee het journaal in;
     een besluit zonder naam is een besluit dat niemand heeft genomen. */
  function uitgeverBesluit({ org, besluit, reden, door }) {
    const u = uitgever(org);
    if (!u) return { status: 404, error: 'Deze uitgever bestaat niet.' };
    if (!STATUS_UITGEVER.includes(besluit) || besluit === 'aangevraagd') return { status: 400, error: 'Een besluit is toegelaten, geweigerd of geschorst.' };
    const wie = String(door || '').trim().slice(0, 80);
    if (!wie) return { status: 400, error: 'Zet je naam erbij: een besluit over een uitgever hoort een mens te hebben genomen.' };
    if (besluit !== 'toegelaten' && String(reden || '').trim().length < 5) return { status: 400, error: 'Een weigering of schorsing draagt een reden; die krijgt de uitgever te lezen.' };
    u.status = besluit;
    u.reden = besluit === 'toegelaten' ? null : String(reden || '').trim().slice(0, 400);
    u.besloten = { door: wie, at: nu() };
    /* Een geschorste uitgever verliest zijn etalage onmiddellijk. Zou dat pas bij
       de volgende publicatie gebeuren, dan blijft een app van een partij waar we
       net afscheid van namen gewoon draaien bij de leden. */
    let gevallen = 0;
    if (besluit !== 'toegelaten') {
      for (const a of Object.values(S().apps)) {
        if (a.org !== u.org || !a.live) continue;
        const v = eigen(S().versies, a.live);
        if (v) v.status = 'ingetrokken';
        a.live = null; a.ingetrokken = { at: nu(), door: wie, reden: 'de uitgever is ' + besluit };
        gevallen++;
      }
    }
    boek('uitgever-' + besluit, u.org, wie, { reden: u.reden, appsGevallen: gevallen });
    save();
    return { status: 200, ok: true, uitgever: publiekU(u), appsGevallen: gevallen };
  }

  /* DE UITGEVERSPLEK VAN EEN MENS AANVRAGEN. Hij komt hier binnen en niet via
     uitgeverAanvragen(), om een reden: bij een ZAAK bestaat de organisatiecode
     al (het tenantregister kent hem), bij een MENS niet -- en hij mag ook niet
     uit de mens worden afgeleid. Zie uitgeverVanPersoon hieronder.

     Twee keer aanvragen levert dus geen tweede plek: er wordt eerst gekeken of
     deze mens er al een heeft, en anders wordt er een code gemaakt. */
  function uitgeverAanvragenPersoon({ persoonKey, naam, contact }) {
    const k = String(persoonKey || '');
    if (!k) return { status: 400, error: 'Er is geen sessie om deze uitgeversplek aan te hangen.' };
    const al = uitgeverVanPersoon(k);
    return uitgeverAanvragen({ org: al ? al.org : nieuweOrgcode(), naam, contact,
      soort: 'persoon', persoonKey: k });
  }

  /* Een WILLEKEURIGE code, en dat is de hele afweging. `publiekU.org` staat in
     de catalogus bij elke app; zou hij uit het account of de codenaam zijn
     gebouwd, dan is die publiek. Botsen kan in theorie: dan nog een keer. */
  function nieuweOrgcode() {
    for (let poging = 0; poging < 8; poging++) {
      const code = 'P-' + require('crypto').randomBytes(5).toString('hex').toUpperCase();
      if (!eigen(S().uitgevers, code)) return code;
    }
    /* Acht botsingen op tien willekeurige bytes gebeurt niet; als het toch
       gebeurt, is er iets anders stuk en dan is stil doorgaan het slechtste
       antwoord (LAT-regel 5). */
    throw new Error('Er kon geen vrije organisatiecode worden gemaakt.');
  }

  /* MAG DEZE UITGEVER GELD VRAGEN? Dit is de ENIGE plek waar die grens staat.
     Zou hij ook in een route staan, dan is er een tweede plek die op een dag
     iets anders zegt (LAT-regel 4). De inzendkant roept hem aan; een tweede
     moment is er niet, want de soort verandert nooit meer. */
  function magPrijsVragen(org) {
    const u = uitgever(org);
    if (!u) return { mag: false, reden: 'Deze organisatie is geen uitgever.' };
    if (u.soort === 'persoon') {
      return { mag: false, reden: 'Je publiceert als geverifieerd persoon, en dan is een app gratis. '
        + 'Een betaalde app vraagt een rechtspersoon: daar hangen de btw, de afdracht en een aanspreekbare partij aan. '
        + 'Zet prijsCenten op 0, of vraag een uitgeversplek aan vanuit een zaak.' };
    }
    return { mag: true };
  }

  /* De uitgeversplek van een MENS, gezocht op de sleutel van zijn sessie. Niet
     op een afgeleide code: `publiekU.org` staat in de catalogus bij elke app, en
     een code die uit het account is gebouwd maakt dat account publiek -- dat is
     het codenaamontwerp omzeilen (CLAUDE.md). De orgcode is dus willekeurig, en
     de sleutel staat ernaast in de opslag. */
  function uitgeverVanPersoon(persoonKey) {
    const k = String(persoonKey || '');
    if (!k) return null;
    return Object.values(S().uitgevers).find(u => u.soort === 'persoon' && u.persoonKey === k) || null;
  }

  /* `soort` staat er wel in: een lid mag weten of er een bedrijf of een mens
     achter een app staat. `persoonKey` staat er met opzet NIET in -- dat is de
     sessiesleutel van een lid, en die hoort nergens publiek te worden. */
  const publiekU = (u) => ({ org: u.org, naam: u.naam, contact: u.contact, soort: u.soort || 'rechtspersoon',
    status: u.status, reden: u.reden || null, at: u.at, besloten: u.besloten || null });
  const uitgevers = () => Object.values(S().uitgevers).map(publiekU);

  return { uitgever, magInzenden, uitgeverAanvragen, uitgeverAanvragenPersoon, uitgeverBesluit,
    publiekU, uitgevers, magPrijsVragen, uitgeverVanPersoon, STATUS_UITGEVER, SOORTEN };
};
module.exports.mensMagUitgeven = mensMagUitgeven;
module.exports.SOORTEN = SOORTEN;
module.exports.UITGEVER_LEEFTIJD = UITGEVER_LEEFTIJD;
