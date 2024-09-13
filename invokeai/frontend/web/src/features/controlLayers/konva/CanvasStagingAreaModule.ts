import { addAppListener } from 'app/store/middleware/listenerMiddleware';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import { CanvasModuleBase } from 'features/controlLayers/konva/CanvasModuleBase';
import { CanvasObjectImage } from 'features/controlLayers/konva/CanvasObject/CanvasObjectImage';
import { getPrefixedId } from 'features/controlLayers/konva/util';
import {
  selectCanvasStagingAreaSlice,
  stagingAreaStartedStaging,
} from 'features/controlLayers/store/canvasStagingAreaSlice';
import { imageDTOToImageWithDims, type StagingAreaImage } from 'features/controlLayers/store/types';
import Konva from 'konva';
import { atom } from 'nanostores';
import type { Logger } from 'roarr';

export class CanvasStagingAreaModule extends CanvasModuleBase {
  readonly type = 'staging_area';
  readonly id: string;
  readonly path: string[];
  readonly parent: CanvasManager;
  readonly manager: CanvasManager;
  readonly log: Logger;

  subscriptions: Set<() => void> = new Set();
  konva: { group: Konva.Group };
  image: CanvasObjectImage | null;
  selectedImage: StagingAreaImage | null;

  $shouldShowStagedImage = atom<boolean>(true);

  constructor(manager: CanvasManager) {
    super();
    this.id = getPrefixedId(this.type);
    this.parent = manager;
    this.manager = manager;
    this.path = this.manager.buildPath(this);
    this.log = this.manager.buildLogger(this);

    this.log.debug('Creating module');

    this.konva = { group: new Konva.Group({ name: `${this.type}:group`, listening: false }) };
    this.image = null;
    this.selectedImage = null;

    this.subscriptions.add(this.$shouldShowStagedImage.listen(this.render));
    this.subscriptions.add(this.manager.stateApi.createStoreSubscription(selectCanvasStagingAreaSlice, this.render));
    this.subscriptions.add(
      this.manager.stateApi.store.dispatch(
        addAppListener({
          actionCreator: stagingAreaStartedStaging,
          effect: () => {
            this.$shouldShowStagedImage.set(true);
            this.render();
          },
        })
      )
    );
  }

  initialize = () => {
    this.log.debug('Initializing module');
    this.render();
  };

  render = async () => {
    this.log.trace('Rendering staging area');
    const stagingArea = this.manager.stateApi.runSelector(selectCanvasStagingAreaSlice);
    const { x, y, width, height } = this.manager.stateApi.getBbox().rect;
    const shouldShowStagedImage = this.$shouldShowStagedImage.get();

    this.selectedImage = stagingArea.stagedImages[stagingArea.selectedStagedImageIndex] ?? null;
    this.konva.group.position({ x, y });

    if (this.selectedImage) {
      const { imageDTO } = this.selectedImage;

      if (!this.image) {
        const { image_name } = imageDTO;
        this.image = new CanvasObjectImage(
          {
            id: 'staging-area-image',
            type: 'image',
            image: {
              image_name: image_name,
              width,
              height,
            },
          },
          this
        );
        this.konva.group.add(this.image.konva.group);
      }

      if (!this.image.isLoading && !this.image.isError) {
        await this.image.update({ ...this.image.state, image: imageDTOToImageWithDims(imageDTO) }, true);
        this.manager.stateApi.$lastCanvasProgressEvent.set(null);
      }
      this.image.konva.group.visible(shouldShowStagedImage);
    } else {
      this.image?.konva.group.visible(false);
    }
  };

  getNodes = () => {
    return [this.konva.group];
  };

  destroy = () => {
    this.log.debug('Destroying module');
    this.subscriptions.forEach((unsubscribe) => unsubscribe());
    this.subscriptions.clear();
    if (this.image) {
      this.image.destroy();
    }
    for (const node of this.getNodes()) {
      node.destroy();
    }
  };

  repr = () => {
    return {
      id: this.id,
      type: this.type,
      path: this.path,
      selectedImage: this.selectedImage,
    };
  };
}
