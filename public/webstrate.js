// await import("es-module-shims")

console.log("I live")

const documentProxyObj = {};
const documentProxy = new Proxy(document, documentProxyObj);
window.documentProxy = documentProxy;

import {coreEvents} from "./webstrates/coreEvents.js";
import {coreDOM} from './webstrates/coreDOM.js';
import {corePopulator} from "./webstrates/corePopulator.js";
import {coreMutation} from './webstrates/coreMutation.js';
import {coreOpCreator} from './webstrates/coreOpCreator.js';
import {coreDocument} from './webstrates/coreDocument.js';
import {coreOpApplier} from './webstrates/coreOpApplier.js';
import {coreUtils} from './webstrates/coreUtils.js';
import {corePathTree} from "./webstrates/corePathTree.js";
import {coreJsonML} from "./webstrates/coreJsonML.js";
import {coreFederation} from "./webstrates/coreFederation.js";
import {globalObject} from "./webstrates/globalObject.js";
import {protectedMode} from "./webstrates/protectedMode.js";

coreDOM.setDocuments(documentProxy, document, documentProxyObj);

corePopulator.setDocument(documentProxy);
coreMutation.setDocument(documentProxy);
coreOpCreator.setDocument(documentProxy);
coreDocument.setDocument(documentProxy);
coreOpApplier.setDocument(documentProxy);
coreUtils.setDocument(documentProxy);
corePathTree.setDocument(documentProxy);
coreJsonML.setDocument(documentProxy);
protectedMode.setDocument(documentProxy);

window.config = {};
window.config.isTransientElement = (DOMNode) => DOMNode.matches('transient');
window.config.isTransientAttribute = (DOMNode, attributeName) => attributeName.startsWith('transient-');
window.config.peerConnectionConfig = {
	'iceServers': [
		{ urls: 'stun:stun.services.mozilla.com' },
		{ urls: 'stun:stun.l.google.com:19302' }
	]
}
window.config.attributeValueDiffing = false;

window.assetHandles = [];


self.repo = window.repo;
self.Automerge = window.Automerge;

window.addEventListener("message", (e) => {
	console.log('received message from host context', e)

	coreEvents.triggerEvent('allModulesLoaded');
	coreEvents.triggerEvent('peerIdReceived', {id: window.repo.networkSubsystem.peerId});

	const handle = window.handle
	if (handle) {
		document.body.innerHTML = "Looking up strate...";
		let timeout = setTimeout(() => {
			document.body.innerHTML = "Could not find the strate.";
		}, 5000);
		let doc = handle.docSync();
		clearTimeout(timeout);
		if (!doc) {
			document.body.innerHTML = "No such strate."
		} else {
			setupWebstrates(handle);
		}
	} else {
		document.body.innerHTML = "No such strate."
	}
})

function setupWebstrates(handle) {
		handle.doc().then((doc) => {
			window.amDoc = doc;
			coreOpApplier.listenForOps();
			coreEvents.triggerEvent('receivedDocument', doc, { static: false });
			corePopulator.populate(coreDOM.externalDocument, doc).then(async => {
				coreMutation.emitMutationsFrom(coreDOM.externalDocument);
				coreOpCreator.emitOpsFromMutations();
				coreDocument.subscribeToOps();
				const targetElement = coreDOM.externalDocument.childNodes[0];
				coreOpApplier.setRootElement(targetElement);

				handle.on( 'change', (change) => {
					if (!window.suppressChanges) {
						let patches = change.patches;
						coreDocument.handlePatches(patches);
					}
					window.amDoc = change.doc;
				});

				// Ephemeral messages might be sent multiple times, so we need to deduplicate them.
				let messageMap = new Map();
				handle.on('ephemeral-message', (messageObj) => {
					let message = messageObj.message;
					if (!message.uuid) return;
					if (!messageMap.has(message.uuid)) {
						coreEvents.triggerEvent('message', message, messageObj.senderId);
						messageMap.set(message.uuid, Date.now());
					}
				});
				// We clear out seen messages every 10 seconds.
				setInterval(() => {
					let now = Date.now();
					for (let [uuid, timestamp] of messageMap) {
						if (now - timestamp > 10000) {
							messageMap.delete(uuid);
						}
					}
				}, 10000);
			})
		});
}


