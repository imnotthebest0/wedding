(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Only enable choreography when the user allows motion. */
    if (!reduceMotion && 'IntersectionObserver' in window) {
        document.documentElement.classList.add('motion');
    } else {
        return;
    }

    /* ------------------------------------------------------------------
       Reveal-on-scroll
       ------------------------------------------------------------------ */
    var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    var staggerContainers = Array.prototype.slice.call(document.querySelectorAll('.stagger'));

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var el = entry.target;
            el.classList.add('is-inview');
            observer.unobserve(el);
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -8% 0px'
    });

    revealEls.forEach(function (el) { observer.observe(el); });
    staggerContainers.forEach(function (container) {
        Array.prototype.forEach.call(container.children, function (child, i) {
            child.style.setProperty('--stagger-index', i);
        });
        observer.observe(container);
    });

    /* ------------------------------------------------------------------
       Smooth scrolling for in-page anchor links (better mobile feel)
       ------------------------------------------------------------------ */
    document.addEventListener('click', function (e) {
        var anchor = e.target.closest('a[href^="#"]');
        if (!anchor) return;
        var id = anchor.getAttribute('href').slice(1);
        if (!id) return;
        var target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        history.pushState(null, '', '#' + id);
    });
})();
