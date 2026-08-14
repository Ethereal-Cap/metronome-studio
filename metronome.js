/**
 * ULTIMATE OFFLINE METRONOME - JS ENGINE (v1.01)
 * Features Web Audio API lookahead scheduling with sub-frame synchronized visual ticks
 * and Subdivisions Intelligent Preset Routine Engine with 1-Min Inter-Tempo Breaks.
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

    // Gap / Mute Trainer (Default: 2 Bars Played / 3 Bars Muted)
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

    // Routine Engine (Full Leg & Full Hand)
    this.routineActive = false;
    this.routineRunCount = 0;
    this.routineMaxRuns = 3;
    this.routineBreakSec = 60; // 1 minute break
    this.inRoutineBreak = false;
    this.routineBreakRemaining = 0;
    this.routineBreakInterval = null;

    // --- Subdivisions Intelligent Preset Engine ---
    this.subdivisionsRoutineActive = false;
    this.subdivisionsTempos = []; // 3 randomly selected tempos e.g. [45, 89, 112]
    this.subdivisionsCurrentTempoIdx = 0; // 0, 1, 2
    this.subdivisionsCurrentStageIdx = 0; // 0 to 6 (7 stages)
    this.subdivisionsBarInStage = 1; // 1 to 6 bars
    this.inSubdivisionsBreak = false;
    this.subdivisionsBreakRemaining = 15; // 15 seconds break between tempos
    this.subdivisionsBreakInterval = null;
    this.subdivisionsStages = [
      { name: "Quarter Notes", sub: 1 },
      { name: "Eighth Notes", sub: 2 },
      { name: "16th Notes", sub: 4 },
      { name: "Eighth Triplets", sub: 3 },
      { name: "16th Triplets", sub: 6 },
      { name: "16th Notes", sub: 4 },
      { name: "Eighth Triplets", sub: 3 }
    ];

    // --- 8ths Rhythm Training Preset Routine ---
    this.eighthsTrainingRoutineActive = false;
    this.eighthsCurrentStepIdx = 0;
    this.eighthsBarInStep = 1;

    // --- 16th Rhythm Training Preset Routine ---
    this.sixteenthsTrainingRoutineActive = false;
    this.sixteenthsCurrentStepIdx = 0;
    this.sixteenthsBarInStep = 1;

    // --- 8th Triplet Rhythm Training Preset Routine ---
    this.tripletsTrainingRoutineActive = false;
    this.tripletsCurrentStepIdx = 0;
    this.tripletsBarInStep = 1;

    // 2-Bar Count-In Feature
    this.inCountIn = false;
    this.countInBarCount = 1;
    this.countInTotalBars = 2;

    // Practice Session Timer & Stopwatch (Default OFF = 0)
    this.timerMode = 'countdown'; // 'countdown' or 'stopwatch'
    this.sessionTimerDuration = 0; // default OFF (continuous)
    this.sessionTimeRemaining = 0;
    this.sessionTimerInterval = null;

    this.practiceElapsedSec = 0;
    this.practiceStopwatchInterval = null;

    // Tempo Change Mute Trainer Override (Plays first 2 bars unmuted when tempo changes)
    this.tempoChangeUnmuteBarsRemaining = 0;

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

    const numSubSteps = Math.max(1, Math.round(this.subdivision));

    for (let b = 0; b < this.beatsPerMeasure; b++) {
      const beatRow = [];
      for (let s = 0; s < numSubSteps; s++) {
        if (oldGrid[b] && oldGrid[b][s] !== undefined) {
          beatRow.push(oldGrid[b][s]);
        } else {
          if (s === 0) {
            if (this.subdivision === 0.5) {
              beatRow.push(b % 2 === 0 ? (b === 0 ? 'accent' : 'normal') : 'mute');
            } else {
              beatRow.push(b === 0 ? 'accent' : 'normal');
            }
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
    if (this.tempoChangeUnmuteBarsRemaining > 0) {
      this.isBarMuted = false;
      return;
    }

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
    this.inSubdivisionsBreak = false;

    // Enable 2-bar count-in on start
    this.inCountIn = true;
    this.countInBarCount = 1;
    this.countInTotalBars = 2;

    this.currentBeatInMeasure = 0;
    this.currentSubdivisionStep = 0;
    this.currentPolyBeat = 0;
    this.currentMeasureCount = 0;
    this.rampBarsCompleted = 0;
    this.rampTimeElapsedSec = 0;
    this.tempoChangeUnmuteBarsRemaining = 0;
    
    this.checkGapMuteState();

    if (this.tempoRampEnabled && !this.subdivisionsRoutineActive) {
      this.setTempo(this.rampStartTempo);
    }

    this.nextNoteTime = this.audioCtx.currentTime + 0.05;
    this.nextPolyTime = this.audioCtx.currentTime + 0.05;

    this.scheduler();
    this.timerID = setInterval(() => this.scheduler(), this.lookaheadMs);

    window.dispatchEvent(new CustomEvent('count-in-start', {
      detail: { countInBar: 1, totalCountInBars: 2 }
    }));

    window.dispatchEvent(new CustomEvent('metronome-state-changed', {
      detail: { isPlaying: true, isPaused: false }
    }));
  }

  pause() {
    if (!this.isPlaying && !this.inRoutineBreak && !this.inSubdivisionsBreak) return;

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
    this.stopSubdivisionsBreakTimer();

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
    } else if (this.inSubdivisionsBreak) {
      this.startSubdivisionsBreakInterval();
    } else {
      if (this.audioCtx) {
        this.nextNoteTime = this.audioCtx.currentTime + 0.05;
        this.nextPolyTime = this.audioCtx.currentTime + 0.05;
      }
      this.scheduler();
      if (!this.timerID) {
        this.timerID = setInterval(() => this.scheduler(), this.lookaheadMs);
      }

      if (this.tempoRampEnabled && this.rampMode === 'time' && !this.subdivisionsRoutineActive) {
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
    this.inCountIn = false;
    this.inRoutineBreak = false;
    this.inSubdivisionsBreak = false;
    this.subdivisionsRoutineActive = false;
    this.eighthsTrainingRoutineActive = false;
    this.sixteenthsTrainingRoutineActive = false;
    this.tripletsTrainingRoutineActive = false;
    this.tempoChangeUnmuteBarsRemaining = 0;
    if (this.timerID) {
      clearInterval(this.timerID);
      this.timerID = null;
    }
    this.stopSessionTimer();
    this.stopPracticeStopwatch();
    this.stopRampTimeTimer();
    this.stopRoutineBreakTimer();
    this.stopSubdivisionsBreakTimer();

    window.dispatchEvent(new CustomEvent('metronome-state-changed', {
      detail: { isPlaying: false, isPaused: false }
    }));
  }

  toggle() {
    if (this.isPlaying || this.isPaused || this.inRoutineBreak || this.inSubdivisionsBreak) {
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
    if (this.inRoutineBreak || this.inSubdivisionsBreak || this.isPaused) return;

    if (this.audioCtx && this.nextNoteTime < this.audioCtx.currentTime) {
      this.nextNoteTime = this.audioCtx.currentTime + 0.05;
    }
    if (this.audioCtx && this.nextPolyTime < this.audioCtx.currentTime) {
      this.nextPolyTime = this.audioCtx.currentTime + 0.05;
    }

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
    
    const effSubdivision = (this.inCountIn || this.subdivision < 1) ? 1 : this.subdivision;
    let stepDuration = secondsPerBeat / effSubdivision;
    if (!this.inCountIn && this.subdivision === 2) {
      const swingRatio = this.swing / 100.0;
      if (this.currentSubdivisionStep % 2 === 0) {
        stepDuration = secondsPerBeat * swingRatio;
      } else {
        stepDuration = secondsPerBeat * (1.0 - swingRatio);
      }
    }

    this.nextNoteTime += stepDuration;

    this.currentSubdivisionStep++;
    if (this.currentSubdivisionStep >= effSubdivision) {
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
    if (this.inCountIn) {
      this.countInBarCount++;
      if (this.countInBarCount > this.countInTotalBars) {
        // 2-Bar Count-In completed! Start main practice session!
        this.inCountIn = false;
        this.currentMeasureCount = 0;

        if (this.tempoRampEnabled && !this.subdivisionsRoutineActive && this.rampMode === 'time') {
          this.startRampTimeTimer();
        }

        if (this.sixteenthsTrainingRoutineActive) {
          this.applySixteenthsTrainingStepState();
        } else if (this.eighthsTrainingRoutineActive) {
          this.applyEighthsTrainingStepState();
        } else if (this.subdivisionsRoutineActive) {
          this.applySubdivisionsStageState();
        }

        if (this.timerMode === 'countdown' && this.sessionTimerDuration > 0) {
          if (this.sessionTimeRemaining <= 0) {
            this.sessionTimeRemaining = this.sessionTimerDuration;
          }
          this.startSessionTimer();
        }

        this.startPracticeStopwatch();

        window.dispatchEvent(new CustomEvent('count-in-complete'));
      } else {
        window.dispatchEvent(new CustomEvent('count-in-update', {
          detail: { countInBar: this.countInBarCount, totalCountInBars: 2 }
        }));
      }
      return; // Do NOT increment practice currentMeasureCount during count-in!
    }

    if (this.tempoChangeUnmuteBarsRemaining > 0) {
      this.tempoChangeUnmuteBarsRemaining--;
    }

    this.currentMeasureCount++;
    this.rampBarsCompleted++;

    this.checkGapMuteState();

    if (this.tripletsTrainingRoutineActive) {
      this.advanceTripletsTrainingRoutine();
    } else if (this.sixteenthsTrainingRoutineActive) {
      this.advanceSixteenthsTrainingRoutine();
    } else if (this.eighthsTrainingRoutineActive) {
      this.advanceEighthsTrainingRoutine();
    } else if (this.subdivisionsRoutineActive) {
      this.advanceSubdivisionsRoutine();
    } else if (this.tempoRampEnabled && this.rampMode === 'bars') {
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

  // --- Subdivisions Intelligent Preset Routine Logic ---
  startSubdivisionsRoutine(temposArray) {
    this.subdivisionsRoutineActive = true;
    this.subdivisionsTempos = temposArray;
    this.subdivisionsCurrentTempoIdx = 0;
    this.subdivisionsCurrentStageIdx = 0;
    this.subdivisionsBarInStage = 1;
    this.inSubdivisionsBreak = false;
    this.gapTrainerEnabled = false;
    this.tempoRampEnabled = false;

    this.setTempo(this.subdivisionsTempos[0]);
    this.start();
  }

  advanceSubdivisionsRoutine() {
    this.subdivisionsBarInStage++;
    
    if (this.subdivisionsBarInStage > 4) {
      this.subdivisionsBarInStage = 1;
      this.subdivisionsCurrentStageIdx++;

      if (this.subdivisionsCurrentStageIdx >= this.subdivisionsStages.length) {
        this.subdivisionsCurrentStageIdx = 0;
        this.subdivisionsCurrentTempoIdx++;

        if (this.subdivisionsCurrentTempoIdx >= this.subdivisionsTempos.length) {
          this.onSubdivisionsRoutineComplete();
          return;
        } else {
          // Trigger 1-Minute Break before switching to the next tempo!
          this.startSubdivisionsInterTempoBreak();
          return;
        }
      }
    }

    this.applySubdivisionsStageState();
  }

  startSubdivisionsInterTempoBreak() {
    this.inSubdivisionsBreak = true;
    this.subdivisionsBreakRemaining = 15; // 15 seconds silence

    if (this.timerID) {
      clearInterval(this.timerID);
      this.timerID = null;
    }

    const nextBpm = this.subdivisionsTempos[this.subdivisionsCurrentTempoIdx];

    window.dispatchEvent(new CustomEvent('subdivisions-break-start', {
      detail: {
        nextTempoIdx: this.subdivisionsCurrentTempoIdx + 1,
        totalTempos: this.subdivisionsTempos.length,
        nextBpm,
        remainingSec: this.subdivisionsBreakRemaining
      }
    }));

    this.startSubdivisionsBreakInterval();
  }

  startSubdivisionsBreakInterval() {
    this.stopSubdivisionsBreakTimer();
    this.subdivisionsBreakInterval = setInterval(() => {
      if (this.subdivisionsBreakRemaining > 0 && !this.isPaused) {
        this.subdivisionsBreakRemaining--;

        const nextBpm = this.subdivisionsTempos[this.subdivisionsCurrentTempoIdx];

        window.dispatchEvent(new CustomEvent('subdivisions-break-update', {
          detail: {
            nextTempoIdx: this.subdivisionsCurrentTempoIdx + 1,
            totalTempos: this.subdivisionsTempos.length,
            nextBpm,
            remainingSec: this.subdivisionsBreakRemaining
          }
        }));

        if (this.subdivisionsBreakRemaining <= 5 && this.subdivisionsBreakRemaining > 0) {
          this.playBreakCountdownBeep(this.subdivisionsBreakRemaining);
        }

        if (this.subdivisionsBreakRemaining <= 0) {
          this.stopSubdivisionsBreakTimer();
          this.resumeSubdivisionsAfterBreak();
        }
      }
    }, 1000);
  }

  resumeSubdivisionsAfterBreak() {
    this.inSubdivisionsBreak = false;
    this.subdivisionsCurrentStageIdx = 0;
    this.subdivisionsBarInStage = 1;
    this.currentBeatInMeasure = 0;
    this.currentSubdivisionStep = 0;

    const nextBpm = this.subdivisionsTempos[this.subdivisionsCurrentTempoIdx];
    this.setTempo(nextBpm);
    this.applySubdivisionsStageState();

    // Enable 1-bar count-in before new tempo plays
    this.inCountIn = true;
    this.countInBarCount = 1;
    this.countInTotalBars = 1;

    this.nextNoteTime = this.audioCtx.currentTime + 0.05;
    this.nextPolyTime = this.audioCtx.currentTime + 0.05;
    this.scheduler();
    if (!this.timerID) {
      this.timerID = setInterval(() => this.scheduler(), this.lookaheadMs);
    }
    this.startPracticeStopwatch();

    window.dispatchEvent(new CustomEvent('count-in-start', {
      detail: { countInBar: 1, totalCountInBars: 1 }
    }));
    window.dispatchEvent(new CustomEvent('subdivisions-break-end'));
  }

  stopSubdivisionsBreakTimer() {
    if (this.subdivisionsBreakInterval) {
      clearInterval(this.subdivisionsBreakInterval);
      this.subdivisionsBreakInterval = null;
    }
  }

  applySubdivisionsStageState() {
    const stage = this.subdivisionsStages[this.subdivisionsCurrentStageIdx];
    this.setSubdivision(stage.sub);

    const isFirstStage = (this.subdivisionsCurrentStageIdx === 0);
    const playFullSubdivisions = (this.subdivisionsBarInStage === 4);

    for (let b = 0; b < this.beatsPerMeasure; b++) {
      for (let s = 0; s < this.subdivision; s++) {
        if (s === 0) {
          if (isFirstStage && !playFullSubdivisions) {
            this.subdivisionGrid[b][s] = 'mute';
          } else {
            this.subdivisionGrid[b][s] = (b === 0 ? 'accent' : 'normal');
          }
        } else {
          this.subdivisionGrid[b][s] = playFullSubdivisions ? 'normal' : 'mute';
        }
      }
    }

    const isMutedQuarterBar = isFirstStage && !playFullSubdivisions;

    window.dispatchEvent(new CustomEvent('subdivisions-stage-update', {
      detail: {
        tempoIdx: this.subdivisionsCurrentTempoIdx + 1,
        totalTempos: this.subdivisionsTempos.length,
        currentBpm: this.subdivisionsTempos[this.subdivisionsCurrentTempoIdx],
        stageIdx: this.subdivisionsCurrentStageIdx + 1,
        totalStages: this.subdivisionsStages.length,
        stageName: stage.name,
        barInStage: this.subdivisionsBarInStage,
        playFullSubdivisions,
        isMutedQuarterBar
      }
    }));
  }

  onSubdivisionsRoutineComplete() {
    this.stop();
    this.playSessionEndChime();

    setTimeout(() => {
      let promptMsg = "🎉 Subdivisions Session Complete!\n🔒 Enter Admin Password to log these 3 tempos as completed:";
      while (true) {
        const enteredPwd = prompt(promptMsg);
        if (enteredPwd === null) {
          alert("⚠️ Cancelled. These tempos were NOT marked as completed.");
          window.dispatchEvent(new CustomEvent('subdivisions-routine-finished', {
            detail: {
              completedTempos: this.subdivisionsTempos,
              verified: false
            }
          }));
          break;
        } else if (enteredPwd === "ArtisanOfGore") {
          alert("✅ Admin Verified! 3 Tempos successfully saved.");
          window.dispatchEvent(new CustomEvent('subdivisions-routine-finished', {
            detail: {
              completedTempos: this.subdivisionsTempos,
              verified: true
            }
          }));
          break;
        } else {
          promptMsg = "❌ WRONG PASSWORD! Please try again.\n🔒 Enter Admin Password (or click Cancel to skip):";
        }
      }
    }, 100);
  }

  // --- 8ths Rhythm Training Preset Routine Logic ---
  startEighthsTrainingRoutine() {
    this.eighthsTrainingRoutineActive = true;
    this.subdivisionsRoutineActive = false;
    this.eighthsCurrentStepIdx = 0;
    this.eighthsBarInStep = 1;
    this.gapTrainerEnabled = false;
    this.tempoRampEnabled = false;

    // Force 4/4 time signature and 8th notes subdivision
    this.beatsPerMeasure = 4;
    this.subdivision = 2;

    this.applyEighthsTrainingStepState();
    this.start();
  }

  getEighthsTrainingPatterns() {
    const pAll8ths = [['accent', 'normal'], ['normal', 'normal'], ['normal', 'normal'], ['normal', 'normal']];
    const pAllOffbeats = [['accent', 'normal'], ['normal', 'normal'], ['normal', 'normal'], ['normal', 'normal']];
    const pQuarters = [['accent', 'mute'], ['normal', 'mute'], ['normal', 'mute'], ['normal', 'mute']];

    const p5a = [['accent', 'normal'], ['normal', 'mute'], ['normal', 'mute'], ['normal', 'mute']];
    const p5b = [['accent', 'mute'], ['normal', 'normal'], ['normal', 'mute'], ['normal', 'mute']];
    const p5c = [['accent', 'mute'], ['normal', 'mute'], ['normal', 'normal'], ['normal', 'mute']];
    const p5d = [['accent', 'mute'], ['normal', 'mute'], ['normal', 'mute'], ['normal', 'normal']];

    const p6a = [['accent', 'mute'], ['normal', 'normal'], ['normal', 'normal'], ['normal', 'normal']];
    const p6b = [['accent', 'normal'], ['normal', 'mute'], ['normal', 'normal'], ['normal', 'normal']];
    const p6c = [['accent', 'normal'], ['normal', 'normal'], ['normal', 'mute'], ['normal', 'normal']];
    const p6d = [['accent', 'normal'], ['normal', 'normal'], ['normal', 'normal'], ['normal', 'mute']];

    return [
      { name: "All 8th Notes", type: "1-bar", gridA: pAll8ths },
      { name: "All '&' Notes", type: "1-bar", gridA: pAllOffbeats },
      { name: "Quarter ➔ '&' Notes", type: "2-bar", gridA: pQuarters, gridB: pAllOffbeats },
      { name: "All 8ths ➔ '&' Notes", type: "2-bar", gridA: pAll8ths, gridB: pAllOffbeats },
      { name: "Beat 1: Quarters + '&'", type: "1-bar", gridA: p5a },
      { name: "Beat 1: All 8ths ('&' Silent)", type: "1-bar", gridA: p6a },
      { name: "Beat 2: Quarters + '&'", type: "1-bar", gridA: p5b },
      { name: "Beat 2: All 8ths ('&' Silent)", type: "1-bar", gridA: p6b },
      { name: "Beat 3: Quarters + '&'", type: "1-bar", gridA: p5c },
      { name: "Beat 3: All 8ths ('&' Silent)", type: "1-bar", gridA: p6c },
      { name: "Beat 4: Quarters + '&'", type: "1-bar", gridA: p5d },
      { name: "Beat 4: All 8ths ('&' Silent)", type: "1-bar", gridA: p6d }
    ];
  }

  applyEighthsTrainingStepState() {
    const patterns = this.getEighthsTrainingPatterns();
    const current = patterns[this.eighthsCurrentStepIdx];
    if (!current) return;

    let targetGrid = current.gridA;
    if (current.type === "2-bar" && (this.eighthsBarInStep === 2 || this.eighthsBarInStep === 4)) {
      targetGrid = current.gridB;
    }

    this.subdivisionGrid = JSON.parse(JSON.stringify(targetGrid));

    window.dispatchEvent(new CustomEvent('eighths-training-update', {
      detail: {
        stepIdx: this.eighthsCurrentStepIdx + 1,
        totalSteps: patterns.length,
        patternName: current.name,
        barInStep: this.eighthsBarInStep,
        totalBarsInStep: 4,
        isBarB: current.type === "2-bar" && (this.eighthsBarInStep === 2 || this.eighthsBarInStep === 4)
      }
    }));
  }

  advanceEighthsTrainingRoutine() {
    this.eighthsBarInStep++;

    const patterns = this.getEighthsTrainingPatterns();

    if (this.eighthsBarInStep > 4) {
      this.eighthsBarInStep = 1;
      this.eighthsCurrentStepIdx++;

      if (this.eighthsCurrentStepIdx >= patterns.length) {
        this.onEighthsTrainingRoutineComplete();
        return;
      }
    }

    this.applyEighthsTrainingStepState();
  }

  onEighthsTrainingRoutineComplete() {
    this.stop();
    this.playSessionEndChime();
    setTimeout(() => {
      alert("🎉 8ths Rhythm Training Complete! All 12 Patterns Finished.");
    }, 100);
  }

  // --- 16th Rhythm Training Preset Routine Logic ---
  startSixteenthsTrainingRoutine() {
    this.sixteenthsTrainingRoutineActive = true;
    this.eighthsTrainingRoutineActive = false;
    this.subdivisionsRoutineActive = false;
    this.sixteenthsCurrentStepIdx = 0;
    this.sixteenthsBarInStep = 1;
    this.gapTrainerEnabled = false;
    this.tempoRampEnabled = false;

    // Force 4/4 time signature and 16th notes subdivision
    this.beatsPerMeasure = 4;
    this.subdivision = 4;

    this.applySixteenthsTrainingStepState();
    this.start();
  }

  getSixteenthsTrainingPatterns() {
    const bAcc16 = ['accent', 'normal', 'normal', 'normal'];
    const bNorm16 = ['normal', 'normal', 'normal', 'normal'];
    const bAccQ = ['accent', 'mute', 'mute', 'mute'];
    const bNormQ = ['normal', 'mute', 'mute', 'mute'];

    const pAll16 = [bAcc16, bNorm16, bNorm16, bNorm16];
    const pAllE = [['accent', 'normal', 'mute', 'mute'], ['normal', 'normal', 'mute', 'mute'], ['normal', 'normal', 'mute', 'mute'], ['normal', 'normal', 'mute', 'mute']];
    const pAllN = [['accent', 'mute', 'normal', 'mute'], ['normal', 'mute', 'normal', 'mute'], ['normal', 'mute', 'normal', 'mute'], ['normal', 'mute', 'normal', 'mute']];
    const pAllA = [['accent', 'mute', 'mute', 'normal'], ['normal', 'mute', 'mute', 'normal'], ['normal', 'mute', 'mute', 'normal'], ['normal', 'mute', 'mute', 'normal']];

    const pQuarters = [bAccQ, bNormQ, bNormQ, bNormQ];

    const buildBeatPattern = (targetBeatIdx, subIdx, isQuartersPlusSub) => {
      const grid = [
        ['accent', 'mute', 'mute', 'mute'],
        ['normal', 'mute', 'mute', 'mute'],
        ['normal', 'mute', 'mute', 'mute'],
        ['normal', 'mute', 'mute', 'mute']
      ];
      for (let b = 0; b < 4; b++) {
        if (isQuartersPlusSub) {
          if (b === targetBeatIdx) {
            grid[b][subIdx] = 'normal';
          }
        } else {
          for (let s = 1; s < 4; s++) {
            grid[b][s] = 'normal';
          }
          grid[targetBeatIdx][subIdx] = 'mute';
        }
      }
      return grid;
    };

    return [
      // Part 1: Foundations
      { name: "All 16th Notes", type: "1-bar", gridA: pAll16 },
      { name: "All 'e' Notes", type: "1-bar", gridA: pAllE },
      { name: "All '&' Notes", type: "1-bar", gridA: pAllN },
      { name: "All 'a' Notes", type: "1-bar", gridA: pAllA },

      // Part 2: Alternating 2-Bar Loops
      { name: "Quarter ➔ All 16ths", type: "2-bar", gridA: pQuarters, gridB: pAll16 },
      { name: "Quarter ➔ All 'e' Notes", type: "2-bar", gridA: pQuarters, gridB: pAllE },
      { name: "Quarter ➔ All '&' Notes", type: "2-bar", gridA: pQuarters, gridB: pAllN },
      { name: "Quarter ➔ All 'a' Notes", type: "2-bar", gridA: pQuarters, gridB: pAllA },
      { name: "All 16ths ➔ All 'e' Notes", type: "2-bar", gridA: pAll16, gridB: pAllE },
      { name: "All 16ths ➔ All '&' Notes", type: "2-bar", gridA: pAll16, gridB: pAllN },
      { name: "All 16ths ➔ All 'a' Notes", type: "2-bar", gridA: pAll16, gridB: pAllA },

      // Part 3: Per-Beat Offbeats (Beat 1 to 4 for e, &, a)
      // Beat 1
      { name: "Beat 1: Quarters + 'e'", type: "1-bar", gridA: buildBeatPattern(0, 1, true) },
      { name: "Beat 1: All 16ths ('e' Silent)", type: "1-bar", gridA: buildBeatPattern(0, 1, false) },
      { name: "Beat 1: Quarters + '&'", type: "1-bar", gridA: buildBeatPattern(0, 2, true) },
      { name: "Beat 1: All 16ths ('&' Silent)", type: "1-bar", gridA: buildBeatPattern(0, 2, false) },
      { name: "Beat 1: Quarters + 'a'", type: "1-bar", gridA: buildBeatPattern(0, 3, true) },
      { name: "Beat 1: All 16ths ('a' Silent)", type: "1-bar", gridA: buildBeatPattern(0, 3, false) },

      // Beat 2
      { name: "Beat 2: Quarters + 'e'", type: "1-bar", gridA: buildBeatPattern(1, 1, true) },
      { name: "Beat 2: All 16ths ('e' Silent)", type: "1-bar", gridA: buildBeatPattern(1, 1, false) },
      { name: "Beat 2: Quarters + '&'", type: "1-bar", gridA: buildBeatPattern(1, 2, true) },
      { name: "Beat 2: All 16ths ('&' Silent)", type: "1-bar", gridA: buildBeatPattern(1, 2, false) },
      { name: "Beat 2: Quarters + 'a'", type: "1-bar", gridA: buildBeatPattern(1, 3, true) },
      { name: "Beat 2: All 16ths ('a' Silent)", type: "1-bar", gridA: buildBeatPattern(1, 3, false) },

      // Beat 3
      { name: "Beat 3: Quarters + 'e'", type: "1-bar", gridA: buildBeatPattern(2, 1, true) },
      { name: "Beat 3: All 16ths ('e' Silent)", type: "1-bar", gridA: buildBeatPattern(2, 1, false) },
      { name: "Beat 3: Quarters + '&'", type: "1-bar", gridA: buildBeatPattern(2, 2, true) },
      { name: "Beat 3: All 16ths ('&' Silent)", type: "1-bar", gridA: buildBeatPattern(2, 2, false) },
      { name: "Beat 3: Quarters + 'a'", type: "1-bar", gridA: buildBeatPattern(2, 3, true) },
      { name: "Beat 3: All 16ths ('a' Silent)", type: "1-bar", gridA: buildBeatPattern(2, 3, false) },

      // Beat 4
      { name: "Beat 4: Quarters + 'e'", type: "1-bar", gridA: buildBeatPattern(3, 1, true) },
      { name: "Beat 4: All 16ths ('e' Silent)", type: "1-bar", gridA: buildBeatPattern(3, 1, false) },
      { name: "Beat 4: Quarters + '&'", type: "1-bar", gridA: buildBeatPattern(3, 2, true) },
      { name: "Beat 4: All 16ths ('&' Silent)", type: "1-bar", gridA: buildBeatPattern(3, 2, false) },
      { name: "Beat 4: Quarters + 'a'", type: "1-bar", gridA: buildBeatPattern(3, 3, true) },
      { name: "Beat 4: All 16ths ('a' Silent)", type: "1-bar", gridA: buildBeatPattern(3, 3, false) }
    ];
  }

  applySixteenthsTrainingStepState() {
    const patterns = this.getSixteenthsTrainingPatterns();
    const current = patterns[this.sixteenthsCurrentStepIdx];
    if (!current) return;

    let targetGrid = current.gridA;
    if (current.type === "2-bar" && (this.sixteenthsBarInStep === 2 || this.sixteenthsBarInStep === 4)) {
      targetGrid = current.gridB;
    }

    this.subdivisionGrid = JSON.parse(JSON.stringify(targetGrid));

    window.dispatchEvent(new CustomEvent('sixteenths-training-update', {
      detail: {
        stepIdx: this.sixteenthsCurrentStepIdx + 1,
        totalSteps: patterns.length,
        patternName: current.name,
        barInStep: this.sixteenthsBarInStep,
        totalBarsInStep: 4,
        isBarB: current.type === "2-bar" && (this.sixteenthsBarInStep === 2 || this.sixteenthsBarInStep === 4)
      }
    }));
  }

  advanceSixteenthsTrainingRoutine() {
    this.sixteenthsBarInStep++;

    const patterns = this.getSixteenthsTrainingPatterns();

    if (this.sixteenthsBarInStep > 4) {
      this.sixteenthsBarInStep = 1;
      this.sixteenthsCurrentStepIdx++;

      if (this.sixteenthsCurrentStepIdx >= patterns.length) {
        this.onSixteenthsTrainingRoutineComplete();
        return;
      }
    }

    this.applySixteenthsTrainingStepState();
  }

  onSixteenthsTrainingRoutineComplete() {
    this.stop();
    this.playSessionEndChime();
    setTimeout(() => {
      alert("🎉 16th Rhythm Training Complete! All 35 Patterns Finished.");
    }, 100);
  }

  // --- 8th Triplet Rhythm Training Preset Routine Logic ---
  startTripletsTrainingRoutine() {
    this.tripletsTrainingRoutineActive = true;
    this.sixteenthsTrainingRoutineActive = false;
    this.eighthsTrainingRoutineActive = false;
    this.subdivisionsRoutineActive = false;
    this.tripletsCurrentStepIdx = 0;
    this.tripletsBarInStep = 1;
    this.gapTrainerEnabled = false;
    this.tempoRampEnabled = false;

    // Force 4/4 time signature and 8th Triplets subdivision
    this.beatsPerMeasure = 4;
    this.subdivision = 3;

    this.applyTripletsTrainingStepState();
    this.start();
  }

  getTripletsTrainingPatterns() {
    const pAllTriplets = [['accent', 'normal', 'normal'], ['normal', 'normal', 'normal'], ['normal', 'normal', 'normal'], ['normal', 'normal', 'normal']];
    const pAllTrip = [['accent', 'normal', 'mute'], ['normal', 'normal', 'mute'], ['normal', 'normal', 'mute'], ['normal', 'normal', 'mute']];
    const pAllLet = [['accent', 'mute', 'normal'], ['normal', 'mute', 'normal'], ['normal', 'mute', 'normal'], ['normal', 'mute', 'normal']];
    const pQuarters = [['accent', 'mute', 'mute'], ['normal', 'mute', 'mute'], ['normal', 'mute', 'mute'], ['normal', 'mute', 'mute']];

    const buildTripletBeatPattern = (targetBeatIdx, subIdx, isQuartersPlusSub) => {
      const grid = [
        ['accent', 'mute', 'mute'],
        ['normal', 'mute', 'mute'],
        ['normal', 'mute', 'mute'],
        ['normal', 'mute', 'mute']
      ];
      for (let b = 0; b < 4; b++) {
        if (isQuartersPlusSub) {
          if (b === targetBeatIdx) {
            grid[b][subIdx] = 'normal';
          }
        } else {
          for (let s = 1; s < 3; s++) {
            grid[b][s] = 'normal';
          }
          grid[targetBeatIdx][subIdx] = 'mute';
        }
      }
      return grid;
    };

    return [
      { name: "All 8th Triplets", type: "1-bar", gridA: pAllTriplets },
      { name: "All 'trip' Notes (2nd Triplet)", type: "1-bar", gridA: pAllTrip },
      { name: "All 'let' Notes (3rd Triplet)", type: "1-bar", gridA: pAllLet },
      { name: "Quarter ➔ All 8th Triplets", type: "2-bar", gridA: pQuarters, gridB: pAllTriplets },
      { name: "Quarter ➔ 'trip' Notes", type: "2-bar", gridA: pQuarters, gridB: pAllTrip },
      { name: "Quarter ➔ 'let' Notes", type: "2-bar", gridA: pQuarters, gridB: pAllLet },

      // Beat 1
      { name: "Beat 1: Quarters + 'trip'", type: "1-bar", gridA: buildTripletBeatPattern(0, 1, true) },
      { name: "Beat 1: All Triplets ('trip' Silent)", type: "1-bar", gridA: buildTripletBeatPattern(0, 1, false) },
      { name: "Beat 1: Quarters + 'let'", type: "1-bar", gridA: buildTripletBeatPattern(0, 2, true) },
      { name: "Beat 1: All Triplets ('let' Silent)", type: "1-bar", gridA: buildTripletBeatPattern(0, 2, false) },

      // Beat 2
      { name: "Beat 2: Quarters + 'trip'", type: "1-bar", gridA: buildTripletBeatPattern(1, 1, true) },
      { name: "Beat 2: All Triplets ('trip' Silent)", type: "1-bar", gridA: buildTripletBeatPattern(1, 1, false) },
      { name: "Beat 2: Quarters + 'let'", type: "1-bar", gridA: buildTripletBeatPattern(1, 2, true) },
      { name: "Beat 2: All Triplets ('let' Silent)", type: "1-bar", gridA: buildTripletBeatPattern(1, 2, false) },

      // Beat 3
      { name: "Beat 3: Quarters + 'trip'", type: "1-bar", gridA: buildTripletBeatPattern(2, 1, true) },
      { name: "Beat 3: All Triplets ('trip' Silent)", type: "1-bar", gridA: buildTripletBeatPattern(2, 1, false) },
      { name: "Beat 3: Quarters + 'let'", type: "1-bar", gridA: buildTripletBeatPattern(2, 2, true) },
      { name: "Beat 3: All Triplets ('let' Silent)", type: "1-bar", gridA: buildTripletBeatPattern(2, 2, false) },

      // Beat 4
      { name: "Beat 4: Quarters + 'trip'", type: "1-bar", gridA: buildTripletBeatPattern(3, 1, true) },
      { name: "Beat 4: All Triplets ('trip' Silent)", type: "1-bar", gridA: buildTripletBeatPattern(3, 1, false) },
      { name: "Beat 4: Quarters + 'let'", type: "1-bar", gridA: buildTripletBeatPattern(3, 2, true) },
      { name: "Beat 4: All Triplets ('let' Silent)", type: "1-bar", gridA: buildTripletBeatPattern(3, 2, false) }
    ];
  }

  applyTripletsTrainingStepState() {
    const patterns = this.getTripletsTrainingPatterns();
    const current = patterns[this.tripletsCurrentStepIdx];
    if (!current) return;

    let targetGrid = current.gridA;
    if (current.type === "2-bar" && (this.tripletsBarInStep === 2 || this.tripletsBarInStep === 4)) {
      targetGrid = current.gridB;
    }

    this.subdivisionGrid = JSON.parse(JSON.stringify(targetGrid));

    window.dispatchEvent(new CustomEvent('triplets-training-update', {
      detail: {
        stepIdx: this.tripletsCurrentStepIdx + 1,
        totalSteps: patterns.length,
        patternName: current.name,
        barInStep: this.tripletsBarInStep,
        totalBarsInStep: 4,
        isBarB: current.type === "2-bar" && (this.tripletsBarInStep === 2 || this.tripletsBarInStep === 4)
      }
    }));
  }

  advanceTripletsTrainingRoutine() {
    this.tripletsBarInStep++;

    const patterns = this.getTripletsTrainingPatterns();

    if (this.tripletsBarInStep > 4) {
      this.tripletsBarInStep = 1;
      this.tripletsCurrentStepIdx++;

      if (this.tripletsCurrentStepIdx >= patterns.length) {
        this.onTripletsTrainingRoutineComplete();
        return;
      }
    }

    this.applyTripletsTrainingStepState();
  }

  onTripletsTrainingRoutineComplete() {
    this.stop();
    this.playSessionEndChime();
    setTimeout(() => {
      alert("🎉 8th Triplet Rhythm Training Complete! All 22 Patterns Finished.");
    }, 100);
  }

  startRampTimeTimer() {
    this.stopRampTimeTimer();
    this.rampTimerInterval = setInterval(() => {
      if (!this.isPlaying || !this.tempoRampEnabled || this.rampMode !== 'time' || this.inRoutineBreak || this.isPaused || this.subdivisionsRoutineActive) return;

      this.rampTimeElapsedSec++;

      if (this.rampSchedule && this.rampSchedule.length > 0) {
        let cumulativeSec = 0;
        let currentStepObj = null;

        for (let i = 0; i < this.rampSchedule.length; i++) {
          const step = this.rampSchedule[i];
          cumulativeSec += step.durationSec;
          if (this.rampTimeElapsedSec < cumulativeSec) {
            currentStepObj = step;
            break;
          }
        }

        if (currentStepObj) {
          if (this.tempo !== currentStepObj.bpm) {
            this.setTempo(currentStepObj.bpm);
          }
        }
      } else if (this.rampEveryTimeSec > 0 && this.rampTimeElapsedSec % this.rampEveryTimeSec === 0) {
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

        if (this.routineBreakRemaining <= 5 && this.routineBreakRemaining > 0) {
          this.playBreakCountdownBeep(this.routineBreakRemaining);
        }

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
    if (!this.timerID) {
      this.timerID = setInterval(() => this.scheduler(), this.lookaheadMs);
    }
    if (this.tempoRampEnabled && this.rampMode === 'time' && !this.subdivisionsRoutineActive) {
      this.startRampTimeTimer();
    }
    this.startPracticeStopwatch();

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
    let subState = (this.subdivisionGrid[beat] && this.subdivisionGrid[beat][subStep]) ? this.subdivisionGrid[beat][subStep] : 'normal';
    const isMainBeat = subStep === 0;

    if (this.inCountIn) {
      if (!isMainBeat) return;
      subState = (beat === 0 ? 'accent' : 'normal');
    }

    const dispatchTick = () => {
      if (this.isPlaying && !this.inRoutineBreak && !this.inSubdivisionsBreak && !this.isPaused) {
        window.dispatchEvent(new CustomEvent('metronome-tick', {
          detail: { 
            beat, 
            subStep, 
            accentState: subState, 
            isBarMuted: this.inCountIn ? false : this.isBarMuted, 
            measureCount: this.inCountIn ? 0 : this.currentMeasureCount + 1 
          }
        }));
      }
    };

    const delayMs = (time - this.audioCtx.currentTime) * 1000;
    if (delayMs <= 12) {
      requestAnimationFrame(dispatchTick);
    } else {
      setTimeout(() => {
        requestAnimationFrame(dispatchTick);
      }, Math.max(0, delayMs - 12));
    }

    if (this.inCountIn) {
      if (!isMainBeat) return;
      this.playCountInTone(time, this.accentVolume, beat === 0);
      return;
    }

    if (beat === 0 && subStep === 0 && this.isLastBarOfSession()) {
      this.playLastBarChime(time);
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

  isLastBarOfSession() {
    const barDurationSec = (60.0 / this.tempo) * this.beatsPerMeasure;

    if (this.subdivisionsRoutineActive) {
      return (this.subdivisionsBarInStage === 4);
    }
    if (this.eighthsTrainingRoutineActive) {
      return (this.eighthsBarInStep === 4);
    }
    if (this.sixteenthsTrainingRoutineActive) {
      return (this.sixteenthsBarInStep === 4);
    }
    if (this.tripletsTrainingRoutineActive) {
      return (this.tripletsBarInStep === 4);
    }

    if (this.tempoRampEnabled) {
      if (this.rampMode === 'time') {
        if (this.rampSchedule && this.rampSchedule.length > 0) {
          let cumulativeSec = 0;
          for (let i = 0; i < this.rampSchedule.length; i++) {
            cumulativeSec += this.rampSchedule[i].durationSec;
            const remInStep = cumulativeSec - this.rampTimeElapsedSec;
            if (remInStep > 0 && remInStep <= barDurationSec + 0.5) {
              return true;
            }
          }
        } else if (this.rampEveryTimeSec > 0) {
          const remInTempoStep = this.rampEveryTimeSec - (this.rampTimeElapsedSec % this.rampEveryTimeSec);
          if (remInTempoStep <= barDurationSec + 0.5) return true;

          if (this.routineActive && this.rampTotalDurationSec > 0) {
            const remInRun = this.rampTotalDurationSec - this.rampTimeElapsedSec;
            if (remInRun <= barDurationSec + 0.5) return true;
          }
        }
      } else if (this.rampMode === 'bars' && this.rampEveryBars > 0) {
        if ((this.rampBarsCompleted + 1) % this.rampEveryBars === 0) return true;
      }
    }

    if (this.timerMode === 'countdown' && this.sessionTimerDuration > 0) {
      if (this.sessionTimeRemaining > 0 && this.sessionTimeRemaining <= barDurationSec + 0.5) return true;
    }

    return false;
  }

  playLastBarChime(time) {
    if (!this.audioCtx) return;
    const masterVol = this.masterVolume;
    const osc1 = this.audioCtx.createOscillator();
    const osc2 = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(1800, time);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2400, time);

    gain.gain.setValueAtTime(0.85 * masterVol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 0.35);
    osc2.stop(time + 0.35);
  }

  playBreakCountdownBeep(sec) {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    const masterVol = this.masterVolume;
    const freq = (sec === 1 ? 1200 : 800);
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.7 * masterVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  schedulePolyNote(polyBeat, time) {
    if (this.isBarMuted) return;

    const dispatchPolyTick = () => {
      if (this.isPlaying && !this.inRoutineBreak && !this.inSubdivisionsBreak && !this.isPaused) {
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

      case 'stick':
        osc.type = isMainBeat ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(isMainBeat ? 2400 : 1600, time);
        osc.frequency.exponentialRampToValueAtTime(isMainBeat ? 1200 : 800, time + 0.035);
        gain.gain.setValueAtTime(noteVolume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
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

  playCountInTone(time, noteVolume, isBeat1) {
    const master = this.audioCtx.createGain();
    master.gain.value = this.masterVolume;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = isBeat1 ? 'triangle' : 'sine';
    const startFreq = isBeat1 ? 2400 : 1600;
    const endFreq = isBeat1 ? 1200 : 800;

    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.035);

    const volMult = isBeat1 ? 1.0 : 0.75;
    gain.gain.setValueAtTime(noteVolume * volMult, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

    const bufferSize = Math.floor(this.audioCtx.sampleRate * 0.015);
    const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.audioCtx.createBufferSource();
    noiseNode.buffer = noiseBuffer;

    const noiseGain = this.audioCtx.createGain();
    noiseGain.gain.setValueAtTime(noteVolume * (isBeat1 ? 0.35 : 0.2), time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.015);

    osc.connect(gain);
    gain.connect(master);

    noiseNode.connect(noiseGain);
    noiseGain.connect(master);

    master.connect(this.audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.04);
    noiseNode.start(time);
    noiseNode.stop(time + 0.02);
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
      if (!this.isPlaying || this.inRoutineBreak || this.inSubdivisionsBreak || this.isPaused) return;
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
    const newBpm = Math.min(Math.max(bpm, 20), this.maxTempo);
    const tempoChanged = (newBpm !== this.tempo);
    this.tempo = newBpm;

    if (tempoChanged && (this.isPlaying || this.isPaused)) {
      this.tempoChangeUnmuteBarsRemaining = 2;
      this.checkGapMuteState();
    }

    window.dispatchEvent(new CustomEvent('tempo-changed', { detail: { tempo: this.tempo } }));
  }

  setBeatsPerMeasure(n) {
    this.beatsPerMeasure = parseInt(n, 10);
    this.initSubdivisionGrid(false);
  }

  setSubdivision(s) {
    this.subdivision = parseFloat(s);
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
