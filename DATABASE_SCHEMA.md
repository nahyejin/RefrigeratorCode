# 🗄️ 데이터베이스 스키마 설계

## 📊 **테이블 구조**

### **1. users (유저 기본 정보)**
```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_username (username),
    INDEX idx_email (email)
);
```

### **2. user_ingredients (유저별 냉장고 재료)**
```sql
CREATE TABLE user_ingredients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ingredient_name VARCHAR(100) NOT NULL,
    category ENUM('frozen', 'fridge', 'room') NOT NULL,
    quantity VARCHAR(50),
    unit VARCHAR(20),
    expiry_date DATE,
    purchase_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_category (category),
    INDEX idx_expiry_date (expiry_date)
);
```

### **3. user_recipes (유저별 레시피 기록)**
```sql
CREATE TABLE user_recipes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    recipe_id INT NOT NULL,
    action_type ENUM('completed', 'recorded', 'favorite') NOT NULL,
    notes TEXT,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    cooked_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_recipe_action (user_id, recipe_id, action_type),
    INDEX idx_user_id (user_id),
    INDEX idx_recipe_id (recipe_id),
    INDEX idx_action_type (action_type),
    INDEX idx_cooked_date (cooked_date)
);
```

### **4. user_favorites (유저별 즐겨찾기)**
```sql
CREATE TABLE user_favorites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    recipe_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_recipe (user_id, recipe_id),
    INDEX idx_user_id (user_id),
    INDEX idx_recipe_id (recipe_id)
);
```

## 🔗 **테이블 관계**

```
users (1) ←→ (N) user_ingredients
users (1) ←→ (N) user_recipes  
users (1) ←→ (N) user_favorites
recipes (1) ←→ (N) user_recipes
recipes (1) ←→ (N) user_favorites
```

## 📝 **주요 기능별 쿼리 예시**

### **유저 냉장고 재료 조회**
```sql
SELECT * FROM user_ingredients 
WHERE user_id = ? 
ORDER BY category, expiry_date;
```

### **유저가 완료한 레시피 조회**
```sql
SELECT r.*, ur.rating, ur.cooked_date, ur.notes
FROM recipes r
JOIN user_recipes ur ON r.id = ur.recipe_id
WHERE ur.user_id = ? AND ur.action_type = 'completed'
ORDER BY ur.cooked_date DESC;
```

### **유저가 기록한 레시피 조회**
```sql
SELECT r.*, ur.notes, ur.created_at as recorded_at
FROM recipes r
JOIN user_recipes ur ON r.id = ur.recipe_id
WHERE ur.user_id = ? AND ur.action_type = 'recorded'
ORDER BY ur.created_at DESC;
```

### **유저 즐겨찾기 레시피 조회**
```sql
SELECT r.*, uf.created_at as favorited_at
FROM recipes r
JOIN user_favorites uf ON r.id = uf.recipe_id
WHERE uf.user_id = ?
ORDER BY uf.created_at DESC;
```

## 🔧 **인덱스 최적화**

- **users**: username, email (로그인 성능)
- **user_ingredients**: user_id, category, expiry_date (냉장고 조회 성능)
- **user_recipes**: user_id, action_type, cooked_date (레시피 기록 조회 성능)
- **user_favorites**: user_id, recipe_id (즐겨찾기 조회 성능)

## 📊 **데이터 타입 선택 이유**

- **ENUM**: 카테고리, 액션 타입 등 제한된 값들
- **VARCHAR**: 가변 길이 문자열 (공간 효율성)
- **TEXT**: 긴 텍스트 (노트, 설명 등)
- **DATE**: 날짜만 필요한 경우 (구매일, 유통기한 등)
- **TIMESTAMP**: 시간까지 필요한 경우 (생성일, 수정일 등) 