import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  nickname: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string, nickname: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 초기 로드 시 토큰 확인
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // TODO: 토큰 검증 및 사용자 정보 로드
      // 임시로 로컬 스토리지에서 사용자 정보 로드
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          console.error('Failed to parse user data:', e);
        }
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      // TODO: 실제 API 호출
      // const response = await api.post('/api/auth/login', { email, password });
      // const { token, user } = response.data;
      
      // 임시 구현
      const mockUser: User = {
        id: '1',
        email,
        nickname: email.split('@')[0],
      };
      
      localStorage.setItem('auth_token', 'mock_token');
      localStorage.setItem('user', JSON.stringify(mockUser));
      setUser(mockUser);
      
      // 마이그레이션 실행
      await migrateLocalDataToServer(mockUser.id);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string, nickname: string) => {
    try {
      // TODO: 실제 API 호출
      // const response = await api.post('/api/auth/register', { email, password, nickname });
      // const { token, user } = response.data;
      
      // 임시 구현
      const mockUser: User = {
        id: '1',
        email,
        nickname,
      };
      
      localStorage.setItem('auth_token', 'mock_token');
      localStorage.setItem('user', JSON.stringify(mockUser));
      setUser(mockUser);
      
      // 마이그레이션 실행
      await migrateLocalDataToServer(mockUser.id);
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const loginWithToken = async (token: string) => {
    try {
      // JWT 토큰 디코딩하여 사용자 정보 추출
      // 실제로는 백엔드에서 토큰 검증 API를 호출해야 하지만,
      // 여기서는 간단히 토큰을 디코딩하여 사용자 정보를 가져옵니다.
      
      // JWT 토큰 파싱 (간단한 방법 - 실제로는 jwt-decode 라이브러리 사용 권장)
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      
      const payload = JSON.parse(jsonPayload);
      
      const user: User = {
        id: String(payload.user_id),
        email: payload.email,
        nickname: payload.nickname,
      };
      
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      
      // 마이그레이션 실행
      await migrateLocalDataToServer(user.id);
    } catch (error) {
      console.error('Token login failed:', error);
      throw error;
    }
  };

  // 로컬 데이터를 서버로 마이그레이션
  const migrateLocalDataToServer = async (userId: string) => {
    try {
      // 재료 마이그레이션
      const localIngredients = JSON.parse(
        localStorage.getItem('myfridge_ingredients') || 'null'
      );
      if (localIngredients) {
        // TODO: API 호출
        // await api.post(`/api/users/${userId}/ingredients/migrate`, { ingredients: localIngredients });
        console.log('Migrating ingredients:', localIngredients);
      }

      // 레시피 마이그레이션
      const localRecorded = JSON.parse(
        localStorage.getItem('my_recorded_recipes') || '[]'
      );
      const localCompleted = JSON.parse(
        localStorage.getItem('my_completed_recipes') || '[]'
      );

      if (localRecorded.length > 0) {
        // TODO: API 호출
        // await api.post(`/api/users/${userId}/recipes/migrate`, { type: 'recorded', recipes: localRecorded });
        console.log('Migrating recorded recipes:', localRecorded);
      }

      if (localCompleted.length > 0) {
        // TODO: API 호출
        // await api.post(`/api/users/${userId}/recipes/migrate`, { type: 'completed', recipes: localCompleted });
        console.log('Migrating completed recipes:', localCompleted);
      }

      // 마이그레이션 완료 후 로컬 데이터 정리 (선택적 - 백업용으로 남길 수도 있음)
      // localStorage.removeItem('myfridge_ingredients');
      // localStorage.removeItem('my_recorded_recipes');
      // localStorage.removeItem('my_completed_recipes');
    } catch (error) {
      console.error('Migration failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, logout, register, loginWithToken, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

