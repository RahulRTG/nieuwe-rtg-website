/* Foundation OS, deel "integriteit": incidenten, klachten, meldingen,
   belangenverstrengeling en het geschenkenregister.

   BIJ EEN STICHTING IS VERTROUWEN HET PRODUCT. Daarom staan de onaangename
   dingen hier als eersteklas objecten en niet als een opmerkingenveld ergens
   onderaan een projectpagina. Wat je geen plek geeft, wordt niet gemeld.

   DRIE REGELS DIE HET VERSCHIL MAKEN:

   1. KRITIEK GAAT ALTIJD OMHOOG. Een melding met zwaarte "kritiek" of "hoog"
      staat vanaf het moment van melden op het landelijke bord, ongeacht wat de
      stad ermee doet. Niet als kopie die iemand moet doorsturen, maar doordat
      het landelijke overzicht ze uit de bron leest.

   2. NIEMAND WIST EEN MELDING. Er is hier geen verwijderfunctie -- niet voor de
      stad, niet voor het landelijke bestuur, en niet voor de eigenaar. Sluiten
      kan, met een uitkomst erbij. Een register waaruit de machtigste partij een
      regel kan halen, is geen register maar een verzameling.

   3. DE MELDER MAG ANONIEM BLIJVEN, EN DAN OOK ECHT. Een anonieme melding
      bewaart geen sleutel van de melder. Niet versleuteld, niet "alleen voor de
      vertrouwenspersoon": niet. Anders is anoniem een belofte die de eerste
      keer sneuvelt dat iemand er hard genoeg naar vraagt.

   DE KLOKKENLUIDER GAAT LANGS DE STAD HEEN. Een melding over het stadsbestuur
   die eerst bij het stadsbestuur langsmoet, wordt niet gedaan. Meldingen van
   het soort 'klokkenluider' en 'belangenverstrengeling' zijn daarom alleen
   landelijk leesbaar, ook als ze over een stad gaan. */

const SOORTEN = ['incident', 'klacht', 'klokkenluider', 'belangenverstrengeling', 'geschenk', 'datalek'];
const ZWAARTE = ['laag', 'middel', 'hoog', 'kritiek'];
const STATUS = ['open', 'in_onderzoek', 'afgehandeld', 'overgedragen'];
// Wat niet langs de stad gaat: zie de kop.
const ALLEEN_LANDELIJK = ['klokkenluider', 'belangenverstrengeling'];

