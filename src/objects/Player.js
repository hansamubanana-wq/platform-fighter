// プレイヤークラス - 物理挙動 & アクション管理
import Phaser from 'phaser';

// 技データ定義
const ATTACKS = {
  // === 地上技 ===
  jab: {         // 弱攻撃 (ジャブ)
    damage: 5, knockback: 150, offsetX: 32, offsetY: 0,
    width: 30, height: 24, duration: 120, cooldown: 250,
    name: 'ジャブ',
  },
  ftilt: {       // 横強攻撃
    damage: 10, knockback: 220, offsetX: 38, offsetY: -2,
    width: 36, height: 28, duration: 180, cooldown: 350,
    name: '横強',
  },
  utilt: {       // 上強攻撃
    damage: 9, knockback: 240, offsetX: 8, offsetY: -40,
    width: 32, height: 36, duration: 180, cooldown: 350,
    knockbackAngle: -80, // ほぼ真上に飛ばす (度)
    name: '上強',
  },
  dtilt: {       // 下強攻撃
    damage: 7, knockback: 180, offsetX: 34, offsetY: 14,
    width: 38, height: 18, duration: 160, cooldown: 300,
    knockbackAngle: 30, // 低い角度で飛ばす
    name: '下強',
  },
  fsmash: {      // 横A: ダッシュ突進攻撃 (瞬間移動風に前方にダッシュしながら攻撃)
    damage: 16, knockback: 320, offsetX: 28, offsetY: -2,
    width: 48, height: 36, duration: 300, cooldown: 650,
    chargeMultiplier: 1.3,
    dashVelocityX: 650, // 前方に高速ダッシュ
    dashVelocityY: 0,
    name: 'ダッシュ攻撃',
  },
  usmash: {      // 上A: 復帰技 (上方向に飛びながら攻撃、空中でも使用可能)
    damage: 14, knockback: 300, offsetX: 4, offsetY: -36,
    width: 36, height: 50, duration: 350, cooldown: 700,
    knockbackAngle: -80,
    chargeMultiplier: 1.3,
    dashVelocityX: 0,
    dashVelocityY: -550, // 上方向に急上昇
    isRecovery: true,     // 復帰技フラグ (空中でも使用可能)
    name: '復帰技',
  },
  dsmash: {      // 下A: 急降下突き刺し (体ごと下に突っ込むメテオ技)
    damage: 17, knockback: 340, offsetX: 0, offsetY: 28,
    width: 32, height: 40, duration: 320, cooldown: 700,
    knockbackAngle: 80, // 下方向メテオ
    chargeMultiplier: 1.3,
    dashVelocityX: 0,
    dashVelocityY: 700, // 下方向に急降下
    isDive: true,         // 急降下フラグ
    name: '急降下突き',
  },
  nsmash: {      // 通常のA攻撃 (ニュートラル強)
    damage: 15, knockback: 280, offsetX: 35, offsetY: 0,
    width: 44, height: 44, duration: 250, cooldown: 500,
    chargeMultiplier: 1.2,
    name: '通常A攻撃',
  },

  // === 空中技 ===
  nair: {        // 空中ニュートラル
    damage: 8, knockback: 170, offsetX: 0, offsetY: 0,
    width: 44, height: 44, duration: 200, cooldown: 300,
    hitBothSides: true,
    name: '空N',
  },
  fair: {        // 空中前
    damage: 11, knockback: 230, offsetX: 36, offsetY: -4,
    width: 34, height: 28, duration: 180, cooldown: 350,
    name: '空前',
  },
  bair: {        // 空中後
    damage: 13, knockback: 260, offsetX: -36, offsetY: -4,
    width: 34, height: 28, duration: 180, cooldown: 350,
    reverseHitDirection: true,
    name: '空後',
  },
  uair: {        // 空中上
    damage: 9, knockback: 220, offsetX: 4, offsetY: -40,
    width: 30, height: 32, duration: 170, cooldown: 320,
    knockbackAngle: -85,
    name: '空上',
  },
  dair: {        // 空中下 (メテオ)
    damage: 12, knockback: 280, offsetX: 4, offsetY: 32,
    width: 28, height: 30, duration: 200, cooldown: 400,
    knockbackAngle: 90, // 真下メテオ
    name: '空下',
  },
};

