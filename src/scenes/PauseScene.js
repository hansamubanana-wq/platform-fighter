import Phaser from 'phaser';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PauseScene' });
  }

  create() {
    const { width, height } = this.cameras.main;

    // 半透明のオーバーレイ
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);

    // PAUSE テキスト
    this.add.text(width / 2, height * 0.35, 'PAUSE', {
      fontSize: '100px',
      fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
      letterSpacing: 20,
    }).setOrigin(0.5);

    // ボタン
    this.createButton(width / 2, height * 0.55, '再開 (Resume)', () => {
      this.scene.resume('GameScene');
      this.scene.stop('PauseScene');
    });

    this.createButton(width / 2, height * 0.68, 'メニューへ戻る (Quit)', () => {
      this.scene.stop('GameScene');
      this.scene.stop('PauseScene');
      this.scene.start('MenuScene');
    });

    // ESCキーで再開
    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.resume('GameScene');
      this.scene.stop('PauseScene');
    });
  }

  createButton(x, y, label, onClick) {
    const button = this.add.text(x, y, label, {
      fontSize: '40px',
      fontFamily: '"Segoe UI", "Noto Sans JP", sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#2a3b5c',
      padding: { x: 30, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    button.on('pointerover', () => button.setStyle({ fill: '#ffeb3b', backgroundColor: '#3a4b6c' }));
    button.on('pointerout', () => button.setStyle({ fill: '#ffffff', backgroundColor: '#2a3b5c' }));
    button.on('pointerdown', onClick);
  }
}
