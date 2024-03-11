import React, {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  useReducer,
} from "react";
import {
  Discussion,
  DiscussionComment,
  HasPatchworkMetadata,
} from "@/patchwork/schema";
import { DiscussionTargetPosition } from "@/tee/codemirrorPlugins/discussionTargetPositionListener";
import { ContactAvatar } from "@/DocExplorer/components/ContactAvatar";
import { getRelativeTimeString, useStaticCallback } from "@/tee/utils";
import { useCurrentAccount } from "@/DocExplorer/account";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Reply } from "lucide-react";
import { uuid } from "@automerge/automerge";
import { sortBy } from "lodash";

export const SpatialSidebar = React.memo(
  ({
    topDiscussion,
    discussions,
    changeDoc,
    onChangeCommentPositionMap,
    setSelectedDiscussionId,
    selectedDiscussionId,
    setHoveredDiscussionId,
    hoveredDiscussionId,
  }: {
    topDiscussion: Discussion;
    discussions: Discussion[];
    changeDoc: (changeFn: (doc: HasPatchworkMetadata) => void) => void;
    onChangeCommentPositionMap: (map: PositionMap) => void;
    setSelectedDiscussionId: (id: string) => void;
    setHoveredDiscussionId: (id: string) => void;
    selectedDiscussionId: string;
    hoveredDiscussionId: string;
  }) => {
    const [activeReplyDiscussionId, setActiveReplyDiscussionId] =
      useState<string>();
    const [scrollOffset, setScrollOffset] = useState(0);
    const account = useCurrentAccount();
    const [scrollContainer, setScrollContainer] = useState<HTMLDivElement>();
    const scrollContainerRect = useMemo(
      () => scrollContainer?.getBoundingClientRect(),
      [scrollContainer]
    );

    const replyToDiscussion = (discussion: Discussion, content: string) => {
      setActiveReplyDiscussionId(null);

      changeDoc((doc) => {
        doc.discussions[discussion.id].comments.push({
          id: uuid(),
          content,
          contactUrl: account.contactHandle.url,
          timestamp: Date.now(),
        });
      });
    };

    const resolveDiscussion = (discussion: Discussion) => {
      const index = discussions.findIndex((d) => d.id === discussion.id);
      const nextDiscussion = discussions[index + 1];

      if (nextDiscussion) {
        setSelectedDiscussionId(nextDiscussion?.id);
      } else {
        const prevDiscussion = discussions[index - 1];
        setSelectedDiscussionId(prevDiscussion?.id);
      }

      changeDoc((doc) => {
        doc.discussions[discussion.id].resolved = true;
      });
    };

    const { registerDiscussionElement, discussionsPositionMap } =
      useDiscussionsPositionMap({
        discussions,
        onChangeCommentPositionMap,
        offset: scrollContainerRect
          ? scrollContainerRect.top - scrollOffset
          : 0,
      });

    const setScrollTarget = useSetScrollTarget(
      discussionsPositionMap,
      scrollContainer
    );

    // sync scrollPosition
    useEffect(() => {
      if (!scrollContainer || !topDiscussion) {
        return;
      }

      // if there is a new selectedDiscussionId ...
      if (selectedDiscussionId) {
        const position = discussionsPositionMap[selectedDiscussionId];
        const scrollOffset = scrollContainer.scrollTop;

        // scroll into view if it's not vissible
        if (
          position &&
          (position.top - scrollOffset < 0 ||
            position.bottom - scrollOffset > scrollContainer.clientHeight)
        ) {
          setScrollTarget(selectedDiscussionId);
        }

        return;
      }

      setScrollTarget(topDiscussion.id);
    }, [
      topDiscussion.id,
      selectedDiscussionId,
      scrollContainer,
      topDiscussion,
      setScrollTarget,
      discussionsPositionMap,
    ]);

    return (
      <div
        ref={setScrollContainer}
        onScroll={(evt) =>
          setScrollOffset((evt.target as HTMLDivElement).scrollTop)
        }
        className="bg-gray-50 flex- h-full p-2 flex flex-col z-20 m-h-[100%] overflow-y-auto overflow-x-visible"
      >
        {discussions &&
          discussions.map((discussion, index) => (
            <DiscussionView
              key={discussion.id}
              discussion={discussion}
              isReplyBoxOpen={activeReplyDiscussionId === discussion.id}
              setIsReplyBoxOpen={(isOpen) =>
                setActiveReplyDiscussionId(isOpen ? discussion.id : undefined)
              }
              onResolve={() => resolveDiscussion(discussion)}
              onReply={(content) => replyToDiscussion(discussion, content)}
              isHovered={hoveredDiscussionId === discussion.id}
              setIsHovered={(isHovered) =>
                setHoveredDiscussionId(isHovered ? discussion.id : undefined)
              }
              isSelected={selectedDiscussionId === discussion.id}
              setIsSelected={(isSelected) => {
                setSelectedDiscussionId(isSelected ? discussion.id : undefined);
              }}
              ref={(element) =>
                registerDiscussionElement(discussion.id, element)
              }
              onSelectNext={() => {
                const nextDiscussion = discussions[index + 1];
                if (nextDiscussion) {
                  setSelectedDiscussionId(nextDiscussion.id);
                }
              }}
              onSelectPrev={() => {
                const prevDiscussion = discussions[index - 1];
                if (prevDiscussion) {
                  setSelectedDiscussionId(prevDiscussion.id);
                }
              }}
            />
          ))}
      </div>
    );
  }
);

