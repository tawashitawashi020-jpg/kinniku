// Phaser を用いた横スクロールのアクション RPG プロトタイプ
// プレイヤーは左右の移動とジャンプが可能で、スペースキーで近接攻撃を行えます。
// ステージを右端まで進むと次のレベルへ移行し、最後のステージをクリアすると勝利です。

// レベル定義。各レベルごとにワールドの幅、高さ、地面や足場、敵の出現位置を指定します。
// 足場や敵の配置はシンプルなオブジェクトの配列で定義されています。
const levels = [
  {
    width: 2000,
    height: 600,
    ground: [
      // 床はワールド全体を覆う長い板
      { x: 0, y: 560, width: 2000, height: 40 }
    ],
    platforms: [
      { x: 400, y: 450, width: 200, height: 20 },
      { x: 800, y: 350, width: 200, height: 20 },
      { x: 1400, y: 480, width: 200, height: 20 }
    ],
    enemies: [
      { x: 600, y: 500, patrolWidth: 200 },
      { x: 1200, y: 500, patrolWidth: 300 }
    ]
  },
  {
    width: 2500,
    height: 600,
    ground: [
      { x: 0, y: 560, width: 2500, height: 40 }
    ],
    platforms: [
      { x: 300, y: 500, width: 200, height: 20 },
      { x: 900, y: 400, width: 200, height: 20 },
      { x: 1400, y: 300, width: 200, height: 20 },
      { x: 1900, y: 450, width: 200, height: 20 }
    ],
    enemies: [
      { x: 500, y: 500, patrolWidth: 250 },
      { x: 1000, y: 500, patrolWidth: 200 },
      { x: 1800, y: 500, patrolWidth: 300 }
    ]
  },
  {
    width: 2800,
    height: 600,
    ground: [
      { x: 0, y: 560, width: 2800, height: 40 }
    ],
    platforms: [
      { x: 400, y: 450, width: 300, height: 20 },
      { x: 900, y: 350, width: 200, height: 20 },
      { x: 1400, y: 420, width: 250, height: 20 },
      { x: 2000, y: 300, width: 250, height: 20 },
      { x: 2400, y: 480, width: 200, height: 20 }
    ],
    enemies: [
      { x: 600, y: 500, patrolWidth: 300 },
      { x: 1200, y: 500, patrolWidth: 200 },
      { x: 1700, y: 500, patrolWidth: 250 },
      { x: 2300, y: 500, patrolWidth: 200 }
    ]
  }
];

class PlatformerScene extends Phaser.Scene {
  constructor() {
    super('PlatformerScene');
    // 現在のレベル index
    this.levelIndex = 0;
    // プレイヤーHP
    this.playerMaxHP = 5;
    this.playerHP = this.playerMaxHP;
    // 攻撃のクールダウン時間（ms）
    this.attackCooldown = 0;
  }

  preload() {
    // プレイヤー用テクスチャ作成（緑色の長方形）
    const pGfx = this.add.graphics();
    pGfx.fillStyle(0x00ff80, 1);
    pGfx.fillRect(0, 0, 32, 48);
    pGfx.generateTexture('playerTex', 32, 48);
    pGfx.destroy();
    // 敵用テクスチャ作成（赤色の長方形）
    const eGfx = this.add.graphics();
    eGfx.fillStyle(0xff4040, 1);
    eGfx.fillRect(0, 0, 40, 48);
    eGfx.generateTexture('enemyTex', 40, 48);
    eGfx.destroy();
    // 攻撃用テクスチャ作成（黄色い円）
    const aGfx = this.add.graphics();
    aGfx.fillStyle(0xffff00, 1);
    aGfx.fillCircle(0, 0, 10);
    aGfx.generateTexture('attackTex', 20, 20);
    aGfx.destroy();
  }

  create() {
    // キーボード入力の設定
    this.cursors = this.input.keyboard.createCursorKeys();
    this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    // HP表示
    this.hpText = this.add.text(10, 10, '', { fontSize: '20px', fill: '#ffffff' });
    this.hpText.setScrollFactor(0);
    // 攻撃グループ初期化
    this.attackGroup = this.physics.add.group();
    // 初期レベル読み込み
    this.loadLevel(this.levelIndex);
  }

