export function publicAssetUrl(asset) {
  const value = String(asset).replace(/["\\\n\r]/g, '').replaceAll('\\', '/');
  if (/^(https?:|data:|\.\/|\/)/.test(value)) {
    return value;
  }
  return `./public/${value}`;
}
