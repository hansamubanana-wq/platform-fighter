// タッチコントロール - スマホ用バーチャルパッド (HTML オーバーレイ)

export const isTouchDevice =
  typeof window !== 'undefined' &&
  (('ontouchstart' in window) || navigator.maxTouchPoints > 0);

export class TouchControls {
  constructor() {
    // 保持型入力 (押し続けで有効)
    this._held = { left: false, right: false, up: false, down: false, shield: false };
    // 単発型入力 (1フレームのみ有効、読み取り後リセット)
    this._jump   = false;
    this._attack = false;
    this._smash  = false;

    this._el = null;
    this._styleEl = null;
    this._build();
  }

  _build() {
    // === CSS ===
    this._styleEl = document.createElement('style');
    this._styleEl.id = 'pf-touch-styles';
    this._styleEl.textContent = `
      #pf-touch {
        position: fixed; inset: 0;
        pointer-events: none;
        z-index: 999;
        touch-action: none;
        user-select: none;
      }
      .pf-btn {
        position: absolute;
        width: 68px; height: 68px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 13px; font-weight: bold; font-family: sans-serif;
        color: rgba(255,255,255,0.9);
        background: rgba(255,255,255,0.15);
        border: 2px solid rgba(255,255,255,0.4);
        pointer-events: auto;
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
        box-sizing: border-box;
      }
      .pf-btn.pressed { background: rgba(255,255,255,0.38); }
      #pf-pause-btn {
        position: absolute;
        top: 8px; left: 50%; transform: translateX(-50%);
        width: 80px; height: 36px;
        border-radius: 18px;
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: bold; font-family: sans-serif;
        color: rgba(255,255,255,0.8);
        background: rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.3);
        pointer-events: auto;
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
      }
      #pf-portrait-warn {
        display: none;
        position: fixed; inset: 0; z-index: 9999;
        background: #000;
        color: #fff;
        align-items: center; justify-content: center;
        flex-direction: column;
        font-size: 20px; font-family: sans-serif; text-align: center;
      }
      @media (orientation: portrait) {
        #pf-portrait-warn { display: flex; }
      }
    `;
    document.head.appendChild(this._styleEl);

    // === コンテナ ===
    this._el = document.createElement('div');
    this._el.id = 'pf-touch';
    document.body.appendChild(this._el);

    // === 縦画面警告 ===
    const warn = document.createElement('div');
    warn.id = 'pf-portrait-warn';
    warn.innerHTML = '📱 横向きにしてください<br><span style="font-size:14px;opacity:0.7">Please rotate to landscape</span>';
    this._el.appendChild(warn);

    // === ポーズボタン ===
    const pauseBtn = document.createElement('div');
    pauseBtn.id = 'pf-pause-btn';
    pauseBtn.textContent = '⏸ Pause';
    this._onPause = null;
    pauseBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this._onPause) this._onPause();
    });
    this._el.appendChild(pauseBtn);

    // === ボタン定義 ===
    // 位置は bottom/left/right の CSS px (ビューポート基準)
    const M = 10;  // 端のマージン
    const S = 74;  // ボタン間のピッチ (68px + 6px gap)

    const defs = [
      // 左サイド: 方向パッド (十字)
      { id: 'left',   label: '◀',    left: M,       bottom: M+S,   border: '#7ea6ff', held: 'left'   },
      { id: 'right',  label: '▶',    left: M+S*2,   bottom: M+S,   border: '#7ea6ff', held: 'right'  },
      { id: 'up',     label: '▲',    left: M+S,     bottom: M+S*2, border: '#4fc3f7', held: 'up', jump: true },
      { id: 'down',   label: '▼',    left: M+S,     bottom: M,     border: '#7ea6ff', held: 'down'   },
      // 右サイド: アクション
      { id: 'jump',   label: 'Jump', right: M+S,    bottom: M+S*2, border: '#4fc3f7', jump: true       },
      { id: 'attack', label: '攻撃', right: M+S*2,  bottom: M+S,   border: '#76ff03', attack: true     },
      { id: 'smash',  label: '強攻撃',right: M,      bottom: M+S,   border: '#ff9800', smash: true      },
      { id: 'shield', label: 'ガード',right: M+S,    bottom: M,     border: '#ce93d8', held: 'shield'  },
    ];

    defs.forEach(def => {
      const el = document.createElement('div');
      el.className = 'pf-btn';
      el.textContent = def.label;
      el.style.borderColor = def.border;
      if (def.left  !== undefined) el.style.left   = def.left  + 'px';
      if (def.right !== undefined) el.style.right  = def.right + 'px';
      el.style.bottom = def.bottom + 'px';

      const press = () => {
        el.classList.add('pressed');
        if (def.held)   this._held[def.held] = true;
        if (def.jump)   this._jump   = true;
        if (def.attack) this._attack = true;
        if (def.smash)  this._smash  = true;
      };
      const release = () => {
        el.classList.remove('pressed');
        if (def.held) this._held[def.held] = false;
      };

      el.addEventListener('pointerdown',   (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); press(); });
      el.addEventListener('pointerup',     (e) => { e.preventDefault(); release(); });
      el.addEventListener('pointercancel', ()  => { release(); });

      this._el.appendChild(el);
    });
  }

  // ポーズコールバック設定
  onPause(fn) { this._onPause = fn; }

  // InputManager から呼ばれる API
  getHorizontal() {
    if (this._held.left)  return -1;
    if (this._held.right) return  1;
    return 0;
  }

  getVertical() {
    if (this._held.up)   return -1;
    if (this._held.down) return  1;
    return 0;
  }

  isJumpJustPressed() {
    if (this._jump)   { this._jump   = false; return true; }
    return false;
  }

  isAttackJustPressed() {
    if (this._attack) { this._attack = false; return true; }
    return false;
  }

  isSmashJustPressed() {
    if (this._smash)  { this._smash  = false; return true; }
    return false;
  }

  isShieldHeld()   { return this._held.shield; }
  isDownHeld()     { return this._held.down;   }

  show() { if (this._el) this._el.style.display = ''; }
  hide() { if (this._el) this._el.style.display = 'none'; }

  destroy() {
    if (this._el)      { this._el.remove();      this._el      = null; }
    if (this._styleEl) { this._styleEl.remove(); this._styleEl = null; }
  }
}
