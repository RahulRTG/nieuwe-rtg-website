/* DE UITZONDERINGENRIJ EN HET ZAAKDOSSIER.

   Wat de automatisering niet zelfstandig afhandelt, wordt een ZAAK: met een
   eigenaar, een termijn, het bewijs waarop hij ontstond, en uiteindelijk een
   besluit. Een medewerker ziet daardoor alleen wat er écht toe doet, en niet
   de honderd gevallen die de machine al heeft opgelost.

   WAAROM EEN ZAAK EN NIET EEN MELDING. Een melding verdwijnt als je hem
   wegklikt; een zaak heeft een uitkomst. Dat verschil is de hele reden dat deze
   rij bestaat: elk geval dat de machine niet aankon, is een gemeten gat in de
   automatisering. `leerpunten()` telt die gaten en dat is de invoer voor de
   volgende automatiseringsronde -- de menselijke beslissing wordt zo niet
   alleen een afhandeling maar ook lesmateriaal.

   DE TERMIJN KOMT UIT HET BELEID. Niet uit een getal in dit bestand, want dan
   zou hij per omgeving niet te verschuiven zijn zonder code te wijzigen. */
'use strict';

const OPEN = 'open', BEZIG = 'in behandeling', KLAAR = 'afgehandeld';

function maakZaken({ db, save, crypto, journaal, beleid, vak, opslag }) {
  const V = typeof vak === 'function' ? vak : (() => opslag.vak());
  function rij() {
    const v = V();
    if (!Array.isArray(v.commandZaken)) v.commandZaken = [];
    return v.commandZaken;
  }
  const nu = () => new Date().toISOString();

  function termijnVan(vanaf) {
    const uren = beleid.getal('zaak.termijnUren', 48);
    return new Date(new Date(vanaf).getTime() + uren * 3600 * 1000).toISOString();
  }

  /* Openen. `bewijs` is wat de machine zag toen hij besloot dit niet zelf te
     doen: het oordeel van de risicomotor, het geval, en de reden. Zonder dat
     kan de mens de beslissing niet overdoen -- en dan is de rij een lijst
     taken zonder context. */
  function open(z) {
    const at = nu();
    const zaak = {
      id: crypto.randomUUID(),
      at, titel: String(z.titel || 'Uitzondering'),
      domein: String(z.domein || 'overig'),
      objectType: z.objectType ? String(z.objectType) : null,
      objectId: z.objectId != null ? String(z.objectId) : null,
      oorzaak: String(z.oorzaak || 'onbekend'),
      bron: String(z.bron || 'command'),
      status: OPEN,
      eigenaar: z.eigenaar ? String(z.eigenaar) : null,
      termijn: termijnVan(at),
      risico: z.risico == null ? null : Number(z.risico),
      bewijs: z.bewijs || null,
      stappen: [{ at, wat: 'geopend', door: String(z.door || 'command'), reden: String(z.reden || '') }],
      besluit: null
    };
    rij().push(zaak);
    if (save) save();
    journaal.noteer({ actor: z.door || 'command', actie: 'zaak openen', objectType: 'zaak', objectId: zaak.id,
      niveau: z.niveau || 'auto', risico: zaak.risico, reden: z.reden || zaak.oorzaak,
      na: { titel: zaak.titel, oorzaak: zaak.oorzaak, termijn: zaak.termijn } });
    return zaak;
  }

  function vind(id) { return rij().find(z => z.id === String(id)) || null; }

  function neem(id, wie) {
    const z = vind(id);
    if (!z) return { error: 'Die zaak bestaat niet.', status: 404 };
    if (!wie) return { error: 'Zonder herleidbare medewerker wordt een zaak niet opgepakt.', status: 403 };
    if (z.status === KLAAR) return { error: 'Die zaak is al afgehandeld.', status: 409 };
    const voor = { eigenaar: z.eigenaar, status: z.status };
    z.eigenaar = String(wie); z.status = BEZIG;
    z.stappen.push({ at: nu(), wat: 'opgepakt', door: String(wie), reden: '' });
    if (save) save();
    journaal.noteer({ actor: wie, actie: 'zaak oppakken', objectType: 'zaak', objectId: z.id,
      niveau: 'hand', reden: 'eigenaarschap', voor, na: { eigenaar: z.eigenaar, status: z.status } });
    return { zaak: z };
  }

  /* Besluiten. Het besluit draagt wat de mens KOOS en waarom -- dat "waarom" is
     wat process mining er later uit haalt. Een besluitveld zonder reden levert
     een dossier op waar niemand van leert. */
  function besluit(id, wie, keuze, reden) {
    const z = vind(id);
    if (!z) return { error: 'Die zaak bestaat niet.', status: 404 };
    if (!wie) return { error: 'Zonder herleidbare medewerker wordt er niet besloten.', status: 403 };
    if (z.status === KLAAR) return { error: 'Die zaak is al afgehandeld.', status: 409 };
    if (!keuze) return { error: 'Een besluit vraagt een keuze.', status: 400 };
    if (!reden || String(reden).trim().length < 4) return { error: 'Een besluit vraagt een reden; daar leert de automatisering van.', status: 400 };
    const voor = { status: z.status, besluit: z.besluit };
    z.status = KLAAR;
    z.besluit = { keuze: String(keuze), reden: String(reden), door: String(wie), at: nu(),
      opTijd: nu() <= z.termijn };
    z.stappen.push({ at: z.besluit.at, wat: 'besloten: ' + z.besluit.keuze, door: String(wie), reden: z.besluit.reden });
    if (save) save();
    journaal.noteer({ actor: wie, actie: 'zaak besluiten', objectType: 'zaak', objectId: z.id,
      niveau: 'hand', reden, voor, na: { status: z.status, keuze: z.besluit.keuze, opTijd: z.besluit.opTijd } });
    return { zaak: z };
  }

  function lijst(filter) {
    let uit = rij().slice().reverse();
    const f = filter || {};
    if (f.status) uit = uit.filter(z => z.status === f.status);
    if (f.domein) uit = uit.filter(z => z.domein === f.domein);
    if (f.eigenaar) uit = uit.filter(z => z.eigenaar === f.eigenaar);
    if (f.oorzaak) uit = uit.filter(z => z.oorzaak === f.oorzaak);
    return uit.slice(0, Number(f.max || 100));
  }

  function tellingen() {
    const alle = rij(), n = nu();
    const open = alle.filter(z => z.status !== KLAAR);
    return {
      totaal: alle.length,
      open: open.length,
      bezig: alle.filter(z => z.status === BEZIG).length,
      zonderEigenaar: open.filter(z => !z.eigenaar).length,
      overTermijn: open.filter(z => z.termijn < n).length,
      afgehandeld: alle.filter(z => z.status === KLAAR).length,
      opTijdAfgehandeld: alle.filter(z => z.status === KLAAR && z.besluit && z.besluit.opTijd).length
    };
  }

  /* HUMAN-IN-THE-LOOP: waar besluiten zich herhalen, ligt een
     automatiseringskandidaat. Groepeer op oorzaak + gekozen besluit; wat vaak
     hetzelfde uitpakt, kan een runbook worden. Alleen tellen -- de stap naar
     een echt runbook blijft mensenwerk, want een automaat die zichzelf
     goedkeurt is precies wat deze laag níet moet worden. */
  function leerpunten(minimaal) {
    const drempel = Number(minimaal || 3);
    const per = new Map();
    for (const z of rij()) {
      if (z.status !== KLAAR || !z.besluit) continue;
      const sleutel = z.oorzaak + ' → ' + z.besluit.keuze;
      const g = per.get(sleutel) || { oorzaak: z.oorzaak, besluit: z.besluit.keuze, aantal: 0, domeinen: new Set(), voorbeelden: [] };
      g.aantal++; g.domeinen.add(z.domein);
      if (g.voorbeelden.length < 3) g.voorbeelden.push({ id: z.id, titel: z.titel, reden: z.besluit.reden });
      per.set(sleutel, g);
    }
    return [...per.values()].filter(g => g.aantal >= drempel)
      .sort((a, b) => b.aantal - a.aantal)
      .map(g => ({ oorzaak: g.oorzaak, besluit: g.besluit, aantal: g.aantal,
        domeinen: [...g.domeinen], voorbeelden: g.voorbeelden,
        voorstel: 'Dit besluit viel ' + g.aantal + '× hetzelfde uit. Kandidaat voor een runbook.' }));
  }

  return { open, vind, neem, besluit, lijst, tellingen, leerpunten, OPEN, BEZIG, KLAAR };
}

module.exports = { maakZaken, OPEN, BEZIG, KLAAR };
