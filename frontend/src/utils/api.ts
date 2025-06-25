// API 호출을 위한 공통 유틸리티
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const api = {
  // 레시피 목록 조회
  getRecipes: async () => {
    const response = await fetch(`${API_BASE_URL}/api/recipes`);
    if (!response.ok) {
      throw new Error('Failed to fetch recipes');
    }
    return response.json();
  },

  // 헬스 체크
  healthCheck: async () => {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (!response.ok) {
      throw new Error('Health check failed');
    }
    return response.json();
  }
};

export default api; 