import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { WebstrateDoc, WebstrateDocAnchor } from "../datatype";

import { useMemo } from "react";

import * as A from "@automerge/automerge/next";
import { DocEditorProps } from "@/DocExplorer/doctypes";

export const Webstrate = ({
  docUrl,
  docHeads,
  annotations = [],
}: DocEditorProps<WebstrateDocAnchor, string>) => {
  const [latestDoc] = useDocument<WebstrateDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<WebstrateDoc>(docUrl);

  const doc = useMemo(
    () => (docHeads ? A.view(latestDoc, docHeads) : latestDoc),
    [latestDoc, docHeads]
  );

  if (!doc) {
    return null;
  }

  return (
    <div className="w-full h-full overflow-hidden">
      <h1>here goes a webstrate</h1>
    </div>
  );
};
