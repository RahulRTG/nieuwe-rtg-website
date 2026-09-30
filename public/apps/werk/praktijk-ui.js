(function () {
  'use strict';
  const K = window.RTGWerk, e = K.esc;
  const labels = { zelfstandig:'Ik werk zelfstandig', winkel:'Winkel of handel', dienstverlening:'Dienstverlening',
    vestigingen:'Meerdere locaties', stichting:'Stichting of vereniging', product:'Product', dienst:'Dienst',
    verhuur:'Verhuur', activiteit:'Activiteit', hulp:'Hulp of vrijwilligerswerk' };
  const opties = (lijst, gekozen) => lijst.map(x => '<option value="' + e(x) + '"' + (x === gekozen ? ' selected' : '') + '>' + e(labels[x] || x) + '</option>').join('');
  const veld = (naam, label, waarde = '', type = 'text') => '<label>' + e(label) + '<input name="' + e(naam) +
    '" type="' + type + '" value="' + e(waarde) + '" maxlength="500"' + (type === 'number' ? ' min="0" step="0.01"' : '') + ' required></label>';
  const tekst = (naam, label, waarde = '') => '<label>' + e(label) + '<textarea name="' + e(naam) + '" maxlength="500" required>' + e(waarde) + '</textarea></label>';
  const keuze = (naam, label, lijst, gekozen) => '<label>' + e(label) + '<select aria-label="' + e(label) + '" name="' + naam + '">' + opties(lijst, gekozen) + '</select></label>';
  const knop = t => '<button class="knop p" type="submit">' + e(t) + '</button>';
  function inrichten(d) {
    const p = d.profiel || {};
    return '<details' + (!d.profiel ? ' open' : '') + '><summary>Uw werkplek inrichten</summary><p>Begin met wat u vandaag doet. U kunt producten, diensten, verhuur, activiteiten en hulp combineren.</p>' +
      '<form data-pr="inrichten">' + keuze('profiel','Hoe werkt u?',d.profielen,p.profiel) +
      window.RTGPraktijkRegio.velden(p) + knop('Werkplek bewaren') + '</form></details>';
  }
  function aanbod(d) {
    return '<details><summary>Aanbod toevoegen · ' + d.aanbod.length + ' onderdelen</summary><p>Dit is uw interne aanbod. Het wordt pas openbaar via de bestaande toelatingsroute.</p><ul>' +
      d.aanbod.map(a => '<li>' + e(a.naam) + ' · ' + e(labels[a.soort]) + ' · ' + e(a.locatie) + '</li>').join('') + '</ul>' +
      '<form data-pr="aanbod">' + veld('naam','Wat biedt u aan?') + keuze('soort','Soort',d.soorten) + tekst('omschrijving','Omschrijving') +
      keuze('prijswijze','Prijs',['vast','op-aanvraag','kosteloos']) + veld('bedrag','Bedrag in ' + d.profiel.valuta, '0', 'number') +
      veld('locatie','Locatie, vestiging of online') + knop('Aanbod bewaren') + '</form></details>';
  }
  function vraag(d) {
    return '<details><summary>Klantvraag of hulpvraag toevoegen</summary><form data-pr="vraag"><label>Aanbod<select name="aanbodId">' +
      d.aanbod.map(a => '<option value="' + e(a.id) + '">' + e(a.naam) + '</option>').join('') + '</select></label>' +
      veld('klant','Klant of contactpersoon (een herkenbare naam is genoeg)') + tekst('vraag','Wat wil deze persoon?') +
      '<label>Gewenste datum (optioneel)<input type="date" name="datum"></label>' + knop('Vraag bewaren') + '</form></details>';
  }
  function werk(x) {
    const stappen = { afgewezen:'Nieuw voorstel maken', vraag:'Voorstel maken', voorstel:'Voorstel aanpassen', bevestigd:'Werk plannen', ingepland:'Uitvoering vastleggen', uitgevoerd:'Administratief afronden' };
    const stap = { afgewezen:'voorstel', vraag:'voorstel', voorstel:'voorstel', bevestigd:'plannen', ingepland:'uitvoeren', uitgevoerd:'afronden' }[x.stand];
    let f = '';
    if (stap) {
      f = '<form data-pr="stap" data-project="' + e(x.id) + '" data-stap="' + stap + '">';
      if (stap === 'voorstel') f += tekst('toelichting','Wat spreekt u af?',x.voorstel || x.omschrijving) + veld('bedrag','Totaalbedrag in ' + x.valuta, (x.bedragMinor || 0)/10**x.decimalen,'number');
      if (stap === 'plannen') f += veld('datum','Uitvoerdatum',x.datum || '','date') + veld('wie','Wie voert het uit?') + veld('locatie','Waar?',x.locatie);
      if (stap === 'uitvoeren') f += tekst('toelichting','Wat is daadwerkelijk uitgevoerd?');
      if (stap === 'afronden') f += keuze('administratie','Afhandeling',x.bedragMinor === 0 ? ['geen-betaling','extern-vastgelegd'] : ['extern-vastgelegd']) +
        tekst('toelichting','Verwijzing naar uw administratie of uitleg') + '<p>Dit registreert uw verwijzing. Het maakt geen factuur en markeert niets als betaald.</p>';
      f += knop(stappen[x.stand]) + '</form>';
    }
    if (x.stand === 'voorstel') f += '<form data-pr="stap" data-project="' + e(x.id) + '" data-stap="akkoord">' +
      tekst('toelichting','Al telefonisch of persoonlijk akkoord? Noteer hoe en wanneer.') + knop('Bestaand akkoord vastleggen') + '</form>';
    if (['voorstel','bevestigd','ingepland','uitgevoerd','afgerond'].includes(x.stand)) f += '<div class="pr-rij"><button type="button" class="knop" data-pr-deel="' + e(x.id) + '">Klantlink maken</button>' +
      '<button type="button" class="knop" data-pr-intrek="' + e(x.id) + '">Klantlinks intrekken</button></div>';
    if (['vraag','voorstel','bevestigd','ingepland','afgewezen'].includes(x.stand)) f += '<details><summary>Werk annuleren</summary><form data-pr="stap" data-project="' + e(x.id) + '" data-stap="annuleren">' + tekst('toelichting','Reden van annulering') + knop('Annulering vastleggen') + '</form></details>';
    if (!['afgerond','geannuleerd'].includes(x.stand)) f += window.RTGPraktijkExtern.formulier(x);
    return '<details data-pr-werk="' + e(x.id) + '"><summary><b>' + e(x.naam) + '</b><br><span class="pr-status">' + e(x.klant) + ' · ' + e(x.stand) + (x.datum ? ' · ' + e(x.datum) : '') + '</span></summary>' +
      '<p>' + e(x.omschrijving) + '</p>' + (x.voorstel ? '<p><b>Afspraak:</b> ' + e(x.voorstel) + '</p>' : '') +
      (x.uitvoering ? '<p><b>Uitgevoerd:</b> ' + e(x.uitvoering.toelichting) + '</p>' : '') +
      (x.administratie ? '<p><b>Administratie:</b> ' + e(x.administratie.verwijzing) + '</p>' : '') + f + '<div class="pr-uit" role="status"></div></details>';
  }
  window.RTGPraktijkUI = { veld, knop, teken: d => '<h2>Uw dagelijkse werk</h2><p>Van een eerste vraag tot afgerond werk. Alles met de hand te gebruiken, ook zonder andere software.</p>' +
    inrichten(d) + (d.profiel ? aanbod(d) + (d.aanbod.length ? vraag(d) : '<p>Voeg uw eerste product, dienst of activiteit toe.</p>') : '') +
    '<details><summary>Team en tijdelijke rechten</summary><button class="knop" type="button" data-pr-team>Team laden</button><div id="prTeam"></div></details>' +
    '<h3>Uw werk · ' + d.pagina.totaal + '</h3>' + (d.werk.length ? d.werk.map(werk).join('') : '<p>Nog geen vragen. Uw eigen werk verschijnt hier zodra u begint.</p>') +
    '<div class="pr-rij">' + (d.pagina.offset > 0 ? '<button class="knop" data-pr-pagina="' + Math.max(0,d.pagina.offset-50) + '">Vorige 50</button>' : '') +
    (d.pagina.offset + 50 < d.pagina.totaal ? '<button class="knop" data-pr-pagina="' + (d.pagina.offset+50) + '">Volgende 50</button>' : '') + '</div>' };
})();
