interface OctagonFrameProps {
  className?: string;
  strokeWidth?: number;
  showInner?: boolean;
}

const OctagonFrame = ({ className = "", strokeWidth = 1, showInner = true }: OctagonFrameProps) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={className}
      fill="none"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Outer octagon - white/gray */}
      <polygon 
        points="30,5 70,5 95,30 95,70 70,95 30,95 5,70 5,30" 
        stroke="hsl(var(--muted-foreground) / 0.3)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Inner octagon - gold accent */}
      {showInner && (
        <polygon 
          points="32,10 68,10 90,32 90,68 68,90 32,90 10,68 10,32" 
          stroke="hsl(var(--accent) / 0.4)"
          strokeWidth={strokeWidth * 0.8}
          fill="none"
        />
      )}
    </svg>
  );
};

export default OctagonFrame;
