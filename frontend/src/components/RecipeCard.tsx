import * as React from 'react';

interface RecipeCardProps {
  thumbnail: string;
  title: string;
  author: string;
  date: string;
  body: string;
  matchRate: number;
  children?: React.ReactNode; // 버튼/재료/대체재 등 부가 UI
  className?: string;
}

const RecipeCard: React.FC<RecipeCardProps> = ({
  thumbnail, title, author, date, body, matchRate, children, className = ''
}) => (
  <div
    className={`w-full ${className}`}
    style={{
      borderRadius: 20,
      background: '#fff',
      boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
      minHeight: 144,
      position: 'relative',
      padding: 16,
      border: 'none',
      marginBottom: 16,
    }}
  >
    <div className="flex flex-row gap-6 items-start mb-2">
      <div className="relative min-w-[97px] max-w-[97px] h-[79px] rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
        <img src={thumbnail} alt="썸네일" className="w-full h-full object-cover object-center" />
        <div className="absolute top-1 left-1 bg-[#444] bg-opacity-90 text-white text-[10px] font-bold rounded px-1.5 py-0 flex items-center gap-1 shadow">
          재료매칭률 <span className="text-[#FFD600] font-extrabold ml-1">{matchRate}%</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center mb-1">
          <span className="text-[#FFD600] font-bold" style={{ fontSize: '12px', marginRight: 6 }}>{author}</span>
          <span className="text-[#B0B0B0]" style={{ fontSize: '10.4px' }}>{date}</span>
        </div>
        <div
          className="mb-2 max-h-16 overflow-y-auto pr-1 cursor-pointer custom-scrollbar"
          style={{ fontSize: '12px', color: '#444', scrollbarWidth: 'auto' }}
          title={body}
        >
          {body}
        </div>
      </div>
    </div>
    {children}
  </div>
);

export default RecipeCard; 