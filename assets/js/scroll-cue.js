(function () {
    const scrollableElements = Array.from(document.querySelectorAll('body *')).filter((element) => {
        const overflowY = window.getComputedStyle(element).overflowY;
        return (overflowY === 'auto' || overflowY === 'scroll') && element.scrollHeight > element.clientHeight;
    });

    function updateScrollCue() {
        const documentAtEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
        const scrollableElementAtEnd = scrollableElements.some((element) =>
            element.scrollTop + element.clientHeight >= element.scrollHeight - 2
        );

        document.body.classList.toggle('scroll-cue-hidden', documentAtEnd || scrollableElementAtEnd);
    }

    window.addEventListener('scroll', updateScrollCue, { passive: true });
    window.addEventListener('resize', updateScrollCue);
    scrollableElements.forEach((element) => element.addEventListener('scroll', updateScrollCue, { passive: true }));
    updateScrollCue();
})();
