/* de meldingenlijst van de zaak */
    $('#notifList').innerHTML = notifs.length ? notifs.map(n =>
      '<div class="notif-item'+(n.read?'':' unread')+'"><div class="ic">'+(window.RTGGlyf&&RTGGlyf.heeft(n.icon)?RTGGlyf.svgHTML(n.icon,{klasse:'gl-inline'}):(n.icon||'•'))+'</div><div class="tx"><b>'+n.title+'</b><span>'+n.body+'</span><time>'+timeAgo(n.at)+'</time></div></div>'
    ).join('') : '<div class="empty">'+T('sup.nonotif','Nog geen meldingen. Nieuwe bestellingen en betalingen ziet u hier live.')+'</div>';
  }
