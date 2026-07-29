/**
 * ULTIMATE OFFLINE METRONOME - JS ENGINE (v1.01)
 * Features Web Audio API lookahead scheduling with sub-frame synchronized visual ticks.
 */

class MetronomeEngine {
  constructor() {
    // Audio Context & State
    this.audioCtx = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.tempo = 120; // BPM
    this.maxTempo = 300; // Cap max tempo to 300 BPM
    this.beatsPerMeasure = 4;
    this.subdivision = 1; // 1=Quarter, 2=Eighth, 3=Triplet, 4=16th, 5=Quintuplet, 6=Sextuplet, 7=Septuplet, 8=32nd
    this.swing = 50;
    this.soundSet = 'woodblock';

    // Volumes (0 - 1)
    this.masterVolume = 0.8;
    this.accentVolume = 1.0;
    this.beatVolume = 0.7;
    this.subVolume = 0.4;
    this.polyVolume = 0.6;

    // 2D Subdivision Note Matrix: [beatIndex][subStepIndex] -> 'accent', 'normal', 'weak', 'mute'
    this.subdivisionGrid = [];

    // Polyrhythm Engine
    this.polyEnabled = false;
    this.polyBeats = 3;
    this.currentPolyBeat = 0;
    this.nextPolyTime = 0.0;

    // Lookahead Scheduler Variables
    this.lookaheadMs = 25.0;
    this.scheduleAheadTime = 0.1;
    this.nextNoteTime = 0.0;
    this.currentBeatInMeasure = 0;
    this.currentSubdivisionStep = 0;
    this.timerID = null;

    // Gap / Mute Trainer (Updated default: 2 Bars Played / 3 Bars Muted)
    this.gapTrainerEnabled = false;
    this.barsPlayed = 2;
    this.barsMuted = 3;
    this.currentMeasureCount = 0;
    this.isBarMuted = false;

    // Tempo Ramp Trainer (Independent Start & End BPM)
    this.tempoRampEnabled = false;
    this.rampMode = 'time'; // 'bars' or 'time'
    this.rampStartTempo = 100; // Start BPM
    this.rampTargetTempo = 135; // End/Max BPM
    this.rampIncrement = 10; // +BPM per step
    this.rampEveryBars = 4; // Bar count interval
    this.rampEveryTimeSec = 60; // Time interval (1 min)
    this.rampTotalDurationSec = 300; // Max time duration (5 min)
    this.rampBarsCompleted = 0;
    this.rampTimeElapsedSec = 0;
    this.rampTimerInterval = null;

    // Routine Engine (Full Leg & Full Hand: 3 Runs with 2-min breaks)
    this.routineActive = false;
    this.routineRunCount = 0;
    this.routineMaxRuns = 3;
    this.routineBreakSec = 120; // 2 minutes break
    this.inRoutineBreak = false;
    this.routineBreakRemaining = 0;
    this.routineBreakInterval = null;

    // Practice Session Timer & Stopwatch (Default OFF = 0)
    this.timerMode = 'countdown'; // 'countdown' or 'stopwatch'
    this.sessionTimerDuration = 0; // default OFF (continuous)
    this.sessionTimeRemaining = 0;
    this.sessionTimerInterval = null;

    this.practiceElapsedSec = 0;
    this.practiceStopwatchInterval = null;

    // Tuning Pitch Drone
    this.droneOsc = null;
    this.droneGain = null;
    this.droneActive = false;
    this.droneFreq = 440;

    // Tap Tempo
    this.tapTimes = [];

    // Initialize 2D Subdivision Matrix
    this.initSubdivisionGrid();
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  initSubdivisionGrid(keepExisting = true) {
    const oldGrid = keepExisting ? this.subdivisionGrid : [];
    this.subdivisionGrid = [];

    for (let b = 0; b < this.beatsPerMeasure; b++) {
      const beatRow = [];
      for (let s = 0; s < this.subdivision; s++) {
        if (oldGrid[b] && oldGrid[b][s] !== undefined) {
          beatRow.push(oldGrid[b][s]);
        } else {
          if (s === 0) {
            beatRow.push(b === 0 ? 'accent' : 'normal');
          } else {
            beatRow.push('normal');
          }
        }
      }
      this.subdivisionGrid.push(beatRow);
    }
  }

  setSubnoteState(beat, subStep, state) {
    if (this.subdivisionGrid[beat] && this.subdivisionGrid[beat][subStep] !== undefined) {
      this.subdivisionGrid[beat][subStep] = state;
    }
  }

  checkGapMuteState() {
    if (this.gapTrainerEnabled) {
      const cycleTotal = this.barsPlayed + this.barsMuted;
      const posInCycle = this.currentMeasureCount % cycleTotal;
      this.isBarMuted = posInCycle >= this.barsPlayed;
    } else {
      this.isBarMuted = false;
    }
  }

  start() {
    this.initAudio();
    if (this.isPlaying && !this.isPaused) return;

    if (this.isPaused) {
      this.resume();
      return;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.inRoutineBreak = false;
    this.currentBeatInMeasure = 0;
    this.currentSubdivisionStep = 0;
    this.currentPolyBeat = 0;
    this.currentMeasureCount = 0;
    this.rampBarsCompleted = 0;
    this.rampTimeElapsedSec = 0;
    
    this.checkGapMuteState();

    if (this.tempoRampEnabled) {
      this.setTempo(this.rampStartTempo);
      if (this.rampMode === 'time') {
        this.startRampTimeTimer();
      }
    }

    this.nextNoteTime = this.audioCtx.currentTime + 0.05;
    this.nextPolyTime = this.audioCtx.currentTime + 0.05;

    this.scheduler();
    this.timerID = setInterval(() => this.scheduler(), this.lookaheadMs);

    if (this.timerMode === 'countdown' && this.sessionTimerDuration > 0) {
      if (this.sessionTimeRemaining <= 0) {
        this.sessionTimeRemaining = this.sessionTimerDuration;
      }
      this.startSessionTimer();
    }

    this.startPracticeStopwatch();

    window.dispatchEvent(new CustomEvent('metronome-state-changed', {
      detail: { isPlaying: true, isPaused: false }
    }));
  }

  pause() {
    if (!this.isPlaying && !this.inRoutineBreak) return;

    this.isPaused = true;
    this.isPlaying = false;

    if (this.timerID) {
      clearInterval(this.timerID);
      this.timerID = null;
    }
    this.stopSessionTimer();
    this.stopPracticeStopwatch();
    this.stopRampTimeTimer();
    this.stopRoutineBreakTimer();

    window.dispatchEvent(new CustomEvent('metronome-state-changed', {
      detail: { isPlaying: false, isPaused: true }
    }));
  }

  resume() {
    if (!this.isPaused) return;

    this.initAudio();
    this.isPaused = false;
    this.isPlaying = true;

    if (this.inRoutineBreak) {
      this.startRoutineBreakInterval();
    } else {
      this.nextNoteTime = this.audioCtx.currentTime + 0.05;
      this.nextPolyTime = this.audioCtx.currentTime + 0.05;
      this.scheduler();
      this.timerID = setInterval(() => this.scheduler(), this.lookaheadMs);

      if (this.tempoRampEnabled && this.rampMode === 'time') {
        this.startRampTimeTimer();
      }
      if (this.timerMode === 'countdown' && this.sessionTimeRemaining > 0) {
        this.startSessionTimer();
      }
      this.startPracticeStopwatch();
    }

    window.dispatchEvent(new CustomEvent('metronome-state-changed', {
      detail: { isPlaying: true, isPaused: false }
    }));
  }

  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.inRoutineBreak = false;
    if (this.timerID) {
      clearInterval(this.timerID);
      this.timerID = null;
    }
    this.stopSessionTimer();
    this.stopPracticeStopwatch();
    this.stopRampTimeTimer();
    this.stopRoutineBreakTimer();

    window.dispatchEvent(new CustomEvent('metronome-state-changed', {
      detail: { isPlaying: false, isPaused: false }
    }));
  }

  toggle() {
    if (this.isPlaying || this.isPaused || this.inRoutineBreak) {
      this.stop();
    } else {
      if (this.routineActive) {
        this.routineRunCount = 0;
      }
      this.start();
    }
    return this.isPlaying;
  }

  scheduler() {
    if (this.inRoutineBreak || this.isPaused) return;

    while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(
        this.currentBeatInMeasure,
        this.currentSubdivisionStep,
        this.nextNoteTime
      );
      this.advanceNote();
    }

    if (this.polyEnabled) {
      while (this.nextPolyTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
        this.schedulePolyNote(this.currentPolyBeat, this.nextPolyTime);
        this.advancePolyNote();
      }
    }
  }

