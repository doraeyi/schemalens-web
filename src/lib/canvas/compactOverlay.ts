import { groupColor } from '@schemalens/schema-renderer';
import type { Schema, TableId } from '@schemalens/schema-core';

const ZONE_PADDING_X = 24;
const ZONE_PADDING_TOP = 20;
const ZONE_LABEL_HEIGHT = 40;
const ZONE_PADDING_BOTTOM = 20;

const SVG_NS = 'http://www.w3.org/2000/svg';

interface GroupInfo {
	name: string;
	description?: string;
	tableCount: number;
}

/** Every group with at least one table, in schema.groups declaration order, then any implicit ones alphabetically. */
function orderedGroups(schema: Schema): GroupInfo[] {
	const counts = new Map<string, number>();
	for (const table of schema.tables) {
		if (!table.group) continue;
		counts.set(table.group, (counts.get(table.group) ?? 0) + 1);
	}
	const declared = (schema.groups ?? []).map((g) => g.name).filter((name) => counts.has(name));
	const declaredSet = new Set(declared);
	const implicit = [...counts.keys()].filter((name) => !declaredSet.has(name)).sort((a, b) => a.localeCompare(b));
	const descriptions = new Map((schema.groups ?? []).map((g) => [g.name, g.description] as const));
	return [...declared, ...implicit].map((name) => ({
		name,
		tableCount: counts.get(name) ?? 0,
		description: descriptions.get(name)
	}));
}

function parsePx(value: string): number {
	const n = Number.parseFloat(value);
	return Number.isFinite(n) ? n : 0;
}

interface CardRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

function readRect(card: HTMLElement): CardRect {
	return {
		left: parsePx(card.style.left),
		top: parsePx(card.style.top),
		width: parsePx(card.style.width),
		height: parsePx(card.style.height)
	};
}

function ensureZoneLayer(viewport: HTMLElement): HTMLElement {
	let layer = viewport.querySelector<HTMLElement>('.sl-zone-layer');
	if (!layer) {
		layer = document.createElement('div');
		layer.className = 'sl-zone-layer';
		viewport.insertBefore(layer, viewport.firstChild);
	}
	return layer;
}

function ensureConnectorLayer(viewport: HTMLElement, afterNode: HTMLElement): SVGSVGElement {
	let svg = viewport.querySelector<SVGSVGElement>('.sl-connector-layer');
	if (!svg) {
		svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
		svg.setAttribute('class', 'sl-connector-layer');
		// zone layer stays behind; connectors sit right after it, cards render on top via .dbs-nodes' own z-index.
		viewport.insertBefore(svg, afterNode.nextSibling);
	}
	return svg;
}

type ArrowDir = 'up' | 'down' | 'left' | 'right';

interface RoutedConnector {
	d: string;
	arrowTip: { x: number; y: number };
	arrowDir: ArrowDir;
}

/** Simple org-chart style elbow connector between two world-space rects. */
function orthogonalConnector(a: CardRect, b: CardRect): RoutedConnector {
	const aCenterY = a.top + a.height / 2;
	const bCenterY = b.top + b.height / 2;
	const sameRow = Math.abs(aCenterY - bCenterY) < 4;

	if (sameRow) {
		const leftToRight = a.left <= b.left;
		const fromX = leftToRight ? a.left + a.width : a.left;
		const toX = leftToRight ? b.left : b.left + b.width;
		return {
			d: `M ${fromX} ${aCenterY} L ${toX} ${bCenterY}`,
			arrowTip: { x: toX, y: bCenterY },
			arrowDir: leftToRight ? 'right' : 'left'
		};
	}

	const aOnTop = a.top < b.top;
	const fromY = aOnTop ? a.top + a.height : a.top;
	const toY = aOnTop ? b.top : b.top + b.height;
	const fromX = a.left + a.width / 2;
	const toX = b.left + b.width / 2;
	const midY = (fromY + toY) / 2;
	return {
		d: `M ${fromX} ${fromY} L ${fromX} ${midY} L ${toX} ${midY} L ${toX} ${toY}`,
		arrowTip: { x: toX, y: toY },
		arrowDir: aOnTop ? 'down' : 'up'
	};
}

/**
 * Points for a small filled arrowhead triangle. Drawn as a plain polygon
 * rather than an SVG <marker> — html-to-image's DOM-to-canvas rasterization
 * doesn't resolve <marker>/url() references reliably (it can render them as
 * a giant unstyled black wedge instead of a small arrow), so a marker-free
 * shape is the robust choice for anything that has to survive PNG/SVG export.
 */
function arrowheadPoints(tip: { x: number; y: number }, dir: ArrowDir, size = 7): string {
	const half = size / 1.6;
	const { x, y } = tip;
	switch (dir) {
		case 'right':
			return `${x - size},${y - half} ${x},${y} ${x - size},${y + half}`;
		case 'left':
			return `${x + size},${y - half} ${x},${y} ${x + size},${y + half}`;
		case 'down':
			return `${x - half},${y - size} ${x},${y} ${x + half},${y - size}`;
		case 'up':
			return `${x - half},${y + size} ${x},${y} ${x + half},${y + size}`;
	}
}

/**
 * Draws grouped zone panels + orthogonal relation connectors for compact
 * mode, entirely from the app layer: reads the positions the vendored
 * renderer already wrote as inline styles on its .dbs-card elements, and
 * hides its own curved .dbs-edges layer in favor of these simpler lines.
 * Never touches the vendored source. Idempotent — safe after every re-render.
 */
