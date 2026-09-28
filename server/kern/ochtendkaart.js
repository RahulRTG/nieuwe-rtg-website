/* DE OCHTENDKAART (PERSONEEL.md par. 4) -- een LEZING op wat er al staat.

   Een medewerker komt binnen en ziet één kaart: zijn dienst, of het team
   compleet is, wat er vandaag binnenkomt, hoeveel gasten er komen, en één knop.
   Niets hiervan wordt hier bedacht: elke regel komt uit een bron die al bestond
   (het rooster, de verzuimlaag, de groothandelsorders, de reserveringen, de
   klok), en deze module bezit niets en schrijft niets.

   DRIE REGELS DIE NIET MOGEN SNEUVELEN.

   1. "Alles staat voor je klaar" staat er alleen als ELKE regel eronder
      GEMETEN is en geen enkele aandacht vraagt. Een rooster uit het
      standaardpatroon is een vermoeden en geen meting; een verzuimlaag die niet
      antwoordt is `onbekend` en geen "team compleet". Dan zegt de kop wat hij
      niet kon nakijken -- `niet vast te stellen` is een eersteklas uitslag.
   2. De kaart STELT NIETS VOOR (besluit B4: Fluister biedt alleen op vraag
      aan). Hij toont wat er staat; een voorstel komt pas als de medewerker
      erom vraagt.
   3. Er staat nooit een getal dat niemand telde. Een groothandelsorder draagt
      geen aflevertijd, dus de kaart zegt hoeveel bevestigde leveringen er
      onderweg zijn en NIET hoe laat de eerste komt. Het aantal gasten is
      geteld uit reserveringen, geen voorspelling. En wie afwezig is, is
      "afwezig" en niets meer: geen reden, geen naam op andermans kaart.

   Dezelfde vorm geldt later voor de kaart van de eigenaar (par. 5): een kop,
   regels met een graad, en hooguit één knop. Status geeft geen voorrang. */
'use strict';

const OPEN_LEVERING = ['bevestigd', 'onderweg'];
const TELT_GAST = ['aangevraagd', 'bevestigd', 'aangekomen'];

