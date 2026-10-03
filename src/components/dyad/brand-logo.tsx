import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  linked?: boolean;
};

export function BrandLogo({ className, linked = true }: BrandLogoProps) {
  const logo = (
    <img
      src="/logo-wordmark.png"
      alt="Dyad"
      width={900}
      height={194}
      className={cn("dyad-logo-glow h-8 w-auto", className)}
    />
  );

  return linked ? (
    <Link to="/" aria-label="Dyad home" className="inline-flex">
      {logo}
    </Link>
  ) : (
    logo
  );
}