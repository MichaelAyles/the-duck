import { cn } from "@/lib/utils";

interface DuckLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8", 
  lg: "h-12 w-12",
  xl: "h-16 w-16"
};

export function DuckLogo({ className, size = "md" }: DuckLogoProps) {
  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        className="w-full h-full"
      >
        {/* Duck body */}
        <ellipse 
          cx="55" 
          cy="65" 
          rx="25" 
          ry="20" 
          fill="currentColor"
          className="text-primary"
        />
        
        {/* Duck head */}
        <circle 
          cx="35" 
          cy="40" 
          r="18" 
          fill="currentColor"
          className="text-primary"
        />
        
        {/* Duck bill */}
        <ellipse 
          cx="18" 
          cy="42" 
          rx="8" 
          ry="4" 
          fill="currentColor"
          className="text-accent"
        />
        
        {/* Duck eye */}
        <circle 
          cx="30" 
          cy="35" 
          r="3" 
          fill="currentColor"
          className="text-background"
        />
        <circle 
          cx="31" 
          cy="34" 
          r="1.5" 
          fill="currentColor"
          className="text-foreground"
        />
        
        {/* Wing detail */}
        <ellipse 
          cx="60" 
          cy="60" 
          rx="12" 
          ry="8" 
          fill="currentColor"
          className="text-accent opacity-60"
        />
        
        {/* Water ripples */}
        <ellipse 
          cx="55" 
          cy="85" 
          rx="30" 
          ry="3" 
          fill="currentColor"
          className="text-muted-foreground opacity-30"
        />
        <ellipse 
          cx="55" 
          cy="88" 
          rx="20" 
          ry="2" 
          fill="currentColor"
          className="text-muted-foreground opacity-20"
        />
      </svg>
    </div>
  );
} 