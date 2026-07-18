        if (naam) doe({ actie: 'lijst', id: b.id, naam });
      });
      el.querySelectorAll('[data-lweg]').forEach(x => x.addEventListener('click', () => doe({ actie: 'lijst-bewerk', id: b.id, lijstId: x.dataset.lweg, weg: true })));
      el.querySelectorAll('[data-plus]').forEach(x => x.addEventListener('click', () => {
        const titel = prompt(T('bd.kaartq','Wat moet er gebeuren?'), '');
        if (titel) doe({ actie: 'kaart', id: b.id, lijstId: x.dataset.plus, titel });
      }));
      el.querySelectorAll('[data-zet]').forEach(x => x.addEventListener('click', () => doe({ actie: 'kaart-zet', id: b.id, kaartId: x.dataset.zet, naarLijstId: x.dataset.naar })));
      el.querySelectorAll('[data-klaar]').forEach(x => x.addEventListener('click', () => doe({ actie: 'kaart-bewerk', id: b.id, kaartId: x.dataset.klaar, klaar: x.dataset.nu === '1' })));
      el.querySelectorAll('[data-kweg]').forEach(x => x.addEventListener('click', () => doe({ actie: 'kaart-weg', id: b.id, kaartId: x.dataset.kweg })));
      el.querySelectorAll('[data-bewerk]').forEach(x => x.addEventListener('click', () => {
        const k = b.lijsten.flatMap(l => l.kaarten).find(k2 => k2.id === x.dataset.bewerk);
        if (!k) return;
        const titel = prompt(T('bd.titelq','Titel:'), k.titel); if (titel === null) return;
        const notitie = prompt(T('bd.notq','Notitie (mag leeg):'), k.notitie || ''); if (notitie === null) return;
        const due = prompt(T('bd.dueq','Deadline (JJJJ-MM-DD, leeg = geen):'), k.due || ''); if (due === null) return;
        const body = { actie: 'kaart-bewerk', id: b.id, kaartId: k.id, titel, notitie, due };
        if (opt.teamleden){
          const team = opt.teamleden() || [];
          if (team.length){
            const wie = prompt(T('bd.wieq','Wie erop? Nummers met komma ertussen:\n') + team.map(m => m.id + ' = ' + m.name).join('\n'), (k.leden||[]).join(','));
            if (wie !== null) body.leden = wie.split(',').map(s => parseInt(s.trim(), 10)).filter(Number.isFinite);
          }
        }
        doe(body);
      }));
    }

    laad();
    return { refresh: laad };
  }

  w.BordenUI = { mount };
})(window);
