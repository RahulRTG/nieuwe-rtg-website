/* Horeca OS (deellaag): DE UITVOERDERS achter de rechtenlaag van Rahul.

   De kern beslist WAT er mag (kern/horeca/rahul-register.js en
   rahul-recht.js); dit bestand weet HOE het gebeurt. Die scheiding is opzet: de
   lagen zijn een besluit dat je wilt kunnen lezen zonder door uitvoercode te
   waden, en een uitvoerder is code die je wilt kunnen wijzigen zonder aan een
   besluit te komen.

   EEN HANDELING ZONDER UITVOERDER IS GEEN GAT. De bon is dan het besluit en
   verder niets -- en dat is precies wat een voorstel hoort te zijn zolang er
   geen deur voor is. Twee handelingen staan daar met opzet:

   BETALING.UITVOEREN krijgt hier NOOIT een uitvoerder, en dat is geen
   nalatigheid maar de juiste uitkomst. Een mens die een betaling bevestigt, IS
   de mens die hem uitvoert -- op het scherm waar betalen hoort. Een tweede
   betaalweg langs deze kant zou een tweede plek zijn waar geld beweegt, en
   precies dat verbiedt LAT-regel 4. De actiebon legt vast dat Rahul het
   voorstelde; de handeling zelf gebeurt waar hij altijd al gebeurde.

   MISE.ADVISEREN staat in het register als `mag`, maar de rekensom ervoor zit
   binnen in de handler van /autopilot. Hem hier namaken zou een tweede
   mise-berekening geven; hem eruit tillen is een eigen snede. Tot die tijd
   levert hij een bon en verder niets, en dat staat er ook bij. */
'use strict';

