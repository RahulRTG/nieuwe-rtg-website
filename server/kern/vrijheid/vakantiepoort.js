/* VRIJHEID: DE PRODUCTIEPOORT VAN DE VAKANTIEREGEL -- standaard DICHT, en
   alleen een mens opent hem, na de juridische toets.

   Besluit van de eigenaar (11 oktober 2026, B1): tot de juridische toets van de
   rekenregel (./vakantieregel.js) is afgerond, blijft de productiepoort
   gesloten. Dicht betekent hier precies een ding: de regel REKENT wel, en zijn
   uitkomst staat er met de graad `vermoed` en de reden, maar hij wordt geen
   RECHT -- `wettelijk` blijft `null`, en een verlofbesluit dat op dat recht
   leunt blijft UNKNOWN met de reden (./besluit.js, RIGHTS_POLICY).

   DE VORM IS DIE VAN DE BESTAANDE BOARDROOMSCHAKELAARS (de terugstortstand,
   de cadeaubon, het afdwingen van de beleidsmotor): achter de boardroom, op
   naam, door de eigenaar, met een verse passkey (kern/zwaarbewijs.js, actie
   `eigenaar-vakantieregel`). Er bestond geen schakelaar voor deze regel; dit
   is er een in die vorm en geen nieuwe bevoegdheidsvorm.

   DRIE GRENDELS, en een open poort zonder alle drie leest als DICHT:
     1. de stand is `open` -- een ontbrekende stand is nooit open;
     2. er is een TOETS vastgelegd: wie toetste (de jurist of het bureau), op
        welke datum, en een kenmerk van het toetsdossier. RTG beoordeelt dat
        dossier niet inhoudelijk; het legt vast WAAROP de eigenaar opende;
     3. de toets geldt voor DEZE regelversie. Verandert de regel (een artikel,
        de opbouwtabel, de factor), dan gaat de poort vanzelf dicht: een toets
        op versie A is geen toets op versie B.

   Dichtzetten mag altijd en vraagt geen toets: de veilige kant op is goedkoop. */
'use strict';
const { REGELVERSIE } = require('./vakantieregel');

const STANDEN = Object.freeze(['gesloten', 'open']);
const DICHT = 'De juridische toets van de rekenregel is niet afgerond; de productiepoort is gesloten (besluit eigenaar, 11 oktober 2026).';
const isDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);

module.exports = ({ eigen, save, nu, versie }) => {
  const tijd = nu || (() => new Date().toISOString());
  const regelVersie = versie || REGELVERSIE;
  const kijk = () => eigen.kijk('vrijheidVakantiepoort') || {};

  function stand() {
    const s = kijk();
    const opgeslagen = STANDEN.includes(s.stand) ? s.stand : 'gesloten';
    const toetsKlopt = !!(s.toets && s.toets.door && isDatum(s.toets.datum) && s.toets.kenmerk);
    const versieKlopt = s.regelVersie === regelVersie;
    const open = opgeslagen === 'open' && toetsKlopt && versieKlopt;
    let reden = null;
    if (!open) reden = opgeslagen === 'open' && !versieKlopt
      ? 'De rekenregel is veranderd sinds de toets (getoetst: ' + s.regelVersie + ', nu: ' + regelVersie + '); de poort is weer gesloten tot de nieuwe versie is getoetst.'
      : DICHT;
    return { open, stand: open ? 'open' : 'gesloten', reden, regelVersie,
      toets: s.toets || null, door: s.door || null, op: s.op || null };
  }

  /* Alleen de route roept dit aan, na boardroom, eigenaar en passkey. `door` is
     de naam uit de sessie; de gedeelde kantoorcode is geen naam. */
  function zet({ stand: nieuw, door, toets }) {
    const s = String(nieuw || '');
    if (!STANDEN.includes(s)) return { status: 400, error: 'De stand is ' + STANDEN.join(' of ') + '.' };
    const wie = schoon(door, 80);
    if (!wie) return { status: 403, error: 'Deze poort gaat op naam om. De gedeelde kantoorcode is geen naam.' };
    let t = null;
    if (s === 'open') {
      const b = toets || {};
      t = { door: schoon(b.door, 120), datum: String(b.datum || ''), kenmerk: schoon(b.kenmerk, 120) };
      const mist = [];
      if (!t.door) mist.push('wie toetste (de jurist of het bureau)');
      if (!isDatum(t.datum)) mist.push('de datum van de toets (JJJJ-MM-DD)');
      if (!t.kenmerk) mist.push('het kenmerk van het toetsdossier');
      if (mist.length) return { status: 422, error: 'Openen kan alleen na een afgeronde juridische toets. Ontbreekt: ' + mist.join(', ') + '.', regelVersie };
      if (t.datum > tijd().slice(0, 10)) return { status: 422, error: 'Een toets die nog moet plaatsvinden, is niet afgerond.' };
    }
    const b = eigen.bak('vrijheidVakantiepoort');
    b.stand = s; b.door = wie; b.op = tijd(); b.toets = t; b.regelVersie = s === 'open' ? regelVersie : null;
    save();
    return { ok: true, ...stand(),
      let: s === 'open'
        ? 'De rekenregel is vrijgegeven op grond van de toets ' + t.kenmerk + '. Vanaf nu kan een verlofbesluit op het berekende recht steunen.'
        : 'De poort is dicht. De regel rekent nog, maar een verlofbesluit steunt er niet op.' };
  }

  return { stand, zet, STANDEN, DICHT };
};
module.exports.DICHT = DICHT;
module.exports.STANDEN = STANDEN;
