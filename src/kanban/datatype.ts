import { DataType } from "@/DocExplorer/doctypes";
import { uuid } from "@automerge/automerge";
import { KanbanSquare } from "lucide-react";
import {
  HasPatchworkMetadata,
  initPatchworkMetadata,
} from "@/patchwork/schema";
import { ChangeGroup } from "@/patchwork/groupChanges";

export type Lane = {
  id: string;
  title: string;
  cardIds: string[];
};

export type Card = {
  id: string;
  title: string;
  description: string;
  label: string;
};

export type KanbanBoardDoc = {
  title: string;
  lanes: Lane[];
  cards: Card[];
} & HasPatchworkMetadata<never, never>;

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
export const markCopy = () => {
  console.error("todo");
};

const getTitle = (doc: any) => {
  return doc.title;
};

export const init = (doc: any) => {
  doc.title = "Untitled Board";
  const defaultLaneId = uuid();
  doc.lanes = [{ id: defaultLaneId, title: "Lane 1", cardIds: [] }];
  doc.cards = [];

  initPatchworkMetadata(doc);
};

export const KanbanBoardDatatype: DataType<KanbanBoardDoc, unknown, unknown> = {
  id: "kanban",
  name: "Kanban Board",
  icon: KanbanSquare,
  init,
  getTitle,
  markCopy,
  fallbackSummaryForChangeGroup: (changeGroup: ChangeGroup<KanbanBoardDoc>) => {
    const descriptions = {
      addCard: { singular: "card added", plural: "cards added" },
      deleteCard: { singular: "card deleted", plural: "cards deleted" },
      moveCard: { singular: "card moved", plural: "cards moved" },
      updateCard: { singular: "card updated", plural: "cards updated" },
      addLane: { singular: "lane added", plural: "lanes added" },
      deleteLane: { singular: "lane deleted", plural: "lanes deleted" },
      updateLane: { singular: "lane updated", plural: "lanes updated" },
    };

    const actionKeys = Object.keys(KanbanBoardDatatype.actions);
    const initialActionCounts: { [key: string]: number } = actionKeys.reduce(
      (acc, key) => {
        acc[key] = 0;
        return acc;
      },
      {}
    );
    const actionCounts = changeGroup.changes.reduce(
      (acc, { metadata: { action } }) => {
        if (typeof action !== "string") return acc;
        if (!actionKeys.includes(action)) {
          console.error("weird action", action);
          return acc;
        }
        acc[action] += 1;
        return acc;
      },
      initialActionCounts
    );

    const summary = Object.entries(actionCounts)
      .filter(([, count]) => count > 0)
      .map(
        ([action, count]) =>
          `${count} ${
            count === 1
              ? descriptions[action].singular
              : descriptions[action].plural
          }`
      )
      .join(", ");
    return summary;
  },
  actions: {
    // TODO: there's other metadata we might want to track here:
    // - runtime checkable schema for the input arguments
    // - natural language description of the action and arguments
    // Maybe we could use decorators to add this to a TS method or something?
    addCard: (doc, { card, laneId }: { card: Card; laneId: string }) => {
      doc.cards.push({ ...card });
      const lane = doc.lanes.find((l) => l.id === laneId);
      lane.cardIds.push(card.id);
    },
    deleteCard: (doc, { cardId }: { cardId: string }) => {
      for (const lane of doc.lanes) {
        const index = [...lane.cardIds].indexOf(cardId);
        if (index > -1) {
          lane.cardIds.splice(index, 1);
        }
      }
      doc.cards.splice(
        doc.cards.findIndex((card) => card.id === cardId),
        1
      );
    },
    updateCard: (doc, { newCard }: { newCard: Card }) => {
      const card = doc.cards.find((card) => card.id === newCard.id);
      if (newCard.title && newCard.title !== card.title) {
        card.title = newCard.title;
      }
      if (newCard.description && newCard.description !== card.description) {
        card.description = newCard.description;
      }
    },
    moveCard: (
      doc,
      {
        fromLaneId,
        toLaneId,
        cardId,
        index,
      }: { fromLaneId: string; toLaneId: string; cardId: string; index: number }
    ) => {
      const fromLane = doc.lanes.find((l) => l.id === fromLaneId);
      const toLane = doc.lanes.find((l) => l.id === toLaneId);

      // TODO: this doesn't work if we don't copy the array; why? automerge bug?
      const oldIndex = [...fromLane.cardIds].indexOf(cardId);
      fromLane.cardIds.splice(oldIndex, 1);
      toLane.cardIds.splice(index, 0, cardId);
    },
    addLane: (doc, { lane }: { lane: { id: string; title: string } }) => {
      doc.lanes.push({ ...lane, cardIds: [] });
    },
    deleteLane: (doc, { laneId }: { laneId: string }) => {
      const lane = doc.lanes.find((l) => l.id === laneId);
      if (!lane) {
        return;
      }
      for (const cardId of lane.cardIds) {
        KanbanBoardDatatype.actions.deleteCard(doc, { cardId });
      }
      doc.lanes.splice(doc.lanes.indexOf(lane), 1);
    },
    updateLane: (doc, { lane }: { lane: Lane }) => {
      const oldLane = doc.lanes.find((l) => l.id === lane.id);
      if (!oldLane) {
        return;
      }
      if (lane.title && lane.title !== oldLane.title) {
        oldLane.title = lane.title;
      }
    },
  },
};