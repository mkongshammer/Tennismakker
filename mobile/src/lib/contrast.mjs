// Opaque sRGB colours only. Invalid club colours use the brand fallback.
export function readableSurface(value) {
  const backgroundColor = /^#[0-9a-f]{6}$/i.test(value ?? "") ? value : "#1B62C4";
  const channels = backgroundColor.slice(1).match(/../g).map(hex => {
    const c = parseInt(hex, 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  const white = 1.05 / (luminance + 0.05);
  const black = (luminance + 0.05) / 0.05;
  return { backgroundColor, color: white >= black ? "#FFFFFF" : "#000000", contrast: Math.max(white, black) };
}