interface DiscussionViewProps {
  discussion: Discussion;
  isReplyBoxOpen: boolean;
  setIsReplyBoxOpen: (isOpen: boolean) => void;
  onResolve: () => void;
  onReply: (content: string) => void;
  onSelectNext: () => void;
  onSelectPrev: () => void;
  isHovered: boolean;
  setIsHovered: (isHovered: boolean) => void;
  isSelected: boolean;
  setIsSelected: (isSelected: boolean) => void;
}

const DiscussionView = forwardRef<HTMLDivElement, DiscussionViewProps>(
  (
    {
      discussion,
      isReplyBoxOpen,
      setIsReplyBoxOpen,
      onResolve,
      onReply,
      isHovered,
      setIsHovered,
      isSelected,
      setIsSelected,
      onSelectNext,
      onSelectPrev,
    }: DiscussionViewProps,
    ref
  ) => {
    const [pendingCommentText, setPendingCommentText] = useState("");
    const [height, setHeight] = useState();
    const [isBeingResolved, setIsBeingResolved] = useState(false);
    const localRef = useRef(null); // Use useRef to create a local ref

    const setRef = (element: HTMLDivElement) => {
      localRef.current = element; // Assign the element to the local ref
      // Forward the ref to the parent
      if (typeof ref === "function") {
        ref(element);
      } else if (ref) {
        ref.current = element;
      }
    };

    const onStartResolve = () => {
      setHeight(localRef.current.clientHeight);
      // delay, so height is set first for transition
      requestAnimationFrame(() => {
        setIsBeingResolved(true);
      });
    };

    // handle keyboard shortcuts
    /*
     * k / ctrl + p / cmd + p : select previous discussion
     * j / ctrl + n / cmd + n: select next discussion
     * cmd + x / ctrl + x : resolve
     * cmd + enter / ctrl + enter : reply
     */
    useEffect(() => {
      if (!isSelected) {
        return;
      }

      const onKeydown = (evt: KeyboardEvent) => {
        const isMetaOrControlPressed = evt.ctrlKey || evt.metaKey;

        // select previous discussion
        if (evt.key === "k" || (evt.key === "p" && isMetaOrControlPressed)) {
          onSelectPrev();
          evt.preventDefault();
          evt.stopPropagation();

          return;
        }

        // select next discussion
        if (evt.key === "j" || evt.key === "n") {
          onSelectNext();
          return;
        }

        if (evt.key === "x" && isMetaOrControlPressed) {
          onStartResolve();
          evt.preventDefault();
          evt.stopPropagation();
        }

        if (evt.key === "Enter" && isMetaOrControlPressed) {
          setIsReplyBoxOpen(true);
          evt.preventDefault();
          evt.stopPropagation();
        }
      };

      window.addEventListener("keydown", onKeydown);

      return () => {
        window.removeEventListener("keydown", onKeydown);
      };
    }, [isSelected, onSelectNext, onSelectPrev, setIsReplyBoxOpen]);

    return (
      <div
        ref={setRef}
        className={`pt-2 transition-all ${
          isBeingResolved ? "overflow-hidden" : ""
        }`}
        style={
          height !== undefined
            ? {
                height: isBeingResolved ? "0" : `${height}px`,
              }
            : undefined
        }
        onTransitionEnd={() => {
          if (isBeingResolved) {
            onResolve();
          }
        }}
      >
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => setIsSelected(true)}
          key={discussion.id}
          className={`select-none mr-2 px-2 py-1 border rounded-sm  hover:border-gray-400 bg-white
    ${
      isSelected || isHovered ? "border-gray-400 shadow-xl" : "border-gray-200 "
    }`}
        >
          <div>
            {discussion.comments.map((comment, index) => (
              <div
                key={comment.id}
                className={
                  index !== discussion.comments.length - 1
                    ? "border-b border-gray-200"
                    : ""
                }
              >
                <DiscusssionCommentView comment={comment} />
              </div>
            ))}
          </div>
          <div
            className={`overflow-hidden transition-all ${
              isSelected ? "h-[43px] border-t border-gray-200 pt-2" : "h-[0px]"
            }`}
          >
            <Popover open={isReplyBoxOpen} onOpenChange={setIsReplyBoxOpen}>
              <PopoverTrigger asChild>
                <Button className="mr-2 px-2 h-8" variant="ghost">
                  <Reply className="mr-2" /> Reply
                  <span className="text-gray-400 ml-2 text-xs">(⌘ + ⏎)</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <Textarea
                  className="mb-4"
                  value={pendingCommentText}
                  onChange={(event) =>
                    setPendingCommentText(event.target.value)
                  }
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter" && event.metaKey) {
                      onReply(pendingCommentText);
                      setPendingCommentText("");
                      event.preventDefault();
                    }
                  }}
                />

                <PopoverClose>
                  <Button
                    variant="outline"
                    onClick={() => {
                      onReply(pendingCommentText);
                      setPendingCommentText("");
                    }}
                  >
                    Comment
                    <span className="text-gray-400 ml-2 text-xs">(⌘ + ⏎)</span>
                  </Button>
                </PopoverClose>
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              className="select-none h-8 px-2 "
              onClick={() => onStartResolve()}
            >
              <Check className="mr-2" /> Resolve
              <span className="text-gray-400 ml-2 text-xs">(⌘ + X)</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

