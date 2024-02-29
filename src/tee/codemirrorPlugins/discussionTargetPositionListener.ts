import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";
import { setAnnotationsEffect, annotationsField } from "./annotations";
import { Discussion } from "@/patchwork/schema";

export interface DiscussionTargetPosition {
  x: number;
  y: number;

  discussion: Discussion;
}

export interface OverlayContainer {
  width: number;
  height: number;
  top: number;
  left: number;
  scrollOffset: number;
}

export const setOverlayContainerEffect = StateEffect.define<OverlayContainer>();
export const overlayContainerField = StateField.define<OverlayContainer | null>(
  {
    create() {
      return null;
    },
    update(rect, tr) {
      for (const e of tr.effects) {
        if (e.is(setOverlayContainerEffect)) {
          return e.value;
        }
      }

      return rect;
    },
  }
);

export const discussionTargetPositionListener = (
  onUpdate: (discussionTargetPositions: DiscussionTargetPosition[]) => void
) => {
  return ViewPlugin.fromClass(
    class {
      constructor(view: EditorView) {
        this.updatePositions(view);
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.transactions.some((tr) =>
            tr.effects.some(
              (e) =>
                e.is(setAnnotationsEffect) || e.is(setOverlayContainerEffect)
            )
          )
        ) {
          this.updatePositions(update.view);
        }
      }

      updatePositions(view: EditorView) {
        const overlayContainer = view.state.field(overlayContainerField);
        const annotations = view.state.field(annotationsField);

        if (!overlayContainer) {
          return;
        }

        // todo: there is probably a better way to do this
        // the problem here is that during update we can't read the positions
        requestAnimationFrame(() => {
          onUpdate(
            annotations.flatMap((annotation) => {
              if ("type" in annotation && annotation.type === "discussion") {
                const lastLineBreakIndex = view.state
                  .sliceDoc(annotation.from, annotation.to)
                  .trimEnd() // trim to ignore line breaks at the end of the string
                  .lastIndexOf("\n");
                const fromIndex =
                  lastLineBreakIndex === -1
                    ? annotation.from
                    : annotation.from + lastLineBreakIndex + 1;

                const fromCoords = view.coordsAtPos(fromIndex);

                if (!fromCoords) {
                  return [];
                }
                return [
                  {
                    discussion: (annotation as any).discussion, // todo: fix types
                    x: fromCoords.left - overlayContainer.left,
                    y: fromCoords.bottom - overlayContainer.top * 2,
                  },
                ];
              }
              return [];
            })
          );
        });
      }
    }
  );
};