  advanceNote() {
    const secondsPerBeat = 60.0 / this.tempo;
    
    let stepDuration = secondsPerBeat / this.subdivision;
    if (this.subdivision === 2) {
      const swingRatio = this.swing / 100.0;
      if (this.currentSubdivisionStep % 2 === 0) {
        stepDuration = secondsPerBeat * (swingRatio * 2);
      } else {
        stepDuration = secondsPerBeat * ((1 - swingRatio) * 2);
      }
    }

    this.nextNoteTime += stepDuration;

    this.currentSubdivisionStep++;
    if (this.currentSubdivisionStep >= this.subdivision) {
      this.currentSubdivisionStep = 0;
      this.currentBeatInMeasure++;

      if (this.currentBeatInMeasure >= this.beatsPerMeasure) {
        this.currentBeatInMeasure = 0;
        this.onMeasureComplete();
      }
    }
  }

  advancePolyNote() {
    const measureDuration = (60.0 / this.tempo) * this.beatsPerMeasure;
    const polyStepDuration = measureDuration / this.polyBeats;
    
    this.nextPolyTime += polyStepDuration;
    this.currentPolyBeat = (this.currentPolyBeat + 1) % this.polyBeats;
  }

  onMeasureComplete() {
    this.currentMeasureCount++;
    this.rampBarsCompleted++;

    this.checkGapMuteState();

    if (this.tempoRampEnabled && this.rampMode === 'bars') {
      if (this.rampBarsCompleted >= this.rampEveryBars) {
        this.rampBarsCompleted = 0;
        if (this.tempo < this.rampTargetTempo) {
          const nextTempo = Math.min(this.tempo + this.rampIncrement, this.rampTargetTempo);
          this.setTempo(nextTempo);
        }
      }
    }

    window.dispatchEvent(new CustomEvent('measure-complete', {
      detail: {
        measureCount: this.currentMeasureCount,
        rampBarsCompleted: this.rampBarsCompleted,
        rampEveryBars: this.rampEveryBars,
        rampMode: this.rampMode
      }
    }));
  }

