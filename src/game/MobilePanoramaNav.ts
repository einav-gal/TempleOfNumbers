import Phaser from 'phaser';

const ARROW_SIZE = 104;
const ARROW_MARGIN = 24;
const ARROW_DEPTH = 70;
const ARROW_COLOR = 0x211a12;
const ARROW_STROKE = 0xe0bd70;
const TRANSITION_DURATION_MS = 520;

export interface PanoramaViewpoint {
  id: string;
  centerX: number;
}

/**
 * Keeps the mobile Central Hall as one continuous panoramic scene.
 * Edge arrows pan between broad viewpoints without naming or revealing
 * the hidden entrances, and without requiring a two-finger gesture.
 */
export default class MobilePanoramaNav {
  private scene: Phaser.Scene;
  private viewpoints: PanoramaViewpoint[] = [];
  private currentIndex = 0;
  private isNavigating = false;
  private inputEnabled = true;
  private leftButton?: Phaser.GameObjects.Container;
  private rightButton?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(): void {
    this.leftButton = this.createArrowButton(-1);
    this.rightButton = this.createArrowButton(1);
    this.positionButtons();
  }

  setViewpoints(viewpoints: PanoramaViewpoint[]): void {
    const previousId = this.viewpoints[this.currentIndex]?.id;
    this.viewpoints = viewpoints;
    if (viewpoints.length === 0) {
      return;
    }

    const previousIndex = previousId
      ? viewpoints.findIndex((viewpoint) => viewpoint.id === previousId)
      : -1;
    const centerIndex = viewpoints.findIndex((viewpoint) => viewpoint.id === 'center');
    this.currentIndex =
      previousIndex >= 0
        ? previousIndex
        : centerIndex >= 0
          ? centerIndex
          : Math.floor(viewpoints.length / 2);
    this.positionButtons();
    this.snapTo(this.currentIndex);
  }

  disable(): void {
    this.inputEnabled = false;
    this.updateButtons();
  }

  enable(): void {
    this.inputEnabled = true;
    this.updateButtons();
  }

  destroy(): void {
    this.leftButton?.destroy();
    this.rightButton?.destroy();
    this.leftButton = undefined;
    this.rightButton = undefined;
  }

  private createArrowButton(direction: -1 | 1): Phaser.GameObjects.Container {
    const background = this.scene.add.graphics();
    background.fillStyle(ARROW_COLOR, 0.68);
    background.fillCircle(0, 0, ARROW_SIZE / 2);
    background.lineStyle(3, ARROW_STROKE, 0.9);
    background.strokeCircle(0, 0, ARROW_SIZE / 2 - 2);

    const arrow = this.scene.add
      .text(0, -3, direction < 0 ? '‹' : '›', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '82px',
        color: '#f3d58d',
      })
      .setOrigin(0.5);

    const container = this.scene.add
      .container(0, 0, [background, arrow])
      .setScrollFactor(0)
      .setDepth(ARROW_DEPTH)
      .setSize(ARROW_SIZE, ARROW_SIZE)
      .setInteractive(
        new Phaser.Geom.Circle(0, 0, ARROW_SIZE / 2),
        Phaser.Geom.Circle.Contains,
      );

    if (container.input) {
      container.input.cursor = 'pointer';
    }
    container.on(Phaser.Input.Events.POINTER_DOWN, () => this.move(direction));
    return container;
  }

  private move(direction: -1 | 1): void {
    if (!this.inputEnabled || this.isNavigating) {
      return;
    }
    const nextIndex = Phaser.Math.Clamp(this.currentIndex + direction, 0, this.viewpoints.length - 1);
    if (nextIndex === this.currentIndex) {
      return;
    }

    this.currentIndex = nextIndex;
    this.isNavigating = true;
    this.updateButtons();

    const viewpoint = this.viewpoints[nextIndex];
    this.scene.cameras.main.pan(
      viewpoint.centerX,
      this.scene.scale.height / 2,
      TRANSITION_DURATION_MS,
      Phaser.Math.Easing.Sine.InOut,
    );

    this.scene.time.delayedCall(TRANSITION_DURATION_MS, () => {
      this.isNavigating = false;
      this.updateButtons();
    });
  }

  private snapTo(index: number): void {
    const viewpoint = this.viewpoints[index];
    if (!viewpoint) {
      return;
    }
    const camera = this.scene.cameras.main;
    camera.setZoom(1);
    camera.centerOn(viewpoint.centerX, this.scene.scale.height / 2);
    this.updateButtons();
  }

  private positionButtons(): void {
    const y = this.scene.scale.height / 2;
    this.leftButton?.setPosition(ARROW_MARGIN + ARROW_SIZE / 2, y);
    this.rightButton?.setPosition(this.scene.scale.width - ARROW_MARGIN - ARROW_SIZE / 2, y);
    this.updateButtons();
  }

  private updateButtons(): void {
    const canGoLeft = this.inputEnabled && !this.isNavigating && this.currentIndex > 0;
    const canGoRight =
      this.inputEnabled && !this.isNavigating && this.currentIndex < this.viewpoints.length - 1;
    this.leftButton?.setVisible(canGoLeft);
    this.rightButton?.setVisible(canGoRight);
  }
}
