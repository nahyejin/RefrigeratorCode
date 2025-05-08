import * as React from 'react';

interface RecipeCardProps {
  thumbnail: string;
  title: string;
  preview: string;
  tags?: React.ReactNode;
  className?: string;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ thumbnail, title, preview, tags, className = '' }) => (
  <div className={`w-full flex gap-4 items-start p-4 border-b ${className}`}>
    <img src={thumbnail} className="w-20 h-20 rounded-md" alt={title} />
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold line-clamp-1">{title}</h3>
      <p className="text-xs text-gray-500 line-clamp-2">{preview}</p>
      <div className="flex gap-2 text-xs mt-1">
        {tags}
      </div>
    </div>
  </div>
);

export default RecipeCard; 