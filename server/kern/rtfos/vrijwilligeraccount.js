/* Foundation OS, deel "vrijwilligeraccount": een vrijwilliger koppelt zijn
   dossier ZELF aan zijn eigen RTG-account.

   WAAROM DIT BESTAAT. Een vrijwilliger had geen account: hij opent zijn portaal
   op een code (RTFV-...). Daardoor kon niets buiten dit OS vaststellen dat
   `user-12` vrijwilliger is in Utrecht, en precies die vraag stelt het leerhuis
   van een RTF-stad (ACADEMY.md besluit B2, stap B2b): een relatie komt uit haar
   bron en niet uit een verklaring.

   DE VRIJWILLIGER BEVESTIGT, EN NIEMAND ANDERS. Koppelen vraagt twee dingen
   tegelijk: een ingelogd eigen account EN zijn geldige code. Er wordt nergens op
   naam gezocht of gegokt: "Jan de Vries" in het register en "Jan de Vries" in
   de kluis zijn geen bewijs dat het dezelfde mens is. Een coördinator kan een
   koppeling LOSMAKEN (met een reden), maar nooit leggen: dan besluit de
   organisatie wie iemand is.

   WAT EEN MEELEZER MET EEN CODE HIERMEE KAN. Een code kan over een schouder
   worden meegelezen. Twee remmen: een dossier dat al aan een account hangt,
   kan niet naar een ander account (409, eerst los via de coördinator), en het
   portaal van de vrijwilliger toont dat er een koppeling IS. En een koppeling
   verleent zelf niets: in het leerhuis moet de organisatie de persoon nog
   steeds zelf als relatie opnemen; de bron bevestigt alleen.

   De leesvraag `inStad` telt ook de ZETELS: wie in een stad een bestuursrol
   heeft, hangt daar al met zijn account (zetels.js). */
'use strict';

const SLEUTEL = /^user-\d+$/;

module.exports = (ctx, eigen) => {
  const { nu, S, audit, save, schoon } = ctx;
  const { metCode, deurIn, SCOPE } = eigen;

  function koppel(code, key) {
    if (!SLEUTEL.test(String(key || ''))) return { status: 403, error: 'Koppelen kan alleen met een eigen RTG-account.' };
    return metCode(code, SCOPE.wijzigen, (staat, v) => {
      if (v.status === 'gestopt') return { status: 403, error: 'Dit dossier is afgesloten.' };
      if (v.account === key) return { ok: true, gekoppeld: true, al: true };
      if (v.account) {
        return { status: 409, error: 'Dit dossier hangt al aan een ander account. Vraag uw coördinator de koppeling los te maken; daarna kunt u opnieuw koppelen.' };
      }
      v.account = key;
      v.accountSinds = nu();
      audit('vrijwilliger:' + v.id, 'vrijwilliger.account-gekoppeld', v.naam, 'door de vrijwilliger zelf, met zijn code', staat);
      return { ok: true, gekoppeld: true };
    });
  }

  /* Los van de eigen kant: zonder code, want wie zijn code kwijt is moet zijn
     account er toch af kunnen halen. */
  function ontkoppel(key) {
    if (!SLEUTEL.test(String(key || ''))) return { status: 403, error: 'Dit kan alleen met een eigen RTG-account.' };
    const rijen = S().vrijwilligers.filter(v => v.account === key);
    for (const v of rijen) {
      delete v.account;
      delete v.accountSinds;
      audit('vrijwilliger:' + v.id, 'vrijwilliger.account-los', v.naam, 'door de vrijwilliger zelf');
    }
    save();
    return { ok: true, losgemaakt: rijen.length };
  }

  /* De coördinator maakt los, en alleen los. Een reden is verplicht: een
     vrijwilliger die daarna niet meer in het leerhuis van zijn stad komt, hoort
     te kunnen horen waarom. */
  function kantoorLos(req, id, reden) {
    const d = deurIn(req, id, S());
    if (d.fout) return d.fout;
    const r = schoon(reden, 200);
    if (!r) return { status: 400, error: 'Een reden is verplicht: de vrijwilliger hoort te kunnen horen waarom.' };
    const was = !!d.v.account;
    delete d.v.account;
    delete d.v.accountSinds;
    audit(d.w.key, 'vrijwilliger.account-los', d.v.naam, r);
    return { ok: true, losgemaakt: was };
  }

  /* Hoort dit account bij deze stad? Een zetel, of een ACTIEVE vrijwilliger die
     zichzelf heeft gekoppeld. Alleen een ja of nee: wie het is, welke rol en
     sinds wanneer blijft in dit OS. */
  function inStad(key, stadId) {
    if (!SLEUTEL.test(String(key || '')) || !stadId) return false;
    const s = S();
    const stad = String(stadId);
    if (s.zetels.some(z => z.key === key && z.stad === stad)) return true;
    return s.vrijwilligers.some(v => v.account === key && v.stad === stad && v.status === 'actief');
  }

  return { koppel, ontkoppel, kantoorLos, inStad };
};
