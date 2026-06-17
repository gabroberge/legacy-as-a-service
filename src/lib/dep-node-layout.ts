const LABEL_CHAR_PX = 5.4;
const VER_CHAR_PX = 4.4;
const PAD_X = 18;
const MIN_W = 92;
const MAX_W = 158;
const NODE_H = 44;

export function measureNode(label: string, ver: string) {
  const inner = Math.max(label.length * LABEL_CHAR_PX, ver.length * VER_CHAR_PX);
  const w = Math.min(MAX_W, Math.max(MIN_W, Math.ceil(inner + PAD_X)));

  const maxLabelChars = Math.max(8, Math.floor((w - PAD_X) / LABEL_CHAR_PX));
  const maxVerChars = Math.max(10, Math.floor((w - PAD_X) / VER_CHAR_PX));

  const displayLabel =
    label.length > maxLabelChars ? `${label.slice(0, maxLabelChars - 1)}…` : label;
  const displayVer = ver.length > maxVerChars ? `${ver.slice(0, maxVerChars - 1)}…` : ver;

  return { w, h: NODE_H, displayLabel, displayVer };
}
