import type { Property } from 'csstype';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import { CanvasModuleBase } from 'features/controlLayers/konva/CanvasModuleBase';
import { getPrefixedId, getRectUnion } from 'features/controlLayers/konva/util';
import type {
  CanvasEntityIdentifier,
  Coordinate,
  Dimensions,
  Rect,
  StageAttrs,
} from 'features/controlLayers/store/types';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { clamp } from 'lodash-es';
import { atom } from 'nanostores';
import type { Logger } from 'roarr';

type CanvasStageModuleConfig = {
  /**
   * The minimum (furthest-zoomed-in) scale of the canvas
   */
  MIN_SCALE: number;
  /**
   * The maximum (furthest-zoomed-out) scale of the canvas
   */
  MAX_SCALE: number;
  /**
   * The factor by which the canvas should be scaled when zooming in/out
   */
  SCALE_FACTOR: number;
};

const DEFAULT_CONFIG: CanvasStageModuleConfig = {
  MIN_SCALE: 0.1,
  MAX_SCALE: 20,
  SCALE_FACTOR: 0.999,
};

export class CanvasStageModule extends CanvasModuleBase {
  readonly type = 'stage';
  readonly id: string;
  readonly path: string[];
  readonly parent: CanvasManager;
  readonly manager: CanvasManager;
  readonly log: Logger;

  container: HTMLDivElement;
  konva: { stage: Konva.Stage };

  config: CanvasStageModuleConfig = DEFAULT_CONFIG;

