import Phaser from 'phaser';

type ScrollFactorObject = Phaser.GameObjects.GameObject & {
  cameraFilter: number;
  scrollFactorX?: number;
  scrollFactorY?: number;
};

/**
 * Renders screen-fixed Phaser objects through a dedicated camera that is
 * never zoomed or panned. `setScrollFactor(0)` cancels camera scrolling,
 * but Phaser still applies camera zoom to those objects; that made mobile
 * popups, the crystal holder, hint button and navigation arrows grow and
 * move outside the cropped ENVELOP viewport whenever the world camera was
 * focused or pinch-zoomed.
 *
 * Objects already marked with scrollFactor 0 remain owned by their scene;
 * this class only routes the scene's top-level display-list objects to the
 * correct camera. A pre-render sync also catches popups or puzzle UI that
 * are created later during play.
 */
export default class FixedUiCamera {
  private readonly scene: Phaser.Scene;
  private camera?: Phaser.Cameras.Scene2D.Camera;

  private readonly syncBeforeRender = () => this.syncObjects();
  private readonly handleResize = (gameSize: Phaser.Structs.Size) => {
    this.camera?.setPosition(0, 0).setSize(gameSize.width, gameSize.height).setScroll(0, 0).setZoom(1);
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(): void {
    if (this.camera) {
      return;
    }

    this.camera = this.scene.cameras.add(
      0,
      0,
      this.scene.scale.width,
      this.scene.scale.height,
      false,
      'fixed-ui-camera',
    );
    this.camera.setScroll(0, 0).setZoom(1);

    this.syncObjects();
    this.scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.syncBeforeRender);
    this.scene.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
  }

  fadeIn(duration: number, red = 0, green = 0, blue = 0): void {
    this.camera?.fadeIn(duration, red, green, blue);
  }

  fadeOut(duration: number, red = 0, green = 0, blue = 0): void {
    this.camera?.fadeOut(duration, red, green, blue);
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.syncBeforeRender);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);

    const uiCamera = this.camera;
    if (!uiCamera) {
      return;
    }

    // Scene instances are reused after stop/start. Clear this camera's
    // filter bit before removing it so no surviving object retains a
    // reference to a camera id that no longer exists.
    for (const gameObject of this.scene.children.list as ScrollFactorObject[]) {
      gameObject.cameraFilter &= ~uiCamera.id;
      gameObject.cameraFilter &= ~this.scene.cameras.main.id;
    }
    this.scene.cameras.remove(uiCamera);
    this.camera = undefined;
  }

  private syncObjects(): void {
    const uiCamera = this.camera;
    if (!uiCamera) {
      return;
    }

    const mainCamera = this.scene.cameras.main;
    for (const gameObject of this.scene.children.list as ScrollFactorObject[]) {
      const isFixed = gameObject.scrollFactorX === 0 && gameObject.scrollFactorY === 0;

      if (isFixed) {
        // Visible only to the stable UI camera.
        gameObject.cameraFilter &= ~uiCamera.id;
        mainCamera.ignore(gameObject);
      } else {
        // Visible only to the zoomable/pannable world camera.
        gameObject.cameraFilter &= ~mainCamera.id;
        uiCamera.ignore(gameObject);
      }
    }
  }
}
