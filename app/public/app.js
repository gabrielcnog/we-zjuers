/* Small and unbundled on purpose: this page is content, not an application. */
(function () {
  /* Header menu (phones, signed in). A native <dialog> does the hard parts:
     focus stays inside, Escape closes it, and focus returns to the button. A
     browser without it gets the old row of links back instead. */
  var menuBtn = document.querySelector('.js-menu-open'), menu = document.getElementById('appMenu');
  if (menuBtn && menu) {
    if (typeof menu.showModal !== 'function') {
      document.documentElement.classList.add('no-menu');
    } else {
      var root = document.documentElement;
      var closeMenu = function () { if (menu.open) menu.close(); };
      menuBtn.addEventListener('click', function () {
        menu.showModal(); root.classList.add('menu-open'); menuBtn.setAttribute('aria-expanded', 'true');
      });
      menu.addEventListener('close', function () {
        root.classList.remove('menu-open'); menuBtn.setAttribute('aria-expanded', 'false');
      });
      menu.querySelector('.js-menu-close').addEventListener('click', closeMenu);
      /* The dialog fills the screen and the panel sits on its right edge, so a
         click that lands on the dialog itself is a click on the dimmed area. */
      menu.addEventListener('click', function (e) { if (e.target === menu) closeMenu(); });
      /* Rotated or resized to the desktop layout while open: the button is gone. */
      window.matchMedia('(min-width: 861px)').addEventListener('change', function (e) { if (e.matches) closeMenu(); });
      /* Coming back with the Back button must not show an open menu. */
      window.addEventListener('pageshow', closeMenu);
    }
  }

  /* The filter rail is rendered open so it works without JavaScript; below the
     rail breakpoint it starts collapsed so results are the first thing on screen. */
  var rail = document.querySelector('.js-rail');
  if (rail && window.matchMedia('(max-width: 899px)').matches) rail.open = false;

  /* Price range: two overlaid sliders driving the real numeric inputs. The
     inputs are the form fields, so with JavaScript off you still get a working
     min/max filter — the sliders are enhancement. */
  document.querySelectorAll('.js-slider').forEach(function (sl) {
    var lo = sl.querySelector('.js-slider-lo'), hi = sl.querySelector('.js-slider-hi');
    var fill = sl.querySelector('.zl-slider__fill');
    var form = sl.closest('form');
    var minIn = form.querySelector('.js-min'), maxIn = form.querySelector('.js-max');
    var MIN = Number(sl.dataset.min), MAX = Number(sl.dataset.max);
    function paint() {
      var a = Number(lo.value), b = Number(hi.value);
      var l = ((a - MIN) / (MAX - MIN)) * 100, r = ((b - MIN) / (MAX - MIN)) * 100;
      fill.style.left = l + '%'; fill.style.width = Math.max(0, r - l) + '%';
    }
    // Thumbs must not cross, or the range inverts and the query returns nothing.
    lo.addEventListener('input', function () {
      if (Number(lo.value) > Number(hi.value)) lo.value = hi.value;
      minIn.value = Number(lo.value) === MIN ? '' : lo.value; paint();
    });
    hi.addEventListener('input', function () {
      if (Number(hi.value) < Number(lo.value)) hi.value = lo.value;
      maxIn.value = Number(hi.value) === MAX ? '' : hi.value; paint();
    });
    // Typing in the boxes moves the thumbs back.
    minIn.addEventListener('change', function () { lo.value = minIn.value || MIN; paint(); });
    maxIn.addEventListener('change', function () { hi.value = maxIn.value || MAX; paint(); });
    paint();
  });

  /* Ticking a box applies the filter straight away — Baymard: apply changes
     immediately and show the result near the control. The submit button stays
     for the no-JS path and is hidden once we take over. */
  document.querySelectorAll('.js-filterform').forEach(function (form) {
    var btn = form.querySelector('.js-filter-submit');
    if (btn) btn.hidden = true;
    form.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
      cb.addEventListener('change', function () { form.submit(); });
    });
    form.querySelectorAll('.js-min, .js-max').forEach(function (i) {
      i.addEventListener('change', function () { form.submit(); });
    });
    // Dragging a slider should not fire a request per pixel.
    form.querySelectorAll('.zl-slider__input').forEach(function (r) {
      r.addEventListener('change', function () { form.submit(); });
    });
  });

  /* Category chip scroller. The track is a plain overflow container, so swipe
     and trackpad scrolling work with or without this; the arrows just make the
     overflow discoverable, and each hides when there is nothing that way. */
  document.querySelectorAll('.js-chipscroll').forEach(function (wrap) {
    var track = wrap.querySelector('.js-chiptrack');
    var prev = wrap.querySelector('.js-chip-prev');
    var next = wrap.querySelector('.js-chip-next');
    // A chip row may ship without arrows. Bailing out beats throwing: this
    // runs inside the shared init, so one null here used to take the
    // type-ahead and the favourite buttons down with it.
    if (!track || !prev || !next) return;
    function update() {
      var max = track.scrollWidth - track.clientWidth;
      // 2px of slack: sub-pixel layout leaves a stray fraction at each end.
      prev.hidden = track.scrollLeft <= 2;
      next.hidden = track.scrollLeft >= max - 2;
    }
    function page(dir) {
      track.scrollBy({ left: dir * Math.round(track.clientWidth * 0.8), behavior: 'smooth' });
    }
    prev.addEventListener('click', function () { page(-1); });
    next.addEventListener('click', function () { page(1); });
    var tick;
    track.addEventListener('scroll', function () {
      clearTimeout(tick); tick = setTimeout(update, 60);
    });
    window.addEventListener('resize', update);
    update();
  });

  /* Share. Native share sheet where the browser has one (phones, mostly),
     otherwise copy the link. Both need JavaScript and the clipboard needs a
     secure context, so the button is rendered hidden and revealed only once we
     know one of the two paths exists — a share button that silently fails is
     worse than none. */
  document.querySelectorAll('.js-share').forEach(function (btn) {
    var canShare = typeof navigator.share === 'function';
    var canCopy = !!(navigator.clipboard && navigator.clipboard.writeText);
    if (!canShare && !canCopy) return;
    btn.hidden = false;
    var label = btn.innerHTML;
    btn.addEventListener('click', function () {
      var url = location.href;
      if (canShare) {
        navigator.share({ title: btn.dataset.title, url: url }).catch(function () {});
        return;
      }
      navigator.clipboard.writeText(url).then(function () {
        btn.textContent = btn.dataset.copied;
        setTimeout(function () { btn.innerHTML = label; }, 1800);
      }).catch(function () {});
    });
  });

  /* Card carousels: arrows and dot state. The track scroll-snaps on its own, so
     swiping already works without any of this. */
  function initCards(root) {
  root.querySelectorAll('.js-cardslides').forEach(function (track) {
    var media = track.closest('.zl-card__media');
    var dots = media.querySelectorAll('.zl-card__dot');
    var prev = media.querySelector('.js-card-prev');
    var next = media.querySelector('.js-card-next');
    var n = track.children.length;
    /* The current slide is held here, not re-derived from scrollLeft on every
       click: during a smooth scroll scrollLeft still reports the old position,
       so two quick clicks compute the same index twice and the carousel stalls.
       Scroll events resync it, which covers swiping. */
    var cur = 0;
    function paint(i) {
      cur = i;
      dots.forEach(function (d, j) { d.classList.toggle('is-on', j === i); });
      /* No disabled state: the arrows are always live now that it loops. */
    }
    /* Wraps rather than clamping. Crossing the seam (last -> first, or first ->
       last) jumps instantly: scrolling smoothly across every slide to get there
       reads as a rewind, not as a wrap. Steps inside the run stay smooth. */
    function go(i) {
      var wrapped = ((i % n) + n) % n;
      var seam = Math.abs(wrapped - cur) > 1;
      paint(wrapped);
      track.scrollTo({ left: wrapped * track.clientWidth, behavior: seam ? 'auto' : 'smooth' });
    }
    // The arrows sit inside the card's stretched link, so stop the click from
    // also following it through to the listing page.
    function arm(btn, delta) {
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation(); go(cur + delta);
      });
    }
    arm(prev, -1); arm(next, 1);
    var tick;
    track.addEventListener('scroll', function () {
      clearTimeout(tick);
      tick = setTimeout(function () { paint(Math.round(track.scrollLeft / track.clientWidth)); }, 60);
    });
    paint(0);
  });

  /* Favourite toggle — the one bit of the site that talks JSON. */
  root.querySelectorAll('.js-fav').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (btn.dataset.busy) return;                  // two fast taps toggled it twice
      btn.dataset.busy = '1';
      var id = btn.dataset.id, lang = location.pathname.split('/')[1] || 'en';
      var was = btn.getAttribute('aria-pressed') === 'true';
      /* The listing's Save button carries a label, so the word has to follow
         the state; the card's heart is icon-only and has neither attribute. */
      var state = function (on) {
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        var span = btn.dataset.on && btn.querySelector('span');
        if (span) span.textContent = on ? btn.dataset.on : btn.dataset.off;
      };
      fetch('/' + lang + '/fav/' + id, { method: 'POST', credentials: 'same-origin' })
        .then(function (r) {
          if (r.status === 401) {
            location.href = '/' + lang + '/signin?next=' + encodeURIComponent(location.pathname + location.search);
            return null;
          }
          if (!r.ok) throw new Error(r.status);       // offline or 500: put the heart back
          return r.json();
        })
        .then(function (d) { if (d) state(d.on); })
        .catch(function () {
          state(was);
          /* Say so: the button quietly snapping back looked like it did nothing. */
          var toast = document.querySelector('.app-toast');
          if (toast) {
            toast.textContent = toast.dataset.fail; toast.hidden = false;
            clearTimeout(toast.zlTimer);
            toast.zlTimer = setTimeout(function () { toast.hidden = true; }, 4000);
          }
        })
        .then(function () { delete btn.dataset.busy; });
    });
  });

  /* Selects that submit their own form (sort, campus). These were inline
     onchange handlers — the reason the CSP needed 'unsafe-inline' for scripts. */
  root.querySelectorAll('.js-autosubmit').forEach(function (sel) {
    sel.addEventListener('change', function () { if (sel.form) sel.form.submit(); });
  });
  }
  initCards(document);

  /* In-place feed swaps. Category chips (marketplace), board links and sort
     tabs (community) replace only the results region instead of loading a new
     page, so the chip row keeps its scroll position and the selection stays
     where the user tapped it. They are all real links — without JavaScript, or
     with a modifier key (open in new tab), they navigate as before. The URL is
     kept in sync with pushState so back/forward, reload and sharing all land
     on the same view. */
  var region = document.querySelector('.js-feed-region');
  var chipTrack = document.querySelector('.js-chiptrack');
  if (region && window.fetch && window.DOMParser && history.pushState) {
    var inflight = null;
    var header = document.querySelector('.zl-header');
    var sameView = function (a, b) {
      return a.pathname === b.pathname &&
        a.searchParams.getAll('category').join() === b.searchParams.getAll('category').join();
    };
    var markNav = function (href) {
      var target = new URL(href, location.href);
      if (chipTrack) chipTrack.querySelectorAll('a.zl-chip').forEach(function (a) {
        a.setAttribute('aria-pressed', sameView(new URL(a.href, location.href), target) ? 'true' : 'false');
      });
      // sameView, not a pathname match: the Community switches boards by path,
      // but the Marketplace switches categories by query string, and comparing
      // paths alone marked every category in that rail as the current one.
      document.querySelectorAll('.js-swapnav a').forEach(function (a) {
        if (sameView(new URL(a.href, location.href), target)) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
    };
    var load = function (href, push) {
      if (inflight) inflight.abort();
      inflight = new AbortController();
      markNav(href);
      region.setAttribute('aria-busy', 'true');
      fetch(href, { signal: inflight.signal, credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (text) {
          var doc = new DOMParser().parseFromString(text, 'text/html');
          var next = doc.querySelector('.js-feed-region');
          if (!next) throw new Error('no region');
          region.innerHTML = next.innerHTML;
          if (doc.title) document.title = doc.title;
          if (push) history.pushState({ feed: true }, '', href);
          region.removeAttribute('aria-busy');
          initCards(region);
          // Switching boards from far down the page: bring the new list's
          // heading up under the sticky header instead of leaving you mid-list.
          var top = region.getBoundingClientRect().top, hh = header ? header.offsetHeight : 0;
          if (top < hh) window.scrollTo(0, window.scrollY + top - hh - 16);
        })
        .catch(function (e) {
          if (e && e.name === 'AbortError') return;
          location.href = href;             // anything unexpected: fall back to a normal load
        });
    };
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (!a) return;
      var isChip = chipTrack && chipTrack.contains(a) && a.classList.contains('zl-chip');
      var isSwap = a.classList.contains('js-swap') || !!a.closest('.js-swapnav');
      if (!isChip && !isSwap) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (a.getAttribute('aria-pressed') === 'true' || a.hasAttribute('aria-current')) return;
      load(a.href, true);
    });
    history.replaceState({ feed: true }, '', location.href);
    window.addEventListener('popstate', function (e) {
      if (e.state && e.state.feed) load(location.href, false);
    });
  }

  /* Community upvotes. The forms work on their own (the server redirects
     back); here they become an optimistic toggle that never reloads. Bound on
     the document so posts swapped in by the feed get it too. */
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.classList || !form.classList.contains('app-vote')) return;
    e.preventDefault();
    if (form.dataset.busy) return;
    var btn = form.querySelector('.js-vote'), n = form.querySelector('.js-vote-n');
    var was = btn.getAttribute('aria-pressed') === 'true', before = Number(n.textContent);
    btn.setAttribute('aria-pressed', was ? 'false' : 'true');
    n.textContent = before + (was ? -1 : 1);
    form.dataset.busy = '1';
    var undo = function () { btn.setAttribute('aria-pressed', was ? 'true' : 'false'); n.textContent = before; };
    fetch(form.action, {
      method: 'POST', credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)).toString(),
    })
      .then(function (r) {
        if (r.status === 401) {
          var lang = location.pathname.split('/')[1] || 'en';
          location.href = '/' + lang + '/signin?next=' + encodeURIComponent(location.pathname + location.search);
          return null;
        }
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (d) {
        if (!d) return;
        btn.setAttribute('aria-pressed', d.on ? 'true' : 'false');
        n.textContent = d.score;
      })
      .catch(undo)
      .then(function () { delete form.dataset.busy; });
  });

  /* The floating action button hides once the footer is on screen: at the end
     of the page there is nothing left to cover, and a button parked over the
     disclaimer looks like a mistake. On a listing it also stands down while
     the real "Message seller" button is on screen — two of the same action a
     thumb apart reads as a bug. */
  var fab = document.querySelector('.app-fab');
  var stand = [].slice.call(document.querySelectorAll('.app-footer, .js-fab-yield'));
  if (fab && stand.length && 'IntersectionObserver' in window) {
    var seen = [];
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var i = stand.indexOf(e.target);
        seen[i] = e.isIntersecting;
      });
      fab.classList.toggle('is-away', seen.indexOf(true) !== -1);
    }, { rootMargin: '0px 0px -8px 0px' });
    stand.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Header search type-ahead ----------
     Suggests what the box actually searches: listings and categories in the
     marketplace, posts and boards in the community, chapters and glossary
     terms in the guidebook. Everything is built with textContent, so a
     listing title can never inject markup into the dropdown.
     The field keeps working with JavaScript off — this only adds a list. */
  var sInput = document.querySelector('.js-searchinput');
  var sPanel = document.querySelector('.js-suggest');
  if (sInput && sPanel && window.fetch) {
    var sForm = sInput.closest('form');
    var sItems = [];          // the <a> elements currently listed
    var sActive = -1;
    var sPending = null;
    var sTimer = null;
    var lastQuery = null;

    function close() {
      sPanel.hidden = true; sPanel.textContent = '';
      sItems = []; sActive = -1;
      sInput.setAttribute('aria-expanded', 'false');
      sInput.removeAttribute('aria-activedescendant');
    }
    function highlight(el, text, term) {
      var at = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
      if (at === -1) { el.appendChild(document.createTextNode(text)); return; }
      el.appendChild(document.createTextNode(text.slice(0, at)));
      var b = document.createElement('b');
      b.textContent = text.slice(at, at + term.length);
      el.appendChild(b);
      el.appendChild(document.createTextNode(text.slice(at + term.length)));
    }
    function row(item, term, i) {
      var a = document.createElement('a');
      a.className = 'zl-suggest__item';
      a.id = 'sg-' + i;
      a.href = item.href;
      a.setAttribute('role', 'option');
      a.setAttribute('aria-selected', 'false');
      if (item.icon) {
        var ic = document.createElement('span');
        ic.setAttribute('aria-hidden', 'true');
        ic.textContent = item.icon;
        a.appendChild(ic);
      }
      var label = document.createElement('span');
      label.className = 'zl-truncate';
      highlight(label, item.label, term);
      a.appendChild(label);
      if (item.scope) {
        var sc = document.createElement('span');
        sc.className = 'zl-suggest__scope';
        sc.textContent = item.scope;
        a.appendChild(sc);
      }
      return a;
    }
    function paint(groups, term) {
      sPanel.textContent = '';
      sItems = []; sActive = -1;
      sInput.removeAttribute('aria-activedescendant');

      // First row always runs the plain search, so Enter and the mouse agree.
      var all = document.createElement('a');
      all.className = 'zl-suggest__item zl-suggest__item--all';
      all.id = 'sg-all';
      all.href = sForm.action + '?q=' + encodeURIComponent(term);
      all.setAttribute('role', 'option');
      all.setAttribute('aria-selected', 'false');
      all.textContent = (sInput.dataset.all || 'Search for “%s”').replace('%s', term);
      sPanel.appendChild(all);
      sItems.push(all);

      groups.forEach(function (g) {
        if (!g.items || !g.items.length) return;
        var head = document.createElement('div');
        head.className = 'zl-suggest__group zl-label';
        head.textContent = g.label;
        sPanel.appendChild(head);
        g.items.forEach(function (it) {
          var a = row(it, term, sItems.length);
          sPanel.appendChild(a);
          sItems.push(a);
        });
      });
      sPanel.hidden = false;
      sInput.setAttribute('aria-expanded', 'true');
    }
    function select(i) {
      if (sActive > -1 && sItems[sActive]) sItems[sActive].setAttribute('aria-selected', 'false');
      sActive = i;
      if (sActive > -1 && sItems[sActive]) {
        sItems[sActive].setAttribute('aria-selected', 'true');
        sInput.setAttribute('aria-activedescendant', sItems[sActive].id);
        sItems[sActive].scrollIntoView({ block: 'nearest' });
      } else {
        sInput.removeAttribute('aria-activedescendant');
      }
    }
    function ask() {
      var term = sInput.value.trim();
      if (term.length < 1) { lastQuery = null; close(); return; }
      if (term === lastQuery && !sPanel.hidden) return;
      lastQuery = term;
      if (sPending) sPending.abort();
      sPending = new AbortController();
      sInput.setAttribute('aria-busy', 'true');
      fetch(sInput.dataset.suggest + '?q=' + encodeURIComponent(term) +
            '&s=' + encodeURIComponent(sInput.dataset.section || 'market'),
            { signal: sPending.signal, credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : { groups: [] }; })
        .then(function (d) {
          if (sInput.value.trim() !== term) return;     // typed on while waiting
          paint(d.groups || [], term);
        })
        .catch(function () { /* offline or aborted: the plain search still works */ })
        .then(function () { sInput.removeAttribute('aria-busy'); });
    }

    sInput.addEventListener('input', function () {
      clearTimeout(sTimer);
      sTimer = setTimeout(ask, 140);                    // one request per pause, not per keystroke
    });
    sInput.addEventListener('focus', function () { if (sInput.value.trim()) ask(); });
    sInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); return; }
      if (sPanel.hidden || !sItems.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); select(sActive + 1 >= sItems.length ? 0 : sActive + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); select(sActive - 1 < 0 ? sItems.length - 1 : sActive - 1); }
      else if (e.key === 'Enter' && sActive > -1) { e.preventDefault(); sItems[sActive].click(); }
      else if (e.key === 'Tab') close();
    });
    // A click inside the sPanel is the anchor doing its job; anywhere else closes.
    document.addEventListener('pointerdown', function (e) {
      if (e.target.closest && (e.target.closest('.js-suggest') || e.target === sInput)) return;
      close();
    });
    sInput.addEventListener('blur', function () { setTimeout(close, 150); });
    if (sForm) sForm.addEventListener('submit', close);
  }

  /* Guidebook. Contents and glossary start collapsed on narrow screens (they
     are rendered open so they work without JavaScript). */
  var toc = document.querySelector('.js-toc'), gloss = document.querySelector('.js-gloss');
  var narrow = window.matchMedia('(max-width: 899px)');
  if (narrow.matches) { if (toc) toc.open = false; if (gloss && !document.querySelector('.js-gloss-filter').value) gloss.open = false; }

  var filter = document.querySelector('.js-gloss-filter');
  if (filter) {
    var items = document.querySelectorAll('.js-gloss-item');
    var none = document.querySelector('.js-gloss-none');
    var apply = function () {
      var v = filter.value.trim().toLowerCase(), shown = 0;
      items.forEach(function (it) {
        var ok = !v || it.dataset.text.indexOf(v) !== -1;
        it.hidden = !ok; if (ok) shown++;
      });
      if (none) none.hidden = shown !== 0;
    };
    filter.addEventListener('input', apply);
  }

  /* A term in the text shows its definition beside the text instead of
     jumping the page: scroll only the glossary list, and flash the entry. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.js-term');
    if (!a) return;
    var item = document.getElementById('g-' + a.dataset.term);
    if (!item) return;
    e.preventDefault();
    if (filter && filter.value) { filter.value = ''; filter.dispatchEvent(new Event('input')); }
    item.hidden = false;
    if (gloss) gloss.open = true;
    var list = item.closest('.js-gloss-list');
    if (!narrow.matches && list && list.scrollHeight > list.clientHeight) {
      list.scrollTop = item.offsetTop - list.offsetTop - 8;
    } else {
      item.scrollIntoView({ block: 'center' });
    }
    item.classList.remove('is-flash'); void item.offsetWidth; item.classList.add('is-flash');
    setTimeout(function () { item.classList.remove('is-flash'); }, 900);
  });

  /* Contents: mark the chapter currently on screen. */
  var tocLinks = document.querySelectorAll('.js-toc-link');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    tocLinks.forEach(function (l) { byId[l.getAttribute('href').slice(1)] = l; });
    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
      var first = null;
      document.querySelectorAll('.app-chapter').forEach(function (c) { if (!first && visible[c.id]) first = c.id; });
      if (!first) return;
      tocLinks.forEach(function (l) { l.removeAttribute('aria-current'); });
      if (byId[first]) byId[first].setAttribute('aria-current', 'true');
    }, { rootMargin: '-120px 0px -55% 0px' });
    document.querySelectorAll('.app-chapter').forEach(function (c) { io.observe(c); });
    tocLinks.forEach(function (l) {
      l.addEventListener('click', function () { if (narrow.matches && toc) toc.open = false; });
    });
  }

  /* On a full page load with a category already selected (reload, back from a
     listing, a shared link), bring the selected chip into view rather than
     leaving it hidden past the right edge. */
  if (chipTrack) {
    var on = chipTrack.querySelector('a.zl-chip[aria-pressed="true"]');
    if (on) {
      var l = on.getBoundingClientRect().left - chipTrack.getBoundingClientRect().left + chipTrack.scrollLeft;
      var r = l + on.offsetWidth;
      if (l < chipTrack.scrollLeft || r > chipTrack.scrollLeft + chipTrack.clientWidth)
        chipTrack.scrollLeft = l - 48;
      chipTrack.dispatchEvent(new Event('scroll'));
    }
  }

  document.querySelectorAll('.js-confirm').forEach(function (b) {
    b.addEventListener('click', function (e) { if (!confirm(b.dataset.msg)) e.preventDefault(); });
  });

  /* Gallery. The track already scroll-snaps, so this only adds arrows,
     thumbnails, a counter and keyboard paging on top of behaviour that
     already works without JavaScript. */
  document.querySelectorAll('.js-gallery').forEach(function (g) {
    var track = g.querySelector('.js-gallery-track');
    var slides = g.querySelectorAll('.zl-gallery__slide');
    var thumbs = g.querySelectorAll('.js-gallery-thumb');
    var count = g.querySelector('.js-gallery-count');
    var prev = g.querySelector('.js-gallery-prev');
    var next = g.querySelector('.js-gallery-next');
    if (!track || slides.length < 2) return;

    /* Same reason as the card carousel: hold the index, do not re-read
       scrollLeft mid-scroll. */
    var cur = 0;
    function index() { return cur; }
    var credits = g.querySelectorAll('.js-gallery-credit');
    function paint(i) {
      cur = i;
      if (count) count.textContent = (i + 1) + ' / ' + slides.length;
      /* One server-rendered credit per photo; show the current one. */
      credits.forEach(function (c, j) { c.hidden = j !== i || !c.firstElementChild; });
      thumbs.forEach(function (b, j) { b.setAttribute('aria-current', j === i ? 'true' : 'false'); });
      /* No disabled state: the arrows are always live now that it loops. */
    }
    /* Paint the new position immediately rather than waiting for the smooth
       scroll to settle — otherwise the counter lags a click behind the image. */
    /* Same wrap-instead-of-clamp as the card carousel; the seam jumps so it
       does not rewind through every photo. */
    function go(i) {
      var n = slides.length;
      var wrapped = ((i % n) + n) % n;
      var seam = Math.abs(wrapped - cur) > 1;
      paint(wrapped);
      track.scrollTo({ left: wrapped * track.clientWidth, behavior: seam ? 'auto' : 'smooth' });
    }
    function sync() { paint(Math.round(track.scrollLeft / track.clientWidth)); }
    var tick;
    track.addEventListener('scroll', function () { clearTimeout(tick); tick = setTimeout(sync, 60); });
    if (prev) prev.addEventListener('click', function () { go(index() - 1); });
    if (next) next.addEventListener('click', function () { go(index() + 1); });
    thumbs.forEach(function (b) {
      b.addEventListener('click', function () { go(Number(b.dataset.i)); });
    });
    g.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index() - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index() + 1); }
    });
    window.addEventListener('resize', sync);
    sync();
  });

  /* Photo upload: resize in the browser BEFORE upload — a 5 MB phone photo
     becomes ~200 KB before it touches the network (infrastructure.md 5.2). */
  var input = document.getElementById('photos');
  if (input) {
    var store = [], thumbs = document.getElementById('thumbs'), field = document.getElementById('imagesField');
    input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files, 0, 6 - store.length);
      files.forEach(function (file) {
        var img = new Image(), url = URL.createObjectURL(file);
        img.onload = function () {
          var max = 1600, s = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          var data = c.toDataURL('image/jpeg', 0.8);
          store.push(data); field.value = JSON.stringify(store);
          var th = new Image(); th.src = data; thumbs.appendChild(th);
          URL.revokeObjectURL(url);
        };
        img.src = url;
      });
    });
  }
})();
