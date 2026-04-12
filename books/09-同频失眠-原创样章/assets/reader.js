const toggleButton = document.getElementById("toggleOriginal");
    const exerciseButtons = Array.from(document.querySelectorAll("#toggleExercise, [data-exercise-toggle]"));
    const readerSection = document.querySelector(".reader");
    const exerciseMilestoneState = {
      total: 0,
      completed: 0,
      triggered: new Set(),
      activePopup: null,
      hideTimer: null,
    };
    const synth = window.speechSynthesis;
    const vocabNodes = Array.from(document.querySelectorAll(".vocab"));
    const paragraphCards = Array.from(document.querySelectorAll(".paragraph-card"));
    const englishVoicePattern = /en(-|_|$)/i;
    const pronunciationAudio = new Audio();
    const audioWarmers = new Map();
    const silentAudioSrc = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
    let activeNode = null;
    let audioUnlocked = false;
    let unlockPromise = null;
    let fallbackTimer = null;
    let playbackStartTimer = null;
    let playbackRequestId = 0;
    let lastTouchPlaybackAt = 0;
    let openGlossNode = null;

    pronunciationAudio.preload = "auto";
    pronunciationAudio.playsInline = true;
    pronunciationAudio.setAttribute("playsinline", "");

    injectExerciseStyles();
    wireOriginalToggle();
    wirePronunciation();
    buildExercisePanes();
    wireExerciseToggle();

    function injectExerciseStyles() {
      const style = document.createElement("style");
      style.textContent = `
        .reader-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .toggle-secondary {
          background: rgba(255, 252, 247, 0.92);
          color: var(--accent);
          border: 1px solid rgba(117, 86, 58, 0.14);
          box-shadow: none;
        }
        .exercise-popup {
          position: fixed;
          inset: 50% auto auto 50%;
          transform: translate(-50%, -50%) scale(0.96);
          width: min(420px, calc(100vw - 32px));
          padding: 22px 22px 20px;
          border-radius: 24px;
          background: rgba(255, 250, 242, 0.98);
          border: 1px solid rgba(117, 86, 58, 0.18);
          box-shadow: 0 24px 60px rgba(52, 33, 14, 0.2);
          z-index: 50;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.22s ease, transform 0.22s ease;
        }
        .exercise-popup.is-visible {
          opacity: 1;
          pointer-events: auto;
          transform: translate(-50%, -50%) scale(1);
        }
        .exercise-popup-tag {
          display: inline-block;
          margin-bottom: 10px;
          color: var(--accent);
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .exercise-popup-copy {
          margin: 0;
          color: var(--ink);
          font-size: 20px;
          line-height: 1.6;
        }
        .exercise-popup-close {
          margin-top: 14px;
          border: 0;
          border-radius: 999px;
          background: linear-gradient(135deg, #8b2e1d, #b55a30);
          color: #fff8ef;
          padding: 9px 15px;
          font: inherit;
          cursor: pointer;
        }
        .exercise-pane {
          display: none;
          margin-top: 14px;
          padding: 16px;
          border-radius: 18px;
          background: rgba(255, 250, 242, 0.94);
          border: 1px solid rgba(117, 86, 58, 0.12);
          gap: 12px;
        }
        body.exercise-mode .processed,
        body.exercise-mode .original {
          display: none;
        }
        body.exercise-mode .exercise-pane {
          display: grid;
        }
        .exercise-label {
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .exercise-sentence {
          font-size: 18px;
          line-height: 1.95;
          color: var(--ink);
        }
        .exercise-blank {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 7.2em;
          min-height: 2.2em;
          margin: 0 0.16em;
          padding: 0 0.7em;
          border-radius: 999px;
          border: 1px dashed rgba(139, 46, 29, 0.44);
          background: rgba(255, 255, 255, 0.84);
          color: var(--accent);
          font: inherit;
          vertical-align: baseline;
        }
        .exercise-blank.is-active {
          box-shadow: 0 0 0 2px rgba(139, 46, 29, 0.14);
          border-style: solid;
        }
        .exercise-blank.is-correct {
          border-style: solid;
          border-color: rgba(55, 120, 72, 0.48);
          background: rgba(229, 244, 233, 0.98);
          color: #245334;
        }
        .exercise-blank.is-wrong,
        .exercise-token.is-wrong {
          animation: shake .26s linear;
        }
        .exercise-bank {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .exercise-token {
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid rgba(117, 86, 58, 0.14);
          background: rgba(255, 255, 255, 0.92);
          color: var(--ink);
          font: inherit;
          cursor: pointer;
        }
        .exercise-token.is-selected {
          border-color: rgba(139, 46, 29, 0.52);
          box-shadow: 0 0 0 2px rgba(139, 46, 29, 0.12);
          color: var(--accent);
        }
        .exercise-token.is-used {
          opacity: 0.42;
          cursor: default;
          text-decoration: line-through;
        }
        .exercise-footer {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        .exercise-reset {
          border: 1px solid rgba(117, 86, 58, 0.14);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
          color: var(--ink);
          padding: 8px 14px;
          font: inherit;
          cursor: pointer;
        }
        .exercise-status {
          color: var(--muted);
          font-size: 14px;
        }
        .exercise-status.is-error {
          color: var(--accent);
          font-weight: 700;
        }
        .exercise-status.is-complete {
          color: #245334;
          font-weight: 700;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
      `;
      document.head.appendChild(style);
    }

    function ensureExercisePopup() {
      if (exerciseMilestoneState.activePopup) {
        return exerciseMilestoneState.activePopup;
      }
      const popup = document.createElement("section");
      popup.className = "exercise-popup";

      const tag = document.createElement("div");
      tag.className = "exercise-popup-tag";
      tag.textContent = "Practice Milestone";

      const copy = document.createElement("p");
      copy.className = "exercise-popup-copy";

      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "exercise-popup-close";
      closeButton.textContent = "继续练习";
      closeButton.addEventListener("click", () => {
        hideExercisePopup();
      });

      popup.appendChild(tag);
      popup.appendChild(copy);
      popup.appendChild(closeButton);
      document.body.appendChild(popup);

      exerciseMilestoneState.activePopup = popup;
      return popup;
    }

    function hideExercisePopup() {
      if (exerciseMilestoneState.hideTimer) {
        window.clearTimeout(exerciseMilestoneState.hideTimer);
        exerciseMilestoneState.hideTimer = null;
      }
      if (exerciseMilestoneState.activePopup) {
        exerciseMilestoneState.activePopup.classList.remove("is-visible");
      }
    }

    function showExercisePopup(message) {
      const popup = ensureExercisePopup();
      const copy = popup.querySelector(".exercise-popup-copy");
      if (!copy) {
        return;
      }
      copy.textContent = message;
      popup.classList.add("is-visible");
      if (exerciseMilestoneState.hideTimer) {
        window.clearTimeout(exerciseMilestoneState.hideTimer);
      }
      exerciseMilestoneState.hideTimer = window.setTimeout(() => {
        hideExercisePopup();
      }, 1000);
    }

    function milestoneDefinitions(total) {
      const halfway = Math.max(1, Math.ceil(total / 2));
      const milestones = [
        {
          key: "three",
          target: 3,
          message: "恭喜，又熟悉了 3 个词。",
        },
        {
          key: "half",
          target: halfway,
          message: "恭喜，已经熟悉了一半的词。",
        },
        {
          key: "complete",
          target: total,
          message: `本章练习完成，你已经熟悉了 ${total} 个词。`,
        },
      ].filter((item) => item.target <= total);

      const deduped = [];
      const seenTargets = new Set();
      milestones.forEach((item) => {
        if (seenTargets.has(item.target)) {
          return;
        }
        seenTargets.add(item.target);
        deduped.push(item);
      });
      return deduped.sort((left, right) => left.target - right.target);
    }

    function updateExerciseMilestones() {
      const blanks = Array.from(document.querySelectorAll(".exercise-blank"));
      const total = blanks.length;
      const completed = blanks.filter((blank) => blank.classList.contains("is-correct")).length;
      exerciseMilestoneState.total = total;
      exerciseMilestoneState.completed = completed;

      if (total === 0) {
        exerciseMilestoneState.triggered.clear();
        hideExercisePopup();
        return;
      }

      const milestones = milestoneDefinitions(total);
      const activeKeys = new Set(
        milestones.filter((item) => completed >= item.target).map((item) => item.key)
      );
      exerciseMilestoneState.triggered.forEach((key) => {
        if (!activeKeys.has(key)) {
          exerciseMilestoneState.triggered.delete(key);
        }
      });

      milestones.forEach((item) => {
        if (completed >= item.target && !exerciseMilestoneState.triggered.has(item.key)) {
          exerciseMilestoneState.triggered.add(item.key);
          showExercisePopup(item.message);
        }
      });
    }

    function wireOriginalToggle() {
      if (!toggleButton) {
        return;
      }
      toggleButton.addEventListener("click", () => {
        document.body.classList.toggle("hide-original");
        toggleButton.textContent = document.body.classList.contains("hide-original")
          ? "显示原文对照"
          : "隐藏原文对照";
      });
    }

    async function unlockAudioPlayback() {
      if (audioUnlocked) {
        return true;
      }
      if (unlockPromise) {
        return unlockPromise;
      }

      unlockPromise = (async () => {
        if (synth) {
          synth.resume();
        }

        pronunciationAudio.muted = true;
        pronunciationAudio.src = silentAudioSrc;
        pronunciationAudio.load();

        try {
          await pronunciationAudio.play();
          pronunciationAudio.pause();
          audioUnlocked = true;
          return true;
        } catch (error) {
          return false;
        } finally {
          pronunciationAudio.currentTime = 0;
          pronunciationAudio.muted = false;
          pronunciationAudio.removeAttribute("src");
          pronunciationAudio.load();
        }
      })();

      const unlocked = await unlockPromise;
      unlockPromise = null;
      return unlocked;
    }

    function clearPlaybackStartTimer() {
      if (playbackStartTimer) {
        window.clearTimeout(playbackStartTimer);
        playbackStartTimer = null;
      }
    }

    function clearSpeakingState() {
      clearPlaybackStartTimer();
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      vocabNodes.forEach((item) => item.classList.remove("is-speaking"));
      activeNode = null;
    }

    function markSpeaking(node) {
      vocabNodes.forEach((item) => item.classList.remove("is-speaking"));
      node.classList.add("is-speaking");
      activeNode = node;
    }

    function warmAudioSource(src) {
      if (!src || audioWarmers.has(src)) {
        return;
      }
      const warmer = new Audio();
      warmer.preload = "auto";
      warmer.src = src;
      warmer.load();
      audioWarmers.set(src, warmer);
    }

    function warmNodeAudio(node) {
      const src = (node.dataset.audio || "").trim();
      if (src) {
        warmAudioSource(src);
      }
    }

    function closeGloss() {
      if (openGlossNode) {
        openGlossNode.classList.remove("is-open");
        openGlossNode = null;
      }
    }

    function openGloss(node) {
      if (openGlossNode && openGlossNode !== node) {
        openGlossNode.classList.remove("is-open");
      }
      node.classList.add("is-open");
      openGlossNode = node;
    }

    function toggleGloss(node) {
      if (openGlossNode === node) {
        closeGloss();
        return false;
      }
      openGloss(node);
      return true;
    }

    function pickVoice() {
      const voices = synth ? synth.getVoices() : [];
      return (
        voices.find((voice) => englishVoicePattern.test(voice.lang) && /Samantha|Daniel|Google US English|Karen|Serena|Eddy|Flo/i.test(voice.name)) ||
        voices.find((voice) => englishVoicePattern.test(voice.lang)) ||
        null
      );
    }

    function googleTtsUrl(word) {
      return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=en-US&client=tw-ob`;
    }

    function playAudioSource(src, onFailure) {
      const requestId = ++playbackRequestId;
      clearPlaybackStartTimer();
      pronunciationAudio.pause();
      pronunciationAudio.currentTime = 0;
      pronunciationAudio.src = src;
      pronunciationAudio.load();
      playbackStartTimer = window.setTimeout(() => {
        if (requestId !== playbackRequestId) {
          return;
        }
        pronunciationAudio.pause();
        pronunciationAudio.currentTime = 0;
        onFailure();
      }, 900);
      const playPromise = pronunciationAudio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          if (requestId !== playbackRequestId) {
            return;
          }
          clearPlaybackStartTimer();
          onFailure();
        });
      }
    }

    function speakViaSystem(word, node) {
      if (!word || !synth || typeof SpeechSynthesisUtterance === "undefined") {
        clearSpeakingState();
        return;
      }

      pronunciationAudio.pause();
      pronunciationAudio.currentTime = 0;
      delete pronunciationAudio.dataset.sourceKind;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(word);
      const voice = pickVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = "en-US";
      }
      utterance.rate = 0.9;
      utterance.pitch = 1;

      markSpeaking(node);
      let started = false;
      fallbackTimer = window.setTimeout(() => {
        if (!started) {
          clearSpeakingState();
        }
      }, 500);

      utterance.onstart = () => {
        started = true;
        if (fallbackTimer) {
          window.clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
      };
      utterance.onend = clearSpeakingState;
      utterance.onerror = clearSpeakingState;
      synth.speak(utterance);
    }

    function speakViaLocalAudio(word, node) {
      const audioSrc = (node.dataset.audio || "").trim();
      if (!audioSrc) {
        speakViaSystem(word, node);
        return;
      }

      if (synth) {
        synth.cancel();
      }
      markSpeaking(node);
      pronunciationAudio.dataset.sourceKind = "local";
      playAudioSource(audioSrc, () => speakViaSystem(word, node));
    }

    function speakViaGoogle(word, node) {
      if (!word) {
        clearSpeakingState();
        return;
      }

      if (synth) {
        synth.cancel();
      }
      markSpeaking(node);
      pronunciationAudio.dataset.sourceKind = "google";
      playAudioSource(googleTtsUrl(word), () => speakViaLocalAudio(word, node));
    }

    async function speakWord(node) {
      const word = (node.dataset.en || node.textContent || "").trim();
      if (!word) {
        return;
      }

      await unlockAudioPlayback();

      if ((node.dataset.audio || "").trim()) {
        speakViaLocalAudio(word, node);
        return;
      }
      if (synth && typeof SpeechSynthesisUtterance !== "undefined") {
        speakViaSystem(word, node);
        return;
      }
      speakViaGoogle(word, node);
    }

    function createAudioProxy(text, audioSrc) {
      const proxy = document.createElement("span");
      proxy.className = "vocab";
      proxy.dataset.en = text;
      proxy.dataset.audio = audioSrc || "";
      proxy.dataset.zh = "";
      proxy.dataset.pos = "";
      proxy.dataset.gloss = "";
      proxy.textContent = text;
      return proxy;
    }

    function wirePronunciation() {
      pronunciationAudio.addEventListener("ended", clearSpeakingState);
      pronunciationAudio.addEventListener("playing", clearPlaybackStartTimer);
      pronunciationAudio.addEventListener("canplay", clearPlaybackStartTimer);
      pronunciationAudio.addEventListener("error", () => {
        if (!activeNode) {
          clearSpeakingState();
          return;
        }
        const word = (activeNode.dataset.en || activeNode.textContent || "").trim();
        const sourceKind = pronunciationAudio.dataset.sourceKind || "";
        if (sourceKind === "google") {
          speakViaLocalAudio(word, activeNode);
          return;
        }
        speakViaSystem(word, activeNode);
      });

      vocabNodes.forEach((node) => {
        node.addEventListener("pointerenter", () => {
          warmNodeAudio(node);
        }, { passive: true });
        node.addEventListener("focus", () => {
          warmNodeAudio(node);
          openGloss(node);
        });
        node.addEventListener("blur", () => {
          if (openGlossNode === node) {
            closeGloss();
          }
        });
        node.addEventListener("touchstart", () => {
          warmNodeAudio(node);
          void unlockAudioPlayback();
        }, { passive: true });
        node.addEventListener("click", (event) => {
          event.stopPropagation();
          if (Date.now() - lastTouchPlaybackAt < 700) {
            return;
          }
          toggleGloss(node);
          void speakWord(node);
        });
        node.addEventListener("touchend", (event) => {
          event.preventDefault();
          event.stopPropagation();
          lastTouchPlaybackAt = Date.now();
          toggleGloss(node);
          void speakWord(node);
        }, { passive: false });
        node.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleGloss(node);
            void speakWord(node);
            return;
          }
          if (event.key === "Escape" && openGlossNode === node) {
            closeGloss();
          }
        });
      });

      document.addEventListener("pointerdown", () => {
        void unlockAudioPlayback();
      }, { passive: true, once: true });

      document.addEventListener("click", (event) => {
        if (!event.target.closest(".vocab")) {
          closeGloss();
        }
      });

      if (synth) {
        speechSynthesis.onvoiceschanged = pickVoice;
        document.addEventListener("touchstart", () => {
          synth.resume();
          void unlockAudioPlayback();
        }, { passive: true, once: true });
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden && synth.paused) {
            synth.resume();
          }
        });
      }
    }

    function buildExercisePanes() {
      paragraphCards.forEach((card) => {
        const processed = card.querySelector(".processed");
        if (!processed) {
          return;
        }

        const vocabTerms = Array.from(processed.querySelectorAll(".vocab"));
        if (!vocabTerms.length) {
          return;
        }

        const pane = document.createElement("section");
        pane.className = "exercise-pane";

        const label = document.createElement("div");
        label.className = "exercise-label";
        label.textContent = "Practice";
        pane.appendChild(label);

        const sentence = document.createElement("div");
        sentence.className = "exercise-sentence";
        pane.appendChild(sentence);

        const bank = document.createElement("div");
        bank.className = "exercise-bank";
        pane.appendChild(bank);

        const footer = document.createElement("div");
        footer.className = "exercise-footer";
        const resetButton = document.createElement("button");
        resetButton.type = "button";
        resetButton.className = "exercise-reset";
        resetButton.textContent = "重练本段";
        const status = document.createElement("div");
        status.className = "exercise-status";
        footer.appendChild(resetButton);
        footer.appendChild(status);
        pane.appendChild(footer);

        const vocabSpecs = vocabTerms.map((node, termIndex) => ({
          answer: (node.dataset.en || node.textContent || "").trim(),
          audio: (node.dataset.audio || "").trim(),
          prompt: (node.dataset.zh || "").trim(),
          termIndex,
        }));
        const terms = [];
        processed.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            sentence.appendChild(document.createTextNode(node.textContent || ""));
            return;
          }
          if (node.nodeType === Node.ELEMENT_NODE && node.classList && node.classList.contains("vocab")) {
            const term = vocabSpecs[terms.length];
            if (!term) {
              return;
            }
            const prompt = term.prompt || term.answer || "填入英文";
            const blank = document.createElement("button");
            blank.type = "button";
            blank.className = "exercise-blank";
            blank.dataset.answer = term.answer;
            blank.dataset.audio = term.audio;
            blank.dataset.prompt = prompt;
            blank.dataset.termIndex = String(term.termIndex);
            blank.textContent = prompt;
            sentence.appendChild(blank);
            terms.push(term);
            return;
          }
          sentence.appendChild(document.createTextNode(node.textContent || ""));
        });

        const state = {
          selectedToken: null,
          blanks: [],
          tokens: [],
          statusTimer: null,
        };

        function clearSelection() {
          if (state.selectedToken) {
            state.selectedToken.classList.remove("is-selected");
          }
          state.selectedToken = null;
          state.blanks.forEach((blank) => blank.classList.remove("is-active"));
        }

        function clearStatusTimer() {
          if (state.statusTimer) {
            window.clearTimeout(state.statusTimer);
            state.statusTimer = null;
          }
        }

        function updateStatus() {
          clearStatusTimer();
          const completed = state.blanks.filter((blank) => blank.classList.contains("is-correct")).length;
          status.classList.remove("is-error");
          if (completed === state.blanks.length) {
            status.textContent = `本段完成 ${completed}/${state.blanks.length}`;
            status.classList.add("is-complete");
          } else {
            status.textContent = `已完成 ${completed}/${state.blanks.length}`;
            status.classList.remove("is-complete");
          }
          updateExerciseMilestones();
        }

        function showErrorStatus(message) {
          clearStatusTimer();
          status.textContent = message;
          status.classList.remove("is-complete");
          status.classList.add("is-error");
          state.statusTimer = window.setTimeout(() => {
            updateStatus();
          }, 1400);
        }

        function markWrong(blank, token) {
          blank.classList.add("is-wrong");
          token.classList.add("is-wrong");
          showErrorStatus("选错了，再试一次");
          window.setTimeout(() => {
            blank.classList.remove("is-wrong");
            token.classList.remove("is-wrong");
          }, 260);
        }

        function attemptFill(blank, token) {
          if (blank.classList.contains("is-correct") || token.classList.contains("is-used")) {
            return;
          }
          if (blank.dataset.answer !== token.dataset.answer) {
            markWrong(blank, token);
            return;
          }
          blank.textContent = token.dataset.answer;
          blank.classList.remove("is-active");
          blank.classList.add("is-correct");
          blank.disabled = true;
          token.classList.remove("is-selected");
          token.classList.add("is-used");
          token.disabled = true;
          state.selectedToken = null;
          updateStatus();
          const proxy = createAudioProxy(token.dataset.answer, token.dataset.audio);
          void speakWord(proxy);
        }

        function shuffle(items) {
          const copy = items.slice();
          for (let index = copy.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            const temp = copy[index];
            copy[index] = copy[swapIndex];
            copy[swapIndex] = temp;
          }
          return copy;
        }

        function renderBank() {
          bank.innerHTML = "";
          state.tokens = [];
          shuffle(terms).forEach((term) => {
            const token = document.createElement("button");
            token.type = "button";
            token.className = "exercise-token";
            token.textContent = term.answer;
            token.dataset.answer = term.answer;
            token.dataset.audio = term.audio;
            token.draggable = true;
            token.addEventListener("click", () => {
              if (token.classList.contains("is-used")) {
                return;
              }
              if (state.selectedToken === token) {
                clearSelection();
                return;
              }
              clearSelection();
              state.selectedToken = token;
              token.classList.add("is-selected");
              state.blanks.filter((blank) => !blank.classList.contains("is-correct")).forEach((blank) => {
                blank.classList.add("is-active");
              });
              const proxy = createAudioProxy(term.answer, term.audio);
              void speakWord(proxy);
            });
            token.addEventListener("dragstart", (event) => {
              event.dataTransfer.setData("text/plain", term.answer);
            });
            bank.appendChild(token);
            state.tokens.push(token);
          });
        }

        state.blanks = Array.from(sentence.querySelectorAll(".exercise-blank"));
        state.blanks.forEach((blank) => {
          blank.addEventListener("click", () => {
            if (!state.selectedToken) {
              return;
            }
            attemptFill(blank, state.selectedToken);
          });
          blank.addEventListener("dragover", (event) => {
            event.preventDefault();
          });
          blank.addEventListener("drop", (event) => {
            event.preventDefault();
            const answer = event.dataTransfer.getData("text/plain");
            const token = state.tokens.find((item) => item.dataset.answer === answer && !item.classList.contains("is-used"));
            if (!token) {
              return;
            }
            attemptFill(blank, token);
          });
        });

        resetButton.addEventListener("click", () => {
          clearStatusTimer();
          clearSelection();
          state.blanks.forEach((blank) => {
            blank.textContent = blank.dataset.prompt || "填入英文";
            blank.disabled = false;
            blank.classList.remove("is-correct", "is-wrong", "is-active");
          });
          renderBank();
          updateStatus();
        });

        renderBank();
        updateStatus();
        card.querySelector(".paragraph-copy").appendChild(pane);
      });
    }

    function wireExerciseToggle() {
      if (!exerciseButtons.length) {
        return;
      }
      const syncLabels = () => {
        const label = document.body.classList.contains("exercise-mode")
          ? "退出练习"
          : "练习模式";
        exerciseButtons.forEach((button) => {
          button.textContent = label;
        });
      };
      syncLabels();
      exerciseButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const willEnterExercise = !document.body.classList.contains("exercise-mode");
          document.body.classList.toggle("exercise-mode");
          syncLabels();
          if (willEnterExercise && readerSection) {
            readerSection.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      });
    }
