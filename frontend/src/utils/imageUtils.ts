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

/**
 * 레시피에 유효한 썸네일이 있는지 확인
 */
export function hasValidThumbnail(recipe: { thumbnail?: string | null }): boolean {
  if (!recipe.thumbnail) return false;
  const thumbnail = recipe.thumbnail.trim();
  if (thumbnail === '') return false;
  
  // 기본적인 URL 형식 체크
  try {
    const url = new URL(thumbnail);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 레시피 목록에서 썸네일이 없는 레시피를 필터링
 */
export function filterRecipesWithValidThumbnails<T extends { thumbnail?: string | null }>(recipes: T[]): T[] {
  return recipes.filter(recipe => hasValidThumbnail(recipe));
} 
/**
 * 업로드 전에 사진을 줄인다.
 *
 * 폰 카메라 원본은 3~5MB(4000px 급)라 그대로 올리면 업로드가 느리고, 인식에
 * 필요한 해상도보다 훨씬 크다. 영수증 글자가 뭉개지지 않을 만큼(긴 변 1600px)만
 * 남기고 JPEG 으로 다시 뽑는다.
 *
 * 원본이 이미 작으면 그대로 돌려준다. 브라우저가 canvas/toBlob 을 못 쓰는 등
 * 어떤 이유로든 실패하면 원본 File 을 그대로 돌려주므로 호출한 쪽은 신경 쓸 게 없다.
 */
export async function shrinkImageForUpload(
  file: File,
  maxEdge: number = 1600,
  quality: number = 0.85
): Promise<File> {
  try {
    if (!file.type.startsWith('image/')) return file;

    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= maxEdge && file.size <= 1_500_000) {
      bitmap.close?.();
      return file;
    }

    const scale = Math.min(1, maxEdge / longest);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob: Blob | null = await new Promise(resolve =>
      canvas.toBlob(b => resolve(b), 'image/jpeg', quality)
    );
    if (!blob) return file;

    // 줄였는데 오히려 커지면(작은 PNG 등) 원본을 쓴다.
    if (blob.size >= file.size) return file;

    return new File([blob], 'capture.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
