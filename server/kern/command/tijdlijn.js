/* DE CONFIGURATIETIJDLIJN -- alles wat er verandert, op één lijn.

   Bij een storing stelt iedereen dezelfde vraag als eerste: *wat is er vlak
   daarvoor veranderd?* Die vraag was hier niet te beantwoorden, niet omdat het
   nergens stond maar omdat het op drie plekken stond met drie verschillende
   vormen: het journaal van RTG Command, de aanvragen aan de schakelkast en het
   audittspoor van de incidentcontrole.

   DIT IS EEN SAMENVOEGING EN GEEN VIERDE OPSLAG. Er wordt hier niets bewaard;
   elke regel komt uit een bron die er al was en draagt de naam van die bron. Een
   eigen kopie zou op een dag iets anders zeggen dan het scherm waar zij vandaan
   kwam -- en dan is de tijdlijn het minst betrouwbare bewijsstuk van de drie.

   VOLGORDE IS GEEN OORZAAK, en dat is de belangrijkste zin in dit bestand.
   `rondom()` mag zeggen dat er zevenendertig seconden vóór een moment iets is
   gewijzigd; hij mag niet zeggen dat dat het veroorzaakte. Elk antwoord draagt
   die zin mee, want een tijdlijn zonder die zin wordt binnen een week gelezen
   als een oorzakenlijst.

   EN WAT DEZE LIJN NIET ZIET, STAAT ERBIJ. Het journaal ziet alleen wat via RTG
   Command is gegaan: de gewone app-routes en de leverancierskant lopen er niet
   doorheen. De schakelaarsaanvragen worden op honderd afgekapt. En een uitrol,
   een migratie of een wijziging op de machine zelf komt in geen van de drie
   voor. "Er is niets veranderd" betekent hier dus "in deze drie bronnen staat
   niets", en dat is iets anders -- precies de verwarring waarmee iemand een
   oorzaak uitsluit die er wel degelijk was. */
'use strict';

/* Wat elke bron levert, en wat hij NIET ziet. Deze tabel is de dekking van de
   tijdlijn; hij gaat mee in elk antwoord. */
const BRONNEN = [
  { id: 'journaal', wat: 'elke handeling van mens en machine binnen RTG Command',
    zietNiet: 'de gewone app-routes en de leverancierskant lopen niet door dit journaal, en de staart wordt ' +
      'afgekapt: `aantal` blijft het echte totaal, de lijst is een venster' },
  { id: 'schakelaar', wat: 'aanvragen en besluiten op de functieschakelaars (het techniekbord)',
    zietNiet: 'alleen de laatste honderd aanvragen; wat daarvoor is gebeurd, staat er niet meer' },
  { id: 'noodstand', wat: 'de incidentcontrole: welke functies zijn tijdelijk omgezet en wanneer terug',
    zietNiet: 'niets buiten die ene bediening' }
];

const BUITEN_BEELD = [
  { wat: 'een uitrol of een nieuwe versie van de software',
    waarom: 'die gaat niet door een van deze drie bronnen; wat er van de uitrol wél in staat is een canary, ' +
      'en alleen als die via Command is gestart' },
  { wat: 'een wijziging op de machine of in de omgevingsvariabelen',
    waarom: 'daar is hier geen bron voor; die staat hooguit in de historie van de installatie' },
  { wat: 'een wijziging aan gegevens buiten een herstelronde',
    waarom: 'de gewone app-routes schrijven zonder journaal; alleen wat via Command ging staat erin' }
];

/* `Number(x || standaard)` is hier fout en dat kostte een toets: een gevraagde
   NUL is falsy, dus wie om een venster van nul minuten vroeg kreeg er stil
   dertig -- en dus veel meer regels dan hij vroeg. Een ontbrekende waarde krijgt
   de standaard; een opgegeven waarde wordt begrensd, ook als hij nul is. */
function grens(waarde, standaard, max) {
  const gevraagd = (waarde == null || waarde === '') ? standaard : Number(waarde);
  return Math.max(1, Math.min(Number.isFinite(gevraagd) ? gevraagd : standaard, max));
}

