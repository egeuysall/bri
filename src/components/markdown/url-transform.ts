export function markdownUrlTransform(url: string, key: string) {
  const value = url.trim();
  if (!value) return '';
  if (/^javascript:/i.test(value)) return '';
  if (/^data:/i.test(value)) {
    return key === 'src' && /^data:image\//i.test(value) ? value : '';
  }
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
  if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../') || value.startsWith('#')) {
    return value;
  }
  return '';
}
