(() => {
    let cleanupFlight = null;

    window.initializeButterflyVideoFlight = () => {
        if (cleanupFlight) cleanupFlight();

        const butterfly = document.querySelector(".flying-butterfly");
        const video = document.querySelector(".butterfly-video-source");
        if (!butterfly || !video) {
            cleanupFlight = null;
            return;
        }

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        const context = butterfly.getContext("2d", { willReadFrequently: true });

        if (!context) throw new Error("Could not create the butterfly video canvas.");

        let videoFrame = 0;
        let usingVideoFrameCallback = false;

        function renderVideoFrame() {
            if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

            if (butterfly.width !== video.videoWidth || butterfly.height !== video.videoHeight) {
                butterfly.width = video.videoWidth;
                butterfly.height = video.videoHeight;
            }

            context.drawImage(video, 0, 0, butterfly.width, butterfly.height);
            const frame = context.getImageData(0, 0, butterfly.width, butterfly.height);
            for (let index = 0; index < frame.data.length; index += 4) {
                const brightness = Math.max(frame.data[index], frame.data[index + 1], frame.data[index + 2]);
                frame.data[index + 3] = brightness <= 3
                    ? 0
                    : Math.min(255, Math.round((brightness - 3) * 8));
            }
            context.putImageData(frame, 0, 0);
        }

        function cancelVideoFrame() {
            if (!videoFrame) return;
            if (usingVideoFrameCallback) video.cancelVideoFrameCallback(videoFrame);
            else window.cancelAnimationFrame(videoFrame);
            videoFrame = 0;
        }

        function scheduleVideoFrame() {
            if (video.paused || videoFrame || reducedMotion.matches) return;

            if (video.requestVideoFrameCallback) {
                usingVideoFrameCallback = true;
                videoFrame = video.requestVideoFrameCallback(() => {
                    videoFrame = 0;
                    renderVideoFrame();
                    scheduleVideoFrame();
                });
                return;
            }

            usingVideoFrameCallback = false;
            videoFrame = window.requestAnimationFrame(() => {
                videoFrame = 0;
                renderVideoFrame();
                scheduleVideoFrame();
            });
        }

        function handleMotionPreferenceChange() {
            if (reducedMotion.matches) {
                video.autoplay = false;
                video.pause();
                cancelVideoFrame();
                if (Number.isFinite(video.duration) && video.duration > 0) {
                    video.currentTime = video.duration * 0.5;
                }
                video.pause();
                butterfly.style.transform = "";
                renderVideoFrame();
                return;
            }

            video.autoplay = true;
            butterfly.style.removeProperty("transform");
            video.play().then(scheduleVideoFrame).catch((error) => {
                if (error.name !== "NotAllowedError") {
                    console.error("Butterfly video could not play.", error);
                }
            });
        }

        function handleVisibilityChange() {
            if (document.hidden) {
                cancelVideoFrame();
                return;
            }
            handleMotionPreferenceChange();
        }

        cleanupFlight = () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            reducedMotion.removeEventListener?.("change", handleMotionPreferenceChange);
            video.removeEventListener("loadeddata", renderVideoFrame);
            video.removeEventListener("loadeddata", scheduleVideoFrame);
            video.removeEventListener("seeked", renderVideoFrame);
            video.removeEventListener("play", scheduleVideoFrame);
            cancelVideoFrame();
            video.pause();
        };

        video.addEventListener("loadeddata", renderVideoFrame);
        video.addEventListener("loadeddata", scheduleVideoFrame);
        video.addEventListener("seeked", renderVideoFrame);
        video.addEventListener("play", scheduleVideoFrame);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        reducedMotion.addEventListener?.("change", handleMotionPreferenceChange);

        if (reducedMotion.matches) handleMotionPreferenceChange();
        else {
            video.play().then(scheduleVideoFrame).catch((error) => {
                if (error.name !== "NotAllowedError") {
                    console.error("Butterfly video could not play.", error);
                }
            });
        }
    };

    window.initializeButterflyVideoFlight();
})();
