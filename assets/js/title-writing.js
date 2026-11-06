(() => {
    let observer = null;

    window.initializeTitleWriting = () => {
        if (observer) observer.disconnect();
        observer = null;

        if (
            !document.documentElement.classList.contains("wedding-home") ||
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) return;

        const sections = document.querySelectorAll(".ceremony-reels .event-section");
        const writeTitles = (section) => {
            section.querySelectorAll(".event-title").forEach((title, index) => {
                if (title.querySelector(".event-title-writing-text")) return;

                const text = title.textContent.trim();
                const writingText = document.createElement("span");
                writingText.className = "event-title-writing-text";
                while (title.firstChild) writingText.append(title.firstChild);
                title.append(writingText);

                const duration = Math.min(7.5, Math.max(2.4, Array.from(text).length * 0.35));
                title.style.setProperty("--title-writing-duration", `${duration}s`);
                title.style.setProperty("--title-writing-delay", `${index * 0.35}s`);
                title.classList.add("is-writing");
                writingText.addEventListener("animationend", () => {
                    title.classList.remove("is-writing");
                }, { once: true });
            });
        };

        if (!("IntersectionObserver" in window)) {
            sections.forEach(writeTitles);
            return;
        }

        observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                observer.unobserve(entry.target);
                writeTitles(entry.target);
            });
        }, { threshold: 0.3 });

        sections.forEach((section) => observer.observe(section));
    };

    window.initializeTitleWriting();
})();
