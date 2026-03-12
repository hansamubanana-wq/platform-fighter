/**
 * SoundManager - Web Audio API を使ったプロシージャル効果音
 * 外部音声ファイル不要でゲーム内効果音を生成する
 */
export class SoundManager {
  constructor() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.ctx = null;
    }
    this.masterVolume = 0.6;
  }

  /** AudioContext のサスペンド解除 (ブラウザ自動再生ポリシー対策) */
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /** マスターゲインノードを作成して destination に接続 */
  _gain(volume = 1.0) {
    const g = this.ctx.createGain();
    g.gain.value = volume * this.masterVolume;
    g.connect(this.ctx.destination);
    return g;
  }

  /** ホワイトノイズバッファを生成 */
  _noiseBuffer(durationSec) {
    const size = Math.floor(this.ctx.sampleRate * durationSec);
    const buf = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < size; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  /** ジャンプ音: 上昇する短いチャープ */
  playJump(isDouble = false) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this._gain(0.25);
    osc.connect(g);
    osc.type = 'sine';
    const startFreq = isDouble ? 450 : 320;
    const endFreq = isDouble ? 900 : 640;
    const dur = 0.12;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(0.25 * this.masterVolume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  /** 着地音: 低い鈍い音 */
  playLand() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const dur = 0.08;

    // ローパスフィルタ付きノイズバースト
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 250;
    const g = this._gain(0.35);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(1, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filter);
    filter.connect(env);
    env.connect(g);
    src.start(t);
  }

  /** 攻撃音: スウィッシュ */
  playAttack(isSmash = false) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const dur = isSmash ? 0.22 : 0.12;
    const startFreq = isSmash ? 500 : 350;
    const endFreq = isSmash ? 120 : 180;
    const vol = isSmash ? 0.22 : 0.14;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);

    const g = this._gain(vol);
    g.gain.setValueAtTime(vol * this.masterVolume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + dur + 0.01);

    // スマッシュは追加の低音インパクト
    if (isSmash) {
      const sub = this.ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(80, t);
      sub.frequency.exponentialRampToValueAtTime(30, t + 0.15);
      const subG = this._gain(0.18);
      subG.gain.setValueAtTime(0.18 * this.masterVolume, t);
      subG.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      sub.connect(subG);
      sub.start(t);
      sub.stop(t + 0.16);
    }
  }

  /** ヒット音: 打撃インパクト */
  playHit(isHeavy = false) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const dur = isHeavy ? 0.28 : 0.14;

    // ノイズ成分
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur);
    const noiseEnv = this.ctx.createGain();
    noiseEnv.gain.setValueAtTime(isHeavy ? 0.5 : 0.3, t);
    noiseEnv.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.7);

    const filter = this.ctx.createBiquadFilter();
    filter.type = isHeavy ? 'bandpass' : 'highpass';
    filter.frequency.value = isHeavy ? 350 : 900;
    filter.Q.value = 2;

    // 低音サイン波
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isHeavy ? 90 : 130, t);
    osc.frequency.exponentialRampToValueAtTime(isHeavy ? 30 : 50, t + dur);
    const oscEnv = this.ctx.createGain();
    oscEnv.gain.setValueAtTime(isHeavy ? 0.5 : 0.25, t);
    oscEnv.gain.exponentialRampToValueAtTime(0.001, t + dur);

    const master = this._gain(1.0);
    src.connect(filter);
    filter.connect(noiseEnv);
    noiseEnv.connect(master);
    osc.connect(oscEnv);
    oscEnv.connect(master);

    src.start(t);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  /** シールドヒット音: 金属的なクランク */
  playShieldHit() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.18);

    const g = this._gain(0.18);
    g.gain.setValueAtTime(0.18 * this.masterVolume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.19);
  }

  /** シールドブレイク音: 破砕効果 */
  playShieldBreak() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    for (let i = 0; i < 6; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.connect(g);
      g.connect(this.ctx.destination);

      osc.type = i % 2 === 0 ? 'sawtooth' : 'square';
      const baseFreq = 300 + i * 180 + Math.random() * 80;
      const delay = i * 0.025;
      osc.frequency.setValueAtTime(baseFreq, t + delay);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.2, t + delay + 0.35);

      g.gain.setValueAtTime(0.09 * this.masterVolume, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.35);
      osc.start(t + delay);
      osc.stop(t + delay + 0.36);
    }

    // ノイズバースト
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.3);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    filter.Q.value = 0.5;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.3 * this.masterVolume, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.ctx.destination);
    src.start(t);
  }

  /** リングアウト音: 落下ウーシュ */
  playRingOut() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const dur = 0.55;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + dur);

    const g = this._gain(0.28);
    g.gain.setValueAtTime(0.28 * this.masterVolume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  /** 勝利ファンファーレ */
  playVictory() {
    if (!this.ctx) return;
    this.resume();
    // C4 E4 G4 C5 のシンプルなファンファーレ
    const melody = [
      { freq: 523, dur: 0.12, delay: 0.05 },
      { freq: 659, dur: 0.12, delay: 0.18 },
      { freq: 784, dur: 0.12, delay: 0.31 },
      { freq: 1047, dur: 0.4,  delay: 0.45 },
    ];
    const t = this.ctx.currentTime;
    melody.forEach(({ freq, dur, delay }) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.12 * this.masterVolume, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + dur + 0.01);
    });
  }
}
