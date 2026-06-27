"use client";

import React from "react";
import * as TablerIcons from "@tabler/icons-react";

interface EmptyStateProps {
  icon?: keyof typeof TablerIcons;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  const IconComponent = icon ? (TablerIcons[icon] as React.ComponentType<{ size?: number; stroke?: number; className?: string }>) : null;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {IconComponent && (
        <IconComponent
          size={64}
          stroke={1}
          className="text-gray-300 mb-4"
        />
      )}
      <h3 className="text-lg font-semibold text-gray-700 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-400 max-w-sm">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