  startRampTimeTimer() {
    this.stopRampTimeTimer();
    this.rampTimerInterval = setInterval(() => {
      if (!this.isPlaying || !this.tempoRampEnabled || this.rampMode !== 'time' || this.inRoutineBreak || this.isPaused) return;

      this.rampTimeElapsedSec++;

      if (this.rampEveryTimeSec > 0 && this.rampTimeElapsedSec % this.rampEveryTimeSec === 0) {
        if (this.tempo < this.rampTargetTempo) {
          let inc = this.rampIncrement;
          if (this.tempo === 130 && this.rampTargetTempo === 135) {
            inc = 5;
          }
          const nextTempo = Math.min(this.tempo + inc, this.rampTargetTempo);
          this.setTempo(nextTempo);
        }
      }

      if (this.rampTotalDurationSec > 0 && this.rampTimeElapsedSec >= this.rampTotalDurationSec) {
        this.onRampDurationComplete();
      }

      window.dispatchEvent(new CustomEvent('ramp-time-update', {
        detail: {
          elapsedSec: this.rampTimeElapsedSec,
          totalSec: this.rampTotalDurationSec,
          everySec: this.rampEveryTimeSec
        }
      }));
    }, 1000);
  }

  onRampDurationComplete() {
    if (this.routineActive) {
      this.routineRunCount++;
      if (this.routineRunCount < this.routineMaxRuns) {
        this.startRoutineBreak();
      } else {
        this.stop();
        this.playSessionEndChime();
        alert("🎉 Routine Complete (3 Runs Finished)!");
      }
    } else {
      window.dispatchEvent(new CustomEvent('ramp-duration-complete'));
    }
  }

