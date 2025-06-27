// =====================
// 상수
// =====================

const DEFAULT_IMAGE_URL = '/default-recipe-image.jpg';
const IMAGE_LOAD_TIMEOUT = 5000; // 5초

// =====================
// 타입 정의
// =====================

export interface ImageLoadResult {
  success: boolean;
  url: string;
  error?: string;
}

// =====================
// 유틸리티 함수
// =====================

/**
 * 이미지 URL이 유효한지 확인
 */
function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  // 기본 URL 패턴 검증
  const urlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i;
  return urlPattern.test(url.trim());
}

/**
 * 이미지 로드 타임아웃 처리
 */
function createImageLoadPromise(url: string): Promise<ImageLoadResult> {
  return new Promise((resolve) => {
    const img = new Image();
    const timeout = setTimeout(() => {
      resolve({
        success: false,
        url,
        error: '이미지 로드 타임아웃'
      });
    }, IMAGE_LOAD_TIMEOUT);

    img.onload = () => {
      clearTimeout(timeout);
      resolve({
        success: true,
        url
      });
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve({
        success: false,
        url,
        error: '이미지 로드 실패'
      });
    };

    img.src = url;
  });
}

// =====================
// 메인 함수
// =====================

/**
 * 이미지 URL을 검증하고 로드 가능한지 확인한다.
 */
export async function validateImageUrl(imageUrl: string): Promise<ImageLoadResult> {
  if (!isValidImageUrl(imageUrl)) {
    return {
      success: false,
      url: imageUrl,
      error: '유효하지 않은 이미지 URL'
    };
  }

  try {
    return await createImageLoadPromise(imageUrl);
  } catch (error) {
    return {
      success: false,
      url: imageUrl,
      error: `이미지 검증 중 오류: ${error}`
    };
  }
}

/**
 * 기본 이미지 URL을 반환한다.
 */
export function getDefaultImageUrl(): string {
  return DEFAULT_IMAGE_URL;
}

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
  // blogfiles.pstatic.net 등은 프록시 없이 원본 URL 사용
  return url;
} 