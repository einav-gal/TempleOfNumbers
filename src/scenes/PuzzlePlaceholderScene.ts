import Phaser from 'phaser';
import { FONT_FAMILY } from '../game/textStyle';

const FADE_MS = 300;

const QUESTION_TEXT = '8 + 4 × 3 = ?';
const OPTIONS = [36, 20, 24, 16];
const CORRECT_ANSWER = 20;

const WRONG_FEEDBACK = 'Not quite — try again.';
const CORRECT_FEEDBACK = 'Correct! Well done.';

const BUTTON_WIDTH = 220;
const BUTTON_HEIGHT = 64;
const BUTTON_GAP = 20;

// Grid offsets (in button-size units) for the four answer buttons, 2x2.
const BUTTON_GRID_OFFSETS = [
  { dx: -1, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 1 },
  { dx: 1, dy: 1 },
];

interface StoneButton {
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  width: number;
  height: number;
  enabled: boolean;
  hovered: boolean;
}

/**
 * The first real puzzle: a single order-of-operations question with four
 * answer buttons. No score, timer, hints, or progress tracking — just the
 * question, feedback, and a way back to the Central Hall.
 */
export default class PuzzlePlaceholderScene extends Phaser.Scene {
  private question?: Phaser.GameObjects.Text;
  private feedback?: Phaser.GameObjects.Text;
  private answerButtons: (StoneButton & { value: number })[] = [];
  private continueButton?: StoneButton;
  private backButton?: StoneButton;
  private solved = false;

  constructor() {
    super('PuzzlePlaceholderScene');
  }

  create(): void {
    this.solved = false;
    this.cameras.main.setBackgroundColor('#141019');

    this.question = this.add
      .text(0, 0, QUESTION_TEXT, {
        fontFamily: FONT_FAMILY,
        fontSize: '34px',
        color: '#d9cfae',
      })
      .setOrigin(0.5);

    this.feedback = this.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: '#e0a458',
        align: 'center',
      })
      .setOrigin(0.5);

    this.answerButtons = OPTIONS.map((value) => ({
      ...this.createButton(String(value), () => this.handleAnswer(value)),
      value,
    }));

    this.continueButton = this.createButton('Continue', () => this.returnToHall());
    this.setButtonEnabled(this.continueButton, false);

    this.backButton = this.createButton('← Back', () => this.returnToHall(), {
      width: 120,
      height: 44,
      fontSize: '16px',
    });

    this.layout(this.scale.width, this.scale.height);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    });

    this.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    this.layout(gameSize.width, gameSize.height);
  }

  private layout(width: number, height: number): void {
    this.question?.setPosition(width / 2, height / 2 - 160);

    const gridCenterY = height / 2 - 10;
    for (let i = 0; i < this.answerButtons.length; i++) {
      const btn = this.answerButtons[i];
      const offset = BUTTON_GRID_OFFSETS[i];
      this.positionButton(
        btn,
        width / 2 + (offset.dx * (BUTTON_WIDTH + BUTTON_GAP)) / 2,
        gridCenterY + (offset.dy * (BUTTON_HEIGHT + BUTTON_GAP)) / 2,
      );
    }

    this.feedback?.setPosition(width / 2, gridCenterY + BUTTON_HEIGHT + 50);

    if (this.continueButton) {
      this.positionButton(this.continueButton, width / 2, gridCenterY + BUTTON_HEIGHT + 110);
    }
    if (this.backButton) {
      this.positionButton(this.backButton, 90, 50);
    }
  }

  private handleAnswer(value: number): void {
    if (this.solved) {
      return;
    }
    if (value === CORRECT_ANSWER) {
      this.solved = true;
      this.setFeedback(CORRECT_FEEDBACK, '#f0cf7a');
      for (const btn of this.answerButtons) {
        this.setButtonEnabled(btn, false);
      }
      if (this.continueButton) {
        this.setButtonEnabled(this.continueButton, true);
      }
    } else {
      this.setFeedback(WRONG_FEEDBACK, '#e0a458');
    }
  }

  private setFeedback(text: string, color: string): void {
    this.feedback?.setText(text).setColor(color);
  }

  private returnToHall(): void {
    this.cameras.main.fadeOut(FADE_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('CentralHallScene');
    });
  }

  // Ancient stone button: dark base, chiseled face, centered label. Returns
  // the graphics/label pair; caller positions and enables it.
  private createButton(
    text: string,
    onClick: () => void,
    size: { width: number; height: number; fontSize: string } = {
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      fontSize: '22px',
    },
  ): StoneButton {
    const bg = this.add.graphics();
    const label = this.add
      .text(0, 0, text, {
        fontFamily: FONT_FAMILY,
        fontSize: size.fontSize,
        color: '#d9cfae',
      })
      .setOrigin(0.5);

    const button: StoneButton = {
      bg,
      label,
      width: size.width,
      height: size.height,
      enabled: true,
      hovered: false,
    };

    bg.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, size.width, size.height),
      Phaser.Geom.Rectangle.Contains,
    );
    bg.input!.cursor = 'pointer';
    bg.on(Phaser.Input.Events.POINTER_OVER, () => {
      button.hovered = true;
      this.redrawButton(button);
    });
    bg.on(Phaser.Input.Events.POINTER_OUT, () => {
      button.hovered = false;
      this.redrawButton(button);
    });
    bg.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (button.enabled) {
        onClick();
      }
    });

    this.redrawButton(button);
    return button;
  }

  private positionButton(button: StoneButton, centerX: number, centerY: number): void {
    button.bg.setPosition(centerX - button.width / 2, centerY - button.height / 2);
    button.label.setPosition(centerX, centerY);
  }

  private setButtonEnabled(button: StoneButton, enabled: boolean): void {
    button.enabled = enabled;
    if (enabled) {
      button.bg.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, button.width, button.height),
        Phaser.Geom.Rectangle.Contains,
      );
      button.bg.input!.cursor = 'pointer';
    } else {
      button.bg.disableInteractive();
      button.hovered = false;
    }
    this.redrawButton(button);
  }

  private redrawButton(button: StoneButton): void {
    const { bg, width: w, height: h, enabled, hovered } = button;
    bg.clear();

    const baseAlpha = enabled ? 1 : 0.45;
    bg.fillStyle(0x241f19, baseAlpha);
    bg.fillRoundedRect(-4, -4, w + 8, h + 8, 10);

    bg.fillStyle(hovered && enabled ? 0x6c604e : 0x574d40, baseAlpha);
    bg.fillRoundedRect(0, 0, w, h, 8);

    bg.lineStyle(1.5, 0x33291f, baseAlpha);
    bg.strokeRoundedRect(4, 4, w - 8, h - 8, 5);

    button.label.setAlpha(baseAlpha);
  }
}
