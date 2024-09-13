import type { SerializableObject } from 'common/types';
import { CanvasEntityAdapterBase } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityAdapterBase';
import { CanvasEntityBufferObjectRenderer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityBufferObjectRenderer';
import { CanvasEntityObjectRenderer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityObjectRenderer';
import { CanvasEntityTransformer } from 'features/controlLayers/konva/CanvasEntity/CanvasEntityTransformer';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import type { CanvasEntityIdentifier, CanvasInpaintMaskState, Rect } from 'features/controlLayers/store/types';
import type { GroupConfig } from 'konva/lib/Group';
import { omit } from 'lodash-es';

export class CanvasEntityAdapterInpaintMask extends CanvasEntityAdapterBase<
  CanvasInpaintMaskState,
  'inpaint_mask_adapter'
> {
  renderer: CanvasEntityObjectRenderer;
  bufferRenderer: CanvasEntityBufferObjectRenderer;
  transformer: CanvasEntityTransformer;
  filterer = undefined;

  constructor(entityIdentifier: CanvasEntityIdentifier<'inpaint_mask'>, manager: CanvasManager) {
    super(entityIdentifier, manager, 'inpaint_mask_adapter');

    this.renderer = new CanvasEntityObjectRenderer(this);
    this.bufferRenderer = new CanvasEntityBufferObjectRenderer(this);
    this.transformer = new CanvasEntityTransformer(this);

    this.subscriptions.add(this.manager.stateApi.createStoreSubscription(this.selectState, this.sync));
  }

  sync = async (state: CanvasInpaintMaskState | undefined, prevState: CanvasInpaintMaskState | undefined) => {
    if (!state) {
      this.destroy();
      return;
    }

    this.state = state;

    if (prevState && prevState === this.state) {
      return;
    }

    if (!prevState || this.state.isEnabled !== prevState.isEnabled) {
      this.syncIsEnabled();
    }
    if (!prevState || this.state.isLocked !== prevState.isLocked) {
      this.syncIsLocked();
    }
    if (!prevState || this.state.objects !== prevState.objects) {
      await this.syncObjects();
    }
    if (!prevState || this.state.position !== prevState.position) {
      this.syncPosition();
    }
    if (!prevState || this.state.opacity !== prevState.opacity) {
      this.syncOpacity();
    }
    if (!prevState || this.state.fill !== prevState.fill) {
      this.syncCompositingRectFill();
    }
    if (!prevState) {
      this.syncCompositingRectSize();
    }
  };

  syncCompositingRectSize = () => {
    this.renderer.updateCompositingRectSize();
  };

  syncCompositingRectFill = () => {
    this.renderer.updateCompositingRectFill();
  };

  getHashableState = (): SerializableObject => {
    const keysToOmit: (keyof CanvasInpaintMaskState)[] = ['fill', 'name', 'opacity'];
    return omit(this.state, keysToOmit);
  };

  getCanvas = (rect?: Rect): HTMLCanvasElement => {
    // The opacity may have been changed in response to user selecting a different entity category, and the mask regions
    // should be fully opaque - set opacity to 1 before rendering the canvas
    const attrs: GroupConfig = { opacity: 1 };
    const canvas = this.renderer.getCanvas({ rect, attrs });
    return canvas;
  };
}
