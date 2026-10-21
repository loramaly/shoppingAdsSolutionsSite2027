/* ==========================================================================
   NAVIGATION
   - Sticky header gets a background after the first scroll
   - "Chapters" / hamburger button opens and closes the chapter menu
   - The current chapter is tracked while scrolling and shown in the header,
     the menu and the side rail (aria-current="true")
   ========================================================================== */
(function () {
  'use strict';

  var header = document.getElementById('site-header');
  var toggle = header.querySelector('.menu-toggle');
  var menu = document.getElementById('site-menu');
  var backdrop = document.querySelector('.site-menu-backdrop');
  var chapterNum = header.querySelector('[data-chapter-num]');
  var chapterName = header.querySelector('[data-chapter-name]');

  var menuLinks = [].slice.call(menu.querySelectorAll('a[href^="#ch-"]'));
  var railNav = document.querySelector('.rail');
  var railLinks = [].slice.call(document.querySelectorAll('.rail a'));

  /* ---------- Menu open / close ---------- */
  function isOpen() {
    return toggle.getAttribute('aria-expanded') === 'true';
  }

  function openMenu() {
    toggle.setAttribute('aria-expanded', 'true');
    header.classList.add('is-open');
    document.body.classList.add('menu-open');
    backdrop.hidden = false;
    // Move focus to the current chapter (or the first link) for keyboard users
    var current = menu.querySelector('[aria-current="true"]') || menuLinks[0];
    if (current) current.focus({ preventScroll: true });
  }

  function closeMenu(returnFocus) {
    toggle.setAttribute('aria-expanded', 'false');
    header.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    backdrop.hidden = true;
    if (returnFocus) toggle.focus();
  }

  toggle.addEventListener('click', function () {
    if (isOpen()) closeMenu(false);
    else openMenu();
  });

  // Any link inside the menu closes it (the browser then jumps to the anchor)
  menu.addEventListener('click', function (event) {
    if (event.target.closest('a')) closeMenu(false);
  });

  backdrop.addEventListener('click', function () {
    closeMenu(true);
  });

  document.addEventListener('keydown', function (event) {
    if (!isOpen()) return;

    if (event.key === 'Escape') {
      closeMenu(true);
      return;
    }

    // Keep Tab inside the header while the menu is open
    if (event.key === 'Tab') {
      var focusable = [toggle].concat([].slice.call(menu.querySelectorAll('a')));
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  // Close the mobile sheet if the window grows past the phone layout
  window.matchMedia('(min-width: 768px)').addEventListener('change', function () {
    if (isOpen()) closeMenu(false);
  });

  /* ---------- Current chapter ---------- */
  var chapters = menuLinks.map(function (link, index) {
    return {
      id: link.getAttribute('href').slice(1),
      num: ('0' + (index + 1)).slice(-2),
      name: link.lastChild.textContent.trim()
    };
  });

  var currentId = null;

  function setCurrent(id) {
    if (id === currentId) return;
    currentId = id;

    menuLinks.concat(railLinks).forEach(function (link) {
      if (link.getAttribute('href') === '#' + id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });

    // Rail: mark chapters above the current one as already read
    var currentIndex = chapters.map(function (c) { return c.id; }).indexOf(id);
    railLinks.forEach(function (link, i) {
      link.classList.toggle('is-past', i < currentIndex);
    });

    var chapter = chapters.filter(function (c) { return c.id === id; })[0];
    if (chapter) {
      chapterNum.textContent = chapter.num;
      chapterName.textContent = chapter.name;
    }
  }

  function update() {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
    railNav && railNav.classList.toggle('is-visible', window.scrollY > 8);

    // The chapter whose top has passed 40% of the viewport is the current one
    var line = window.innerHeight * 0.4;
    var current = chapters[0].id;
    chapters.forEach(function (chapter) {
      var el = document.getElementById(chapter.id);
      if (el && el.getBoundingClientRect().top < line) current = chapter.id;
    });
    setCurrent(current);
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      update();
    });
  }, { passive: true });

  window.addEventListener('resize', update);
  update();
})();
