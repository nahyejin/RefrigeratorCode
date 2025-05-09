import * as React from 'react';

interface TagPillProps {
  children: React.ReactNode;
  info?: { expiry?: string; purchase?: string };
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const TagPill: React.FC<TagPillProps> = ({ children, info, className = '', style, onClick }) => {
  const [hover, setHover] = React.useState(false);

  return (
    <span
      className={`inline-flex flex-nowrap items-center bg-[#444444] text-white text-[11px] font-light px-2 h-6 rounded-full mr-2 mb-[3px] overflow-hidden whitespace-nowrap relative ${className}`}
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      {children}
      {hover && (info?.expiry || info?.purchase) && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-1 rounded border border-gray-300 bg-white bg-opacity-50 text-[#404040] text-xs z-50 shadow"
          style={{ pointerEvents: 'none', minWidth: 140, textAlign: 'center' }}
        >
          {info?.expiry && <>유통기한 : {info.expiry}</>}
          {info?.purchase && <>구매시점 : {info.purchase}</>}
        </div>
      )}
    </span>
  );
};

export default TagPill; 