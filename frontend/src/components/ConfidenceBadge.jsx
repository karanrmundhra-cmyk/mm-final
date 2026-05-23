import React from "react";
import { confidenceColor, confidenceIcon } from "@/lib/utils";

export default function ConfidenceBadge({ level, showLabel = false, size = "sm" }) {
  if (!level) return null;
  const color = confidenceColor(level);
  const icon = confidenceIcon(level);
  return (
    <span className="inline-flex items-center gap-0.5"
          style={{ color, fontSize: size === "xs" ? 10 : 11, fontWeight: 600 }}
          title={`${level} confidence`}>
      <span>{icon}</span>
      {showLabel && <span style={{ textTransform: "capitalize" }}>{level}</span>}
    </span>
  );
}
