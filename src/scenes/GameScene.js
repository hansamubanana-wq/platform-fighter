// ゲームシーン - メインのゲームプレイロジック
import Phaser from 'phaser';
import { Player, ATTACKS } from '../objects/Player.js';
import { Stage } from '../objects/Stage.js';
import { InputManager } from '../objects/InputManager.js';
import { TouchControls, isTouchDevice } from '../objects/TouchControls.js';

/**
 * GameScene - ステージ、プレイヤー、戦闘、UIを管理するメインシーン
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data) {
    this.cpuMode = data ? data.cpuMode : false;
    // タッチデバイスでは常にCPU対戦 (2人同時タッチ操作は非現実的)
    if (isTouchDevice) this.cpuMode = true;
    this.cpuTimer = 0; // AI思考用タイマー
  }

  create() {
    const { width, height } = this.cameras.main;

    // === カメラ設定 ===
    this.uiCamera = this.cameras.add(0, 0, width, height);
    
    // UIとWorldの描画分けヘルパー
    this.ignoreInUI = (obj) => {
      if (this.uiCamera && obj) {
        if (Array.isArray(obj)) obj.forEach(o => this.uiCamera.ignore(o));
        else this.uiCamera.ignore(obj);
      }
      return obj;
    };
    
    this.ignoreInWorld = (obj) => {
      if (this.cameras.main && obj) {
        if (Array.isArray(obj)) obj.forEach(o => this.cameras.main.ignore(o));
        else this.cameras.main.ignore(obj);
      }
      return obj;
    };

    // === 試合状態管理 ===
    this.matchStarted = false;
    this.matchOver = false;

    // === 背景演出 ===
    this.createBackground(width, height);

    // === ステージ作成 ===
    this.stage = new Stage(this);
    const [mainPlatformsGroup, floatingPlatformsGroup] = this.stage.getAllPlatforms();
    this.ignoreInUI(mainPlatformsGroup.getChildren());
    this.ignoreInUI(floatingPlatformsGroup.getChildren());

    // === プレイヤー作成 ===
    // スポーン位置を1920x1080に適応
    this.player1 = new Player(this, width / 2 - 200, height - 250, 'player1', 0);
    this.player2 = new Player(this, width / 2 + 200, height - 250, 'player2', 1);
    this.ignoreInUI([this.player1, this.player2]);

    // === タッチコントロール (スマホ用) ===
    this.touchControls = null;
    if (isTouchDevice) {
      this.touchControls = new TouchControls();
      this.touchControls.onPause(() => {
        this.scene.pause();
        this.scene.launch('PauseScene');
      });
    }

    // === 入力マネージャー ===
    this.input1 = new InputManager(this, 0, this.touchControls);
    this.input2 = new InputManager(this, 1);

    // シャットダウン時にタッチコントロールを破棄
    this.events.once('shutdown', () => {
      if (this.touchControls) {
        this.touchControls.destroy();
        this.touchControls = null;
      }
    });

    // === コリジョン設定 ===
    this.setupCollisions();

    // === UI作成 ===
    this.createUI(width, height);

    // === 操作説明テキスト ===
    this.createControlsInfo(width, height);

    // === カウントダウン開始 ===
    this.player1.body.setAllowGravity(false);
    this.player2.body.setAllowGravity(false);
    this.startCountdown(width, height);

    // === ポーズ機能 (ESCキー) ===
    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.pause();
      this.scene.launch('PauseScene');
    });
  }

  /**
   * 背景演出の作成
   */
  createBackground(width, height) {
    // AI生成の高画質背景画像
    const bg = this.add.image(width / 2, height / 2, 'bg');
    this.ignoreInUI(bg);
    
    // 画面全体を覆うようにスケール調整
    const scaleX = width / bg.width;
    const scaleY = height / bg.height;
    const scale = Math.max(scaleX, scaleY);
    bg.setScale(scale).setScrollFactor(0);
    // 少し暗くしてキャラクターを目立たせる
    bg.setTint(0xcccccc);

    // 装飾用の星や光インジケーター (既存維持)
    for (let i = 0; i < 50; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height * 0.7),
        Phaser.Math.Between(1, 3),
        0xffffff,
        Phaser.Math.FloatBetween(0.1, 0.5)
      );
      this.ignoreInUI(star);
      this.tweens.add({
        targets: star,
        alpha: { from: star.alpha, to: star.alpha * 0.3 },
        duration: Phaser.Math.Between(1000, 3000),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }
  }

  /**
   * コリジョン設定
   */
  setupCollisions() {
    const [mainPlatforms, floatingPlatforms] = this.stage.getAllPlatforms();

    this.physics.add.collider(this.player1, mainPlatforms);
    this.physics.add.collider(this.player2, mainPlatforms);

    this.floatCollider1 = this.physics.add.collider(this.player1, floatingPlatforms);
    this.floatCollider2 = this.physics.add.collider(this.player2, floatingPlatforms);

    this.physics.add.collider(this.player1, this.player2);
  }

  /**
   * カウントダウン演出
   */
  startCountdown(width, height) {
    const countdownStyle = {
      fontSize: '120px',
      fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 8,
    };

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.4);
    overlay.setDepth(100);
    this.ignoreInWorld(overlay);

    const counts = ['3', '2', '1', 'GO!'];
    const colors = ['#4fc3f7', '#ffeb3b', '#ef5350', '#76ff03'];
    let index = 0;

    const showNext = () => {
      if (index >= counts.length) {
        overlay.destroy();
        this.matchStarted = true;
        this.player1.body.setAllowGravity(true);
        this.player2.body.setAllowGravity(true);
        return;
      }

      const text = this.add.text(width / 2, height / 2, counts[index], {
        ...countdownStyle,
        color: colors[index],
        fontSize: counts[index] === 'GO!' ? '100px' : '120px',
      }).setOrigin(0.5).setDepth(101).setScale(0.3).setAlpha(0);
      this.ignoreInWorld(text);

      this.tweens.add({
        targets: text,
        scale: 1,
        alpha: 1,
        duration: 300,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: text,
            scale: 1.5,
            alpha: 0,
            duration: 400,
            delay: 300,
            ease: 'Power2',
            onComplete: () => {
              text.destroy();
              index++;
              showNext();
            },
          });
        },
      });
    };

    this.time.delayedCall(500, showNext);
  }

  /**
   * ダメージ UI & ストック UI の作成
   */
  createUI(width, height) {
    const uiY = height - 115;
    const panelW = 250;
    const panelH = 100;

    // === P1 UI (左側) ===
    this.p1Panel = this.add.graphics();
    this.drawPanel(this.p1Panel, 30, uiY, panelW, panelH, 0x4fc3f7);

    const t1 = this.add.text(52, uiY + 6, 'P1', {
      fontSize: '14px',
      fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
      color: '#4fc3f7',
      fontStyle: 'bold',
    });

    this.p1DamageText = this.add.text(155, uiY + 18, '0%', {
      fontSize: '44px',
      fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
      fontStyle: 'bold',
      color: '#4fc3f7',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0);

    // P1 ストックアイコン
    this.p1StockIcons = [];
    for (let i = 0; i < 3; i++) {
      const icon = this.add.circle(60 + i * 24, uiY + panelH - 16, 8, 0x4fc3f7, 1);
      this.p1StockIcons.push(icon);
    }

    // P1 シールドバー
    this.p1ShieldBarBg = this.add.rectangle(155, uiY + panelH - 16, 100, 8, 0x333333).setOrigin(0.5, 0.5);
    this.p1ShieldBar = this.add.rectangle(106, uiY + panelH - 16, 100, 8, 0x4fc3f7).setOrigin(0, 0.5);

    // === P2 UI (右側) ===
    const p2X = width - 30 - panelW;
    this.p2Panel = this.add.graphics();
    this.drawPanel(this.p2Panel, p2X, uiY, panelW, panelH, 0xef5350);

    const t2 = this.add.text(p2X + 22, uiY + 6, 'P2', {
      fontSize: '14px',
      fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
      color: '#ef5350',
      fontStyle: 'bold',
    });

    this.p2DamageText = this.add.text(p2X + panelW / 2, uiY + 18, '0%', {
      fontSize: '44px',
      fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
      fontStyle: 'bold',
      color: '#ef5350',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0);

    // P2 ストックアイコン
    this.p2StockIcons = [];
    for (let i = 0; i < 3; i++) {
      const icon = this.add.circle(p2X + 30 + i * 24, uiY + panelH - 16, 8, 0xef5350, 1);
      this.p2StockIcons.push(icon);
    }

    // P2 シールドバー
    this.p2ShieldBarBg = this.add.rectangle(p2X + panelW / 2, uiY + panelH - 16, 100, 8, 0x333333).setOrigin(0.5, 0.5);
    this.p2ShieldBar = this.add.rectangle(p2X + panelW / 2 - 50, uiY + panelH - 16, 100, 8, 0xef5350).setOrigin(0, 0.5);

    // === 上部タイトル ===
    const t3 = this.add.text(width / 2, 20, 'STAR BRAWLERS: ARENA UNBOUND', {
      fontSize: '24px',
      fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
      color: '#e0e0e0',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0).setAlpha(0.7);

    // UIコンテナ
    this.uiContainer = this.add.container(0, 0, [
      this.p1Panel, t1, this.p1DamageText, ...this.p1StockIcons, this.p1ShieldBarBg, this.p1ShieldBar,
      this.p2Panel, t2, this.p2DamageText, ...this.p2StockIcons, this.p2ShieldBarBg, this.p2ShieldBar,
      t3
    ]);
    this.ignoreInWorld(this.uiContainer);
  }

  drawPanel(graphics, x, y, w, h, color) {
    graphics.fillStyle(color, 0.12);
    graphics.fillRoundedRect(x, y, w, h, 12);
    graphics.lineStyle(2, color, 0.4);
    graphics.strokeRoundedRect(x, y, w, h, 12);
  }

  /**
   * 操作説明テキスト
   */
  createControlsInfo(width, height) {
    const infoStyle = {
      fontSize: '11px',
      fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
      color: '#aaaaaa',
      lineSpacing: 3,
    };

    const t1 = this.add.text(20, 12, 'P1: WASD移動 / F攻撃 / H強攻撃 / G防御', infoStyle).setAlpha(0.5);
    const t2 = this.add.text(width - 20, 12, 'P2: ↑↓←→移動 / L攻撃 / J強攻撃 / K防御', infoStyle)
      .setOrigin(1, 0).setAlpha(0.5);
    const t3 = this.add.text(width / 2, height - 12, 'ゲームパッド: 左スティック移動 / A:ジャンプ / X:攻撃 / B:強攻撃 / LB/RB:シールド', {
      ...infoStyle, fontSize: '10px',
    }).setOrigin(0.5, 1).setAlpha(0.35);

    this.ignoreInWorld([t1, t2, t3]);
  }

  /**
   * メインゲームループ
   */
  update(time, delta) {
    if (!this.matchStarted || this.matchOver) return;

    // プレイヤー入力 / CPUロジック
    if (!this.player1.isDead) {
      this.handlePlayerInput(this.player1, this.input1, this.floatCollider1);
    }
    if (!this.player2.isDead) {
      if (this.cpuMode) {
        this.updateCPU(delta);
      } else {
        this.handlePlayerInput(this.player2, this.input2, this.floatCollider2);
      }
    }

    // クールダウン & シールド更新
    this.player1.updateCooldown(delta);
    this.player2.updateCooldown(delta);

    // リングアウト判定
    this.checkRingOuts();

    // UI更新
    this.updateUI();

    // ジャンプカウントリセット
    this.resetJumpOnGround(this.player1);
    this.resetJumpOnGround(this.player2);

    // ゲームパッド前フレーム保存
    this.input1.updatePrevPadState();
    this.input2.updatePrevPadState();

    // ダイナミックカメラ更新
    this.updateCamera(delta);
  }

  /**
   * プレイヤー入力の処理
   */
  handlePlayerInput(player, input, floatCollider) {
    // シールド処理
    if (input.isShieldHeld() && !player.shieldBroken) {
      player.startShielding();
    } else {
      player.stopShielding();
    }

    // シールド中は移動・攻撃不可 (ジャンプは可)
    if (!player.isShielding) {
      const horizontal = input.getHorizontal();
      player.handleMovement(horizontal);
    }

    // ジャンプ
    if (input.isJumpPressed()) {
      player.jump();
    }

    // すり抜け床通過
    floatCollider.active = !input.isDownHeld();

    // 攻撃
    const attackType = input.getAttackType();
    if (attackType) {
      const hitbox = player.performAttack(this, attackType);
      if (hitbox) {
        this.setupHitboxOverlap(hitbox, player);
      }
    }
  }

  /**
   * 簡易的なCPU (AI) ロジック
   */
  updateCPU(delta) {
    const p1 = this.player1;
    const cpu = this.player2;

    if (cpu.isDead || p1.isDead || cpu.isAttacking || cpu.shieldStun > 0 || cpu.hitStun > 0) return;

    this.cpuTimer += delta;

    // 毎フレームではなく一定間隔で思考を更新する (200ms程度)
    if (this.cpuTimer > 200) {
      this.cpuTimer = 0;

      const distX = p1.x - cpu.x;
      const distY = p1.y - cpu.y;
      const absDistX = Math.abs(distX);
      const absDistY = Math.abs(distY);

      // --- 行動決定 ---
      // 1. リングアウトしそうなら復帰を最優先
      if (cpu.y > this.cameras.main.height + 50 || cpu.x < 50 || cpu.x > this.cameras.main.width - 50) {
        if (cpu.y > p1.y) cpu.jump(); // 上へ
        cpu.handleMovement(cpu.x < this.cameras.main.width / 2 ? 1 : -1);
        
        // 空中ジャンプが尽きたら上スマッシュ（復帰技）を試みる
        if (cpu.jumpCount >= cpu.maxJumps && Math.random() < 0.5) {
          const hitbox = cpu.performAttack(this, 'smash_up');
          if (hitbox) this.setupHitboxOverlap(hitbox, cpu);
        }
        return;
      }

      // 2. 攻撃レンジ (Xが近く、Yも近い場合)
      if (absDistX < 80 && absDistY < 60) {
        cpu.handleMovement(0);
        
        // プレイヤーの方向を向く
        cpu.facingRight = distX > 0;
        cpu.setFlipX(!cpu.facingRight);

        // ガードするか攻撃するかランダム
        if (p1.isAttacking && cpu.shieldHP > 30 && Math.random() < 0.6) {
          cpu.startShielding();
        } else {
          cpu.stopShielding();
          // ランダムな攻撃
          const attacks = ['neutral', 'forward', 'down', 'smash_forward', 'smash_down'];
          const attackType = Phaser.Math.RND.pick(attacks);
          const hitbox = cpu.performAttack(this, attackType);
          if (hitbox) this.setupHitboxOverlap(hitbox, cpu);
        }
      } 
      // 3. 離れている場合: 相手に近づく
      else {
        cpu.stopShielding();

        // 相手が上にいるならジャンプ
        if (distY < -80 && absDistX < 150 && Math.random() < 0.4) {
          cpu.jump();
        }

        // 左右移動
        if (absDistX > 40) {
          cpu.handleMovement(distX > 0 ? 1 : -1);
        } else {
          cpu.handleMovement(0);
        }
      }
    }
  }

  /**
   * ヒットボックスのオーバーラップ検出設定
   */
  setupHitboxOverlap(hitbox, attacker) {
    const target = attacker.playerIndex === 0 ? this.player2 : this.player1;
    if (target.isDead) return;

    const overlap = this.physics.add.overlap(hitbox, target, () => {
      const attackData = attacker.currentAttackData;
      if (!attackData) return;

      // シールド中の場合
      if (target.isShielding) {
        const broken = target.hitShield(attackData.damage);
        if (broken) {
          this.showStatusText('シールドブレイク！', target.x, target.y - 40, '#ff1744');
        }
        // シールドノックバック (小さめ)
        const dir = target.x > attacker.x ? 1 : -1;
        target.setVelocityX(dir * attackData.knockback * 0.2);
      } else {
        // 通常ダメージ
        target.takeDamage(
          attackData.damage,
          attackData.knockback,
          attacker.x,
          attackData.knockbackAngle
        );
        this.createHitEffect(target.x, target.y);
      }

      // ヒットボックス即破棄
      if (hitbox.active) {
        hitbox.destroy();
        attacker.hitbox = null;
      }
      overlap.destroy();
    });
  }

  /**
   * ステータステキスト表示 (シールドブレイク等)
   */
  showStatusText(message, x, y, color) {
    const text = this.add.text(x, y, message, {
      fontSize: '18px',
      fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
      color: color,
      stroke: '#000000',
      strokeThickness: 3,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);
    this.ignoreInUI(text);

    this.tweens.add({
      targets: text,
      y: y - 60,
      alpha: 0,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }

  /**
   * ヒットエフェクト
   */
  createHitEffect(x, y) {
    for (let i = 0; i < 8; i++) {
      const particle = this.add.circle(
        x, y,
        Phaser.Math.Between(3, 8),
        Phaser.Math.RND.pick([0xffeb3b, 0xff9800, 0xffffff]),
        1
      );
      this.ignoreInUI(particle);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.Between(80, 200);

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0,
        duration: Phaser.Math.Between(200, 400),
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      });
    }
    this.cameras.main.shake(80, 0.005);
  }

  /**
   * リングアウト判定 & リスポーン
   */
  checkRingOuts() {
    const { width, height } = this.cameras.main;

    if (this.player1.checkRingOut(width, height)) {
      const alive = this.player1.respawn();
      this.showRingOutText('P1');
      if (!alive) this.checkGameOver();
    }

    if (this.player2.checkRingOut(width, height)) {
      const alive = this.player2.respawn();
      this.showRingOutText('P2');
      if (!alive) this.checkGameOver();
    }
  }

  /**
   * ゲームオーバー判定
   */
  checkGameOver() {
    if (this.matchOver) return;

    let winner = null;
    if (this.player1.isDead && !this.player2.isDead) {
      winner = 'P2';
    } else if (this.player2.isDead && !this.player1.isDead) {
      winner = 'P1';
    } else if (this.player1.isDead && this.player2.isDead) {
      winner = 'DRAW';
    }

    if (winner) {
      this.matchOver = true;
      this.showGameOver(winner);
    }
  }

  /**
   * ゲームオーバー演出
   */
  showGameOver(winner) {
    const { width, height } = this.cameras.main;

    // オーバーレイ
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0);
    overlay.setDepth(200);
    this.ignoreInWorld(overlay);
    this.tweens.add({ targets: overlay, fillAlpha: 0.6, duration: 800 });

    // 勝者テキスト
    const winText = winner === 'DRAW' ? '引き分け！' : `${winner} の勝利！`;
    const winColor = winner === 'P1' ? '#4fc3f7' : winner === 'P2' ? '#ef5350' : '#ffeb3b';

    const text = this.add.text(width / 2, height / 2 - 40, winText, {
      fontSize: '64px',
      fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
      fontStyle: 'bold',
      color: winColor,
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(201).setScale(0).setAlpha(0);
    this.ignoreInWorld(text);

    this.tweens.add({
      targets: text,
      scale: 1,
      alpha: 1,
      duration: 600,
      delay: 400,
      ease: 'Back.easeOut',
    });

    // リスタートテキスト
    const restartLabel = isTouchDevice ? 'タップしてリスタート' : 'Rキー / タップでリスタート';
    const restartText = this.add.text(width / 2, height / 2 + 40, restartLabel, {
      fontSize: '22px',
      fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
      color: '#cccccc',
      stroke: '#000000',
      strokeThickness: 3,
      backgroundColor: '#1a2a4a',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setDepth(201).setAlpha(0).setInteractive({ useHandCursor: true });
    this.ignoreInWorld(restartText);

    this.tweens.add({
      targets: restartText,
      alpha: 1,
      duration: 500,
      delay: 1200,
    });

    // R キー / タップでリスタート
    this.input.keyboard.once('keydown-R', () => this.scene.restart());
    restartText.once('pointerdown', () => this.scene.restart());
  }

  /**
   * リングアウト通知テキスト
   */
  showRingOutText(playerName) {
    const { width, height } = this.cameras.main;
    const player = playerName === 'P1' ? this.player1 : this.player2;
    const remaining = player.stocks;
    const msg = remaining > 0
      ? `${playerName} リングアウト！ 残り ${remaining} ストック`
      : `${playerName} 全ストック消費！`;

    const text = this.add.text(width / 2, height / 2 - 50, msg, {
      fontSize: '30px',
      fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
      color: '#ffeb3b',
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);
    this.ignoreInWorld(text);

    this.tweens.add({
      targets: text,
      y: height / 2 - 100,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }

  /**
   * UI更新
   */
  updateUI() {
    // ダメージ%
    this.p1DamageText.setText(`${Math.floor(this.player1.damage)}%`);
    this.p2DamageText.setText(`${Math.floor(this.player2.damage)}%`);
    this.p1DamageText.setColor(this.getDamageColor(this.player1.damage, '#4fc3f7'));
    this.p2DamageText.setColor(this.getDamageColor(this.player2.damage, '#ef5350'));

    // ストックアイコン
    for (let i = 0; i < 3; i++) {
      this.p1StockIcons[i].setAlpha(i < this.player1.stocks ? 1 : 0.15);
      this.p2StockIcons[i].setAlpha(i < this.player2.stocks ? 1 : 0.15);
    }

    // シールドバー
    this.p1ShieldBar.setDisplaySize(this.player1.shieldHP, 8);
    this.p2ShieldBar.setDisplaySize(this.player2.shieldHP, 8);

    // シールドブレイク時は赤色
    if (this.player1.shieldBroken) {
      this.p1ShieldBar.setFillStyle(0xff1744);
    } else {
      this.p1ShieldBar.setFillStyle(0x4fc3f7);
    }
    if (this.player2.shieldBroken) {
      this.p2ShieldBar.setFillStyle(0xff1744);
    } else {
      this.p2ShieldBar.setFillStyle(0xef5350);
    }
  }

  getDamageColor(damage, baseColor) {
    if (damage < 50) return baseColor;
    if (damage < 100) return '#ffeb3b';
    if (damage < 150) return '#ff9800';
    return '#ff1744';
  }

  resetJumpOnGround(player) {
    if (player.isDead) return;
    // velocity.y >= 0 の条件でジャンプ直後のリセットを防止 (2段ジャンプの修正)
    if ((player.body.blocked.down || player.body.touching.down) && player.body.velocity.y >= 0) {
      player.jumpCount = 0;
      player.hasUsedAirSmash = false;
    }
  }

  /**
   * ダイナミックカメラ (マルチターゲットカメラ)
   */
  updateCamera(delta) {
    const p1 = this.player1;
    const p2 = this.player2;
    
    let targets = [];
    if (!p1.isDead && p1.y < 2500) targets.push(p1);
    if (!p2.isDead && p2.y < 2500) targets.push(p2);
    
    const cam = this.cameras.main;
    const width = cam.width;
    const height = cam.height;
    
    let centerX = width / 2;
    let centerY = height / 2;
    let targetZoom = 1.0;

    if (targets.length === 2) {
      centerX = (p1.x + p2.x) / 2;
      centerY = (p1.y + p2.y) / 2;
      
      const distX = Math.abs(p1.x - p2.x);
      const distY = Math.abs(p1.y - p2.y);
      
      // 画面に収めるためのマージン
      const marginX = 600; 
      const marginY = 400;
      
      const zoomX = cam.width / (distX + marginX);
      const zoomY = cam.height / (distY + Math.max(marginY, distY * 0.5));
      targetZoom = Math.min(zoomX, zoomY);
    } else if (targets.length === 1) {
      centerX = targets[0].x;
      centerY = targets[0].y;
      targetZoom = 1.2;
    }
    
    // ズームの最大・最小制限
    targetZoom = Phaser.Math.Clamp(targetZoom, 0.7, 1.4);
    
    // 足元を見すぎないようにオフセット (ズームしているほど上にずらす)
    centerY -= 50 / targetZoom;

    // カメラ中心の移動制限 (ステージから離れすぎないように)
    // 1920x1080解像度に合わせて拡張
    centerX = Phaser.Math.Clamp(centerX, 400, width - 400);
    centerY = Phaser.Math.Clamp(centerY, 100, height - 100);
    
    // Lerpで滑らかに追従
    const lerp = 0.05 * (delta / 16.6); // 60FPS基準
    
    cam.scrollX = Phaser.Math.Linear(cam.scrollX, centerX - cam.width / 2, lerp);
    cam.scrollY = Phaser.Math.Linear(cam.scrollY, centerY - cam.height / 2, lerp);
    cam.zoom = Phaser.Math.Linear(cam.zoom, targetZoom, lerp);
  }
}
