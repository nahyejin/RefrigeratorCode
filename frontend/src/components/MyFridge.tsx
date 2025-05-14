<span
  key={ingredient}
  className="inline-flex flex-nowrap items-center bg-[#444444] text-white px-2 h-6 rounded-full mr-2 mb-[3px] overflow-hidden whitespace-nowrap relative"
  style={{
    fontSize: '10.4px',
    fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif',
    fontWeight: 400,
    letterSpacing: '-0.1px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  }}
>
  <span className="truncate max-w-[110px]">{ingredient}</span>
  <span 
    className="relative flex-shrink-0 ml-2" 
    style={{ 
      width: '20px', 
      height: '24px', 
      display: 'inline-block' 
    }}
  >
    <span 
      style={{ 
        position: 'absolute', 
        left: '85%', 
        top: '40%', 
        transform: 'translate(-50%, -50%)', 
        fontSize: '16px', 
        fontWeight: 300, 
        cursor: 'pointer', 
        lineHeight: 1 
      }}
    >
      x
    </span>
  </span>
</span> 