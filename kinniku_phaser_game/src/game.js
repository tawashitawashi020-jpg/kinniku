// Phaser を用いたシンプルなトップダウンRPGプロトタイプ
// プレイヤーは矢印キーで移動し、スペースキーでアタックできます。
// 全ての敵を倒すと勝利、HP がなくなるとゲームオーバーになります。

class RPGScene extends Phaser.Scene {
  constructor() {
    super('RPGScene');
    this.worldWidth = 1600;
    this.worldHeight = 1200;
    this.playerMaxHP = 5;
    this.playerHP = this.playerMaxHP;
    this.enemiesRemaining = 0;
    this.attackCooldown = 0;
  }

  preload() {
    // プレイヤー用のテクスチャ生成
    const pGfx = this.add.graphics();
    pGfx.fillStyle(0x00ff80, 1);
    pGfx.fillRect(0, 0, 32, 32);
    pGfx.generateTexture('playerTex', 32, 32);
    pGfx.destroy();
    // 敵用のテクスチャ生成
    const eGfx = this.add.graphics();
    eGfx.fillStyle(0xff4040, 1);
    eGfx.fillRect(0, 0, 48, 48);
    eGfx.generateTexture('enemyTex', 48, 48);
    eGfx.destroy();
    // アタック（パンチ）用のテクスチャ
    const aGfx = this.add.graphics();
    aGfx.fillStyle(0xffff00, 1);
    aGfx.fillCircle(0, 0, 10);
    aGfx.generateTexture('attackTex', 20, 20);
    aGfx.destroy();
  }

  create() {
    // ワールドの境界を設定
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);

    // 背景
    this.add.rectangle(0, 0, this.worldWidth, this.worldHeight, 0x2a2a2a).setOrigin(0);

    // プレイヤー生成
    this.player = this.physics.add.sprite(100, 100, 'playerTex');
    this.player.setCollideWorldBounds(true);

    // プレイヤーのHP表示
    this.hpText = this.add.text(10, 10, `HP: ${this.playerHP}/${this.playerMaxHP}`, {
      fontSize: '20px',
      fill: '#fff'
    });
    this.hpText.setScrollFactor(0);

    // 敵グループを生成
    this.enemies = this.physics.add.group();
    this.spawnEnemies(5);

    // アタックグループ
    this.attacks = this.physics.add.group();

    // プレイヤーと敵との衝突判定
    this.physics.add.collider(this.player, this.enemies, this.playerHit, null, this);
    // アタックと敵との重なり判定
    this.physics.add.overlap(this.attacks, this.enemies, this.attackHit, null, this);

    // カメラ設定
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.worldWidth, this.worldHeight);
    cam.startFollow(this.player, true, 0.1, 0.1);

    // キーボード入力
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // victory/game over text placeholders
    this.endText = null;
  }

  spawnEnemies(count) {
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(200, this.worldWidth - 200);
      const y = Phaser.Math.Between(200, this.worldHeight - 200);
      const enemy = this.enemies.create(x, y, 'enemyTex');
      enemy.setCollideWorldBounds(true);
      enemy.setBounce(1);
      enemy.setVelocity(Phaser.Math.Between(-50, 50), Phaser.Math.Between(-50, 50));
      enemy.hp = 3;
      this.enemiesRemaining++;
    }
  }

  playerHit(player, enemy) {
    // プレイヤーが敵にぶつかるとHP減少
    if (enemy.hp > 0) {
      this.playerHP -= 1;
      this.hpText.setText(`HP: ${this.playerHP}/${this.playerMaxHP}`);
      // ノックバック
      const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
      const force = 200;
      player.setVelocity(Math.cos(angle) * force, Math.sin(angle) * force);
      // プレイヤーがやられたか判定
      if (this.playerHP <= 0) {
        this.gameOver();
      }
    }
  }

  attackHit(attack, enemy) {
    attack.destroy();
    if (enemy.hp > 0) {
      enemy.hp -= 1;
      enemy.setTintFill(0xffffff);
      this.time.delayedCall(100, () => enemy.clearTint(), [], this);
      if (enemy.hp <= 0) {
        enemy.disableBody(true, true);
        this.enemiesRemaining--;
        if (this.enemiesRemaining <= 0) {
          this.victory();
        }
      }
    }
  }

  playerAttack() {
    // クールダウン中は攻撃しない
    if (this.attackCooldown > 0) return;
    // アタック生成: プレイヤー前方に円を出す
    const offset = 40;
    const dirX = this.cursors.right.isDown - this.cursors.left.isDown;
    const dirY = this.cursors.down.isDown - this.cursors.up.isDown;
    const magnitude = Math.hypot(dirX, dirY) || 1;
    const normX = dirX / magnitude;
    const normY = dirY / magnitude;
    const atkX = this.player.x + normX * offset;
    const atkY = this.player.y + normY * offset;
    const attack = this.attacks.create(atkX, atkY, 'attackTex');
    attack.setLifetime = 10;
    // 0.5 秒後に攻撃を消す
    this.time.delayedCall(500, () => attack.destroy(), [], this);
    // クールダウン設定
    this.attackCooldown = 300; // ms
  }

  update(time, delta) {
    if (this.endText) return; // ゲーム終了時は更新しない

    // プレイヤー移動
    const speed = 150;
    let vx = 0;
    let vy = 0;
    if (this.cursors.left.isDown) vx -= 1;
    if (this.cursors.right.isDown) vx += 1;
    if (this.cursors.up.isDown) vy -= 1;
    if (this.cursors.down.isDown) vy += 1;
    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      vx = (vx / len) * speed;
      vy = (vy / len) * speed;
    }
    this.player.setVelocity(vx, vy);

    // 攻撃処理
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.playerAttack();
    }

    // クールダウンを減少
    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
      if (this.attackCooldown < 0) this.attackCooldown = 0;
    }

    // 敵の簡易AI: プレイヤーをゆっくり追う
    this.enemies.getChildren().forEach(enemy => {
      if (enemy.active && enemy.hp > 0) {
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        const followSpeed = 50;
        enemy.setVelocity(Math.cos(angle) * followSpeed, Math.sin(angle) * followSpeed);
      }
    });
  }

  victory() {
    this.endText = this.add.text(this.cameras.main.worldView.centerX, this.cameras.main.worldView.centerY, '全ての敵を倒しました！\n勝利！', {
      fontSize: '32px',
      fill: '#00ff00',
      align: 'center'
    }).setOrigin(0.5);
    this.endText.setScrollFactor(0);
    this.player.setVelocity(0, 0);
  }

  gameOver() {
    this.endText = this.add.text(this.cameras.main.worldView.centerX, this.cameras.main.worldView.centerY, 'やられてしまいました…', {
      fontSize: '32px',
      fill: '#ff5555',
      align: 'center'
    }).setOrigin(0.5);
    this.endText.setScrollFactor(0);
    this.player.setVelocity(0, 0);
    // 敵も停止
    this.enemies.setVelocity(0, 0);
  }
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'gameContainer',
  backgroundColor: '#111111',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: RPGScene
};

// ゲーム開始
new Phaser.Game(config);