  // レベルを読み込んでステージを作成する
  loadLevel(index) {
    // 以前のレベルのオブジェクトを片付ける
    if (this.platformGroup) {
      this.platformGroup.clear(true, true);
    }
    if (this.enemies) {
      this.enemies.clear(true, true);
    }
    if (this.player) {
      this.player.destroy();
    }
    if (this.endText) {
      this.endText.destroy();
      this.endText = null;
    }
    // レベルデータ
    this.currentLevelData = levels[index];
    // ワールドの境界を設定（底のみ固定、左右と上はカメラでスクロール）
    this.physics.world.setBounds(0, 0, this.currentLevelData.width, this.currentLevelData.height);
    // カメラ設定
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.currentLevelData.width, this.currentLevelData.height);
    cam.setBackgroundColor('#222222');
    // 足場グループ
    this.platformGroup = this.add.group();
    // 地面と足場の生成
    const allPlatforms = [];
    this.currentLevelData.ground.forEach(cfg => {
      const rect = this.add.rectangle(cfg.x + cfg.width / 2, cfg.y + cfg.height / 2, cfg.width, cfg.height, 0x664422);
      this.physics.add.existing(rect, true);
      this.platformGroup.add(rect);
      allPlatforms.push(rect);
    });
    this.currentLevelData.platforms.forEach(cfg => {
      const rect = this.add.rectangle(cfg.x + cfg.width / 2, cfg.y + cfg.height / 2, cfg.width, cfg.height, 0x888888);
      this.physics.add.existing(rect, true);
      this.platformGroup.add(rect);
      allPlatforms.push(rect);
    });
    // プレイヤー生成
    this.player = this.physics.add.sprite(50, this.currentLevelData.height - 120, 'playerTex');
    this.player.setCollideWorldBounds(true);
    // プレイヤーの衝突ボックス調整（幅狭め）
    this.player.body.setSize(20, 48);
    // プレイヤーのHPリセット（レベル間で引き継ぐためリセットしない）
    this.hpText.setText(`HP: ${this.playerHP}/${this.playerMaxHP}`);
    // 足場との衝突
    this.physics.add.collider(this.player, this.platformGroup);
    // カメラ追従
    cam.startFollow(this.player, true, 0.1, 0.1);
    // 敵グループ作成
    this.enemies = this.physics.add.group();
    this.currentLevelData.enemies.forEach(cfg => {
      const enemy = this.physics.add.sprite(cfg.x, cfg.y, 'enemyTex');
      enemy.setCollideWorldBounds(false);
      enemy.body.setSize(20, 48);
      enemy.hp = 3;
      enemy.speed = 40;
      enemy.direction = 1;
      enemy.patrolCenter = cfg.x;
      enemy.patrolWidth = cfg.patrolWidth || 200;
      this.enemies.add(enemy);
    });
    // 敵と足場の衝突
    this.physics.add.collider(this.enemies, this.platformGroup);
    // プレイヤーと敵の衝突
    this.physics.add.collider(this.player, this.enemies, this.playerHit, null, this);
    // 攻撃と敵の重なり判定
    this.physics.add.overlap(this.attackGroup, this.enemies, this.attackHit, null, this);
  }

  // プレイヤーが敵に触れたときの処理
  playerHit(player, enemy) {
    if (enemy.hp > 0) {
      this.playerHP -= 1;
      this.hpText.setText(`HP: ${this.playerHP}/${this.playerMaxHP}`);
      // ノックバック
      const knockback = 200;
      const dir = player.x < enemy.x ? -1 : 1;
      player.setVelocityX(dir * -knockback);
      player.setVelocityY(-150);
      // HPが尽きたらゲームオーバー
      if (this.playerHP <= 0) {
        this.gameOver();
      }
    }
  }

  // 攻撃が敵に当たったときの処理
  attackHit(attack, enemy) {
    attack.destroy();
    if (enemy.hp > 0) {
      enemy.hp -= 1;
      enemy.setTintFill(0xffffff);
      this.time.delayedCall(100, () => enemy.clearTint(), [], this);
      if (enemy.hp <= 0) {
        enemy.disableBody(true, true);
        // もし全ての敵が倒れ、最後のレベルの最後の敵なら自動的にレベルクリアとする
        if (this.enemies.countActive(true) === 0) {
          // レベルをクリアした扱いにするため、画面右端まで移動した扱いにする
          this.player.x = this.currentLevelData.width;
        }
      }
    }
  }

  // プレイヤー攻撃処理
  playerAttack() {
    if (this.attackCooldown > 0) return;
    // プレイヤーの向きに応じて攻撃位置を決める
    const offsetX = this.player.flipX ? -30 : 30;
    const atkX = this.player.x + offsetX;
    const atkY = this.player.y;
    const attack = this.attackGroup.create(atkX, atkY, 'attackTex');
    attack.setDepth(1);
    // 攻撃は短時間で消える
    this.time.delayedCall(200, () => attack.destroy(), [], this);
    // クールダウン設定
    this.attackCooldown = 300;
  }

  // 勝利したとき
  victory() {
    this.endText = this.add.text(
      this.cameras.main.worldView.centerX,
      this.cameras.main.worldView.centerY,
      'すべてのステージをクリアしました！\nおめでとう！',
      {
        fontSize: '32px',
        fill: '#00ff00',
        align: 'center'
      }
    ).setOrigin(0.5);
    this.endText.setScrollFactor(0);
    // プレイヤーと敵を停止
    this.player.setVelocity(0, 0);
    this.enemies.setVelocityX(0);
  }

  // ゲームオーバー時
  gameOver() {
    // 終了テキストを表示
    this.endText = this.add.text(
      this.cameras.main.worldView.centerX,
      this.cameras.main.worldView.centerY,
      'やられてしまいました…',
      {
        fontSize: '32px',
        fill: '#ff5555',
        align: 'center'
      }
    ).setOrigin(0.5);
    this.endText.setScrollFactor(0);
    // 移動停止
    this.player.setVelocity(0, 0);
    this.enemies.setVelocityX(0);
  }

  update(time, delta) {
    if (this.endText) {
      return;
    }
    // プレイヤーの横移動
    const moveSpeed = 180;
    let vx = 0;
    if (this.cursors.left.isDown) {
      vx = -moveSpeed;
      this.player.flipX = true;
    } else if (this.cursors.right.isDown) {
      vx = moveSpeed;
      this.player.flipX = false;
    } else {
      vx = 0;
    }
    this.player.setVelocityX(vx);
    // ジャンプ
    if (this.cursors.up.isDown && this.player.body.blocked.down) {
      this.player.setVelocityY(-350);
    }
    // 攻撃
    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      this.playerAttack();
    }
    // クールダウン減少
    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
      if (this.attackCooldown < 0) this.attackCooldown = 0;
    }
    // 敵の簡易AI（左右にパトロール）
    this.enemies.getChildren().forEach(enemy => {
      if (!enemy.active) return;
      // 巡回幅に合わせて方向を変える
      const leftBound = enemy.patrolCenter - enemy.patrolWidth / 2;
      const rightBound = enemy.patrolCenter + enemy.patrolWidth / 2;
      if (enemy.x <= leftBound) {
        enemy.direction = 1;
      } else if (enemy.x >= rightBound) {
        enemy.direction = -1;
      }
      enemy.setVelocityX(enemy.direction * enemy.speed);
    });
    // レベルクリア判定
    if (this.player.x > this.currentLevelData.width - 50 && this.player.body.blocked.down) {
      if (this.levelIndex + 1 < levels.length) {
        this.levelIndex++;
        this.loadLevel(this.levelIndex);
      } else {
        this.victory();
      }
    }
  }
}

// ゲーム設定
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'gameContainer',
  backgroundColor: '#111111',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 800 },
      debug: false
    }
  },
  scene: PlatformerScene
};

// ゲーム開始
new Phaser.Game(config);