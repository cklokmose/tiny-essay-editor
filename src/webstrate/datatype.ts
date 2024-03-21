import { Sheet } from "lucide-react";
import { next as A } from "@automerge/automerge";
import { DataType } from "@/DocExplorer/doctypes";
import { Annotation, HasPatchworkMetadata } from "@/patchwork/schema";

export type WebstrateDoc = HasPatchworkMetadata<never, never> & {
  title: string; // The title of the strate
  dom: any; // The DOM of the strate
};

export type WebstrateDocAnchor = {
  id: string;
}

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
// (this mechanism needs to be thought out more...)
export const markCopy = (doc: any) => {
  doc.title = "Copy of " + doc.title;
};

const getTitle = (doc: any) => {
  return doc.title || "Untitled Webstrate";
};

export const init = (doc: any) => {
  doc.title = "My Webstrate";
  doc.dom = ["h1", {}, "hello"]
};

// TODO
const patchesToAnnotations = (
  doc: WebstrateDoc,
  docBefore: WebstrateDoc,
  patches: A.Patch[]
) => {
  return patches.flatMap((patch): Annotation<WebstrateDocAnchor, string>[] => {
    const handledPatchActions = ["splice"];
    if (patch.path[0] !== "data" || !handledPatchActions.includes(patch.action))
      return [];

    // TODO: find a way to show the old value in the annotation
    switch (patch.action) {
      case "splice": {
        return [
          {
            type: "added",
            added: patch.value,
            target: {
              id: patch.path[patch.path.length-1] as string,
            },
          },
        ];
      }
      case "del":
        // TODO
        return [];

      default:
        throw new Error("invalid patch");
    }
  });
};

export const WebstrateDatatype: DataType<
  WebstrateDoc,
  WebstrateDocAnchor,
  string
> = {
  id: "webstrate",
  name: "Webstrate",
  icon: Sheet,
  init,
  getTitle,
  markCopy, // TODO: this shouldn't be here
  patchesToAnnotations,
};
