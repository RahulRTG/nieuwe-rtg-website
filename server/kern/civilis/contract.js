/* ============================================================================
   CIVILIS-KETENCONTRACT -- gedeelde taal, geen gedeelde uitvoeringsmachine.

   VERDER.md heeft gemeten dat een universeel transitieobject de echte poorten
   van domeinen wegpoetst. Dit bestand doet daarom uitsluitend drie dingen:
   namen vastleggen, een gebeurtenisenvelop controleren en eisen wat iedere
   domeinovergang zelf moet beschrijven. Het verandert geen toestand, kent geen
   database en beslist geen recht.
   ========================================================================== */
'use strict';

const FASES = [
  'toegang', 'veiligheid', 'begrijpen', 'plan_en_regie', 'bevoegd_besluit',
  'toewijzing_en_acceptatie', 'uitvoering', 'resultaat_en_bewijs',
  'vervolg_en_deelname', 'nazorg_en_hernieuwde_toegang'
];

const DOMEINEN = [
  'veiligheid_en_crisis', 'wonen', 'inkomen', 'schulden_en_geld', 'gezondheid',
  'onderwijs', 'werk', 'gezin_en_jeugd', 'ouderen_en_beperkingen',
  'recht_en_identiteit', 'mobiliteit_en_digitaal', 'gemeenschap_en_participatie'
];

const LAGEN = [
  'mens_en_huishouden', 'levenssituatie_en_trajecten', 'organisaties_en_bevoegdheden',
  'mensen_en_middelen', 'transacties_en_bewijs', 'vertrouwen_en_continuiteit'
];

const MOTOREN = [
  'toegang', 'veiligheid', 'identiteit', 'rechten', 'plan', 'ketenregie',
  'capaciteit', 'overdracht', 'werk', 'middelen', 'bewijs', 'financieel',
  'herstel', 'evaluatie', 'preventie'
];

const BEWIJSNIVEAUS = [
  'ontwerp', 'geimplementeerd', 'gesimuleerd', 'extern_geaccepteerd', 'operationeel_bewezen'
];

const VERPLICHT = [
  'id', 'keten', 'overgang', 'fase', 'domein', 'actor', 'bevoegdheid', 'grondslag',
  'doel', 'tenant', 'zaak', 'onderwerp', 'idempotentie', 'gegevens', 'bewijs',
  'fouttoestand', 'compensatie', 'audit', 'verantwoordelijke', 'op'
];

/* De envelop reist tussen organisaties; de inhoud blijft bij de eigenaar.
   `onderwerp` is een codenaam of opaque verwijzing, nooit een naam of BSN. */
function keurEnvelop(e) {
  const fouten = [];
  for (const veld of VERPLICHT) {
    if (e == null || e[veld] === undefined || e[veld] === null || e[veld] === '') {
      fouten.push('mist ' + veld);
    }
  }
  if (e && !FASES.includes(e.fase)) fouten.push('onbekende fase');
  if (e && !DOMEINEN.includes(e.domein)) fouten.push('onbekend domein');
  if (e && !/^[-A-Za-z0-9_:/.]{2,120}$/.test(String(e.onderwerp || ''))) {
    fouten.push('onderwerp is geen beperkte verwijzing');
  }
  const verboden = ['naam', 'achternaam', 'bsn', 'diagnose', 'adres', 'telefoon', 'email'];
  for (const veld of verboden) {
    if (e && Object.prototype.hasOwnProperty.call(e, veld)) fouten.push('verboden topveld ' + veld);
  }
  if (e && (!Array.isArray(e.gegevens) || !e.gegevens.length)) fouten.push('gegevens is geen minimale veldlijst');
  if (e && (!Array.isArray(e.bewijs) || !e.bewijs.length)) fouten.push('bewijs ontbreekt');
  return { ok: fouten.length === 0, fouten };
}

/* Iedere domeinovergang beschrijft zijn eigen poort. Geen generieke `mag()`:
   de instantie die beslist blijft zichtbaar en toetsbaar. */
function keurOvergang(o) {
  const nodig = ['id', 'van', 'naar', 'actor', 'bevoegdheid', 'grondslagBeslispunt',
    'noodzakelijkeGegevens', 'bewijs', 'fouttoestand', 'compensatie', 'audit',
    'verantwoordelijkePartij'];
  const fouten = nodig.filter(k => o == null || o[k] === undefined || o[k] === null || o[k] === '')
    .map(k => 'mist ' + k);
  if (o && !Array.isArray(o.noodzakelijkeGegevens)) fouten.push('noodzakelijkeGegevens is geen lijst');
  if (o && !Array.isArray(o.bewijs)) fouten.push('bewijs is geen lijst');
  return { ok: fouten.length === 0, fouten };
}

module.exports = { FASES, DOMEINEN, LAGEN, MOTOREN, BEWIJSNIVEAUS, VERPLICHT,
  keurEnvelop, keurOvergang };
