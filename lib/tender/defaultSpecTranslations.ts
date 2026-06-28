/** Default Chinese / Japanese translations keyed by spec line code. */
export const SPEC_LINE_TRANSLATIONS: Record<
  string,
  { zh: string; ja: string }
> = {
  "DD-001": {
    zh: "干船坞使用费 / 坞租",
    ja: "ドック使用料 / ドック賃",
  },
  "DD-002": {
    zh: "码头费 / 修船期间泊位费",
    ja: "岸壁使用料 / 修理工場バース料",
  },
  "DD-003": {
    zh: "进坞与出坞（首日费用）",
    ja: "入渠・出渠（初日料金）",
  },
  "GS-001": {
    zh: "消防值班",
    ja: "防火見張り",
  },
  "GS-002": {
    zh: "安全巡逻",
    ja: "警備パトロール",
  },
  "GS-003": {
    zh: "临时通风",
    ja: "仮設換気",
  },
  "GS-004": {
    zh: "临时照明",
    ja: "仮設照明",
  },
  "UT-001": {
    zh: "冷却水管线（日租费）",
    ja: "冷却水ライン（日額）",
  },
  "UT-002": {
    zh: "冷却水连接 / 断开（×2）",
    ja: "冷却水接続・切離（×2）",
  },
  "UT-003": {
    zh: "岸电 / 电力（日租费）",
    ja: "岸壁電力（日額）",
  },
  "UT-004": {
    zh: "岸电连接 / 断开（×2）",
    ja: "岸壁電力接続・切離（×2）",
  },
  "UT-005": {
    zh: "压缩空气（日租费）",
    ja: "コンプレッサー空気（日額）",
  },
};

const HULL_ZONE_TRANSLATIONS: Record<string, { zh: string; ja: string }> = {
  "Boot Top": { zh: "水线间", ja: "バートップ" },
  "Flat Bottom": { zh: "平底", ja: "フラットボトム" },
  "Vertical Bottom (Side Bottom)": { zh: "直底（侧底）", ja: "垂直底部（側面底部）" },
  "Vertical Side": { zh: "直舷", ja: "垂直側面" },
  Topside: { zh: "干舷", ja: "トップサイド" },
};

export function hullPrepTranslation(zoneName: string): { zh: string; ja: string } {
  const base = HULL_ZONE_TRANSLATIONS[zoneName] ?? { zh: zoneName, ja: zoneName };
  return {
    zh: `${base.zh} — HP冲洗 / 预处理`,
    ja: `${base.ja} — HP洗浄 / 前処理`,
  };
}

export function hullPaintTranslation(zoneName: string): { zh: string; ja: string } {
  const base = HULL_ZONE_TRANSLATIONS[zoneName] ?? { zh: zoneName, ja: zoneName };
  return {
    zh: `${base.zh} — 涂装施工`,
    ja: `${base.ja} — 塗装施工`,
  };
}

export function lookupSpecTranslation(
  lineCode: string,
): { zh: string; ja: string } | null {
  return SPEC_LINE_TRANSLATIONS[lineCode] ?? null;
}
