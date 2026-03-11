// メインエントリーポイント - Phaser ゲーム設定 & 起動
import Phaser from 'phaser';
import { PreloadScene } from './scenes/PreloadScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { PauseScene } from './scenes/PauseScene.js';

// ゲーム設定
const config = {
  type: Phaser.AUTO,
  width: 1920,
  height: 1080,
  parent: document.body,
  backgroundColor: '#16213e',
  resolution: window.devicePixelRatio || 1, // 高解像度ディスプレイでくっきりさせる
  roundPixels: true, // ピクセル境界の滲みを防ぐ
  render: {
    pixelArt: false,
    antialias: true,
    powerPreference: 'high-performance', // GPU最適化
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 900 },
      debug: false,
    },
  },
  input: {
    gamepad: true,
    activePointers: 6, // マルチタッチ対応 (最大6本指)
  },
  scene: [PreloadScene, MenuScene, GameScene, PauseScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

// ゲーム起動
const game = new Phaser.Game(config);