const DiscusssionCommentView = ({
  comment,
}: {
  comment: DiscussionComment;
}) => {
  return (
    <div>
      <div className="flex items-center justify-between p-1.5 text-sm">
        <div className="">
          <ContactAvatar url={comment.contactUrl} showName={true} size="sm" />
        </div>

        <div className="text-xs text-gray-400">
          {getRelativeTimeString(comment.timestamp)}
        </div>
      </div>

      <div className="p-1.5">
        <p>{comment.content}</p>
      </div>
    </div>
  );
};

export type PositionMap = Record<string, { top: number; bottom: number }>;

interface UseDiscussionsPositionMapResult {
  registerDiscussionElement: (
    discussionId: string,
    element: HTMLDivElement
  ) => void;
  discussionsPositionMap: PositionMap;
}

interface UseDiscussionPositionOptions {
  discussions: Discussion[];
  onChangeCommentPositionMap?: (map: PositionMap) => void;
  offset: number;
}

const useDiscussionsPositionMap = ({
  discussions,
  onChangeCommentPositionMap,
  offset,
}: UseDiscussionPositionOptions): UseDiscussionsPositionMapResult => {
  const elementByDiscussionId = useRef(new Map<HTMLDivElement, string>());
  const discussionIdByElement = useRef(new Map<HTMLDivElement, string>());
  const elementSizes = useRef<Record<string, number>>({});
  // create an artificial dependency that triggeres a re-eval of effects / memos
  // that depend on it when forceChange is called
  const [, forceChange] = useReducer(() => ({}), {});
  const [resizeObserver] = useState(
    () =>
      new ResizeObserver((events) => {
        for (const event of events) {
          const discussionId = discussionIdByElement.current.get(
            event.target as HTMLDivElement
          );
          elementSizes.current[discussionId] = event.borderBoxSize[0].blockSize;
        }

        forceChange();
      })
  );

  // cleanup resize observer
  useEffect(() => {
    return () => {
      resizeObserver.disconnect();
    };
  }, [resizeObserver]);

  const registerDiscussionElement = (
    discussionId: string,
    element?: HTMLDivElement
  ) => {
    const prevElement = elementByDiscussionId.current[discussionId];
    if (prevElement) {
      resizeObserver.unobserve(prevElement);
      discussionIdByElement.current.delete(prevElement);
      delete elementByDiscussionId.current[discussionId];
    }

    if (element) {
      resizeObserver.observe(element);
      elementByDiscussionId.current[discussionId];
      discussionIdByElement.current.set(element, discussionId);
    }
  };

  const discussionsPositionMap = useMemo(() => {
    let currentPos = offset;
    const positionMap = {};

    for (const discussion of discussions) {
      const top = currentPos;
      const bottom = top + elementSizes.current[discussion.id];

      positionMap[discussion.id] = { top, bottom };
      currentPos = bottom;
    }

    if (onChangeCommentPositionMap) {
      onChangeCommentPositionMap(positionMap);
    }
    return positionMap;
  }, [discussions, offset, onChangeCommentPositionMap]);

  return { registerDiscussionElement, discussionsPositionMap };
};

