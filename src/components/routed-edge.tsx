"use client";

import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import type { RoutedGraphEdge } from "@/domain/edge-routing";

export function RoutedFallbackEdge(props: EdgeProps) {
  const { id, source, target, sourceX, sourceY, targetX, targetY, markerEnd, style } = props;
  const data = props.data as RoutedGraphEdge["data"];
  const reason = data?.routeFallback ?? "unsupported route";
  const sameNode = source === target;
  const distanceX = targetX - sourceX;
  const distanceY = targetY - sourceY;
  const distance = Math.max(1, Math.hypot(distanceX, distanceY));
  const direction = (data?.routeOffset ?? 0) % 2 === 0 ? 1 : -1;
  const offset = direction * (44 + ((data?.routeOffset ?? 0) % 3) * 18);
  const controlX = (sourceX + targetX) / 2 - (distanceY / distance) * offset;
  const controlY = (sourceY + targetY) / 2 + (distanceX / distance) * offset;
  const path = sameNode
    ? `M ${sourceX} ${sourceY} C ${sourceX + 92} ${sourceY - 92}, ${targetX + 92} ${targetY + 92}, ${targetX} ${targetY}`
    : `M ${sourceX} ${sourceY} Q ${controlX} ${controlY}, ${targetX} ${targetY}`;
  const badgeX = sameNode ? sourceX + 70 : (sourceX + 2 * controlX + targetX) / 4;
  const badgeY = sameNode ? sourceY : (sourceY + 2 * controlY + targetY) / 4;

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ ...style, strokeDasharray: "5 4" }} interactionWidth={20} />
      <EdgeLabelRenderer>
        <span
          className="route-fallback-badge"
          style={{ transform: `translate(-50%, -50%) translate(${badgeX}px, ${badgeY}px)` }}
          title={`Fallback route: ${reason}`}
          aria-label={`Fallback route: ${reason}`}
        >
          <span aria-hidden="true">↗</span> Fallback{props.label ? ` · ${props.label}` : ""}
        </span>
      </EdgeLabelRenderer>
    </>
  );
}
