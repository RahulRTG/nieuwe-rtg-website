/* Payroll OS: CONTRACTEN, als versies met een ingangsdatum.

   DE REGEL: EEN CONTRACTWIJZIGING OVERSCHRIJFT NOOIT. Iemand krijgt per 1 juli
   opslag. Wie dan het uurloon in het bestaande record aanpast, heeft daarmee
   ook juni veranderd -- en een loonrun over juni die daarna wordt overgedaan
   (bij een correctie, een controle, een geschil) rekent met het nieuwe loon.
   Het verschil is stil en het valt nooit meer terug te vinden.

   Een contract is hier dus een RIJ VERSIES. Elke versie heeft een `vanaf`, en
   de motor vraagt om de versie die gold op de dag van de periode. Wijzigen is
   een versie toevoegen; er verdwijnt niets.

   TERUGWERKENDE WIJZIGINGEN MOGEN, MAAR NOOIT STIL. Een opslag met terugwerkende
   kracht is een normale zaak. Maar hij raakt perioden die al betaald zijn, dus
   hij hoort een waarschuwing te geven en zichtbaar te zijn in de controlelaag
   (zie ./run.js). Daarom staat op elke versie WANNEER hij is vastgelegd naast
   VANAF wanneer hij geldt: als `vastgelegdOp` later is dan `vanaf`, is het
   terugwerkend.

   MEERDERE CONTRACTEN PER PERSOON. Iemand kan bij dezelfde werkgever twee
   functies hebben (kok en bezorger, elk een eigen uurloon) en bij twee
   werkgevers werken. De sleutel is daarom (zaak, medewerker, contractnummer) en
   niet de persoon. */
'use strict';

const SOORTEN = ['vast', 'tijdelijk', 'oproep', 'nuluren', 'minmax', 'stage', 'uitzend', 'freelance'];
const BETALING = ['maand', 'vierweken'];
const isDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

function keur(v) {
  const bez = [];
  if (!v || typeof v !== 'object') return ['Geen contractversie ontvangen.'];
  if (!isDatum(v.vanaf)) bez.push('vanaf ontbreekt of is geen datum (JJJJ-MM-DD).');
  if (v.tot && !isDatum(v.tot)) bez.push('tot is geen datum (JJJJ-MM-DD).');
  if (v.tot && v.vanaf && v.tot < v.vanaf) bez.push('tot ligt voor vanaf.');
  if (!SOORTEN.includes(v.soort)) bez.push('soort moet een van ' + SOORTEN.join(', ') + ' zijn.');
  if (!BETALING.includes(v.betaling || 'maand')) bez.push('betaling moet maand of vierweken zijn.');
  const u = v.uurloonCenten;
  if (typeof u !== 'number' || !Number.isFinite(u) || u <= 0) bez.push('uurloonCenten ontbreekt of is geen positief getal.');
  else if (u > 100000) bez.push('uurloonCenten (' + u + ') is niet aannemelijk; centen, geen euro\'s?');
  if (v.urenPerWeek != null && (typeof v.urenPerWeek !== 'number' || v.urenPerWeek < 0 || v.urenPerWeek > 80))
    bez.push('urenPerWeek is geen aannemelijk getal.');
  /* Een tijdelijk contract zonder einddatum is geen tijdelijk contract. Dit is
     geen muggenzifterij: het bepaalt of iemand na de einddatum nog uren mag
     schrijven, en dat is een van de controles in de loonrun. */
  if (v.soort === 'tijdelijk' && !v.tot) bez.push('een tijdelijk contract heeft een einddatum.');
  return bez;
}

function maakContracten({ db, save, nu }) {
  const tijd = nu || (() => new Date().toISOString());
  const sleutel = (code, staffId, nr) => String(code).toUpperCase() + ':' + staffId + ':' + (nr || 1);

  function bak() {
    if (!db.data.payrollContracten || typeof db.data.payrollContracten !== 'object') db.data.payrollContracten = {};
    return db.data.payrollContracten;
  }
  const versiesVan = (code, staffId, nr) => {
    const b = bak(); const k = sleutel(code, staffId, nr);
    if (!Array.isArray(b[k])) b[k] = [];
    return b[k];
  };

  /* Een versie vastleggen. Levert terug of hij terugwerkend is, zodat de
     aanroeper dat kan melden in plaats van het te laten gebeuren. */
  function leg(code, staffId, versie, door, nr) {
    const bez = keur(versie);
    if (bez.length) return { status: 422, error: 'Deze contractversie is afgekeurd.', bezwaren: bez };
    if (!door) return { status: 400, error: 'Noteer wie deze contractwijziging vastlegt.' };
    const rij = versiesVan(code, staffId, nr);
    const vastgelegdOp = tijd();
    const terugwerkend = vastgelegdOp.slice(0, 10) > versie.vanaf;
    const v = Object.assign({}, versie, { betaling: versie.betaling || 'maand',
      door, vastgelegdOp, terugwerkend });
    rij.push(v);
    rij.sort((a, b) => (a.vanaf < b.vanaf ? -1 : a.vanaf > b.vanaf ? 1 : 0));
    save();
    return { ok: true, versie: v, terugwerkend,
      let: terugwerkend ? 'Deze wijziging gaat in op ' + versie.vanaf + ' en wordt nu pas vastgelegd. Perioden die al zijn gedraaid veranderen NIET vanzelf; daarvoor is een correctierun nodig.' : null };
  }

  /* De versie die gold op een dag. Dit is de enige manier waarop de loonmotor
     aan een contract mag komen. */
  function opDatum(code, staffId, datum, nr) {
    const d = String(datum || '').slice(0, 10);
    if (!isDatum(d)) return null;
    const geldig = versiesVan(code, staffId, nr).filter(v => v.vanaf <= d && (!v.tot || v.tot >= d));
    return geldig.length ? geldig[geldig.length - 1] : null;
  }

  /* Alle contracten van een medewerker bij een zaak (meerdere functies). */
  function nummersVan(code, staffId) {
    const voor = String(code).toUpperCase() + ':' + staffId + ':';
    return Object.keys(bak()).filter(k => k.startsWith(voor))
      .map(k => Number(k.slice(voor.length))).sort((a, b) => a - b);
  }

  const geschiedenis = (code, staffId, nr) => versiesVan(code, staffId, nr).slice();

  return { leg, opDatum, nummersVan, geschiedenis, keur, SOORTEN, BETALING };
}

module.exports = { maakContracten, keur, SOORTEN, BETALING };
