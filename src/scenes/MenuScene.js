import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const { width, height } = this.cameras.main;

    // 背景画像 (もしPreloadSceneでロードされていれば)
    if (this.textures.exists('bg')) {
      this.add.image(width / 2, height / 2, 'bg')
          .setOrigin(0.5)
          .setDisplaySize(width, height)
          .setAlpha(0.7);
    } else {
      this.cameras.main.setBackgroundColor('#16213e');
    }

    // タイトル
    this.add.text(width / 2, height * 0.28, 'STAR BRAWLERS', {
      fontSize: '120px',
      fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 10,
      shadow: { blur: 10, color: '#000000', fill: true }
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.42, 'ARENA UNBOUND', {
      fontSize: '48px',
      fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
      fontStyle: 'bold',
      color: '#f0c040',
      stroke: '#000000',
      strokeThickness: 6,
      shadow: { blur: 8, color: '#000000', fill: true }
    }).setOrigin(0.5);

    // メニューボタン
    this.createButton(width / 2, height * 0.65, 'プレイヤー対戦 (VS Player)', () => {
      this.scene.start('GameScene', { cpuMode: false });
    });

    this.createButton(width / 2, height * 0.75, 'CPU対戦 (VS CPU)', () => {
      this.scene.start('GameScene', { cpuMode: true });
    });
    
    // 操作説明
    this.add.text(width / 2, height * 0.9, '【P1/CPU】 WASD移動, F攻撃, H強攻撃, Gシールド\n【P2】 ↑↓←→移動, L攻撃, J強攻撃, Kシールド', {
      fontSize: '24px',
      fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
      color: '#cccccc',
      align: 'center',
      lineSpacing: 10
    }).setOrigin(0.5).setAlpha(0.6);
  }

  createButton(x, y, label, onClick) {
    const button = this.add.text(x, y, label, {
      fontSize: '48px',
      fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#2a3b5c',
      padding: { x: 40, y: 15 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    button.on('pointerover', () => button.setStyle({ fill: '#ffeb3b', backgroundColor: '#3a4b6c' }));
    button.on('pointerout', () => button.setStyle({ fill: '#ffffff', backgroundColor: '#2a3b5c' }));
    button.on('pointerdown', () => {
      button.setStyle({ fill: '#ff1744' });
      onClick();
    });
  }
}