export const useSetScrollTarget = (
  positionMap: PositionMap,
  scrollContainer: HTMLDivElement
) => {
  const targetIdRef = useRef<string>();

  const triggerScrollPositionUpdate = useStaticCallback(() => {
    const maxScrollPos =
      scrollContainer.scrollHeight - scrollContainer.clientHeight;
    const targetPos = positionMap[targetIdRef.current]?.top;

    // abort, if target no longer exists
    if (targetPos === undefined) {
      return;
    }

    const scrollToPos = Math.min(maxScrollPos, targetPos);

    // hack: for some reason the scrolling get's stuck when it's close to the target but not quite
    // haven't figured out yet why this is happening
    if (Math.abs(scrollContainer.scrollTop - scrollToPos) < 5) {
      scrollContainer.scrollTo({
        top: scrollToPos,
        behavior: "instant",
      });
      targetIdRef.current = undefined;
      return;
    }

    // incrementally converge towards scrollToPos
    const nextPosition = (scrollContainer.scrollTop * 9 + scrollToPos) / 10;

    scrollContainer.scrollTo({
      top: nextPosition,
      behavior: "instant",
    });

    requestAnimationFrame(triggerScrollPositionUpdate);
  });

  useEffect(() => {
    if (scrollContainer && targetIdRef.current !== undefined) {
      triggerScrollPositionUpdate();
    }
  }, [scrollContainer, triggerScrollPositionUpdate]);

  return (discussionId: string) => {
    const prevTarget = targetIdRef.current;

    targetIdRef.current = discussionId;

    if (!prevTarget && scrollContainer) {
      triggerScrollPositionUpdate();
    }
  };
};

const COMMENT_ANCHOR_OFFSET = 30;

