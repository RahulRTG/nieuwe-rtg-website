/* De handelingen van het treasury-bord (leverancier-19b.js): apart zetten,
   vrijgeven en de automatische regels.

   LOSSE REGELS EN GEEN FUNCTIE, en dat is hier geen stijlkeuze. De delen van
   deze app zijn stukken van EEN bestand: leverancier-21.js begint bindKantoor()
   en leverancier-22.js loopt daar middenin door. Een fragment landt dus in de
   scope waar zijn buren staan. Dit blok stond eerst als `function
   bindTreasury(el)` in een fragment tussen 20 en 21 -- en dat is de scope van de
   tekenfunctie, niet van bindKantoor. De aanroep werd daarmee een
   ReferenceError en het treasury-vak bleef leeg; scripts/check.js regel 37 ving
   dat voordat een mens het zag.

   Eigen fragment omdat leverancier-21.js er anders over de keuringsgrens van
   10240 byte gaat. Het sorteert na 21 en voor 22, dus middenin bindKantoor --
   precies waar deze regels horen.

   Vrijgeven is de handeling die er echt bij hoort. De btw is afgedragen, dus
   het geld is weer van u; zonder die knop is apart zetten een eenrichtingsweg. */

    /* TREASURY (leverancier-19b.js). Drie handelingen: apart zetten, vrijgeven
       en de automatische regels. Vrijgeven is de handeling die er echt bij
       hoort -- de btw is afgedragen, dus het geld is weer van u; zonder die
       knop is apart zetten een eenrichtingsweg. */
    el.querySelectorAll('[data-trvrij]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/pay/treasury/vrij', { id: b.dataset.trvrij });
        tresMsg = ''+T('kt.trvrijklaar','Vrijgegeven. Dit bedrag is weer beschikbaar.'); }
      catch(e){ tresMsg = e.message; }
      tresData = null; tresGraaf = null; laadTreasury();
    }));
    const trA = el.querySelector('#trApart'); if (trA) trA.addEventListener('click', async () => {
      const naam = (el.querySelector('#trNaam')||{}).value || '';
      const euroIn = parseFloat(((el.querySelector('#trBedrag')||{}).value || '').replace(',', '.'));
      if (!naam || !isFinite(euroIn)) { toast(T('kt.trvul','Vul een naam en een bedrag in.')); return; }
      try { await API.call('/supplier/pay/treasury/apart', { naam: naam, centen: Math.round(euroIn * 100) });
        tresMsg = ''+T('kt.trapartklaar','Apart gezet. Dit gaat niet mee bij een uitbetaling.'); }
      catch(e){ tresMsg = e.message; }
      tresData = null; tresGraaf = null; laadTreasury();
    });
    const trB = el.querySelector('#trBeleid'); if (trB) trB.addEventListener('click', () => {
      const num = (id) => parseFloat(((el.querySelector(id)||{}).value || '').replace(',', '.'));
      const buf = num('#trBuffer');
      treasuryZet({ btwPct: num('#trBtw'), payrollPct: num('#trLoon'),
        bufferCenten: isFinite(buf) ? Math.round(buf * 100) : undefined },
      ''+T('kt.trbeleidklaar','De regels staan. Vanaf de volgende ontvangst gaat dit deel meteen apart.'));
    });
