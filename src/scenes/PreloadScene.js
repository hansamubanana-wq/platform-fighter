// プリロードシーン - テクスチャ生成 & アセット管理
import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload() {
    // ローディングバー表示
    this.createLoadingBar();

    // AIで生成した高画質アセットの読み込み
    this.load.image('bg_raw', 'assets/bg.png');
    this.load.image('stage_tex', 'assets/stage.png'); // タイル用にそのまま読み込む
    this.load.image('p1_raw', 'assets/p1.png');
    this.load.image('p1_atk_raw', 'assets/p1_atk.png');
    this.load.image('p1_atk_f_raw', 'assets/p1_atk_f.png');
    this.load.image('p1_atk_u_raw', 'assets/p1_atk_u.png');
    this.load.image('p1_atk_d_raw', 'assets/p1_atk_d.png');
    
    this.load.image('p2_raw', 'assets/p2.png');
    this.load.image('p2_atk_raw', 'assets/p2_atk.png');
    this.load.image('p2_atk_f_raw', 'assets/p2_atk_f.png');
    this.load.image('p2_atk_u_raw', 'assets/p2_atk_u.png');
    this.load.image('p2_atk_d_raw', 'assets/p2_atk_d.png');
  }

  create() {
    // 透過処理とリサイズを行ってテクスチャを再生成
    this.processImage('bg_raw', 'bg', 1280, 720, false);
    // ステージはそのまま使うためprocessImageは不要
    
    // キャラクターはグリーンバック透過処理を行う (キーカラー緑を透過)
    // 視認性向上のためサイズを 100x100 に拡大
    this.processImage('p1_raw', 'player1', 100, 100, true);
    this.processImage('p1_atk_raw', 'player1_atk', 100, 100, true);
    this.processImage('p1_atk_f_raw', 'player1_atk_f', 100, 100, true);
    this.processImage('p1_atk_u_raw', 'player1_atk_u', 100, 100, true);
    this.processImage('p1_atk_d_raw', 'player1_atk_d', 100, 100, true);

    this.processImage('p2_raw', 'player2', 100, 100, true);
    this.processImage('p2_atk_raw', 'player2_atk', 100, 100, true);
    this.processImage('p2_atk_f_raw', 'player2_atk_f', 100, 100, true);
    this.processImage('p2_atk_u_raw', 'player2_atk_u', 100, 100, true);
    this.processImage('p2_atk_d_raw', 'player2_atk_d', 100, 100, true);

    // 攻撃ヒットボックス等のプリミティブ生成
    this.generateHitboxTexture('hitbox', 0xffeb3b);

    // 処理完了後、少し待ってからGameSceneへ
    this.time.delayedCall(100, () => {
      this.scene.start('MenuScene');
    });
  }

  /**
   * 画像をCanvasに描画し、クロマキー合成やリサイズを行って新しいテクスチャとして登録する
   */
  processImage(sourceKey, newKey, targetW, targetH, chromaKey = false) {
    const srcImg = this.textures.get(sourceKey).getSourceImage();
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    // リサイズして描画
    ctx.drawImage(srcImg, 0, 0, targetW, targetH);

    // グリーンバック透過処理 (クロマキー)
    if (chromaKey) {
      const imgData = ctx.getImageData(0, 0, targetW, targetH);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // 緑成分が強く、赤・青が弱いピクセルを透過 (許容範囲を調整)
        if (g > 100 && r < g * 0.8 && b < g * 0.8) {
          data[i + 3] = 0; // Alpha = 0
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // Phaserのテクスチャとして追加
    this.textures.addSpriteSheet(newKey, canvas, { frameWidth: targetW, frameHeight: targetH });
  }

  generateHitboxTexture(key, color) {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(color, 0.5);
    graphics.fillCircle(20, 20, 20);
    graphics.lineStyle(2, color, 0.8);
    graphics.strokeCircle(20, 20, 20);
    graphics.generateTexture(key, 40, 40);
    graphics.destroy();
  }

  createLoadingBar() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const title = this.add.text(width / 2, height / 2 - 60, 'STAR BRAWLERS: ARENA UNBOUND', {
      fontSize: '28px',
      fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
      color: '#e0e0e0',
    }).setOrigin(0.5);

    const barBg = this.add.rectangle(width / 2, height / 2, 400, 20, 0x333333);
    const bar = this.add.rectangle(width / 2 - 198, height / 2, 4, 16, 0x4fc3f7);

    this.load.on('progress', (value) => {
      bar.width = 396 * value;
    });
  }
}