  $stageAttrs = atom<StageAttrs>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    scale: 0,
  });

  subscriptions = new Set<() => void>();
  resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLDivElement, manager: CanvasManager) {
    super();
    this.id = getPrefixedId('stage');
    this.parent = manager;
    this.manager = manager;
    this.path = this.manager.buildPath(this);
    this.log = this.manager.buildLogger(this);

    this.log.debug('Creating module');

    this.container = container;
    this.konva = {
      stage: new Konva.Stage({
        id: getPrefixedId('konva_stage'),
        container,
      }),
    };
  }

  setContainer = (container: HTMLDivElement) => {
    this.container = container;
    this.konva.stage.container(container);
    this.setResizeObserver();
  };

  setResizeObserver = () => {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.resizeObserver = new ResizeObserver(this.fitStageToContainer);
    this.resizeObserver.observe(this.container);
  };

  initialize = () => {
    this.log.debug('Initializing module');
    this.konva.stage.container(this.container);
    this.setResizeObserver();
    this.fitStageToContainer();
    this.fitLayersToStage();

    this.konva.stage.on('wheel', this.onStageMouseWheel);
    this.konva.stage.on('dragmove', this.onStageDragMove);
    this.konva.stage.on('dragend', this.onStageDragEnd);

    this.subscriptions.add(() => this.konva.stage.off('wheel', this.onStageMouseWheel));
    this.subscriptions.add(() => this.konva.stage.off('dragmove', this.onStageDragMove));
    this.subscriptions.add(() => this.konva.stage.off('dragend', this.onStageDragEnd));
  };

  /**
   * Fits the stage to the container element.
   */
  fitStageToContainer = (): void => {
    this.log.trace('Fitting stage to container');
    const containerWidth = this.konva.stage.container().offsetWidth;
    const containerHeight = this.konva.stage.container().offsetHeight;

    // If the container has no size, the following calculations will be reaallll funky and bork the stage
    if (containerWidth === 0 || containerHeight === 0) {
      return;
    }

    // If the stage _had_ no size just before this function was called, that means we've just mounted the stage or
    // maybe un-hidden it. In that case, the user is about to see the stage for the first time, so we should fit the
    // layers to the stage. If we don't do this, the layers will not be centered.
    const shouldFitLayersAfterFittingStage = this.konva.stage.width() === 0 || this.konva.stage.height() === 0;

    this.konva.stage.width(containerWidth);
    this.konva.stage.height(containerHeight);
    this.$stageAttrs.set({
      x: this.konva.stage.x(),
      y: this.konva.stage.y(),
      width: this.konva.stage.width(),
      height: this.konva.stage.height(),
      scale: this.konva.stage.scaleX(),
    });

    if (shouldFitLayersAfterFittingStage) {
      this.fitLayersToStage();
    }
  };

  getVisibleRect = (type?: Exclude<CanvasEntityIdentifier['type'], 'ip_adapter'>): Rect => {
    const rects = [];

    for (const adapter of this.manager.getAllAdapters()) {
      if (!adapter.state.isEnabled) {
        continue;
      }
      if (type && adapter.state.type !== type) {
        continue;
      }
      if (adapter.renderer.hasObjects()) {
        rects.push(adapter.transformer.getRelativeRect());
      }
    }

    return getRectUnion(...rects);
  };

  /**
   * Fits the bbox to the stage. This will center the bbox and scale it to fit the stage with some padding.
   */
  fitBboxToStage = (): void => {
    const { rect } = this.manager.stateApi.getBbox();
    this.log.trace({ rect }, 'Fitting bbox to stage');
    this.fitRect(rect);
  };

  /**
   * Fits the visible canvas to the stage. This will center the canvas and scale it to fit the stage with some padding.
   */
  fitLayersToStage = (): void => {
    const rect = this.getVisibleRect();
    if (rect.width === 0 || rect.height === 0) {
      this.fitBboxToStage();
    } else {
      this.log.trace({ rect }, 'Fitting layers to stage');
      this.fitRect(rect);
    }
  };

  /**
   * Fits a rectangle to the stage. The rectangle will be centered and scaled to fit the stage with some padding.
   *
   * The max scale is 1, but the stage can be scaled down to fit the rect.
   */
  fitRect = (rect: Rect): void => {
    const { width, height } = this.getSize();

    // If the stage has no size, we can't fit anything to it
    if (width === 0 || height === 0) {
      return;
    }

    const padding = 20; // Padding in absolute pixels

    const availableWidth = width - padding * 2;
    const availableHeight = height - padding * 2;

    // Make sure we don't accidentally set the scale to something nonsensical, like a negative number, 0 or something
    // outside the valid range
    const scale = this.constrainScale(
      Math.min(Math.min(availableWidth / rect.width, availableHeight / rect.height), 1)
    );
    const x = -rect.x * scale + padding + (availableWidth - rect.width * scale) / 2;
    const y = -rect.y * scale + padding + (availableHeight - rect.height * scale) / 2;

    this.konva.stage.setAttrs({
      x,
      y,
      scaleX: scale,
      scaleY: scale,
    });

    this.$stageAttrs.set({
      ...this.$stageAttrs.get(),
      x,
      y,
      scale,
    });
  };

  /**
   * Gets the center of the stage in either absolute or relative coordinates
   * @param absolute Whether to return the center in absolute coordinates
   */
  getCenter = (absolute = false): Coordinate => {
    const scale = this.getScale();
    const { x, y } = this.getPosition();
    const { width, height } = this.getSize();

    const center = {
      x: (width / 2 - x) / scale,
      y: (height / 2 - y) / scale,
    };

    if (!absolute) {
      return center;
    }

    return this.konva.stage.getAbsoluteTransform().point(center);
  };

  /**
   * Constrains a scale to be within the valid range
   */
  constrainScale = (scale: number): number => {
    return clamp(Math.round(scale * 100) / 100, this.config.MIN_SCALE, this.config.MAX_SCALE);
  };

  /**
   * Sets the scale of the stage. If center is provided, the stage will zoom in/out on that point.
   * @param scale The new scale to set
   * @param center The center of the stage to zoom in/out on
   */
  setScale = (scale: number, center: Coordinate = this.getCenter(true)): void => {
    this.log.trace('Setting scale');
    const newScale = this.constrainScale(scale);

    const { x, y } = this.getPosition();
    const oldScale = this.getScale();

    const deltaX = (center.x - x) / oldScale;
    const deltaY = (center.y - y) / oldScale;

    const newX = center.x - deltaX * newScale;
    const newY = center.y - deltaY * newScale;

    this.konva.stage.setAttrs({
      x: newX,
      y: newY,
      scaleX: newScale,
      scaleY: newScale,
    });

    this.$stageAttrs.set({
      x: Math.floor(this.konva.stage.x()),
      y: Math.floor(this.konva.stage.y()),
      width: this.konva.stage.width(),
      height: this.konva.stage.height(),
      scale: this.konva.stage.scaleX(),
    });
  };

  onStageMouseWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    if (e.evt.ctrlKey || e.evt.metaKey) {
      return;
    }

    // We need the absolute cursor position - not the scaled position
    const cursorPos = this.konva.stage.getPointerPosition();

    if (cursorPos) {
      // When wheeling on trackpad, e.evt.ctrlKey is true - in that case, let's reverse the direction
      const delta = e.evt.ctrlKey ? -e.evt.deltaY : e.evt.deltaY;
      const scale = this.manager.stage.getScale() * this.config.SCALE_FACTOR ** delta;
      this.manager.stage.setScale(scale, cursorPos);
    }
  };

  onStageDragMove = (e: KonvaEventObject<MouseEvent>) => {
    if (e.target !== this.konva.stage) {
      return;
    }

    this.$stageAttrs.set({
      // Stage position should always be an integer, else we get fractional pixels which are blurry
      x: Math.floor(this.konva.stage.x()),
      y: Math.floor(this.konva.stage.y()),
      width: this.konva.stage.width(),
      height: this.konva.stage.height(),
      scale: this.konva.stage.scaleX(),
    });
  };

  onStageDragEnd = (e: KonvaEventObject<DragEvent>) => {
    if (e.target !== this.konva.stage) {
      return;
    }

    this.$stageAttrs.set({
      // Stage position should always be an integer, else we get fractional pixels which are blurry
      x: Math.floor(this.konva.stage.x()),
      y: Math.floor(this.konva.stage.y()),
      width: this.konva.stage.width(),
      height: this.konva.stage.height(),
      scale: this.konva.stage.scaleX(),
    });
  };

  /**
   * Gets the scale of the stage. The stage is always scaled uniformly in x and y.
   */
  getScale = (): number => {
    // The stage is never scaled differently in x and y
    return this.konva.stage.scaleX();
  };

  /**
   * Gets the position of the stage.
   */
  getPosition = (): Coordinate => {
    return this.konva.stage.position();
  };

  /**
   * Gets the size of the stage.
   */
  getSize(): Dimensions {
    return this.konva.stage.size();
  }

  /**
   * Scales a number of pixels by the current stage scale. For example, if the stage is scaled by 5, then 10 pixels
   * would be scaled to 10px / 5 = 2 pixels.
   * @param pixels The number of pixels to scale
   * @returns The number of pixels scaled by the current stage scale
   */
  getScaledPixels = (pixels: number): number => {
    return pixels / this.getScale();
  };

  setCursor = (cursor: Property.Cursor) => {
    this.container.style.cursor = cursor;
  };

  setIsDraggable = (isDraggable: boolean) => {
    this.konva.stage.draggable(isDraggable);
  };

  addLayer = (layer: Konva.Layer) => {
    this.konva.stage.add(layer);
  };

  destroy = () => {
    this.log.debug('Destroying module');
    this.subscriptions.forEach((unsubscribe) => unsubscribe());
    this.subscriptions.clear();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.konva.stage.destroy();
  };
}
