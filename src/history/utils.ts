import { MarkdownDoc } from "@/tee/schema";
import {
  Doc,
  diff,
  decodeChange,
  ActorId,
  DecodedChange,
  Patch,
  getAllChanges,
} from "@automerge/automerge";

export type ChangeGroup = {
  id: string;
  changes: DecodedChange[];
  actorIds: ActorId[];
  charsAdded: number;
  charsDeleted: number;
  diff: Patch[];
};

/* returns all the changes from this doc, grouped in a simple way for now. */
export const getGroupedChanges = (doc: Doc<MarkdownDoc>) => {
  const changes = getAllChanges(doc);
  const reversedChanges = [...changes].reverse();
  const changeGroups: ChangeGroup[] = [];

  let currentGroup: ChangeGroup | null = null;

  const pushCurrentGroup = () => {
    currentGroup.diff = diff(
      doc,
      [currentGroup.changes[0].hash],
      [currentGroup.changes[currentGroup.changes.length - 1].hash]
    );
    changeGroups.push(currentGroup);
  };

  for (let i = 0; i < reversedChanges.length; i++) {
    const change = reversedChanges[i];
    const decodedChange = decodeChange(change);

    if (
      currentGroup &&
      currentGroup.actorIds[0] === decodedChange.actor &&
      currentGroup.changes.length < 1000
    ) {
      currentGroup.changes.push(decodedChange);
      currentGroup.charsAdded += decodedChange.ops.reduce((total, op) => {
        return op.action === "set" && op.insert === true ? total + 1 : total;
      }, 0);
      currentGroup.charsDeleted += decodedChange.ops.reduce((total, op) => {
        return op.action === "del" ? total + 1 : total;
      }, 0);
    } else {
      if (currentGroup) {
        pushCurrentGroup();
      }
      currentGroup = {
        id: decodedChange.hash,
        changes: [decodedChange],
        actorIds: [decodedChange.actor],
        charsAdded: decodedChange.ops.reduce((total, op) => {
          return op.action === "set" && op.insert === true ? total + 1 : total;
        }, 0),
        charsDeleted: decodedChange.ops.reduce((total, op) => {
          return op.action === "del" ? total + 1 : total;
        }, 0),
        diff: [],
      };
    }
  }

  if (currentGroup) {
    pushCurrentGroup();
  }

  return changeGroups;
};