module.exports = (ctx) => {
  const { nu, rid, schoon, S, audit, wie, poort, stadVan, save } = ctx;

  const vind = id => S().incidenten.find(i => i.id === String(id || '')) || null;
  const beeld = i => ({ id: i.id, stad: i.stad, stadNaam: (stadVan(i.stad) || {}).naam || 'landelijk',
    soort: i.soort, zwaarte: i.zwaarte, tekst: i.tekst, status: i.status,
    melder: i.anoniem ? 'anoniem' : i.melder, anoniem: !!i.anoniem,
    escalatie: !!i.escalatie, projectId: i.projectId || null,
    stappen: (i.stappen || []).slice(0, 30), uitkomst: i.uitkomst || null, at: i.at });

  /* Melden kan iedereen met een zetel, in elke stad waar hij zit -- 'incident.
     melden' zit in alle drie de rollen. Een melding die alleen het bestuur mag
     doen, is een melding die nooit over het bestuur gaat. */
  function meld(req, b) {
    b = b || {};
    const w = wie(req);
    if (!w.key) return { status: 401, error: 'Log in om een melding te doen.' };
    const soort = String(b.soort || '');
    if (!SOORTEN.includes(soort)) return { status: 400, error: 'Kies een soort (' + SOORTEN.join(', ') + ').' };
    const zwaarte = String(b.zwaarte || 'middel');
    if (!ZWAARTE.includes(zwaarte)) return { status: 400, error: 'Zwaarte is laag, middel, hoog of kritiek.' };
    const tekst = schoon(b.tekst, 1000);
    if (tekst.length < 10) return { status: 400, error: 'Beschrijf wat er is gebeurd.' };
    let stad = null;
    if (b.stad) {
      const g = poort(w, b.stad, 'incident.melden');
      if (!g.ok) return g;
      stad = g.stad.id;
    } else if (!w.landelijk && w.zetels.length) {
      stad = w.zetels[0].stad;
    }
    if (S().incidenten.length >= 100000) return { status: 400, error: 'Het meldingenregister zit vol.' };
    const anoniem = b.anoniem === true;
    const i = { id: rid(), stad, soort, zwaarte, tekst, status: 'open',
      // Bij anoniem bewaren we de sleutel niet. Ook niet ergens anders.
      melder: anoniem ? null : w.key, anoniem,
      escalatie: zwaarte === 'hoog' || zwaarte === 'kritiek' || ALLEEN_LANDELIJK.includes(soort),
      projectId: schoon(b.projectId, 20) || null, stappen: [], uitkomst: null, at: nu() };
    S().incidenten.push(i);
    // Het auditspoor noteert de melding, en bij anoniem niet wie hem deed.
    audit(anoniem ? 'anoniem' : w.key, 'melding.nieuw', soort, zwaarte + (i.escalatie ? ', landelijk' : ''));
    save();
    return { ok: true, melding: beeld(i), landelijk: i.escalatie };
  }

  /* Lezen. Drie kringen, en ze overlappen bewust niet:
       - landelijk ziet alles;
       - een stad ziet de meldingen van de eigen stad, behalve de soorten die
         alleen landelijk zijn;
       - een anonieme melder ziet zijn eigen melding niet terug, want we weten
         niet welke van hem is. Dat is de prijs van anoniem, en hij staat in de
         tekst bij het melden. */
  function lijst(req, stadId) {
    const w = wie(req);
    if (w.landelijk && !stadId) {
      return { ok: true, soorten: SOORTEN, zwaartes: ZWAARTE, statussen: STATUS, landelijk: true,
        meldingen: S().incidenten.slice(-500).reverse().map(beeld),
        escalaties: S().incidenten.filter(i => i.escalatie && i.status !== 'afgehandeld').map(beeld) };
    }
    const g = poort(w, stadId, 'rapport.lezen');
    if (!g.ok) return g;
    const zicht = S().incidenten.filter(i => i.stad === g.stad.id &&
      (w.landelijk || !ALLEEN_LANDELIJK.includes(i.soort)));
    return { ok: true, soorten: SOORTEN, zwaartes: ZWAARTE, statussen: STATUS, landelijk: !!w.landelijk,
      meldingen: zicht.slice(-300).reverse().map(beeld),
      escalaties: zicht.filter(i => i.escalatie && i.status !== 'afgehandeld').map(beeld) };
  }

  // Wie mag deze ene melding behandelen.
  function magBij(w, i) {
    if (w.landelijk) return true;
    if (ALLEEN_LANDELIJK.includes(i.soort)) return false;
    if (i.zwaarte === 'kritiek') return false; // kritiek is landelijk werk
    return !!i.stad && ctx.magRecht(w, i.stad, 'incident.melden');
  }

  function stap(req, id, tekst) {
    const i = vind(id);
    if (!i) return { status: 404, error: 'Deze melding bestaat niet.' };
    const w = wie(req);
    if (!magBij(w, i)) {
      return { status: 403, error: i.zwaarte === 'kritiek' || ALLEEN_LANDELIJK.includes(i.soort)
        ? 'Deze melding wordt landelijk behandeld.'
        : 'U heeft geen toegang tot deze melding.' };
    }
    const t = schoon(tekst, 600);
    if (!t) return { status: 400, error: 'Wat is er gedaan?' };
    if (!Array.isArray(i.stappen)) i.stappen = [];
    if (i.stappen.length >= 100) return { status: 400, error: 'Dit dossier zit vol.' };
    i.stappen.unshift({ id: rid(), tekst: t, door: w.key, at: nu() });
    if (i.status === 'open') i.status = 'in_onderzoek';
    audit(w.key, 'melding.stap', i.id, i.soort);
    save();
    return { ok: true, melding: beeld(i) };
  }

  /* Sluiten. Er is geen weg terug naar 'open' en er is geen verwijderknop; de
     uitkomst is verplicht, want een melding die "afgehandeld" heet zonder dat
     iemand opschreef wat eruit kwam, is stil weggewerkt (LAT.md regel 5). */
  function sluit(req, id, uitkomst) {
    const i = vind(id);
    if (!i) return { status: 404, error: 'Deze melding bestaat niet.' };
    const w = wie(req);
    if (!magBij(w, i)) return { status: 403, error: 'Deze melding wordt landelijk afgehandeld.' };
    if (i.status === 'afgehandeld') return { status: 400, error: 'Deze melding is al afgehandeld.' };
    const u = schoon(uitkomst, 600);
    if (u.length < 10) return { status: 400, error: 'Wat is de uitkomst? Schrijf het op; dit is wat er over vijf jaar nog van te lezen is.' };
    i.uitkomst = { tekst: u, door: w.key, at: nu() };
    i.status = 'afgehandeld';
    audit(w.key, 'melding.sluit', i.id, i.soort + ' ' + i.zwaarte);
    save();
    return { ok: true, melding: beeld(i) };
  }

  return { meld, lijst, stap, sluit, vind, beeld, SOORTEN, ZWAARTE, STATUS, ALLEEN_LANDELIJK };
};
module.exports.SOORTEN = SOORTEN;
module.exports.ZWAARTE = ZWAARTE;
module.exports.ALLEEN_LANDELIJK = ALLEEN_LANDELIJK;
