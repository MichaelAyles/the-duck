import { cn } from "@/lib/utils";
import Image from "next/image";

interface DuckLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "duck" | "full";
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8", 
  lg: "h-12 w-12",
  xl: "h-16 w-16"
};

const fullLogoSizeClasses = {
  sm: "h-6 w-auto",
  md: "h-8 w-auto", 
  lg: "h-12 w-auto",
  xl: "h-16 w-auto"
};

export function DuckLogo({ className, size = "md", variant = "duck" }: DuckLogoProps) {
  const isFullLogo = variant === "full";
  const logoSrc = isFullLogo ? "/images/logos/theduckchatfull.png" : "/images/logos/theduckchatduck.png";
  const logoClasses = isFullLogo ? fullLogoSizeClasses[size] : sizeClasses[size];

  return (
    <div className={cn("relative", logoClasses, className)}>
      <Image
        src={logoSrc}
        alt={isFullLogo ? "The Duck Chat Logo" : "Duck Logo"}
        fill
        className="object-contain"
        priority
      />
    </div>
  );
} 