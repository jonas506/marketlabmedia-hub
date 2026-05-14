import { Instagram, Youtube, Music2, HardDrive, Link as LinkIcon } from "lucide-react";
import type { SourceType } from "./constants";

export const SourceIcon: React.FC<{ type: SourceType; className?: string }> = ({ type, className = "h-4 w-4" }) => {
  switch (type) {
    case "instagram":
      return <Instagram className={className} />;
    case "tiktok":
      return <Music2 className={className} />;
    case "youtube":
      return <Youtube className={className} />;
    case "drive":
      return <HardDrive className={className} />;
    default:
      return <LinkIcon className={className} />;
  }
};

export const SOURCE_LABEL: Record<SourceType, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  drive: "Drive",
  other: "Link",
};