function maakTijdlijn({ db, journaal }) {
  const techniek = () => (db.data.techniek || {});

  function uitJournaal() {
    const rij = journaal.recent(2000) || [];
    return rij.map(r => ({
      at: r.at, bron: 'journaal', soort: r.actie, wie: r.actor,
      wat: r.actie + (r.objectType ? ' · ' + r.objectType + (r.objectId ? ' ' + r.objectId : '') : ''),
      reden: r.reden || null, niveau: r.niveau || null,
      verwijzing: r.objectType ? { type: r.objectType, id: r.objectId } : null
    }));
  }

  /* Een aanvraag die WACHT of GEWEIGERD is, heeft niets veranderd -- en staat er
     toch in. Wie zoekt naar "wat is er veranderd", wil ook zien wat er BIJNA is
     veranderd; de status staat erbij zodat de twee niet door elkaar lopen. */
  function uitSchakelaar() {
    const rij = Array.isArray(techniek().functieVerzoeken) ? techniek().functieVerzoeken : [];
    const uit = [];
    for (const v of rij) {
      uit.push({ at: v.at, bron: 'schakelaar', soort: 'schakelaar aangevraagd', wie: v.doorNaam || v.doorId,
        wat: v.label + ' (' + (v.wijzigingen || []).length + ' functie(s))',
        reden: null, status: v.status, veranderdeIets: false });
      if (v.besluitAt) {
        uit.push({ at: v.besluitAt, bron: 'schakelaar',
          soort: v.status === 'akkoord' ? 'schakelaar omgezet' : 'schakelaar geweigerd',
          wie: 'de eigenaar', wat: v.label, reden: null, status: v.status,
          veranderdeIets: v.status === 'akkoord' });
      }
    }
    return uit;
  }

  function uitNoodstand() {
    const s = (techniek().incidentcontrole || {});
    const rij = Array.isArray(s.audit) ? s.audit : [];
    return rij.map(a => ({ at: a.at || a.moment || null, bron: 'noodstand',
      soort: 'noodstand ' + (a.actie || a.modus || 'gewijzigd'), wie: a.door || a.actor || 'onbekend',
      wat: a.reden || a.label || 'incidentcontrole', reden: a.reden || null, veranderdeIets: true }))
      .filter(x => x.at);
  }

  function alles() {
    return uitJournaal().concat(uitSchakelaar(), uitNoodstand())
      .filter(r => r.at && !isNaN(Date.parse(r.at)))
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }

  function lijst(o) {
    const f = o || {};
    let rij = alles();
    if (f.bron) rij = rij.filter(r => r.bron === String(f.bron));
    if (f.vanaf) rij = rij.filter(r => Date.parse(r.at) >= Date.parse(f.vanaf));
    if (f.tot) rij = rij.filter(r => Date.parse(r.at) <= Date.parse(f.tot));
    const max = grens(f.max, 100, 500);
    return { regels: rij.slice(0, max), totaalInVenster: rij.length,
      bronnen: BRONNEN, buitenBeeld: BUITEN_BEELD,
      let: 'Deze lijn voegt drie bestaande bronnen samen en bewaart zelf niets. Wat er niet in staat, ' +
        'is niet hetzelfde als wat er niet is gebeurd -- zie "buiten beeld".' };
  }

  /* DE VRAAG WAAR DIT VOOR BESTAAT: wat is er vlak vóór dit moment veranderd?
     Met de afstand in seconden erbij, want die is het enige dat hier gemeten is
     -- en uitdrukkelijk zonder oordeel over oorzaak. */
  function rondom(moment, minuten) {
    const t = Date.parse(moment);
    if (isNaN(t)) return { error: 'Dat moment is geen geldige tijd.', status: 400 };
    const m = grens(minuten, 30, 24 * 60);
    const van = t - m * 60000;
    const rij = alles().filter(r => { const x = Date.parse(r.at); return x >= van && x <= t; })
      .map(r => Object.assign({ secondenVoor: Math.round((t - Date.parse(r.at)) / 1000) }, r));
    return {
      moment: new Date(t).toISOString(), venster: { minuten: m, vanaf: new Date(van).toISOString() },
      regels: rij, aantal: rij.length,
      veranderdeIets: rij.filter(r => r.veranderdeIets !== false).length,
      bronnen: BRONNEN, buitenBeeld: BUITEN_BEELD,
      /* Deze zin is de reden dat deze functie een eigen antwoord heeft en niet
         gewoon een gefilterde lijst is. */
      let: rij.length
        ? 'Dit is VOLGORDE en geen oorzaak. Dat iets kort hiervoor is veranderd, maakt het een kandidaat ' +
          'om na te kijken -- meer niet. Kijk ook bij "buiten beeld": drie soorten wijziging komen in geen ' +
          'van deze bronnen voor.'
        : 'In deze drie bronnen staat niets in dit venster. Dat is iets anders dan "er is niets veranderd": ' +
          'een uitrol, een wijziging op de machine of een schrijfactie buiten Command zou hier ook niet staan.'
    };
  }

  return { lijst, rondom, BRONNEN, BUITEN_BEELD };
}

module.exports = { maakTijdlijn, BRONNEN, BUITEN_BEELD };
