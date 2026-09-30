window.RTGKlaarzetten=function(api, meld){
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
/* EEN REIS KLAARZETTEN VOOR EEN KLANT DIE NOG GEEN LID IS.

   De onderdelen worden hier opgebouwd en pas bij "Zet de reis klaar" verstuurd.
   Er gaat NIETS over de klant mee: dit scherm vraagt niet naar een naam, een
   e-mailadres of een telefoonnummer, en het stuurt ook niets. De medewerker
   krijgt een link en verstuurt die zelf -- wat er niet gevraagd wordt, kan ook
   niet bewaard worden (kern/reisuitnodiging.js). */
let KLAAR = [];
function tekenKlaarLijst(){
  $('#kKlaarLijst').innerHTML = KLAAR.length
    ? '<ul>' + KLAAR.map((o, i) => '<li>' + esc(o.soort) + ': ' + esc(o.titel) +
        (o.bestemming ? ' (' + esc(o.bestemming) + ')' : '') + ' &middot; ' + esc(o.van) +
        (o.tot ? ' t/m ' + esc(o.tot) : '') +
        ' <button class="knop stil rp-legacy-1" type="button" data-af="' + i + '">weg</button></li>').join('') + '</ul>'
    : '<div class="leeg">Nog geen onderdelen.</div>';
  $('#kKlaarLijst').querySelectorAll('[data-af]').forEach(b => b.addEventListener('click', () => {
    KLAAR.splice(Number(b.dataset.af), 1); tekenKlaarLijst();
  }));
}
async function laadKlaargezet(){
  try {
    const d = await api('reisbureau/uitnodigingen');
    const rij = (d.uitnodigingen || []).filter(x => x.soort === 'klaargezet'&&!x.programmaReis);
    $('#kKlaarStaat').innerHTML = rij.length ? rij.map(x =>
      '<div class="rp-saved"><span>'+esc(x.bestemming||'Reis')+' · '+esc(x.venster.van)+' · '+
      (x.opgeeist?'Overgenomen':x.ingetrokken?'Ingetrokken':'Geldig tot '+esc(x.toegang&&x.toegang.expires_at))+'</span>'+
      (x.opgeeist||x.ingetrokken?'':'<button type="button" data-roteer="'+esc(x.id)+'">Nieuwe link</button><button type="button" data-introk="'+esc(x.id)+'">Trek in</button>')+'</div>').join(''):'<p>Er staat niets klaar.</p>';
    $('#kKlaarStaat').querySelectorAll('[data-roteer]').forEach(b=>b.addEventListener('click',async()=>{
      b.disabled=true;try{const r=await api('reisbureau/uitnodiging-roteer',{id:b.dataset.roteer,idem:RTGIdem('reis-roteer')});toonLink(r.link);await laadKlaargezet();}catch(e){meld(e.message);b.disabled=false;}
    }));
    $('#kKlaarStaat').querySelectorAll('[data-introk]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await api('reisbureau/uitnodiging-weg', { id: b.dataset.introk }); laadKlaargezet(); }
      catch (e) { meld(e.message); b.disabled = false; }
    }));
  } catch (e) { $('#kKlaarStaat').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>'; }
}
function toonLink(link){
  const vak=$('#kKlaarUit');vak.replaceChildren();const p=document.createElement('p');p.textContent='De reis staat klaar. Kopieer deze eenmalig getoonde link:';
  const inp=document.createElement('input');inp.readOnly=true;inp.value=new URL(link,location.origin).href;
  const b=document.createElement('button');b.type='button';b.id='kKlaarKopie';b.textContent='Kopieer';b.onclick=async()=>{try{await navigator.clipboard.writeText(inp.value);meld('Link gekopieerd.');}catch(e){inp.focus();inp.select();}};vak.append(p,inp,b);
}
function bedraadKlaarzetten(){
  $('#kKlaarLees').addEventListener('click', async () => {
    $('#kKlaarGelezen').textContent = 'Lezen...';
    try {
      const d = await api('reisbureau/lees', { tekst: $('#kKlaarTekst').value });
      const v = d.gelezen.velden || {};
      const w = (n) => (v[n] || {}).waarde || '';
      if (w('titel') || w('vlucht') || w('kenmerk')) $('#kKlaarTitel').value = w('titel') || w('vlucht') || w('kenmerk');
      if (w('soort')) $('#kKlaarSoort').value = w('soort');
      if (w('bestemming')) $('#kKlaarPlaats').value = w('bestemming');
      if (w('van_datum')) $('#kKlaarVan').value = w('van_datum');
      if (w('tot_datum')) $('#kKlaarTot').value = w('tot_datum');
      const onzeker = d.gelezen.onzeker || [];
      $('#kKlaarGelezen').textContent = 'Gelezen uit ' + (d.gelezen.hoe === 'bcbp' ? 'de boardingpass-strook' : 'de tekst') +
        (onzeker.length ? ' -- kijk na: ' + onzeker.join(', ') : ' -- alles eenduidig');
    } catch (e) { $('#kKlaarGelezen').textContent = e.message; }
  });
  $('#kKlaarErbij').addEventListener('click', () => {
    const o = { soort: $('#kKlaarSoort').value, titel: $('#kKlaarTitel').value.trim(),
      bestemming: $('#kKlaarPlaats').value.trim(), van: $('#kKlaarVan').value.trim(), tot: $('#kKlaarTot').value.trim() };
    if (!o.titel || !/^\d{4}-\d{2}-\d{2}$/.test(o.van)) { meld('Een onderdeel heeft een naam en een datum nodig.'); return; }
    KLAAR.push(o); tekenKlaarLijst();
    $('#kKlaarTekst').value = ''; $('#kKlaarTitel').value = ''; $('#kKlaarVan').value = ''; $('#kKlaarTot').value = '';
    $('#kKlaarGelezen').textContent = '';
  });
  $('#kKlaarZet').addEventListener('click', async () => {
    if (!KLAAR.length) { meld('Zet eerst een onderdeel erbij.'); return; }
    try {
      const d = await api('reisbureau/klaarzetten', { onderdelen: KLAAR });
      KLAAR = []; tekenKlaarLijst(); toonLink(d.link);
      laadKlaargezet();
    } catch (e) { meld(e.message); }
  });
}
return {bedraadKlaarzetten,tekenKlaarLijst,laadKlaargezet};
};
