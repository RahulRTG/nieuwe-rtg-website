    if (cssGedaan) return; cssGedaan = true;
    var css = '.sb-balk{display:flex;align-items:center;gap:.6rem;padding:.6rem 1rem;border-bottom:1px solid var(--lijn);position:relative;}' +
      '.sb-brand{font-family:var(--serif);font-weight:500;background:#7F1734;color:#fff;padding:.18rem .6rem .22rem;border-radius:4px;}.sb-brand b{color:#F4E9C8;}' +
      '.sb-terug{color:var(--zacht);text-decoration:none;font-size:.85rem;}' +
      '.sb-bel{margin-left:auto;background:transparent;color:var(--txt);font-size:1.15rem;position:relative;line-height:1;padding:.2rem;}' +
      '.sb-tel{position:absolute;top:-4px;right:-6px;background:var(--rood);color:#fff;font-size:.62rem;font-weight:700;border-radius:999px;min-width:1.1rem;height:1.1rem;display:inline-flex;align-items:center;justify-content:center;padding:0 3px;}' +
      '.sb-tel[hidden]{display:none;}' +
      '.sb-prof{display:flex;align-items:center;gap:.45rem;background:transparent;color:var(--txt);}' +
      '.sb-av{width:1.8rem;height:1.8rem;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:1rem;}' +
      '.sb-nm{font-size:.9rem;font-weight:600;max-width:7rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.sb-menu{position:absolute;top:100%;right:1rem;z-index:40;background:var(--paneel);border:1px solid var(--lijn);border-radius:12px;padding:.4rem;display:flex;flex-direction:column;min-width:12rem;box-shadow:0 12px 30px rgba(0,0,0,.5);}' +
      '.sb-menu[hidden],.sb-berichten[hidden]{display:none;}' +
      '.sb-menu a{color:var(--txt);text-decoration:none;padding:.6rem .7rem;border-radius:8px;font-size:.9rem;}.sb-menu a:hover{background:var(--paneel2);color:var(--goud);}' +
      '.sb-berichten{position:absolute;top:100%;right:1rem;z-index:40;background:var(--paneel);border:1px solid var(--lijn);border-radius:12px;padding:.5rem;width:min(92vw,22rem);max-height:70vh;overflow:auto;box-shadow:0 12px 30px rgba(0,0,0,.5);}' +
      '.sb-leeg{color:var(--zacht);font-size:.85rem;padding:.8rem;text-align:center;}' +
      '.sb-b{padding:.6rem .7rem;border-radius:10px;background:var(--paneel2);margin-bottom:.4rem;}' +
      '.sb-b.reis{border:1px solid var(--goud);}' +
      '.sb-b.hulp{border:1px solid var(--rood);background:#2a1512;}' +
      '.sb-hulplabel{color:#e88;font-weight:700;font-size:.78rem;margin-bottom:.25rem;}' +
      '.sb-bkop{font-size:.78rem;color:var(--zacht);margin-bottom:.2rem;}.sb-bkop b{color:var(--txt);}' +
      '.sb-btxt{font-size:.92rem;line-height:1.4;white-space:pre-wrap;}' +
      '.sb-reisknop{display:inline-block;margin-top:.5rem;background:var(--goud);color:#1a1710;font-weight:700;font-size:.82rem;text-decoration:none;padding:.35rem .7rem;border-radius:8px;}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  }
  w.Sessie = Sessie;
})(window);