  startRoutineBreak() {
    this.inRoutineBreak = true;
    this.routineBreakRemaining = this.routineBreakSec;
    this.rampTimeElapsedSec = 0;

    if (this.timerID) {
      clearInterval(this.timerID);
      this.timerID = null;
    }

    window.dispatchEvent(new CustomEvent('routine-break-start', {
      detail: {
        breakNum: this.routineRunCount,
        remaining: this.routineBreakRemaining
      }
    }));

    this.startRoutineBreakInterval();
  }

  startRoutineBreakInterval() {
    this.stopRoutineBreakTimer();
    this.routineBreakInterval = setInterval(() => {
      if (this.routineBreakRemaining > 0) {
        this.routineBreakRemaining--;
        window.dispatchEvent(new CustomEvent('routine-break-update', {
          detail: {
            breakNum: this.routineRunCount,
            remaining: this.routineBreakRemaining
          }
        }));

        if (this.routineBreakRemaining <= 0) {
          this.stopRoutineBreakTimer();
          this.resumeAfterBreak();
        }
      }
    }, 1000);
  }

  resumeAfterBreak() {
    this.inRoutineBreak = false;
    this.currentBeatInMeasure = 0;
    this.currentSubdivisionStep = 0;
    this.currentMeasureCount = 0;
    this.rampTimeElapsedSec = 0;
    this.setTempo(this.rampStartTempo);
    this.checkGapMuteState();

    this.nextNoteTime = this.audioCtx.currentTime + 0.05;
    this.nextPolyTime = this.audioCtx.currentTime + 0.05;
    this.scheduler();
    this.timerID = setInterval(() => this.scheduler(), this.lookaheadMs);

    window.dispatchEvent(new CustomEvent('routine-break-end'));
  }

  stopRoutineBreakTimer() {
    if (this.routineBreakInterval) {
      clearInterval(this.routineBreakInterval);
      this.routineBreakInterval = null;
    }
  }

  stopRampTimeTimer() {
    if (this.rampTimerInterval) {
      clearInterval(this.rampTimerInterval);
      this.rampTimerInterval = null;
    }
  }

  scheduleNote(beat, subStep, time) {
    const subState = (this.subdivisionGrid[beat] && this.subdivisionGrid[beat][subStep]) ? this.subdivisionGrid[beat][subStep] : 'normal';
    const isMainBeat = subStep === 0;

    const dispatchTick = () => {
      if (this.isPlaying && !this.inRoutineBreak && !this.isPaused) {
        window.dispatchEvent(new CustomEvent('metronome-tick', {
          detail: { 
            beat, 
            subStep, 
            accentState: subState, 
            isBarMuted: this.isBarMuted, 
            measureCount: this.currentMeasureCount + 1 
          }
        }));
      }
    };

    const delayMs = (time - this.audioCtx.currentTime) * 1000;
    if (delayMs <= 8) {
      requestAnimationFrame(dispatchTick);
    } else {
      setTimeout(() => {
        requestAnimationFrame(dispatchTick);
      }, delayMs - 8);
    }

    if (this.isBarMuted || subState === 'mute') return;

    let freq = 800;
    let noteVol = this.beatVolume;

    if (subState === 'accent') {
      freq = 1400;
      noteVol = this.accentVolume;
    } else if (subState === 'weak') {
      freq = 450;
      noteVol = this.subVolume * 0.7;
    } else {
      freq = isMainBeat ? 900 : 600;
      noteVol = isMainBeat ? this.beatVolume : this.subVolume;
    }

    this.playSyntheticTone(freq, time, noteVol, isMainBeat);
  }

