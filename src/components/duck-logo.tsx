import { cn } from "@/lib/utils";
import Image from "next/image";

interface DuckLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "duck" | "full";
}

const sizeMap = {
  sm: { duck: 24, full: { width: 80, height: 24 } },
  md: { duck: 32, full: { width: 100, height: 32 } },
  lg: { duck: 48, full: { width: 150, height: 48 } },
  xl: { duck: 64, full: { width: 200, height: 64 } }
};

export function DuckLogo({ className, size = "md", variant = "duck" }: DuckLogoProps) {
  const isFullLogo = variant === "full";
  const logoSrc = isFullLogo ? "/images/logos/theduckchatfull.png" : "/images/logos/theduckchatduck.png";
  
  const dimensions = isFullLogo 
    ? sizeMap[size].full 
    : { width: sizeMap[size].duck, height: sizeMap[size].duck };

  return (
    <div className={cn("relative", className)}>
      <Image
        src={logoSrc}
        alt={isFullLogo ? "The Duck Chat Logo" : "Duck Logo"}
        width={dimensions.width}
        height={dimensions.height}
        className="object-contain"
        style={{
          width: dimensions.width,
          height: dimensions.height,
        }}
        priority
      />
    </div>
  );
} 