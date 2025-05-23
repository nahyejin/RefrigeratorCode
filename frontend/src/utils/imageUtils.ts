export function getProxiedImageUrl(url: string) {
  if (!url) return '';
  if (url.includes('postfiles.pstatic.net')) {
    let cleanUrl = url;
    if (/\?type=[^&]*/.test(url)) {
      cleanUrl = url.replace(/\?type=[^&]*/, '?type=w966');
    } else if (!url.includes('?type=')) {
      cleanUrl += (url.includes('?') ? '&' : '?') + 'type=w966';
    }
    return 'https://images.weserv.nl/?url=' + cleanUrl.replace(/^https?:\/\//, '');
  }
  return url;
} 