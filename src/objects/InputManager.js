// 入力管理 - キーボード & ゲームパッド & タッチの統一入力
import Phaser from 'phaser';

/**
 * InputManager - プレイヤーごとの入力状態を管理
 * キーボード、ゲームパッド、タッチ入力を統一的に扱う
 *
 * P1: WASD移動 / F攻撃 / G シールド / Hスマッシュ
 * P2: ↑↓←→移動 / L攻撃 / K シールド / Jスマッシュ
 */
export class InputManager {
  constructor(scene, playerIndex, touchControls = null) {
    this.scene = scene;
    this.playerIndex = playerIndex;
    this.keys = {};
    this.touchControls = touchControls; // タッチ入力 (スマホ用、P1のみ)

    // ゲームパッドの前フレーム状態 (JustDown 判定用)
    this.prevPadButtons = {};
    this.prevAxisUp = false; // スティック上入力の前フレーム

    this.setupKeyboard();
  }

  setupKeyboard() {
    if (this.playerIndex === 0) {
      this.keys = {
        up: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        attack: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
        shield: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G),
        smash: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H),
      };
    } else {
      this.keys = {
        up: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        down: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
        left: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        right: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
        attack: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L),
        shield: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K),
        smash: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J),
      };
    }
  }

  getGamepad() {
    if (!this.scene.input.gamepad) return null;
    const pads = this.scene.input.gamepad.gamepads;
    return pads[this.playerIndex] || null;
  }

  /**
   * ゲームパッドボタンの JustDown チェック
   */
  isPadButtonJustDown(pad, buttonIndex) {
    if (!pad || buttonIndex >= pad.buttons.length) return false;
    const pressed = pad.buttons[buttonIndex].pressed;
    const wasPressed = this.prevPadButtons[buttonIndex] || false;
    return pressed && !wasPressed;
  }

  /**
   * ゲームパッドの前フレーム状態を保存 (毎フレーム末尾で呼ぶ)
   */
  updatePrevPadState() {
    const pad = this.getGamepad();
    if (pad) {
      for (let i = 0; i < pad.buttons.length; i++) {
        this.prevPadButtons[i] = pad.buttons[i].pressed;
      }
      // スティック上入力の前フレーム保存
      if (pad.axes.length >= 2) {
        this.prevAxisUp = pad.axes[1].getValue() < -0.7;
      }
    }
  }

  getHorizontal() {
    const pad = this.getGamepad();
    if (pad) {
      if (pad.axes.length >= 1) {
        const axisX = pad.axes[0].getValue();
        if (Math.abs(axisX) > 0.2) return axisX > 0 ? 1 : -1;
      }
      if (pad.left) return -1;
      if (pad.right) return 1;
    }
    if (this.keys.left.isDown) return -1;
    if (this.keys.right.isDown) return 1;
    if (this.touchControls) return this.touchControls.getHorizontal();
    return 0;
  }

  getVertical() {
    const pad = this.getGamepad();
    if (pad) {
      if (pad.axes.length >= 2) {
        const axisY = pad.axes[1].getValue();
        if (Math.abs(axisY) > 0.3) return axisY > 0 ? 1 : -1;
      }
      if (pad.up) return -1;
      if (pad.down) return 1;
    }
    if (this.keys.up.isDown) return -1;
    if (this.keys.down.isDown) return 1;
    if (this.touchControls) return this.touchControls.getVertical();
    return 0;
  }

  isJumpPressed() {
    const pad = this.getGamepad();
    if (pad) {
      // Yボタン (index 3) = ジャンプ
      if (this.isPadButtonJustDown(pad, 3)) return true;
      // Xボタン (index 2) = ジャンプ
      if (this.isPadButtonJustDown(pad, 2)) return true;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.up)) return true;
    if (this.touchControls) return this.touchControls.isJumpJustPressed();
    return false;
  }

  /**
   * 攻撃入力の検出 + 方向を考慮した技タイプを返す
   * @returns {string|null} 技タイプ ('neutral', 'forward', 'up', 'down') or null
   */
  getAttackType() {
    const pad = this.getGamepad();
    let attackPressed = false;
    let isSmash = false;

    // ゲームパッド
    if (pad) {
      // Bボタン (index 1) = 弱攻撃 (通常攻撃)
      if (this.isPadButtonJustDown(pad, 1)) {
        attackPressed = true;
      }
      // Aボタン (index 0) = 強攻撃 (スマッシュ)
      if (this.isPadButtonJustDown(pad, 0)) {
        attackPressed = true;
        isSmash = true;
      }
    }

    // キーボード
    if (Phaser.Input.Keyboard.JustDown(this.keys.attack)) {
      attackPressed = true;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.smash)) {
      attackPressed = true;
      isSmash = true;
    }

    // タッチ
    if (this.touchControls) {
      if (this.touchControls.isAttackJustPressed()) attackPressed = true;
      if (this.touchControls.isSmashJustPressed())  { attackPressed = true; isSmash = true; }
    }

    if (!attackPressed) return null;

    // 方向入力で技を振り分ける
    const h = this.getHorizontal();
    const v = this.getVertical();

    if (isSmash) {
      if (v < 0) return 'smash_up';
      if (v > 0) return 'smash_down';
      if (h !== 0) return 'smash_forward';
      return 'smash_neutral';
    }

    if (v < 0) return 'up';
    if (v > 0) return 'down';
    if (h !== 0) return 'forward';
    return 'neutral';
  }

  /**
   * シールド入力
   */
  isShieldHeld() {
    const pad = this.getGamepad();
    if (pad) {
      // L/R トリガー or LB/RB
      if (pad.buttons.length > 4 && (pad.buttons[4].pressed || pad.buttons[5].pressed)) {
        return true;
      }
      // L2/R2 トリガー
      if (pad.buttons.length > 6 && (pad.buttons[6].pressed || pad.buttons[7].pressed)) {
        return true;
      }
    }
    if (this.keys.shield.isDown) return true;
    if (this.touchControls) return this.touchControls.isShieldHeld();
    return false;
  }

  isDownHeld() {
    const pad = this.getGamepad();
    if (pad) {
      if (pad.axes.length >= 2) {
        const axisY = pad.axes[1].getValue();
        if (axisY > 0.5) return true;
      }
      if (pad.down) return true;
    }
    if (this.keys.down.isDown) return true;
    if (this.touchControls) return this.touchControls.isDownHeld();
    return false;
  }

  /**
   * コントローラー振動 (Gamepad Vibration API)
   * Chrome: vibrationActuator.playEffect('dual-rumble', ...)
   * Firefox: hapticActuators[0].pulse(...)
   * @param {number} duration - 振動時間 (ms)
   * @param {number} weakMagnitude - 弱モーター強度 (0.0〜1.0)
   * @param {number} strongMagnitude - 強モーター強度 (0.0〜1.0)
   */
  vibrate(duration, weakMagnitude = 0.5, strongMagnitude = 0.5) {
    const pad = this.getGamepad();
    if (!pad) return;

    // Phaser は Gamepad をラップしているので、ネイティブの Gamepad オブジェクトを取得
    const nativePad = pad.pad || pad;

    // 初回接続時にデバッグ情報をコンソールに出力
    if (!this._vibrateLogged) {
      this._vibrateLogged = true;
      console.log(`[P${this.playerIndex + 1} Gamepad] id: "${nativePad.id}"`);
      console.log(`[P${this.playerIndex + 1} Gamepad] vibrationActuator:`, nativePad.vibrationActuator ?? 'なし');
      console.log(`[P${this.playerIndex + 1} Gamepad] hapticActuators:`, nativePad.hapticActuators ?? 'なし');
    }

    try {
      // Chrome / Edge: dual-rumble
      if (nativePad.vibrationActuator) {
        nativePad.vibrationActuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration,
          weakMagnitude,
          strongMagnitude,
        });
        return;
      }

      // Firefox: hapticActuators
      if (nativePad.hapticActuators && nativePad.hapticActuators.length > 0) {
        const magnitude = Math.max(weakMagnitude, strongMagnitude);
        nativePad.hapticActuators[0].pulse(magnitude, duration);
        return;
      }
    } catch (e) {
      // 振動非対応環境では無視
    }
  }
}
