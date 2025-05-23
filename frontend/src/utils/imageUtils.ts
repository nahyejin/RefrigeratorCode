export function getProxiedImageUrl(url: string) {
  if (!url) return '';
  if (url.includes('postfiles.pstatic.net')) {
    return 'https://images.weserv.nl/?url=' + url.replace(/^https?:\/\//, '');
  }
  return url;
} 