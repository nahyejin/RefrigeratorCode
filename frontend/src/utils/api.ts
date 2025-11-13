import { Recipe } from '../types/recipe';

// =====================
// 상수
// =====================

const API_BASE_URL = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://refrigeratorcode-production.up.railway.app';

const API_ENDPOINTS = {
  recipes: '/api/recipes',
  health: '/api/health',
} as const;

// =====================
// 타입 정의
// =====================

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
}

export interface ApiError extends Error {
  status?: number;
  endpoint?: string;
}

// =====================
// 유틸리티 함수
// =====================

/**
 * API 응답을 안전하게 처리하고 에러를 던진다
 */
async function handleApiResponse<T>(
  response: Response,
  endpoint: string
): Promise<T> {
  if (!response.ok) {
    const error: ApiError = new Error(
      `API 요청 실패: ${response.status} ${response.statusText}`
    );
    error.status = response.status;
    error.endpoint = endpoint;
    throw error;
  }
  
  try {
    return await response.json();
  } catch (error) {
    const jsonError: ApiError = new Error(
      `JSON 파싱 실패: ${endpoint}`
    );
    jsonError.endpoint = endpoint;
    throw jsonError;
  }
}

// =====================
// API 함수들
// =====================

/**
 * API 호출을 위한 공통 유틸리티
 */
export const api = {
  /**
   * 레시피 목록을 조회한다
   */
  getRecipes: async (): Promise<Recipe[]> => {
    const endpoint = `${API_BASE_URL}${API_ENDPOINTS.recipes}`;
    const response = await fetch(endpoint, {
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    return handleApiResponse<Recipe[]>(response, endpoint);
  },

  /**
   * API 서버 상태를 확인한다
   */
  healthCheck: async (): Promise<HealthCheckResponse> => {
    const endpoint = `${API_BASE_URL}${API_ENDPOINTS.health}`;
    const response = await fetch(endpoint, {
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    return handleApiResponse<HealthCheckResponse>(response, endpoint);
  }
};

export default api; 