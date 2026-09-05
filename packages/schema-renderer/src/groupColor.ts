/**
 * 群組配色。
 *
 * 由群組名稱決定色相，因此同一個群組在任何機器、任何一次開啟都是同一個顏色，
 * 也不需要使用者手動指定。飽和度與亮度固定，確保在深淺主題下都看得清楚。
 */
const HUE_COUNT = 12;

export function groupHue(group: string): number {
  let hash = 0;
  for (let i = 0; i < group.length; i++) {
    hash = (hash * 31 + group.charCodeAt(i)) >>> 0;
  }
  return (hash % HUE_COUNT) * (360 / HUE_COUNT);
}

/** 卡片左緣的群組色條。 */
export function groupColor(group: string): string {
  return `hsl(${groupHue(group)}, 62%, 58%)`;
}

/** 群組標籤的底色，比色條淡，不與文字搶注意力。 */
export function groupBadgeColor(group: string): string {
  return `hsla(${groupHue(group)}, 62%, 58%, 0.18)`;
}
