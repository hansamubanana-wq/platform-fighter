/**
 * SoundManager - Web Audio API を使ったプロシージャル効果音 (改良版)
 * - デチューン・倍音重ね合わせで音に厚みを追加
 * - 共有リバーブで空間感を付加
 * - ディストーションで重さを表現
 */
export class SoundManager {
  constructor() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.ctx = null;
      return;
    }
    this.masterVolume = 0.6;
    this._reverb = null;
    this._reverbSend = null;
    this._initReverb();
  }

  /** 短いコンボリューションリバーブを初期化 */
  _initReverb() {
    if (!this.ctx) return;
    const dur = 0.5;
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * dur);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
      }
    }
    this._reverb = this.ctx.createConvolver();
    this._reverb.buffer = buf;
    this._reverbSend = this.ctx.createGain();
    this._reverbSend.gain.value = 0.22;
    this._reverb.connect(this._reverbSend);
    this._reverbSend.connect(this.ctx.destination);
  }

  /** AudioContext のサスペンド解除 */
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /** ドライ出力用ゲイン */
  _gain(volume = 1.0) {
    const g = this.ctx.createGain();
    g.gain.value = volume * this.masterVolume;
    g.connect(this.ctx.destination);
    return g;
  }

  /** リバーブ付きゲイン (reverbWet: 0.0 〜 1.0) */
  _gainRv(volume = 1.0, reverbWet = 0.3) {
    const g = this.ctx.createGain();
    g.gain.value = volume * this.masterVolume;
    g.connect(this.ctx.destination);
    if (reverbWet > 0 && this._reverb) {
      const send = this.ctx.createGain();
      send.gain.value = reverbWet;
      g.connect(send);
      send.connect(this._reverb);
    }
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

  /** ディストーション Waveshaper */
  _makeDistortion(amount = 40) {
    const ws = this.ctx.createWaveShaper();
    const n = 512;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    ws.curve = curve;
    ws.oversample = '2x';
    return ws;
  }

  /** ジャンプ音: ふわっとした上昇チャープ */
  playJump(isDouble = false) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const dur = isDouble ? 0.20 : 0.16;
    const startF = isDouble ? 480 : 260;
    const endF   = isDouble ? 1100 : 700;

    // 2つのデチューンしたオシレータで厚みを出す
    [{ type: 'sine', detune: 0, vol: 0.22 }, { type: 'triangle', detune: 10, vol: 0.10 }].forEach(cfg => {
      const osc = this.ctx.createOscillator();
      osc.type = cfg.type;
      osc.detune.value = cfg.detune;
      osc.frequency.setValueAtTime(startF, t);
      osc.frequency.exponentialRampToValueAtTime(endF, t + dur);
      const g = this._gainRv((isDouble ? 1.2 : 1) * cfg.vol, 0.2);
      g.gain.setValueAtTime((isDouble ? 1.2 : 1) * cfg.vol * this.masterVolume, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + dur + 0.06);
    });

    // 短いウィンドノイズ
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur * 0.7);
    const bf = this.ctx.createBiquadFilter();
    bf.type = 'bandpass';
    bf.frequency.setValueAtTime(startF * 3, t);
    bf.frequency.exponentialRampToValueAtTime(endF * 2.5, t + dur * 0.7);
    bf.Q.value = 5;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.045 * this.masterVolume, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.7);
    src.connect(bf);
    bf.connect(ng);
    ng.connect(this.ctx.destination);
    src.start(t);
  }

  /** 着地音: ドスンとした重い衝撃 */
  playLand() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const dur = 0.14;

    // 低域ノイズバースト
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const noiseEnv = this.ctx.createGain();
    noiseEnv.gain.setValueAtTime(0.55 * this.masterVolume, t);
    noiseEnv.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(lp);
    lp.connect(noiseEnv);
    noiseEnv.connect(this.ctx.destination);
    src.start(t);

    // 体の振動感 (サブバス)
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.12);
    const oscEnv = this.ctx.createGain();
    oscEnv.gain.setValueAtTime(0.40 * this.masterVolume, t);
    oscEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(oscEnv);
    oscEnv.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  /** 攻撃音: 風を切る鋭いスウィッシュ */
  playAttack(isSmash = false) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const dur = isSmash ? 0.28 : 0.15;

    // ウィンドスウィッシュ (フィルタードノイズ)
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isSmash ? 2200 : 2800, t);
    bp.frequency.exponentialRampToValueAtTime(isSmash ? 350 : 550, t + dur);
    bp.Q.value = 1.2;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime((isSmash ? 0.30 : 0.20) * this.masterVolume, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.ctx.destination);
    src.start(t);

    // スマッシュ: 低音のうなり + ディストーション
    if (isSmash) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + dur);
      const dist = this._makeDistortion(35);
      const oscEnv = this.ctx.createGain();
      oscEnv.gain.setValueAtTime(0.18 * this.masterVolume, t);
      oscEnv.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(dist);
      dist.connect(oscEnv);
      oscEnv.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    }
  }

  /** ヒット音: 打撃インパクト */
  playHit(isHeavy = false) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const dur = isHeavy ? 0.35 : 0.20;

    // 高域インパクトノイズ (パンッ / ドンッ)
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur * 0.5);
    const hp = this.ctx.createBiquadFilter();
    hp.type = isHeavy ? 'bandpass' : 'highpass';
    hp.frequency.value = isHeavy ? 1400 : 2200;
    hp.Q.value = isHeavy ? 1.5 : 1;
    const nEnv = this.ctx.createGain();
    nEnv.gain.setValueAtTime((isHeavy ? 0.55 : 0.38) * this.masterVolume, t);
    nEnv.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.45);
    src.connect(hp);
    hp.connect(nEnv);
    nEnv.connect(this.ctx.destination);
    src.start(t);

    // サブバス (ドスン感)
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isHeavy ? 120 : 170, t);
    osc.frequency.exponentialRampToValueAtTime(isHeavy ? 28 : 50, t + dur);
    const oscEnv = this._gainRv(isHeavy ? 0.55 : 0.30, isHeavy ? 0.25 : 0.1);
    oscEnv.gain.setValueAtTime((isHeavy ? 0.55 : 0.30) * this.masterVolume, t);
    oscEnv.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(oscEnv);
    osc.start(t);
    osc.stop(t + dur + 0.01);

    // 重い攻撃: ミッドバンドと追加サブ
    if (isHeavy) {
      const mid = this.ctx.createBufferSource();
      mid.buffer = this._noiseBuffer(0.22);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 700;
      bp.Q.value = 2.0;
      const midEnv = this.ctx.createGain();
      midEnv.gain.setValueAtTime(0.42 * this.masterVolume, t);
      midEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      mid.connect(bp);
      bp.connect(midEnv);
      midEnv.connect(this.ctx.destination);
      mid.start(t);

      // 最低音のズーン
      const sub = this.ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(65, t);
      sub.frequency.exponentialRampToValueAtTime(18, t + 0.28);
      const subEnv = this.ctx.createGain();
      subEnv.gain.setValueAtTime(0.50 * this.masterVolume, t);
      subEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      sub.connect(subEnv);
      subEnv.connect(this.ctx.destination);
      sub.start(t);
      sub.stop(t + 0.29);
    }
  }

  /** シールドヒット音: 金属的なクランク (複数倍音) */
  playShieldHit() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    // 複数の部分音を重ねて金属質を表現
    const partials = [1100, 1750, 2350, 3200, 4100];
    partials.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.28);
      const vol = [0.18, 0.12, 0.08, 0.05, 0.03][i];
      const env = this._gainRv(vol, 0.35);
      env.gain.setValueAtTime(vol * this.masterVolume, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(env);
      osc.start(t);
      osc.stop(t + 0.29);
    });
  }

  /** シールドブレイク音: 破砕 + ノイズ */
  playShieldBreak() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    for (let i = 0; i < 8; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = i % 2 === 0 ? 'sawtooth' : 'square';
      const baseFreq = 180 + i * 220 + Math.random() * 100;
      const d = i * 0.03;
      osc.frequency.setValueAtTime(baseFreq, t + d);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.12, t + d + 0.42);
      g.gain.setValueAtTime(0.09 * this.masterVolume, t + d);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.42);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t + d);
      osc.stop(t + d + 0.43);
    }

    // 広帯域ノイズバースト
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.38);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 800;
    const env = this._gainRv(0.45, 0.3);
    env.gain.setValueAtTime(0.45 * this.masterVolume, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    src.connect(hp);
    hp.connect(env);
    src.start(t);
  }

  /** リングアウト音: ドップラー落下 */
  playRingOut() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const dur = 0.75;

    // メインピッチ急降下
    [{ type: 'sawtooth', vol: 0.20, det: 0 }, { type: 'sine', vol: 0.10, det: -8 }].forEach(cfg => {
      const osc = this.ctx.createOscillator();
      osc.type = cfg.type;
      osc.detune.value = cfg.det;
      osc.frequency.setValueAtTime(720, t);
      osc.frequency.exponentialRampToValueAtTime(35, t + dur);
      const g = this._gainRv(cfg.vol, 0.2);
      g.gain.setValueAtTime(cfg.vol * this.masterVolume, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    });

    // ウィンドノイズ
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1400, t);
    bp.frequency.exponentialRampToValueAtTime(150, t + dur);
    bp.Q.value = 1.2;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.20 * this.masterVolume, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.ctx.destination);
    src.start(t);
  }

  /** 勝利ファンファーレ: ハーモニー付き */
  playVictory() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    // ハーモニーを重ねた4和音ファンファーレ
    const melody = [
      { freqs: [523, 659],   dur: 0.16, delay: 0.00 },
      { freqs: [659, 784],   dur: 0.16, delay: 0.18 },
      { freqs: [784, 988],   dur: 0.16, delay: 0.36 },
      { freqs: [1047, 1319], dur: 0.60, delay: 0.54 },
    ];

    melody.forEach(({ freqs, dur, delay }) => {
      freqs.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.value = freq;
        const vol = i === 0 ? 0.15 : 0.09;
        const env = this._gainRv(vol, 0.4);
        env.gain.setValueAtTime(0, t + delay);
        env.gain.linearRampToValueAtTime(vol * this.masterVolume, t + delay + 0.025);
        env.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
        osc.connect(env);
        osc.start(t + delay);
        osc.stop(t + delay + dur + 0.02);
      });
    });
  }
}
