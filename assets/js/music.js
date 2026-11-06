(() => {
    const databaseName = "animesh-arpita-wedding";
    const databaseVersion = 1;
    const storeName = "music";
    const recordId = "selected-track";
    const musicElement = document.querySelector("#wedding-music");
    const defaultMusicUrl = musicElement
        ? musicElement.getAttribute("src")
        : "assets/audio/wedding-shehnai.mp3";
    const musicStartTime = 10;
    let musicNotesTimeout = null;

    function initializeMusicNotes() {
        const notes = document.querySelector(".music-notes");
        if (musicNotesTimeout !== null) {
            window.clearTimeout(musicNotesTimeout);
            musicNotesTimeout = null;
        }
        if (!notes) return;

        const colors = ["#b8324e", "#d4af37", "#628b55", "#8b5aa5", "#e58b32", "#398da3"];
        const positions = [
            { startLift: "-8px", lift: "-180px" },
            { startLift: "0px", lift: "0px" },
            { startLift: "8px", lift: "180px" }
        ];
        const emissionOrder = [0, 2, 1];
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let batch = 0;

        function emitNote(step) {
            if (!notes.isConnected) {
                musicNotesTimeout = null;
                return;
            }

            const index = emissionOrder[step];
            const position = positions[index];
            const note = document.createElement("span");
            note.textContent = "𝄞";
            note.style.setProperty("--note-color", colors[(batch * positions.length + index) % colors.length]);
            note.style.setProperty("--note-start-lift", position.startLift);
            note.style.setProperty("--note-lift", position.lift);
            note.addEventListener("animationend", () => note.remove(), { once: true });
            notes.append(note);

            if (step < emissionOrder.length - 1) {
                musicNotesTimeout = window.setTimeout(() => emitNote(step + 1), step === 0 ? 2000 : 4000);
                return;
            }

            batch += 1;
            musicNotesTimeout = window.setTimeout(() => emitNote(0), 500);
        }

        if (reducedMotion) {
            positions.forEach((_, index) => {
                const note = document.createElement("span");
                note.textContent = "𝄞";
                note.style.setProperty("--note-color", colors[index]);
                note.style.setProperty("--note-start-lift", positions[index].startLift);
                note.style.setProperty("--note-lift", positions[index].lift);
                notes.append(note);
            });
            return;
        }

        emitNote(0);
    }

    function seekToMusicStart(player) {
        if (Number.isFinite(player.duration) && player.duration > musicStartTime) {
            player.currentTime = musicStartTime;
        }
    }

    function waitForMetadata(player) {
        if (player.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();

        return new Promise((resolve, reject) => {
            function cleanup() {
                player.removeEventListener("loadedmetadata", onLoadedMetadata);
                player.removeEventListener("error", onError);
            }

            function onLoadedMetadata() {
                cleanup();
                resolve();
            }

            function onError() {
                cleanup();
                reject(player.error || new Error("Could not load music metadata."));
            }

            player.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
            player.addEventListener("error", onError, { once: true });
        });
    }

    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(databaseName, databaseVersion);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(storeName)) {
                    request.result.createObjectStore(storeName, { keyPath: "id" });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error("Could not open music storage."));
        });
    }

    async function readTrack() {
        const database = await openDatabase();
        return new Promise((resolve, reject) => {
            const request = database.transaction(storeName, "readonly").objectStore(storeName).get(recordId);
            request.onsuccess = () => {
                database.close();
                resolve(request.result || null);
            };
            request.onerror = () => {
                database.close();
                reject(request.error || new Error("Could not read saved music."));
            };
        });
    }

    async function writeTrack(track) {
        const database = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(storeName, "readwrite");
            transaction.objectStore(storeName).put(track);
            transaction.oncomplete = () => {
                database.close();
                resolve();
            };
            transaction.onerror = () => {
                database.close();
                reject(transaction.error || new Error("Could not save music."));
            };
            transaction.onabort = () => {
                database.close();
                reject(transaction.error || new Error("Music saving was cancelled."));
            };
        });
    }

    async function deleteTrack() {
        const database = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction(storeName, "readwrite");
            transaction.objectStore(storeName).delete(recordId);
            transaction.oncomplete = () => {
                database.close();
                resolve();
            };
            transaction.onerror = () => {
                database.close();
                reject(transaction.error || new Error("Could not remove saved music."));
            };
        });
    }

    function initializePlayer() {
        const player = document.querySelector("#wedding-music");
        const status = document.querySelector("#music-player-status");
        const playerContainer = document.querySelector("#persistent-music-player");
        if (!player) return;
        let repeatTrack = true;
        let playerConfigured = false;
        let gesturePlaybackPending = false;
        let startButton = null;
        let currentTrackId = null;
        let restoredPlaybackPosition = false;
        let playbackStorageAvailable = true;
        const playbackStorageKey = `${databaseName}-playback`;

        function readPlaybackState() {
            if (!playbackStorageAvailable) return null;
            try {
                const state = JSON.parse(sessionStorage.getItem(playbackStorageKey) || "null");
                if (
                    !state ||
                    typeof state.trackId !== "string" ||
                    !Number.isFinite(state.currentTime) ||
                    !Number.isFinite(state.savedAt) ||
                    typeof state.wasPlaying !== "boolean"
                ) return null;
                return state;
            } catch (error) {
                playbackStorageAvailable = false;
                console.error("Could not read the saved music position.", error);
                return null;
            }
        }

        function savePlaybackState() {
            if (!playbackStorageAvailable || !currentTrackId || player.ended || !Number.isFinite(player.currentTime)) return;
            try {
                sessionStorage.setItem(playbackStorageKey, JSON.stringify({
                    trackId: currentTrackId,
                    currentTime: player.currentTime,
                    savedAt: Date.now(),
                    wasPlaying: !player.paused && !player.ended
                }));
            } catch (error) {
                playbackStorageAvailable = false;
                console.error("Could not save the music position.", error);
            }
        }

        function restorePlaybackState() {
            const state = readPlaybackState();
            if (!state || state.trackId !== currentTrackId) return false;

            let position = state.currentTime;
            if (state.wasPlaying) position += Math.min(30, Math.max(0, Date.now() - state.savedAt) / 1000);
            if (repeatTrack && Number.isFinite(player.duration) && player.duration > musicStartTime) {
                position = musicStartTime + ((position - musicStartTime) % (player.duration - musicStartTime));
            } else if (Number.isFinite(player.duration)) {
                position = Math.min(position, player.duration);
            }

            player.currentTime = Math.max(0, position);
            restoredPlaybackPosition = true;
            return state.wasPlaying;
        }

        function showStartButton() {
            if (!playerContainer || startButton) return;
            startButton = document.createElement("button");
            startButton.type = "button";
            startButton.className = "music-start-button";
            startButton.textContent = restoredPlaybackPosition ? "Resume wedding music" : "Start wedding music";
            startButton.addEventListener("click", startFromUserGesture);
            playerContainer.insertBefore(startButton, status || null);
        }

        function handlePlaybackError(error) {
            if (error.name === "NotAllowedError") {
                if (status) status.textContent = "Your browser blocked autoplay. Tap anywhere or use the button to start the wedding music.";
                showStartButton();
                return;
            }
            console.error(error);
            if (status) status.textContent = "Music could not start. Please try again.";
        }

        function startFromUserGesture() {
            if (!playerConfigured || !player.paused || gesturePlaybackPending) return;
            gesturePlaybackPending = true;
            try {
                if (!restoredPlaybackPosition && player.readyState >= HTMLMediaElement.HAVE_METADATA) {
                    seekToMusicStart(player);
                }
                const playback = player.play();
                if (!playback || typeof playback.then !== "function") {
                    gesturePlaybackPending = false;
                    if (status) status.textContent = "";
                    if (startButton) startButton.remove();
                    startButton = null;
                    return;
                }
                playback.then(() => {
                    gesturePlaybackPending = false;
                    if (status) status.textContent = "";
                    if (startButton) startButton.remove();
                    startButton = null;
                }).catch((error) => {
                    gesturePlaybackPending = false;
                    handlePlaybackError(error);
                });
            } catch (error) {
                gesturePlaybackPending = false;
                handlePlaybackError(error);
            }
        }

        async function startPlayback() {
            try {
                await waitForMetadata(player);
                const shouldResume = restorePlaybackState();
                if (!restoredPlaybackPosition) seekToMusicStart(player);
                if (restoredPlaybackPosition && !shouldResume) {
                    showStartButton();
                    return;
                }
                await player.play();
                if (status) status.textContent = "";
                if (startButton) startButton.remove();
                startButton = null;
            } catch (error) {
                handlePlaybackError(error);
            }
        }

        document.addEventListener("pointerdown", startFromUserGesture, { capture: true });
        player.addEventListener("timeupdate", savePlaybackState);
        player.addEventListener("play", savePlaybackState);
        player.addEventListener("pause", savePlaybackState);
        window.addEventListener("pagehide", savePlaybackState);

        readTrack().then((track) => {
            if (track) {
                currentTrackId = "saved-track";
                player.src = URL.createObjectURL(track.audio);
                player.volume = track.volume;
                repeatTrack = track.repeat;
            } else {
                currentTrackId = "default-track";
                player.src = defaultMusicUrl;
                player.volume = 0.7;
                repeatTrack = true;
            }
            player.loop = false;
            player.load();
            playerConfigured = true;
            return startPlayback();
        }).catch((error) => {
            console.error(error);
            currentTrackId = "default-track";
            player.src = defaultMusicUrl;
            player.volume = 0.7;
            repeatTrack = true;
            player.loop = false;
            player.load();
            playerConfigured = true;
            if (status) status.textContent = "Saved music could not be loaded. Playing the default shehnai track.";
            return startPlayback();
        });

        player.addEventListener("ended", () => {
            if (!repeatTrack) return;
            seekToMusicStart(player);
            startPlayback();
        });
    }

    function initializeSettings() {
        const fileInput = document.querySelector("#music-file");
        if (!fileInput) return;

        const preview = document.querySelector("#music-preview");
        const volume = document.querySelector("#music-volume");
        const volumeValue = document.querySelector("#music-volume-value");
        const repeat = document.querySelector("#music-repeat");
        const saveButton = document.querySelector("#save-music");
        const clearButton = document.querySelector("#clear-music");
        const status = document.querySelector("#music-settings-status");
        let selectedTrack = null;
        let previewUrl = null;

        function setPreview(track) {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = URL.createObjectURL(track.audio);
            preview.src = previewUrl;
            preview.addEventListener("loadedmetadata", () => seekToMusicStart(preview), { once: true });
            preview.volume = track.volume;
            preview.loop = track.repeat;
            preview.hidden = false;
            volume.value = String(Math.round(track.volume * 100));
            volumeValue.value = `${volume.value}%`;
            repeat.checked = track.repeat;
            selectedTrack = { audio: track.audio, name: track.name };
            saveButton.disabled = false;
        }

        async function loadDefaultTrack() {
            const response = await fetch(defaultMusicUrl);
            if (!response.ok) throw new Error(`Could not load default music (${response.status}).`);
            setPreview({
                audio: await response.blob(),
                name: "Wedding Shehnai — Ustad Bismillah Khan",
                volume: 0.7,
                repeat: true
            });
        }

        fileInput.addEventListener("change", () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            setPreview({ audio: file, name: file.name, volume: Number(volume.value) / 100, repeat: repeat.checked });
            status.textContent = `Selected track: ${file.name}`;
        });

        volume.addEventListener("input", () => {
            volumeValue.value = `${volume.value}%`;
            preview.volume = Number(volume.value) / 100;
        });

        repeat.addEventListener("change", () => {
            preview.loop = repeat.checked;
        });

        saveButton.addEventListener("click", async () => {
            if (!selectedTrack) {
                status.textContent = "Choose an audio file before saving.";
                return;
            }
            saveButton.disabled = true;
            status.textContent = "Saving music…";
            try {
                await writeTrack({
                    id: recordId,
                    audio: selectedTrack.audio,
                    name: selectedTrack.name,
                    volume: Number(volume.value) / 100,
                    repeat: repeat.checked
                });
                clearButton.hidden = false;
                status.textContent = "Music saved. Return to the invitation page to listen.";
            } catch (error) {
                console.error(error);
                status.textContent = "Music could not be saved. Please try again.";
            } finally {
                saveButton.disabled = false;
            }
        });

        clearButton.addEventListener("click", async () => {
            clearButton.disabled = true;
            try {
                await deleteTrack();
                selectedTrack = null;
                preview.pause();
                preview.removeAttribute("src");
                preview.load();
                preview.hidden = true;
                fileInput.value = "";
                clearButton.hidden = true;
                await loadDefaultTrack();
                status.textContent = "Saved music removed. The default shehnai track is selected.";
            } catch (error) {
                console.error(error);
                status.textContent = "Saved music could not be removed. Please try again.";
            } finally {
                clearButton.disabled = false;
            }
        });

        readTrack().then(async (track) => {
            if (!track) {
                await loadDefaultTrack();
                status.textContent = "The default shehnai track is selected. Choose another audio file if you prefer.";
                return;
            }
            setPreview(track);
            clearButton.hidden = false;
            status.textContent = `Saved track: ${track.name}`;
        }).catch((error) => {
            console.error(error);
            loadDefaultTrack().then(() => {
                status.textContent = "Saved music could not be loaded. The default shehnai track is selected.";
            }).catch((defaultError) => {
                console.error(defaultError);
                status.textContent = "Neither the saved nor default music could be loaded.";
            });
        });
    }

    function initializeNavigation() {
        if (window.location.protocol === "file:") return;

        async function initializeButterflyFlight(url) {
            if (typeof window.initializeButterflyVideoFlight === "function") {
                window.initializeButterflyVideoFlight();
                return;
            }
            if (!document.documentElement.classList.contains("wedding-home")) return;

            await new Promise((resolve, reject) => {
                const script = document.createElement("script");
                script.src = new URL("assets/js/butterfly-video-flight.js", url).href;
                script.addEventListener("load", resolve, { once: true });
                script.addEventListener("error", () => {
                    reject(new Error("Could not load the butterfly animation."));
                }, { once: true });
                document.head.append(script);
            });
        }

        async function renderPage(url, addHistoryEntry) {
            const response = await fetch(url.href);
            if (!response.ok) throw new Error(`Could not load page (${response.status}).`);

            const nextDocument = new DOMParser().parseFromString(await response.text(), "text/html");
            const playerContainer = document.querySelector("#persistent-music-player");
            if (!nextDocument.body || !playerContainer) {
                throw new Error("The requested page is missing its shared music player.");
            }

            const requiredStylesheets = new Set(
                Array.from(nextDocument.querySelectorAll('link[rel="stylesheet"][href]'), (link) =>
                    new URL(link.getAttribute("href"), url).href
                )
            );

            for (const link of document.head.querySelectorAll('link[rel="stylesheet"][href]')) {
                if (new URL(link.href).origin === window.location.origin && !requiredStylesheets.has(link.href)) {
                    link.remove();
                }
            }

            for (const stylesheetUrl of requiredStylesheets) {
                if (!Array.from(document.head.querySelectorAll('link[rel="stylesheet"][href]')).some((link) => link.href === stylesheetUrl)) {
                    const link = document.createElement("link");
                    link.rel = "stylesheet";
                    link.href = stylesheetUrl;
                    document.head.append(link);
                }
            }

            const pageContent = Array.from(nextDocument.body.childNodes)
                .filter((node) =>
                    !(node instanceof Element && (node.id === "persistent-music-player" || node.tagName === "SCRIPT"))
                )
                .map((node) => document.importNode(node, true));

            document.title = nextDocument.title;
            document.documentElement.lang = nextDocument.documentElement.lang;
            document.documentElement.className = nextDocument.documentElement.className;
            document.body.className = nextDocument.body.className;
            document.body.replaceChildren(...pageContent, playerContainer);
            initializeMusicNotes();
            window.initializeTitleWriting?.();
            await initializeButterflyFlight(url);
            if (addHistoryEntry) history.pushState({}, "", url.href);
            initializeSettings();

            if (url.hash) {
                document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView();
            } else {
                window.scrollTo(0, 0);
            }
        }

        document.addEventListener("click", (event) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            if (!(event.target instanceof Element)) return;

            const link = event.target.closest("a[href]");
            if (!(link instanceof HTMLAnchorElement) || link.target && link.target !== "_self" || link.hasAttribute("download")) return;

            const url = new URL(link.href, window.location.href);
            if (url.origin !== window.location.origin || !url.pathname.toLowerCase().endsWith(".html")) return;
            if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;

            event.preventDefault();
            renderPage(url, true).catch((error) => {
                console.error(error);
                const status = document.querySelector("#music-player-status");
                if (status) status.textContent = "The page could not be opened. Please try again.";
            });
        });

        window.addEventListener("popstate", () => {
            renderPage(new URL(window.location.href), false).catch((error) => {
                console.error(error);
                const status = document.querySelector("#music-player-status");
                if (status) status.textContent = "The page could not be opened. Please try again.";
            });
        });
    }

    initializeMusicNotes();
    initializePlayer();
    initializeSettings();
    initializeNavigation();
})();
