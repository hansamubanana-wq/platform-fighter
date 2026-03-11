// ステージ管理 - メインフロア & すり抜け床の生成
import Phaser from 'phaser';

/**
 * Stage - ステージ内のプラットフォームを管理
 */
export class Stage {
  /**
   * @param {Phaser.Scene} scene - シーン参照
   */
  constructor(scene) {
    this.scene = scene;

    // 静的プラットフォームグループ
    this.platforms = scene.physics.add.staticGroup();

    // すり抜け床グループ (別管理)
    this.floatingPlatforms = scene.physics.add.staticGroup();

    this.createStage();
  }

  /**
   * ステージ構成を作成
   */
  createStage() {
    const { width, height } = this.scene.cameras.main;

    // === メインフロア ===
    // 画面下部に大きなプラットフォーム
    // 1920x1080に合わせてメインフロアを広くする (幅1400)
    const floorWidth = 1400;
    const mainFloor = this.scene.add.tileSprite(width / 2, height - 100, floorWidth, 40, 'stage_tex');
    this.platforms.add(mainFloor);
    mainFloor.body.setSize(floorWidth, 40);
    mainFloor.body.setOffset(0, 0);

    // === すり抜け床 x2 ===
    // 左上の足場 (少し高く、遠くに設定)
    const floatLeft = this.scene.add.tileSprite(width / 2 - 400, height - 350, 240, 16, 'stage_tex');
    this.floatingPlatforms.add(floatLeft);
    floatLeft.body.setSize(240, 16);
    floatLeft.body.setOffset(0, 0);
    floatLeft.body.checkCollision.down = false;
    floatLeft.body.checkCollision.left = false;
    floatLeft.body.checkCollision.right = false;

    // 右上の足場
    const floatRight = this.scene.add.tileSprite(width / 2 + 400, height - 350, 240, 16, 'stage_tex');
    this.floatingPlatforms.add(floatRight);
    floatRight.body.setSize(240, 16);
    floatRight.body.setOffset(0, 0);
    floatRight.body.checkCollision.down = false;
    floatRight.body.checkCollision.left = false;
    floatRight.body.checkCollision.right = false;
  }

  /**
   * 全プラットフォームを返す (コリジョン設定用)
   */
  getAllPlatforms() {
    return [this.platforms, this.floatingPlatforms];
  }
}