export function syncCompactOverlay(
	canvasHost: HTMLElement,
	schema: Schema,
	hiddenGroups: ReadonlySet<string>
): void {
	canvasHost.classList.add('sl-compact-active');

	const cardById = new Map<TableId, HTMLElement>();
	for (const card of canvasHost.querySelectorAll<HTMLElement>('.dbs-card')) {
		const id = card.dataset.tableId as TableId | undefined;
		if (id) cardById.set(id, card);
		const hidden = !!card.dataset.group && hiddenGroups.has(card.dataset.group);
		card.classList.toggle('sl-group-hidden', hidden);
	}

	const viewport = canvasHost.querySelector<HTMLElement>('.dbs-viewport');
	if (!viewport) return;

	// Global X span so every zone panel lines up to the same left/right edges.
	let globalMinX = Infinity;
	let globalMaxX = -Infinity;
	for (const card of cardById.values()) {
		const rect = readRect(card);
		globalMinX = Math.min(globalMinX, rect.left);
		globalMaxX = Math.max(globalMaxX, rect.left + rect.width);
	}

	const zoneLayer = ensureZoneLayer(viewport);
	const groups = orderedGroups(schema);
	const seen = new Set<string>();

	for (const group of groups) {
		const cards = [...cardById.values()].filter((card) => card.dataset.group === group.name);
		if (cards.length === 0) continue;
		seen.add(group.name);

		let minY = Infinity;
		let maxY = -Infinity;
		for (const card of cards) {
			const rect = readRect(card);
			minY = Math.min(minY, rect.top);
			maxY = Math.max(maxY, rect.top + rect.height);
		}

		let zone = zoneLayer.querySelector<HTMLElement>(`.sl-zone[data-group="${CSS.escape(group.name)}"]`);
		if (!zone) {
			zone = document.createElement('div');
			zone.className = 'sl-zone';
			zone.dataset.group = group.name;
			const label = document.createElement('div');
			label.className = 'sl-zone-label';
			label.append(el('div', 'sl-zone-title'), el('div', 'sl-zone-desc'));
			zone.append(label);
			zoneLayer.append(zone);
		}

		zone.style.left = `${globalMinX - ZONE_PADDING_X}px`;
		zone.style.width = `${globalMaxX - globalMinX + ZONE_PADDING_X * 2}px`;
		zone.style.top = `${minY - ZONE_PADDING_TOP - ZONE_LABEL_HEIGHT}px`;
		zone.style.height = `${maxY - minY + ZONE_PADDING_TOP + ZONE_LABEL_HEIGHT + ZONE_PADDING_BOTTOM}px`;
		zone.style.borderLeftColor = groupColor(group.name);
		zone.classList.toggle('sl-group-hidden', hiddenGroups.has(group.name));

		const title = zone.querySelector<HTMLElement>('.sl-zone-title');
		if (title) title.textContent = `${group.name}（${group.tableCount} 張表）`;
		const desc = zone.querySelector<HTMLElement>('.sl-zone-desc');
		if (desc) desc.textContent = group.description ?? '';
	}

	for (const zone of zoneLayer.querySelectorAll<HTMLElement>('.sl-zone')) {
		if (zone.dataset.group && !seen.has(zone.dataset.group)) zone.remove();
	}

	// Connectors: one elbow path + arrowhead per relation whose two tables are both currently shown.
	const connectorSvg = ensureConnectorLayer(viewport, zoneLayer);
	connectorSvg.replaceChildren();

	const isHidden = (id: TableId): boolean => {
		const card = cardById.get(id);
		return !card || (!!card.dataset.group && hiddenGroups.has(card.dataset.group));
	};

	// Baked in as real attribute values (not left to the "sl-connector-*" CSS classes) so the
	// lines still render correctly under html-to-image's PNG/SVG export, which doesn't reliably
	// resolve external stylesheet rules — let alone CSS custom properties — for cloned SVG nodes.
	const connectorColor = getComputedStyle(canvasHost).getPropertyValue('--sl-cyan').trim() || '#22d3ee';

	for (const relation of schema.relations) {
		if (isHidden(relation.sourceTable) || isHidden(relation.targetTable)) continue;
		const sourceCard = cardById.get(relation.sourceTable);
		const targetCard = cardById.get(relation.targetTable);
		if (!sourceCard || !targetCard) continue;

		const { d, arrowTip, arrowDir } = orthogonalConnector(readRect(sourceCard), readRect(targetCard));

		const path = document.createElementNS(SVG_NS, 'path');
		path.setAttribute('class', 'sl-connector-path');
		path.setAttribute('d', d);
		path.setAttribute('fill', 'none');
		path.setAttribute('stroke', connectorColor);
		path.setAttribute('stroke-width', '1.5');
		path.setAttribute('opacity', '0.55');
		connectorSvg.append(path);

		const arrow = document.createElementNS(SVG_NS, 'polygon');
		arrow.setAttribute('class', 'sl-connector-arrowhead');
		arrow.setAttribute('points', arrowheadPoints(arrowTip, arrowDir));
		arrow.setAttribute('fill', connectorColor);
		arrow.setAttribute('opacity', '0.55');
		connectorSvg.append(arrow);
	}
}

function el(tag: string, className: string): HTMLElement {
	const node = document.createElement(tag);
	node.className = className;
	return node;
}

/** Removes every trace of the compact overlay — call when switching back to full mode. */
export function clearCompactOverlay(canvasHost: HTMLElement): void {
	canvasHost.classList.remove('sl-compact-active');
	for (const el of canvasHost.querySelectorAll('.sl-group-hidden')) el.classList.remove('sl-group-hidden');
	canvasHost.querySelector('.sl-zone-layer')?.remove();
	canvasHost.querySelector('.sl-connector-layer')?.remove();
}