module.exports = (kern) => {
  const { schoon, horeca, keuken } = kern;
  const { nu, id, centen } = horeca;
  const cadans = require('../../../kern/horeca/cadans');
  // dezelfde klok als de cadans hierboven; niet de OS-tijd
  const klok = require('../../../lib/klok');
  const werklijstlaag = require('../../../kern/horeca/werklijst')(
    { horeca, schoon, verzoeklaag: kern.verzoeklaag });

  const regelVan = (rek, regelId) => (rek.regels || []).find((x) => x.id === String(regelId || ''));

  return {
    /* ---- geld: binnen de grens van de zaak, anders na bevestiging ---- */
    'korting.toekennen': (h, g, wie) => {
      const rek = h.rekeningen[String((g || {}).rekeningId || '')];
      if (!rek) return { error: 'Deze rekening kennen we niet.' };
      if (rek.status !== 'open') return { error: 'Deze rekening is al ' + rek.status + '.' };
      const reden = schoon((g || {}).reden, 80);
      if (!reden) return { error: 'Een korting draagt altijd een reden.' };
      const bedrag = centen((g || {}).centen);
      if (!bedrag) return { error: 'Geef een bedrag in centen.' };
      rek.kortingen.push({ id: id(3), reden: reden + ' (via Rahul, bevestigd door ' + wie + ')',
        procent: null, centen: bedrag, at: nu(), door: wie });
      return { let: 'Korting van ' + (bedrag / 100).toFixed(2) + ' geboekt op ' + (rek.tafel || rek.id) + '.' };
    },

    /* ---- een allergie aanpassen: en dan STOPT de keuken tot een mens kijkt ----

       Grens 1 zegt dat generatieve AI nooit bepaalt of iets veilig is om te
       eten, en dat een mens bij de pas nog een keer bevestigt. Die tweede
       controle bestond al: een regel met `bevestiging: 'wacht'` haalt het
       keukenbord niet (zie routes/supplier/horeca/keuken.js) en staat in de
       wachtrij van /gast/wachtrij tot iemand hem aftekent.

       Dus doet deze uitvoerder twee dingen: de allergie zetten EN de regel
       terugzetten op wachten. Alleen de allergie zetten zou betekenen dat een
       bord doorloopt op informatie die een model heeft aangeraakt, en dat is
       precies wat niet mag. */
    'allergie.aanpassen': (h, g, wie) => {
      const rek = h.rekeningen[String((g || {}).rekeningId || '')];
      if (!rek) return { error: 'Deze rekening kennen we niet.' };
      const regel = regelVan(rek, (g || {}).regelId);
      if (!regel) return { error: 'Die regel staat niet op deze rekening.' };
      if (regel.stand === 'uitgegeven') return { error: 'Dit gerecht is al uitgeserveerd.' };
      const was = regel.allergie || null;
      const wordt = schoon((g || {}).allergie, 120) || null;
      if (was === wordt) return { error: 'Dit staat er al zo op; er is niets te wijzigen.' };
      regel.allergie = wordt;
      regel.bevestiging = 'wacht';
      regel.bevestigingCode = 'allergie-gewijzigd';
      regel.bevestigingUitleg = 'De allergie is via Rahul aangepast van "' + (was || 'geen') +
        '" naar "' + (wordt || 'geen') + '" en bevestigd door ' + wie +
        '. Een mens tekent dit bij de pas nog een keer af voordat de keuken verder gaat.';
      return { let: 'Allergie aangepast en de regel wacht nu op een tweede controle bij de pas. ' +
        'De keuken gaat pas verder als iemand hem aftekent.' };
    },

    /* ---- een voorraadverschil wegboeken: via de bestaande telling ----
       keuken.telling() is de deur die een geteld aantal vastlegt met de naam
       van wie telde. Een eigen afboeking hier zou een tweede weg zijn waarlangs
       voorraad verandert, en dan klopt de derving-historie niet meer. */
    'voorraad.wegboeken': (h, g, wie, supplier) => {
      if (!keuken || typeof keuken.telling !== 'function') return { error: 'De keukenvoorraad staat niet aan.' };
      const r = keuken.telling(supplier, (g || {}).artikelId, (g || {}).geteld, wie + ' (na voorstel van Rahul)');
      if (r && r.error) return { error: r.error };
      return { let: 'Telling vastgelegd via de gewone voorraaddeur, op naam van ' + wie + '.' };
    },

    /* ---- lezen en samenstellen: dit mag Rahul zelf ---- */
    'werklijst.samenvatten': (h, g, wie, supplier) => {
      const w = werklijstlaag.werklijst(h, supplier.code, { modus: (g || {}).modus });
      if (!w.nu.length && !w.open.length) return { let: 'Er staat niets open.' };
      /* Een samenvatting van GEMETEN getallen, opgebouwd uit de lijst zelf --
         geen model. Wat er niet in de lijst staat, staat er ook niet in. */
      const kop = w.nu.length
        ? w.nu.length + ' taak(en) over hun grens, de scherpste ' + w.nu[0].over + ' min: ' + w.nu[0].wat +
          ' (' + (w.nu[0].tafel || '-') + ')'
        : 'Niets staat over zijn grens';
      return { let: kop + '. Daarnaast ' + w.open.length + ' open zonder grens.' };
    },

    /* Welke gang wacht het langst op vrijgave door de zaal. Rule-based en na te
       rekenen: het is de tafel waarvan de oudste niet-vrijgegeven regel staat.
       Het VERANDERT niets -- vrijgeven blijft een tik van de zaal. */
    'gang.voorstellen': (h) => {
      let beste = null;
      for (const rek of Object.values(h.rekeningen || {})) {
        if (rek.status !== 'open') continue;
        for (const r of (rek.regels || [])) {
          if (r.vrijAt) continue;
          const t = Date.parse(r.at || '');
          if (isNaN(t)) continue;
          if (!beste || t < beste.t) beste = { t, tafel: rek.tafel || rek.kanaal, gang: r.gang || 0, rekeningId: rek.id };
        }
      }
      if (!beste) return { let: 'Er staat geen gang te wachten op vrijgave.' };
      const min = Math.max(0, Math.round((klok.nu() - beste.t) / 60000));
      return { let: 'Gang ' + beste.gang + ' op ' + beste.tafel + ' staat ' + min +
        ' min klaar om vrijgegeven te worden. Vrijgeven blijft een tik van de zaal.' };
    }
  };
};
