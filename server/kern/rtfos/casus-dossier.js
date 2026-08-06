/* Foundation OS, deel "casus-dossier": de stappen in een hulpvraag en het
   openen van de contactgegevens.

   HET OPENEN VAN CONTACTGEGEVENS IS EEN HANDELING, GEEN BIJVANGST. In de lijst
   staat een codenaam; wie de naam en het telefoonnummer nodig heeft, vraagt er
   apart om en dat wordt apart genoteerd. Dat is precies het verschil tussen
   "ik werk aan deze hulpvraag" en "ik heb gekeken wie dit is" -- en zonder dat
   spoor is dat verschil onzichtbaar, ook achteraf, ook voor de toezichthouder,
   ook voor de persoon zelf.

   ZONDER SLEUTEL GEEN GOK. Staat de data versleuteld (RTG_ENC_KEY) en ontbreekt
   de sleutel op deze server, dan komt er een duidelijke fout in plaats van een
   leeg veld. Een leeg veld leest als "er is geen contact bekend", en dat is een
   andere en gevaarlijkere mededeling dan "ik kan er niet bij" (LAT.md regel 3).

   'HULPACTIE' IS EEN EIGEN WOORD. Afronden kan alleen als er ten minste een
   stap van dat soort in het dossier staat: een hulpvraag die "afgerond" heet
   terwijl niemand opschreef wat er is gedaan, is administratief gesloten en
   feitelijk open blijven staan. */

const STAPSOORTEN = ['contact', 'hulpactie', 'doorverwijzing', 'nazorg', 'notitie'];

module.exports = (ctx, eigen) => {
  const { nu, rid, schoon, audit, wie, poort, save, kluis } = ctx;
  const { vind, beeld } = eigen;

  function open(req, id) {
    const c = vind(id);
    if (!c) return { status: 404, error: 'Deze hulpvraag bestaat niet.' };
    const w = wie(req);
    const g = poort(w, c.stad, 'casus.beheren', 'individual_cases');
    if (!g.ok) return g;
    return { ok: true, c, w };
  }

  function contactOpen(req, id) {
    const o = open(req, id);
    if (!o.ok) return o;
    if (!o.c.contact) return { ok: true, contact: null };
    let contact;
    try { contact = kluis.ontsleutel(o.c.contact); }
    catch (e) {
      return { status: 500, error: 'Deze gegevens staan versleuteld en de sleutel ontbreekt op deze server. Er is dus wel een contact bekend; ik kan er alleen niet bij.' };
    }
    audit(o.w.key, 'casus.contact-open', o.c.codenaam, 'contactgegevens ingezien');
    return { ok: true, contact };
  }

  function stap(req, id, b) {
    b = b || {};
    const o = open(req, id);
    if (!o.ok) return o;
    const tekst = schoon(b.tekst, 300);
    if (!tekst) return { status: 400, error: 'Wat is er gedaan?' };
    const soort = STAPSOORTEN.includes(String(b.soort)) ? String(b.soort) : 'notitie';
    if (!Array.isArray(o.c.stappen)) o.c.stappen = [];
    if (o.c.stappen.length >= 200) return { status: 400, error: 'Dit dossier zit vol.' };
    o.c.stappen.unshift({ id: rid(), soort, tekst, door: o.w.key, at: nu() });
    audit(o.w.key, 'casus.stap', o.c.codenaam, soort);
    save();
    return { ok: true, casus: beeld(o.c) };
  }

  return { contactOpen, stap, STAPSOORTEN };
};
module.exports.STAPSOORTEN = STAPSOORTEN;
