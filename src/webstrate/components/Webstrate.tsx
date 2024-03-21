import { useDocument, useHandle, useRepo } from "@automerge/automerge-repo-react-hooks";
import { WebstrateDoc, WebstrateDocAnchor } from "../datatype";

import { useEffect, useMemo, useRef } from "react";

import diff_match_patch from "diff-match-patch";
import { next as Automerge } from "@automerge/automerge";

import * as A from "@automerge/automerge/next";
import { DocEditorProps } from "@/DocExplorer/doctypes";

export const Webstrate = ({
  docUrl,
  docHeads,
  annotations = [],
}: DocEditorProps<WebstrateDocAnchor, string>) => {
  const [latestDoc] = useDocument<WebstrateDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const frameRef = useRef(null);
  const repo = useRepo()

  const doc = useMemo(
    () => (docHeads ? A.view(latestDoc, docHeads) : latestDoc),
    [latestDoc, docHeads]
  );

  const onFrameLoad = (event) => {
    const frame = event.target
    console.log("loaded", event)
    if (!frame) return
    frame.contentWindow.repo = repo;
    frame.contentWindow.diffMatchPatch = diff_match_patch;
    frame.contentWindow.Automerge = Automerge;
    frame.contentWindow.setImmediate = setImmediate;
    frame.contentWindow.postMessage({msg: "repoSet", documentUrl: docUrl});
    console.log("frame.contentWindow", frame.contentWindow)
  }

  useEffect(() => {
    if (!frameRef.current) return
    
    const frame = frameRef.current;
    frame.addEventListener("load", () => {
    });
  }, [docUrl, frameRef, repo])

  if (!doc) {
    return null;
  }

  return (
    <div className="w-full h-full overflow-hidden">
      <iframe onLoad={ onFrameLoad } src="./index.html"/>
    </div>
  );
};
