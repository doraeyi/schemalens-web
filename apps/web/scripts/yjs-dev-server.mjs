/**
 * 本機開發用的 Yjs WebSocket relay server——即時協作 demo 專用。
 * 純記憶體、不落地、不進 production build，只用來讓兩個瀏覽器分頁互通。
 * 正式環境要怎麼跑（Vercel serverless 不支援長連線）之後再另外決定。
 */
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as map from 'lib0/map';

const messageSync = 0;
const messageAwareness = 1;
const pingTimeout = 30000;

const docs = new Map();

class WSSharedDoc extends Y.Doc {
	constructor(name) {
		super({ gc: true });
		this.name = name;
		this.conns = new Map();
		this.awareness = new awarenessProtocol.Awareness(this);
		this.awareness.setLocalState(null);

		this.awareness.on('update', ({ added, updated, removed }, conn) => {
			const changedClients = added.concat(updated, removed);
			if (conn !== null) {
				const controlledIds = this.conns.get(conn);
				if (controlledIds !== undefined) {
					added.forEach((clientID) => controlledIds.add(clientID));
					removed.forEach((clientID) => controlledIds.delete(clientID));
				}
			}
			const encoder = encoding.createEncoder();
			encoding.writeVarUint(encoder, messageAwareness);
			encoding.writeVarUint8Array(
				encoder,
				awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
			);
			const buff = encoding.toUint8Array(encoder);
			this.conns.forEach((_, c) => send(this, c, buff));
		});

		this.on('update', (update, _origin, doc) => {
			const encoder = encoding.createEncoder();
			encoding.writeVarUint(encoder, messageSync);
			syncProtocol.writeUpdate(encoder, update);
			const message = encoding.toUint8Array(encoder);
			doc.conns.forEach((_, conn) => send(doc, conn, message));
		});
	}
}

function getYDoc(docName) {
	return map.setIfUndefined(docs, docName, () => new WSSharedDoc(docName));
}

function send(doc, conn, message) {
	if (conn.readyState !== WebSocket.CONNECTING && conn.readyState !== WebSocket.OPEN) {
		closeConn(doc, conn);
		return;
	}
	try {
		conn.send(message, (err) => err != null && closeConn(doc, conn));
	} catch {
		closeConn(doc, conn);
	}
}

function closeConn(doc, conn) {
	if (doc.conns.has(conn)) {
		const controlledIds = doc.conns.get(conn);
		doc.conns.delete(conn);
		awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null);
	}
	conn.close();
}

function messageListener(conn, doc, message) {
	const encoder = encoding.createEncoder();
	const decoder = decoding.createDecoder(message);
	const messageType = decoding.readVarUint(decoder);
	switch (messageType) {
		case messageSync:
			encoding.writeVarUint(encoder, messageSync);
			syncProtocol.readSyncMessage(decoder, encoder, doc, conn);
			if (encoding.length(encoder) > 1) send(doc, conn, encoding.toUint8Array(encoder));
			break;
		case messageAwareness:
			awarenessProtocol.applyAwarenessUpdate(doc.awareness, decoding.readVarUint8Array(decoder), conn);
			break;
	}
}

function setupWSConnection(conn, req) {
	conn.binaryType = 'arraybuffer';
	const docName = (req.url || '/').slice(1).split('?')[0] || 'default';
	const doc = getYDoc(docName);
	doc.conns.set(conn, new Set());

	conn.on('message', (message) => messageListener(conn, doc, new Uint8Array(message)));

	let pongReceived = true;
	const pingInterval = setInterval(() => {
		if (!pongReceived) {
			if (doc.conns.has(conn)) closeConn(doc, conn);
			clearInterval(pingInterval);
			return;
		}
		if (doc.conns.has(conn)) {
			pongReceived = false;
			try {
				conn.ping();
			} catch {
				closeConn(doc, conn);
				clearInterval(pingInterval);
			}
		}
	}, pingTimeout);

	conn.on('close', () => {
		closeConn(doc, conn);
		clearInterval(pingInterval);
	});
	conn.on('pong', () => {
		pongReceived = true;
	});

	const syncEncoder = encoding.createEncoder();
	encoding.writeVarUint(syncEncoder, messageSync);
	syncProtocol.writeSyncStep1(syncEncoder, doc);
	send(doc, conn, encoding.toUint8Array(syncEncoder));

	const awarenessStates = doc.awareness.getStates();
	if (awarenessStates.size > 0) {
		const awarenessEncoder = encoding.createEncoder();
		encoding.writeVarUint(awarenessEncoder, messageAwareness);
		encoding.writeVarUint8Array(
			awarenessEncoder,
			awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys()))
		);
		send(doc, conn, encoding.toUint8Array(awarenessEncoder));
	}
}

const port = Number(process.env.PORT) || 1234;
// 正式環境部署時（見 apps/web/scripts/collab-relay-deploy/）只綁 localhost，
// 對外連線一律走 nginx 反向代理成 wss://，這個 process 本身不直接暴露在公網上。
// 本機開發預設值一樣是 127.0.0.1，不影響原本 ws://localhost:1234 的用法。
const host = process.env.HOST || '127.0.0.1';
const server = http.createServer((_req, res) => {
	res.writeHead(200, { 'Content-Type': 'text/plain' });
	res.end('yjs dev relay ok');
});
const wss = new WebSocketServer({ server });
wss.on('connection', setupWSConnection);
server.listen(port, host, () => {
	console.log(`[yjs-dev-server] listening on ws://${host}:${port}`);
});
