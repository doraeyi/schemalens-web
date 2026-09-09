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

/** 群組外框的邊線顏色。 */
export function groupBorderColor(group: string): string {
  return `hsla(${groupHue(group)}, 62%, 60%, 0.75)`;
}

/**
 * 群組外框的底色。
 *
 * 同色系但透明度極低：卡片自己有不透明背景，因此底色只會出現在卡片之間的縫隙，
 * 剛好圈出範圍又不影響閱讀。用單一透明色而不是點陣——
 * 10 個群組同時出現時，點陣會讓整片畫面變得很吵。
 */
export function groupTintColor(group: string): string {
  return `hsla(${groupHue(group)}, 62%, 58%, 0.08)`;
}
