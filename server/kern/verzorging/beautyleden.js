/* De LEDENKANT van de beauty-salon en barbier: knippen, scheren, nagels.
   Nadrukkelijk niet-medisch, en dat is hier geen bijzin maar het ontwerp:
   deze laag draagt GEEN zorgprofiel en GEEN intake mee. Wie medische context
   moet delen, doet dat in Care (kern/care/) bij een kliniek, uitdrukkelijk en
   per aanbieder. Een kapper hoort geen medisch dossier te zien.

   De salon zelf woont in ./beauty.js en blijft de enige waarheid over het
   aanbod en de agenda: deze module leest die bak en laat het boeken door
   beautyBoek doen, zodat de botsingscontrole er maar een keer staat.

   Privacy: een lid boekt op CODENAAM. De salon ziet dus dezelfde naam als
   elke andere partner, en niet meer dan dat. */

const { TIJD, DATUM } = require('../genrehulp');

/* De salon kent (nog) geen openingstijden in zijn eigen data. Tot die er zijn
   staat het rooster hier, met dezelfde stap voor elke salon. Dat is een
   BEKEND gat en geen aanname die zich verstopt: zodra een salon zijn uren zelf
   zet, hoort dit weg en komt het uit de bak. */
const DAG_VAN = 9 * 60, DAG_TOT = 18 * 60, STAP = 30;

const alsTijd = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const alsMin = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

module.exports = ({ db, save, beauty }) => {
  const salonVan = beauty.salonVan;
  const vandaag = () => new Date().toISOString().slice(0, 10);

  /* welke partners zijn een salon? De cap is de waarheid, niet een lijstje
     codes hier: wie het genre krijgt, staat er vanzelf bij. */
  const salons = () => (db.data.suppliers || []).filter(s => s && (db.capsVan(s) || []).includes('beauty'));
  const salonMet = code => salons().find(s => s.code === String(code || ''));

  /* vrije tijden voor een behandeling op een dag. Een stoel van het juiste
     soort moet de hele duur vrij zijn; welke stoel dat wordt kiest de salon
     bij het boeken. */
  function vrijeTijden(s, beh, datum) {
    const stoelen = s.stoelen.filter(x => x.soort === beh.soort);
    const bezet = s.afspraken.filter(a => a.datum === datum && a.status !== 'weg');
    const uit = [];
    for (let m = DAG_VAN; m + beh.duurMin <= DAG_TOT; m += STAP) {
      const van = alsTijd(m), tot = alsTijd(m + beh.duurMin);
      const vrij = stoelen.find(st => !bezet.some(a => a.stoelId === st.id && van < a.tot && tot > a.van));
      if (vrij) uit.push({ tijd: van, stoelId: vrij.id });
    }
    return uit;
  }

  /* het aanbod voor het lid. Elke behandeling draagt soort 'cosmetisch' naar
     buiten, zodat het scherm zorg en verzorging uit elkaar kan houden zonder
     de naam van de behandeling te moeten lezen. */
  function verzorgingOverzicht(codenaam, datumIn) {
    const datum = DATUM.test(String(datumIn || '')) ? String(datumIn) : vandaag();
    const aanbieders = salons().map(p => {
      const s = salonVan(p.code);
      return {
        code: p.code, naam: s.naam || p.name, waar: (p.loc && p.loc.label) || p.city || null,
        soort: 'verzorging', medisch: false, icon: 'beauty',
        behandelingen: s.behandelingen.map(b => ({
          id: b.id, naam: b.naam, vak: b.soort, soort: 'cosmetisch',
          duurMin: b.duurMin, prijs: b.prijs,
          tijden: vrijeTijden(s, b, datum).map(x => x.tijd)
        }))
      };
    });
    return { ok: true, datum, aanbieders, mijn: verzorgingMijn(codenaam).afspraken };
  }

  /* boeken. De salon doet zelf de laatste botsingscontrole (beautyBoek), dus
     twee leden die tegelijk hetzelfde slot pakken botsen daar en niet hier. */
  function verzorgingBoek(sess, codenaam, body) {
    if (sess.tier === 'guest') return { status: 403, error: 'Boeken kan alleen met een lidmaatschap.' };
    const p = salonMet(body.code);
    if (!p) return { status: 404, error: 'Deze salon bestaat niet.' };
    const s = salonVan(p.code);
    const beh = s.behandelingen.find(x => x.id === String(body.behandelingId || ''));
    if (!beh) return { status: 404, error: 'Deze behandeling bestaat niet.' };
    const datum = String(body.datum || ''), tijd = String(body.tijd || '');
    if (!DATUM.test(datum) || datum < vandaag()) return { status: 400, error: 'Kies een dag vanaf vandaag.' };
    if (!TIJD.test(tijd)) return { status: 400, error: 'Kies een tijd.' };
    const slot = vrijeTijden(s, beh, datum).find(x => x.tijd === tijd);
    if (!slot) return { status: 409, error: 'Dat moment is niet (meer) vrij. Kies een ander tijdstip.' };
    const r = beauty.boek(p.code, { behandelingId: beh.id, stoelId: slot.stoelId, naam: codenaam, datum, tijd });
    if (!r.ok) return r;
    return { ok: true, afspraak: { ...r.afspraak, code: p.code, salon: s.naam || p.name },
      betalen: 'U rekent af bij de salon.' };
  }

  /* mijn afspraken, over alle salons heen. Op codenaam: een lid ziet alleen
     wat op zijn eigen codenaam staat. */
  function verzorgingMijn(codenaam) {
    const d = vandaag();
    const uit = [];
    for (const p of salons()) {
      const s = salonVan(p.code);
      for (const a of s.afspraken) {
        if (a.naam !== codenaam || a.status === 'weg' || a.datum < d) continue;
        uit.push({ id: a.id, code: p.code, salon: s.naam || p.name, behandeling: a.behandeling,
          stoel: a.stoel, datum: a.datum, van: a.van, tot: a.tot, prijs: a.prijs, status: a.status });
      }
    }
    uit.sort((x, y) => (x.datum + x.van).localeCompare(y.datum + y.van));
    return { ok: true, afspraken: uit };
  }

  /* annuleren. De eigendomscontrole staat VOOR de statuswijziging: een id van
     iemand anders is een 404, niet een geslaagde annulering. */
  function verzorgingAnnuleer(codenaam, code, idIn) {
    const p = salonMet(code);
    if (!p) return { status: 404, error: 'Deze salon bestaat niet.' };
    const s = salonVan(p.code);
    const a = s.afspraken.find(x => x.id === String(idIn || '') && x.naam === codenaam && x.status !== 'weg');
    if (!a) return { status: 404, error: 'Deze afspraak staat niet op uw naam.' };
    a.status = 'weg';
    save();
    return { ok: true, geannuleerd: a.behandeling };
  }

  return { verzorgingLeden: { overzicht: verzorgingOverzicht, boek: verzorgingBoek,
    mijn: verzorgingMijn, annuleer: verzorgingAnnuleer } };
};
