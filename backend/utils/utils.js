export const SUBTITLE_STYLES = [
  {
    id: "netflix",
    name: "Netflix",
    description: "White text, bold black outline",
    preview: { color: "#ffffff", bg: "transparent", outline: "#000000", fontStyle: "normal", fontWeight: "bold" },
    ass: `Style: Default,Arial,52,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,0,2,10,10,30,1`,
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "White text, semi-transparent black box",
    preview: { color: "#ffffff", bg: "rgba(0,0,0,0.6)", outline: "transparent", fontStyle: "normal", fontWeight: "normal" },
    ass: `Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,3,0,0,2,10,10,20,1`,
  },
  {
    id: "bold-yellow",
    name: "Bold Yellow",
    description: "Yellow bold text, black outline",
    preview: { color: "#ffff00", bg: "transparent", outline: "#000000", fontStyle: "normal", fontWeight: "bold" },
    ass: `Style: Default,Arial,56,&H0000FFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,1,2,10,10,30,1`,
  },
  {
    id: "top-caption",
    name: "Top Caption",
    description: "White text positioned at top",
    preview: { color: "#ffffff", bg: "rgba(0,0,0,0.5)", outline: "transparent", fontStyle: "normal", fontWeight: "normal" },
    ass: `Style: Default,Arial,52,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,8,10,10,30,1`,
  },
  {
    id: "cinematic",
    name: "Cinematic",
    description: "Italic white text with subtle shadow",
    preview: { color: "#ffffff", bg: "transparent", outline: "transparent", fontStyle: "italic", fontWeight: "normal" },
    ass: `Style: Default,Georgia,50,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,-1,0,0,100,100,1,0,1,1,3,2,10,10,30,1`,
  },
  {
    id: "neon-green",
    name: "Neon Green",
    description: "Bright green text, black outline",
    preview: { color: "#00ff88", bg: "transparent", outline: "#000000", fontStyle: "normal", fontWeight: "bold" },
    ass: `Style: Default,Arial,52,&H0088FF00,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,3,1,2,10,10,30,1`,
  },
  {
    id: "dark-box",
    name: "Dark Box",
    description: "White text on solid black box",
    preview: { color: "#ffffff", bg: "#000000", outline: "transparent", fontStyle: "normal", fontWeight: "normal" },
    ass: `Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,3,0,0,2,10,10,20,1`,
  },
  {
    id: "retro",
    name: "Retro",
    description: "Yellow monospace on black box",
    preview: { color: "#ffff00", bg: "#000000", outline: "transparent", fontStyle: "normal", fontWeight: "bold" },
    ass: `Style: Default,Courier New,52,&H0000FFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,3,0,0,2,10,10,20,1`,
  },
];

/**
 * Converts Whisper JSON transcription to ASS subtitle format.
 * @param {Object} json - { segments: [{ start, end, text }] }
 * @param {string} styleId - ID from SUBTITLE_STYLES (defaults to "netflix")
 */
export function jsonToAss(json, styleId = "netflix") {
  const style = SUBTITLE_STYLES.find(s => s.id === styleId) || SUBTITLE_STYLES[0];

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${style.ass}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  if (!json.segments || !Array.isArray(json.segments)) return header;

  const events = json.segments.map(seg => {
    const start = secondsToAss(seg.start);
    const end = secondsToAss(seg.end);
    const text = (seg.text || "").trim().replace(/{/g, "\\{").replace(/}/g, "\\}");
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
  });

  return header + events.join("\n") + "\n";
}

function secondsToAss(totalSeconds) {
  if (!totalSeconds || isNaN(totalSeconds)) return "0:00:00.00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const cs = Math.floor((totalSeconds % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}