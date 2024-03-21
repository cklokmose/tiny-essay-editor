import { useDocument, useHandle, useRepo } from "@automerge/automerge-repo-react-hooks";
import { WebstrateDoc, WebstrateDocAnchor } from "../datatype";

import { useEffect, useMemo, useRef } from "react";

import * as diffMatchPatch from "diff-match-patch";
import { setImmediate } from "setimmediate";
import { next as Automerge } from "@automerge/automerge";

import * as A from "@automerge/automerge/next";
import { DocEditorProps } from "@/DocExplorer/doctypes";

export const Webstrate = ({
  docUrl,
  docHeads,
  annotations = [],
}: DocEditorProps<WebstrateDocAnchor, string>) => {
  const handle = useHandle(docUrl)
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
    frame.contentWindow.diffMatchPatch = diffMatchPatch;
    frame.contentWindow.Automerge = Automerge;
    frame.contentWindow.handle = handle
    frame.contentWindow.setImmediate = setImmediate;
    frame.contentWindow.postMessage({"repoSet": true})
    console.log("frame.contentWindow", frame.contentWindow)
  }

  if (!doc) {
    return null;
  }

  return (
    <div className="w-full h-full overflow-hidden">
      <iframe onLoad={ onFrameLoad } src="./webstrate.html" style={{width: "100%", height: "100%"}}/>
    </div>
  );
};