/**
 * Player - Arcade Sprite を拡張したプレイヤーオブジェクト
 * ダメージ%、2段ジャンプ、多彩な技、シールド、ノックバックを管理
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, textureKey, playerIndex) {
    super(scene, x, y, textureKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.playerIndex = playerIndex;
    this.textureKey = textureKey;

    // ステータス
    this.damage = 0;
    this.jumpCount = 0;
    this.maxJumps = 2;
    this.isAttacking = false;
    this.facingRight = playerIndex === 0;
    this.attackCooldown = 0;
    this.stocks = 3;          // 残機
    this.invincible = false;
    this.isDead = false;       // 全ストック消費
    this.hitbox = null;
    this.currentAttackData = null; // 現在の技データ
    this.hasUsedAirSmash = false; // 空中での強攻撃使用済みフラグ

    // シールド関連
    this.isShielding = false;
    this.shieldHP = 100;       // シールド耐久値 (最大100)
    this.shieldStun = 0;       // シールドスタン中 (ms)
    this.shieldBroken = false; // シールドブレイク状態
    this.shieldBreakTimer = 0;
    this.shieldGraphics = null; // シールド表示用グラフィック

    // リスポーン位置 (空中リスポーン: ステージ上部中央)
    this.spawnX = scene.cameras.main.width / 2;
    this.spawnY = 120; // 上空にスポーン

    // 物理設定
    this.body.setSize(40, 60);
    this.body.setOffset(30, 20); // 100x100の画像に対して中央下寄りに配置
    this.setBounce(0);
    this.setCollideWorldBounds(false);
    this.body.setMaxVelocity(700, 900);
    this.body.setDrag(800, 0); // 地上でのデフォルトの摩擦 (X方向)

    // 移動パラメータ (慣性・加速度ベースに変更)
    this.moveSpeed = 300;       // 目標最高速度
    this.groundAccel = 2500;    // 地上加速度
    this.airAccel = 1200;       // 空中加速度
    this.jumpVelocity = -420;
    this.dashSpeed = 450;
    
    // やられ状態
    this.hitStun = 0;

    // 初期向き
    this.setFlipX(!this.facingRight);

    // シールドグラフィック作成
    this.createShieldGraphics();
  }

  /**
   * シールドの視覚表示を作成
   */
  createShieldGraphics() {
    this.shieldGraphics = this.scene.add.graphics();
    this.shieldGraphics.setDepth(5);
    if (this.scene.ignoreInUI) this.scene.ignoreInUI(this.shieldGraphics);
  }

  /**
   * シールド表示更新
   */
  updateShieldGraphics() {
    this.shieldGraphics.clear();

    if (this.isShielding && !this.shieldBroken) {
      const size = 28 + (this.shieldHP / 100) * 12; // HP に応じてサイズ変動
      const alpha = 0.3 + (this.shieldHP / 100) * 0.3;
      const color = this.playerIndex === 0 ? 0x4fc3f7 : 0xef5350;

      this.shieldGraphics.fillStyle(color, alpha);
      this.shieldGraphics.fillCircle(this.x, this.y, size);
      this.shieldGraphics.lineStyle(2, 0xffffff, alpha * 0.7);
      this.shieldGraphics.strokeCircle(this.x, this.y, size);
    }
  }

  /**
   * 水平移動処理
   */
  handleMovement(direction) {
    if (this.isAttacking || this.shieldStun > 0 || this.shieldBroken || this.hitStun > 0) return;
    if (this.isShielding) {
      this.setAccelerationX(0);
      return; // シールド中は移動不可
    }

    const onGround = this.body.blocked.down || this.body.touching.down;
    
    // 空中と地上で摩擦を変える
    this.body.setDragX(onGround ? 800 : 200);

    if (direction !== 0) {
      const accel = onGround ? this.groundAccel : this.airAccel;
      this.setAccelerationX(direction * accel);
      
      // 最高速度の制限
      const maxSpd = onGround ? this.moveSpeed : this.moveSpeed * 0.85;
      if (Math.abs(this.body.velocity.x) > maxSpd) {
        this.setVelocityX(Math.sign(this.body.velocity.x) * maxSpd);
      }

      this.facingRight = direction > 0;
      this.setFlipX(!this.facingRight);
    } else {
      this.setAccelerationX(0);
    }
  }

  /**
   * ジャンプ処理 (2段ジャンプ対応)
   */
  jump() {
    if (this.isAttacking || this.shieldStun > 0 || this.shieldBroken || this.hitStun > 0) return;

    // シールド中にジャンプ → シールド解除 + ジャンプ (ガードジャンプ)
    if (this.isShielding) {
      this.stopShielding();
    }

    if (this.jumpCount < this.maxJumps) {
      const velocity = this.jumpCount === 0 ? this.jumpVelocity : this.jumpVelocity * 0.85;
      this.setVelocityY(velocity);
      this.jumpCount++;
    }
  }

  /**
   * シールド開始
   */
  startShielding() {
    if (this.isAttacking || this.shieldBroken || this.shieldStun > 0) return;
    const onGround = this.body.blocked.down || this.body.touching.down;
    if (!onGround) return; // 地上のみ

    this.isShielding = true;
    this.setVelocityX(0);
  }

  /**
   * シールド解除
   */
  stopShielding() {
    this.isShielding = false;
  }

  /**
   * シールドにダメージを与える
   * @returns {boolean} シールドブレイクしたか
   */
  hitShield(damage) {
    this.shieldHP -= damage * 1.5; // シールドへのダメージは1.5倍
    this.shieldStun = 150; // 短いスタン

    // シールドブレイク
    if (this.shieldHP <= 0) {
      this.shieldHP = 0;
      this.shieldBroken = true;
      this.isShielding = false;
      this.shieldBreakTimer = 2500; // 2.5秒間スタン

      // シールドブレイクエフェクト
      this.scene.tweens.add({
        targets: this,
        tint: 0x888888,
        duration: 100,
        yoyo: true,
        repeat: 12,
        onComplete: () => this.clearTint(),
      });

      return true;
    }
    return false;
  }

  /**
   * 技の選択 & 実行
   * @param {string} attackType - 'neutral', 'forward', 'up', 'down', 'smash_forward', 'smash_up', 'smash_down'
   */
  performAttack(scene, attackType) {
    if (this.isAttacking || this.attackCooldown > 0) return null;
    if (this.shieldStun > 0 || this.shieldBroken) return null;

    // シールド中は攻撃不可 (掴みは未実装)
    if (this.isShielding) return null;

    const onGround = this.body.blocked.down || this.body.touching.down;

    // 技の選択
    let attackData;
    if (onGround) {
      attackData = this.selectGroundAttack(attackType);
    } else {
      attackData = this.selectAirAttack(attackType);
    }

    if (!attackData) return null;

    this.isAttacking = true;
    this.attackCooldown = attackData.cooldown;
    this.currentAttackData = attackData;

    // === 移動技の速度適用 ===
    if (attackData.dashVelocityX || attackData.dashVelocityY) {
      const dirX = this.facingRight ? 1 : -1;
      if (attackData.dashVelocityX) {
        this.setVelocityX(attackData.dashVelocityX * dirX);
      }
      if (attackData.dashVelocityY) {
        this.setVelocityY(attackData.dashVelocityY);
      }
    }

    // ヒットボックス生成
    const hitbox = this.createAttackHitbox(scene, attackData);
    this.hitbox = hitbox;

    // 攻撃アニメーション (テクスチャ切り替え含む)
    this.playAttackAnimation(scene, attackData);

    // ヒットボックスを一定時間後に消去
    scene.time.delayedCall(attackData.duration, () => {
      if (hitbox && hitbox.active) {
        hitbox.destroy();
      }
      this.hitbox = null;
      this.isAttacking = false;
      this.currentAttackData = null;
      
      // テクスチャを通常状態に戻す
      this.setTexture(this.textureKey);

      // 急降下技終了後は速度リセット
      if (attackData.isDive) {
        this.setVelocityY(0);
      }
    });

    return hitbox;
  }

  /**
   * 地上技の選択
   */
  selectGroundAttack(type) {
    switch (type) {
      // 弱攻撃系
      case 'neutral': return ATTACKS.jab;
      case 'forward': return ATTACKS.ftilt;
      case 'up': return ATTACKS.utilt;
      case 'down': return ATTACKS.dtilt;
      // 強攻撃系 (スマッシュ)
      case 'smash_forward': return ATTACKS.fsmash;
      case 'smash_up': return ATTACKS.usmash;
      case 'smash_down': return ATTACKS.dsmash;
      case 'smash_neutral': return ATTACKS.nsmash;
      default: return ATTACKS.jab;
    }
  }

  /**
   * 空中技の選択
   */
  selectAirAttack(type) {
    // 方向+A (スマッシュ技) は空中で着地するまで1回しか使えない
    if (type && type.startsWith('smash_')) {
      if (this.hasUsedAirSmash) return null;
    }

    let attack = null;
    switch (type) {
      // 空中通常攻撃
      case 'neutral': attack = ATTACKS.nair; break;
      case 'forward': attack = ATTACKS.fair; break;
      case 'back': attack = ATTACKS.bair; break;
      case 'up': attack = ATTACKS.uair; break;
      case 'down': attack = ATTACKS.dair; break;
      
      // スマッシュ(A)入力時の空中技
      case 'smash_forward': attack = ATTACKS.fsmash; break;
      case 'smash_up': attack = ATTACKS.usmash; break;
      case 'smash_down': attack = ATTACKS.dsmash; break;
      case 'smash_neutral': attack = ATTACKS.nsmash; break;
      default: attack = ATTACKS.nair; break;
    }

    // 発動した場合、使用済みフラグを立てる
    if (attack && type && type.startsWith('smash_')) {
      this.hasUsedAirSmash = true;
    }

    return attack;
  }

  /**
   * ヒットボックスを生成
   */
  createAttackHitbox(scene, attackData) {
    let offsetX = attackData.offsetX;

    // 両側ヒットの場合はオフセット0
    if (attackData.hitBothSides) {
      offsetX = 0;
    } else if (!this.facingRight) {
      offsetX = -offsetX;
    }

    // 空後の場合は方向反転
    if (attackData === ATTACKS.bair) {
      offsetX = this.facingRight ? -Math.abs(attackData.offsetX) : Math.abs(attackData.offsetX);
    }

    const hitbox = scene.physics.add.sprite(
      this.x + offsetX,
      this.y + attackData.offsetY,
      'hitbox'
    );
    hitbox.body.setAllowGravity(false);
    hitbox.body.setImmovable(true);
    hitbox.setDisplaySize(attackData.width, attackData.height);
    hitbox.setVisible(false); // 当たり判定エフェクトを完全に隠す
    hitbox.playerOwner = this.playerIndex;
    if (scene.ignoreInUI) scene.ignoreInUI(hitbox);

    // スマッシュ技は赤みがかかる
    if (attackData.chargeMultiplier) {
      hitbox.setTint(0xff6600);
    }

    return hitbox;
  }

  /**
   * 攻撃アニメーション
   */
  playAttackAnimation(scene, attackData) {
    // 攻撃の種類に応じてテクスチャを切り替え
    let suffix = '_atk'; // デフォルト(弱・空Nなど)
    
    // 横方向の攻撃
    if (attackData === ATTACKS.ftilt || attackData === ATTACKS.fsmash || attackData === ATTACKS.fair || attackData === ATTACKS.bair) {
      suffix = '_atk_f';
    } 
    // 上方向の攻撃
    else if (attackData === ATTACKS.utilt || attackData === ATTACKS.usmash || attackData === ATTACKS.uair) {
      suffix = '_atk_u';
    }
    // 下方向の攻撃
    else if (attackData === ATTACKS.dtilt || attackData === ATTACKS.dsmash || attackData === ATTACKS.dair) {
      suffix = '_atk_d';
    }

    this.setTexture(this.textureKey + suffix);

    // ダッシュ技: 残像エフェクト
    if (attackData.dashVelocityX) {
      // 残像エフェクト (ダッシュ突進の軌跡)
      for (let i = 0; i < 3; i++) {
        const afterImage = scene.add.rectangle(
          this.x - (this.facingRight ? 1 : -1) * (i + 1) * 20,
          this.y,
          32, 48,
          this.playerIndex === 0 ? 0x4fc3f7 : 0xef5350,
          0.3 - i * 0.08
        ).setDepth(1);
        if (scene.ignoreInUI) scene.ignoreInUI(afterImage);
        
        scene.tweens.add({
          targets: afterImage,
          alpha: 0,
          duration: 250,
          delay: i * 40,
          onComplete: () => afterImage.destroy(),
        });
      }
      // プレイヤーのスケールアニメーション
      scene.tweens.add({
        targets: this,
        scaleX: this.facingRight ? 1.3 : -1.3,
        scaleY: 0.8,
        duration: attackData.duration * 0.3,
        yoyo: true,
      });
      return;
    }

    // 急降下技: 体を縮めて突っ込むアニメーション
    if (attackData.isDive) {
      scene.tweens.add({
        targets: this,
        scaleY: 1.4,
        scaleX: this.facingRight ? 0.7 : -0.7,
        duration: attackData.duration * 0.3,
        yoyo: true,
      });
      return;
    }

    // 復帰技: 上方向に伸びるアニメーション
    if (attackData.isRecovery) {
      scene.tweens.add({
        targets: this,
        scaleY: 1.3,
        scaleX: this.facingRight ? 0.75 : -0.75,
        duration: attackData.duration * 0.4,
        yoyo: true,
      });
      return;
    }

    // スマッシュ技は大きめのモーション
    const scaleAmount = attackData.chargeMultiplier ? 1.25 : 1.12;

    if (attackData.knockbackAngle && attackData.knockbackAngle < 0) {
      scene.tweens.add({
        targets: this,
        scaleY: scaleAmount,
        duration: attackData.duration * 0.4,
        yoyo: true,
      });
    } else if (attackData.hitBothSides) {
      scene.tweens.add({
        targets: this,
        scaleX: { from: 1, to: -1 },
        duration: attackData.duration * 0.5,
        yoyo: true,
      });
    } else {
      scene.tweens.add({
        targets: this,
        scaleX: this.facingRight ? scaleAmount : -scaleAmount,
        duration: attackData.duration * 0.4,
        yoyo: true,
      });
    }
  }

  /**
   * ダメージ受け & ノックバック処理
   */
  takeDamage(baseDamage, baseKnockback, attackerX, knockbackAngle) {
    if (this.invincible) return;

    this.damage += baseDamage;

    const knockbackMultiplier = 1 + (this.damage / 100);
    const knockbackForce = baseKnockback * knockbackMultiplier;

    // ノックバック方向の計算
    if (knockbackAngle !== undefined && knockbackAngle !== null) {
      // 角度指定のノックバック (度 → ラジアン)
      const rad = (knockbackAngle * Math.PI) / 180;
      const dirX = this.x > attackerX ? 1 : -1;
      this.setVelocityX(Math.cos(rad) * knockbackForce * dirX);
      this.setVelocityY(Math.sin(rad) * knockbackForce);
    } else {
      // デフォルト: 攻撃者から離れる方向
      const directionX = this.x > attackerX ? 1 : -1;
      this.setVelocityX(directionX * knockbackForce);
      this.setVelocityY(-knockbackForce * 0.6);
    }

    // ヒットスタンとノックバック演出
    // ダメージが大きいほど硬直時間 (hitStun) が長くなる
    this.hitStun = 200 + knockbackForce * 0.3;
    
    // 強攻撃を受けた時は横に倒れる・回転するモーションを入れる
    if (knockbackForce > 300) {
      this.disableBodyInteraction(); // 少しの間だけ挙動を変える
      this.scene.tweens.add({
        targets: this,
        angle: this.x > attackerX ? 90 : -90, // 飛んでいく方向へ倒れる
        duration: Math.min(this.hitStun * 0.5, 400),
        yoyo: true,
        onComplete: () => {
          this.setAngle(0);
          this.enableBodyInteraction();
        }
      });
    }

    // ヒットフラッシュ
    this.scene.tweens.add({
      targets: this,
      tint: 0xffaaaa, // 少し赤く光る
      duration: 100,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.clearTint(),
    });
  }

  // ノックバック中の当たり判定や移動を一時的に無効化するヘルパー
  disableBodyInteraction() {
    this.body.checkCollision.none = false;
  }
  
  enableBodyInteraction() {
    this.body.checkCollision.none = false;
  }

  /**
   * リスポーン処理 - 空中にスポーン + 無敵時間
   * @returns {boolean} リスポーン成功 (ストックが残っていた場合)
   */
  respawn() {
    this.stocks--;

    if (this.stocks <= 0) {
      this.isDead = true;
      this.setActive(false);
      this.setVisible(false);
      this.body.enable = false;
      this.shieldGraphics.clear();
      return false;
    }

    // ダメージリセット
    this.damage = 0;
    this.setVelocity(0, 0);

    // 空中リスポーン (ステージ上部中央)
    this.setPosition(this.spawnX, this.spawnY);
    this.jumpCount = 0;
    this.isAttacking = false;
    this.isShielding = false;
    this.shieldHP = 100;
    this.shieldBroken = false;
    this.shieldBreakTimer = 0;
    this.shieldStun = 0;
    this.hitStun = 0;
    this.setAngle(0);
    this.enableBodyInteraction();

    // 無敵時間 (2.5秒)
    this.invincible = true;
    this.setAlpha(0.5);

    this.scene.tweens.add({
      targets: this,
      alpha: { from: 0.3, to: 0.8 },
      duration: 200,
      repeat: 10,  // 約2秒間点滅
      onComplete: () => {
        // 無敵終了を少し遅らせる
        this.scene.time.delayedCall(500, () => {
          this.invincible = false;
          this.setAlpha(1);
        });
      },
    });

    return true;
  }

  checkRingOut(worldWidth, worldHeight) {
    if (this.isDead) return false;
    // カメラのズームやパンを考慮してマージンを広く取る
    const margin = 400; 
    return (
      this.x < -margin ||
      this.x > worldWidth + margin ||
      this.y < -margin ||
      this.y > worldHeight + margin
    );
  }

  /**
   * 毎フレーム更新
   */
  updateCooldown(delta) {
    if (this.isDead) return;

    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
    }
    
    // ヒットスタン更新
    if (this.hitStun > 0) {
      this.hitStun -= delta;
      if (this.hitStun <= 0) {
        this.hitStun = 0;
      }
    }

    // シールドスタン更新
    if (this.shieldStun > 0) {
      this.shieldStun -= delta;
      if (this.shieldStun <= 0) {
        this.shieldStun = 0;
      }
    }

    // シールドブレイク更新
    if (this.shieldBroken) {
      this.shieldBreakTimer -= delta;
      if (this.shieldBreakTimer <= 0) {
        this.shieldBroken = false;
        this.shieldHP = 30; // 少し回復した状態で復帰
      }
    }

    // シールド耐久値の自然回復 (シールドしていない時)
    if (!this.isShielding && !this.shieldBroken && this.shieldHP < 100) {
      this.shieldHP = Math.min(100, this.shieldHP + delta * 0.02);
    }

    // シールド中は耐久値が少しずつ減少
    if (this.isShielding && !this.shieldBroken) {
      this.shieldHP -= delta * 0.015;
      if (this.shieldHP <= 0) {
        this.hitShield(0); // シールドブレイク
      }
    }

    // ヒットボックス追従
    if (this.hitbox && this.hitbox.active && this.currentAttackData) {
      let offsetX = this.currentAttackData.offsetX;
      if (this.currentAttackData.hitBothSides) {
        offsetX = 0;
      } else if (!this.facingRight) {
        offsetX = -offsetX;
      }
      if (this.currentAttackData === ATTACKS.bair) {
        offsetX = this.facingRight ? -Math.abs(this.currentAttackData.offsetX) : Math.abs(this.currentAttackData.offsetX);
      }
      this.hitbox.setPosition(this.x + offsetX, this.y + this.currentAttackData.offsetY);
    }

    // シールドグラフィック更新
    this.updateShieldGraphics();
  }
}

// 技データをエクスポート (GameScene で使用)
export { ATTACKS };