  schedulePolyNote(polyBeat, time) {
    if (this.isBarMuted) return;

    const dispatchPolyTick = () => {
      if (this.isPlaying && !this.inRoutineBreak && !this.isPaused) {
        window.dispatchEvent(new CustomEvent('poly-tick', { detail: { polyBeat } }));
      }
    };

    const delayMs = (time - this.audioCtx.currentTime) * 1000;
    if (delayMs <= 8) {
      requestAnimationFrame(dispatchPolyTick);
    } else {
      setTimeout(() => {
        requestAnimationFrame(dispatchPolyTick);
      }, delayMs - 8);
    }

    this.playPolyTone(1050, time, this.polyVolume);
  }

  playSyntheticTone(freq, time, noteVolume, isMainBeat) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const master = this.audioCtx.createGain();

    master.gain.value = this.masterVolume;

    switch (this.soundSet) {
      case 'beep':
        osc.type = 'sine';
        gain.gain.setValueAtTime(noteVolume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        osc.frequency.setValueAtTime(freq, time);
        break;

      case 'woodblock':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.4, time + 0.04);
        gain.gain.setValueAtTime(noteVolume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
        break;

      case 'cowbell':
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq * 0.75, time);
        gain.gain.setValueAtTime(noteVolume * 0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
        break;

      case 'drumkit':
        if (isMainBeat && freq > 1000) {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(300, time);
          gain.gain.setValueAtTime(noteVolume, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
        } else {
          osc.type = 'square';
          osc.frequency.setValueAtTime(2200, time);
          gain.gain.setValueAtTime(noteVolume * 0.5, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
        }
        break;

      case 'marimba':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(noteVolume * 0.9, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
        break;

      case 'pingpong':
      default:
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 1.2, time);
        gain.gain.setValueAtTime(noteVolume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
        break;
    }

    osc.connect(gain);
    gain.connect(master);
    master.connect(this.audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.15);
  }

  playPolyTone(freq, time, volume) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const master = this.audioCtx.createGain();

    master.gain.value = this.masterVolume;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

    osc.connect(gain);
    gain.connect(master);
    master.connect(this.audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.08);
  }

  setSessionTimerDuration(seconds) {
    this.sessionTimerDuration = seconds;
    this.sessionTimeRemaining = seconds;
    window.dispatchEvent(new CustomEvent('session-timer-update', {
      detail: { remaining: this.sessionTimeRemaining }
    }));
  }

  startSessionTimer() {
    this.stopSessionTimer();
    this.sessionTimerInterval = setInterval(() => {
      if (this.sessionTimeRemaining > 0 && !this.isPaused) {
        this.sessionTimeRemaining--;
        window.dispatchEvent(new CustomEvent('session-timer-update', {
          detail: { remaining: this.sessionTimeRemaining }
        }));

        if (this.sessionTimeRemaining <= 0) {
          this.onSessionTimerComplete();
        }
      }
    }, 1000);
  }

  stopSessionTimer() {
    if (this.sessionTimerInterval) {
      clearInterval(this.sessionTimerInterval);
      this.sessionTimerInterval = null;
    }
  }

  onSessionTimerComplete() {
    this.stop();
    this.playSessionEndChime();
    window.dispatchEvent(new CustomEvent('session-timer-complete'));
  }

  startPracticeStopwatch() {
    this.stopPracticeStopwatch();
    this.practiceStopwatchInterval = setInterval(() => {
      if (!this.isPlaying || this.inRoutineBreak || this.isPaused) return;
      this.practiceElapsedSec++;
      window.dispatchEvent(new CustomEvent('practice-stopwatch-update', {
        detail: { elapsed: this.practiceElapsedSec }
      }));
    }, 1000);
  }

  stopPracticeStopwatch() {
    if (this.practiceStopwatchInterval) {
      clearInterval(this.practiceStopwatchInterval);
      this.practiceStopwatchInterval = null;
    }
  }

  resetPracticeStopwatch() {
    this.practiceElapsedSec = 0;
    window.dispatchEvent(new CustomEvent('practice-stopwatch-update', {
      detail: { elapsed: this.practiceElapsedSec }
    }));
  }

  playSessionEndChime() {
    this.initAudio();
    const now = this.audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0.4 * this.masterVolume, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.65);
    });
  }

  toggleDrone(enable, pitchHz = 440) {
    this.initAudio();
    if (enable) {
      if (this.droneActive) this.toggleDrone(false);

      this.droneOsc = this.audioCtx.createOscillator();
      this.droneGain = this.audioCtx.createGain();

      this.droneOsc.type = 'sine';
      this.droneOsc.frequency.setValueAtTime(pitchHz, this.audioCtx.currentTime);
      this.droneGain.gain.setValueAtTime(0.3 * this.masterVolume, this.audioCtx.currentTime);

      this.droneOsc.connect(this.droneGain);
      this.droneGain.connect(this.audioCtx.destination);

      this.droneOsc.start();
      this.droneActive = true;
      this.droneFreq = pitchHz;
    } else {
      if (this.droneOsc) {
        this.droneGain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.05);
        setTimeout(() => {
          if (this.droneOsc) {
            this.droneOsc.stop();
            this.droneOsc.disconnect();
            this.droneOsc = null;
          }
        }, 60);
      }
      this.droneActive = false;
    }
  }

  tap() {
    const now = performance.now();
    if (this.tapTimes.length > 0 && now - this.tapTimes[this.tapTimes.length - 1] > 3000) {
      this.tapTimes = [];
    }

    this.tapTimes.push(now);
    if (this.tapTimes.length > 8) this.tapTimes.shift();

    if (this.tapTimes.length >= 2) {
      const intervals = [];
      for (let i = 1; i < this.tapTimes.length; i++) {
        intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round(60000 / avgInterval);
      this.setTempo(Math.min(Math.max(bpm, 20), this.maxTempo));
    }
  }

  setTempo(bpm) {
    this.tempo = Math.min(Math.max(bpm, 20), this.maxTempo);
    window.dispatchEvent(new CustomEvent('tempo-changed', { detail: { tempo: this.tempo } }));
  }

  setBeatsPerMeasure(n) {
    this.beatsPerMeasure = parseInt(n, 10);
    this.initSubdivisionGrid(false);
  }

  setSubdivision(s) {
    this.subdivision = parseInt(s, 10);
    this.initSubdivisionGrid(false);
  }
}

// Global Metronome Instance
const metronome = new MetronomeEngine();

// --- Italian Tempo Markings Table ---
const TEMPO_MARKINGS = [
  { name: "Larghissimo", min: 20, max: 24 },
  { name: "Grave", min: 25, max: 39 },
  { name: "Largo", min: 40, max: 59 },
  { name: "Larghetto", min: 60, max: 65 },
  { name: "Adagio", min: 66, max: 75 },
  { name: "Andante", min: 76, max: 107 },
  { name: "Moderato", min: 108, max: 119 },
  { name: "Allegro", min: 120, max: 155 },
  { name: "Presto", min: 156, max: 199 },
  { name: "Prestissimo", min: 200, max: 300 }
];

function getTempoMarking(bpm) {
  const match = TEMPO_MARKINGS.find(t => bpm >= t.min && bpm <= t.max);
  return match ? match.name : "Moderato";
}