export const SpatialCommentsLinesLayer = ({
  commentsPositionMap,
  discussionTargetPositions,
  activeDiscussionIds,
}: {
  commentsPositionMap: PositionMap;
  discussionTargetPositions: DiscussionTargetPosition[];
  activeDiscussionIds: string[];
}) => {
  const [bezierCurveLayerRect, setBezierCurveLayerRect] = useState<DOMRect>();
  const [bezierCurveLayerElement, setBezierCurveLayerElement] =
    useState<HTMLDivElement>();

  // handle resize of bezierCureveLayerElement
  useEffect(() => {
    if (!bezierCurveLayerElement) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setBezierCurveLayerRect(bezierCurveLayerElement.getBoundingClientRect());
    });

    setBezierCurveLayerRect(bezierCurveLayerElement.getBoundingClientRect());

    observer.observe(bezierCurveLayerElement);

    return () => {
      observer.disconnect();
    };
  }, [bezierCurveLayerElement]);

  return (
    <div
      ref={setBezierCurveLayerElement}
      className="absolute z-50 top-0 right-0 bottom-0 left-0 pointer-events-none"
    >
      {bezierCurveLayerRect && (
        <svg
          width={bezierCurveLayerRect.width}
          height={bezierCurveLayerRect.height}
        >
          {sortBy(discussionTargetPositions, (pos) =>
            activeDiscussionIds.includes(pos.discussion.id) ? 1 : 0
          ).map((position) => {
            const commentPosition = commentsPositionMap[position.discussion.id];

            if (!commentPosition) {
              return;
            }

            return (
              <BezierCurve
                color={
                  activeDiscussionIds.includes(position.discussion.id)
                    ? "#facc15"
                    : "#d1d5db"
                }
                key={position.discussion.id}
                x1={bezierCurveLayerRect.width}
                y1={
                  commentsPositionMap[position.discussion.id].top +
                  COMMENT_ANCHOR_OFFSET -
                  bezierCurveLayerRect.top
                }
                // todo: draw the line to the border of the editor
                // x2={editorContainerRect.right - bezierCurveLayerRect.left + 30}
                // y2={position.y + bezierCurveLayerRect.top}
                x2={position.x}
                y2={position.y - bezierCurveLayerRect.top}
                x3={position.x}
                y3={position.y - bezierCurveLayerRect.top}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
};

interface BezierCurveProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
  x4?: number;
  y4?: number;
  color: string;
}

const BezierCurve: React.FC<BezierCurveProps> = ({
  x1,
  y1,
  x2,
  y2,
  x3,
  y3,
  x4,
  y4,
  color,
}) => {
  // Control points for the Bezier curve from point 1 to point 2
  const controlPoint1 = { x: x1 + (x2 - x1) / 3, y: y1 };
  const controlPoint2 = { x: x2 - (x2 - x1) / 3, y: y2 };

  // Path data for the Bezier curve from point 1 to point 2
  const pathDataBezier1 = `M ${x1} ${y1} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${x2} ${y2}`;

  // Path data for the straight line from point 2 to point 3
  const pathDataLine = `M ${x2} ${y2} L ${x3} ${y3}`;

  let pathDataBezier2 = "";

  if (x4 !== undefined && y4 !== undefined) {
    // Control points for the Bezier curve from point 3 to point 4 that bends outwards
    const controlPoint3 = { x: x4, y: y3 };
    const controlPoint4 = { x: x4, y: y3 };

    // Path data for the Bezier curve from point 3 to point 4
    pathDataBezier2 = `M ${x3} ${y3} C ${controlPoint3.x} ${controlPoint3.y}, ${controlPoint4.x} ${controlPoint4.y}, ${x4} ${y4}`;
  }

  // Combine all path datas
  const combinedPathData = `${pathDataBezier1} ${pathDataLine} ${pathDataBezier2}`;

  return (
    <path d={combinedPathData} stroke={color} fill="none" strokeWidth="1" />
  );
};