function maakOchtendkaart({ db, scheduleFor, klokVan, inplanbaar, vrij, vandaag }) {
  /* inplanbaar (kern/payroll/inplanbaar.js) als stand: onbekend, afwezig of inplanbaar */
  const standVan = (code, id, dag) => {
    const ip = inplanbaar ? inplanbaar(code, id, dag) : { onbekend: true };
    return ip.onbekend ? { stand: 'onbekend' } : ip.plan ? { stand: 'inplanbaar' } : { stand: 'afwezig', wat: ip.wat };
  };
  const dagVan = vandaag || (() => new Date().toISOString().slice(0, 10));

  function regelDienst(ik, rooster) {
    const graad = rooster.vast ? 'gemeten' : 'vermoed';
    const bron = rooster.vast ? 'vastgesteld rooster' : 'standaardpatroon (geen vastgesteld rooster)';
    if (rooster.mijnVerzuim.stand === 'afwezig')
      return { soort: 'dienst', graad: 'gemeten', bron: 'verzuimlaag',
        tekst: 'Je staat vandaag als ' + rooster.mijnVerzuim.wat + ' in de verzuimlaag. Er wordt vandaag niets van je gevraagd.' };
    if (!ik) return { soort: 'dienst', graad: 'onbekend', bron: 'rooster', tekst: 'Je staat niet in het rooster van vandaag.' };
    if (ik.shift === vrij) return { soort: 'dienst', graad, bron, tekst: 'Je bent vandaag vrij.' };
    return { soort: 'dienst', graad, bron, tekst: ik.shift };
  }

  /* Het team: wie vandaag werkt, tegen de verzuimlaag gelegd. Alleen een
     AANTAL, want de naam van een afwezige collega hoort niet op jouw kaart.
     Het rooster (kern/personeel.js) zet wie afwezig is al op vrij met
     `afwezig: true`; die telt mee, anders zou een zieke collega verdwijnen
     in plaats van ontbreken. */
  function regelTeam(code, staffId, dag, rooster) {
    const werkt = rooster.staff.filter(m => (m.shift !== vrij || m.afwezig) && m.id !== staffId);
    let onbekend = 0, afwezig = 0;
    for (const m of werkt) {
      const v = standVan(code, m.id, dag);
      if (v.stand === 'onbekend') onbekend++;
      else if (m.afwezig || v.stand === 'afwezig') afwezig++;
    }
    if (!werkt.length) return { soort: 'team', graad: rooster.vast ? 'gemeten' : 'vermoed', bron: 'rooster', tekst: 'Er werkt vandaag verder niemand.' };
    if (onbekend) return { soort: 'team', graad: 'onbekend', bron: 'verzuimlaag',
      tekst: 'Ik kon niet nakijken of het team compleet is.' };
    if (afwezig) return { soort: 'team', graad: 'gemeten', bron: 'rooster en verzuimlaag', aandacht: true,
      tekst: afwezig === 1 ? 'Eén collega is vandaag afwezig.' : afwezig + ' collega\'s zijn vandaag afwezig.' };
    return { soort: 'team', graad: rooster.vast ? 'gemeten' : 'vermoed', bron: 'rooster en verzuimlaag', tekst: 'Team compleet.' };
  }

  /* Alleen voor een zaak die bij een groothandel bestelt; anders geen regel,
     want "geen levering" is voor een kapper geen nieuws. */
  function regelLevering(code) {
    const orders = (db.data.groothandelOrders || []).filter(o => o.klant && o.klant.id === code && o.klant.soort !== 'lid');
    if (!orders.length) return null;
    const open = orders.filter(o => OPEN_LEVERING.includes(o.status)).length;
    return { soort: 'levering', graad: 'gemeten', bron: 'groothandelsorders',
      tekst: open ? (open === 1 ? 'Eén bevestigde levering onderweg' : open + ' bevestigde leveringen onderweg') + ' (geen aflevertijd bekend).'
        : 'Geen bevestigde levering onderweg.' };
  }

  function regelGasten(code, dag) {
    const alle = (db.data.reserveringen || []).filter(r => r.supplierCode === code);
    if (!alle.length) return null;
    const vandaagR = alle.filter(r => r.datum === dag && TELT_GAST.includes(r.status));
    const personen = vandaagR.reduce((n, r) => n + (Number(r.personen) || 0), 0);
    return { soort: 'gasten', graad: 'gemeten', bron: 'reserveringen (geteld, geen voorspelling)',
      tekst: vandaagR.length ? personen + ' gasten gereserveerd vandaag (' + vandaagR.length + (vandaagR.length === 1 ? ' reservering' : ' reserveringen') + ').'
        : 'Nog geen reserveringen voor vandaag.' };
  }

  const NAKIJKWOORD = { dienst: 'je dienst', team: 'of het team compleet is', levering: 'de leveringen', gasten: 'de reserveringen' };
  /* De kop noemt de OORZAAK en niet elke regel die eraan lijdt: een rooster dat
     niet is vastgesteld maakt zowel de dienst als het team een vermoeden, en
     dat is één ding en geen twee. Wat niet na te kijken was, gaat voor. */
  function kop(regels, vast) {
    const onbekend = regels.filter(r => r.graad === 'onbekend');
    if (onbekend.length) return 'Ik kon niet nakijken: ' + onbekend.map(r => NAKIJKWOORD[r.soort] || r.soort).join(' en ') + '.';
    if (!vast && regels.some(r => r.graad === 'vermoed'))
      return 'Het rooster van vandaag is nog niet vastgesteld: dit is het standaardpatroon.';
    const aandacht = regels.filter(r => r.aandacht);
    if (aandacht.length === 1) return 'Eén ding vraagt je aandacht.';
    if (aandacht.length > 1) return aandacht.length + ' dingen vragen je aandacht.';
    return 'Alles staat voor je klaar.';
  }

  function kaart(code, staffId) {
    const dag = dagVan();
    const week = scheduleFor(code);
    const d0 = (week.days || []).find(d => d.date === dag) || { date: dag, staff: [] };
    const sup = (db.data.suppliers || []).find(s => s.code === code);
    const rooster = {
      staff: d0.staff || [],
      vast: !!(sup && sup.roosterVast && sup.roosterVast[dag]),
      mijnVerzuim: standVan(code, staffId, dag)
    };
    const ik = rooster.staff.find(m => m.id === staffId) || null;
    const regels = [regelDienst(ik, rooster), regelTeam(code, staffId, dag, rooster), regelLevering(code), regelGasten(code, dag)].filter(Boolean);
    const klok = klokVan(code, staffId);
    const vrijVandaag = rooster.mijnVerzuim.stand === 'afwezig' || !!(ik && ik.shift === vrij);
    return {
      datum: dag,
      naam: ik ? ik.name : null,
      kop: kop(regels, rooster.vast),
      regels,
      /* één knop, en alleen als er iets te doen is: wie al binnen is ziet dat,
         en wie vrij of afwezig is wordt niet gevraagd te beginnen */
      knop: klok.open ? { tekst: 'Je bent ingeklokt', pad: null }
        : vrijVandaag ? null : { tekst: 'Begin mijn dag', pad: '/api/staff/clock' },
      stelt: 'niets voor (B4: alleen op vraag)'
    };
  }

  return { kaart };
}

module.exports = { maakOchtendkaart };
