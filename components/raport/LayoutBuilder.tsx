'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconGripVertical, IconEye, IconEyeOff, IconTrash, IconPlus } from '@tabler/icons-react';
import type { LayoutSection, VarianTampilan } from '@/lib/raport/schemas';
import {
  SECTION_VARIANTS,
  SECTION_LABELS,
  VARIANT_LABELS,
  DUMMY_DATA,
  RaportPreview,
} from '@/lib/raport/section-renderers';

// =============================================
// Available section types (draggable from left)
// =============================================

const ALL_SECTION_TYPES: LayoutSection['sectionType'][] = [
  'header',
  'identitas',
  'nilai_mapel',
  'sikap',
  'ekskul',
  'catatan_wali_kelas',
  'footer',
];

// =============================================
// Sortable Section Item
// =============================================

function SortableSectionItem({
  section,
  index,
  onVariantChange,
  onToggleVisibility,
  onRemove,
}: {
  section: LayoutSection;
  index: number;
  onVariantChange: (index: number, variant: VarianTampilan) => void;
  onToggleVisibility: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.sectionType });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const variants = SECTION_VARIANTS[section.sectionType] ?? [];
  const label = SECTION_LABELS[section.sectionType] ?? section.sectionType;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg mb-2 ${section.visible ? 'bg-white border-gray-200' : 'bg-gray-50 border-dashed border-gray-300'}`}
    >
      <div className="flex items-center gap-2 p-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          aria-label="Drag to reorder"
        >
          <IconGripVertical size={18} />
        </button>

        <span className="text-sm font-medium text-gray-700 w-40">{label}</span>

        {section.wajib ? (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Wajib</span>
        ) : null}

        <select
          value={section.varianTampilan}
          onChange={(e) => onVariantChange(index, e.target.value as VarianTampilan)}
          className="text-xs border border-gray-300 rounded px-2 py-1 bg-white ml-auto"
        >
          {variants.map((v) => (
            <option key={v} value={v}>
              {VARIANT_LABELS[v]}
            </option>
          ))}
        </select>

        <button
          onClick={() => onToggleVisibility(index)}
          className={`p-1 rounded ${section.visible ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-100'}`}
          title={section.visible ? 'Sembunyikan' : 'Tampilkan'}
        >
          {section.visible ? <IconEye size={16} /> : <IconEyeOff size={16} />}
        </button>

        {!section.wajib && (
          <button
            onClick={() => onRemove(index)}
            className="p-1 rounded text-red-500 hover:bg-red-50"
            title="Hapus section"
          >
            <IconTrash size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================
// Draggable Available Section (left panel)
// =============================================

function AvailableSectionItem({
  sectionType,
  onAdd,
}: {
  sectionType: LayoutSection['sectionType'];
  onAdd: (type: LayoutSection['sectionType']) => void;
}) {
  const label = SECTION_LABELS[sectionType] ?? sectionType;
  return (
    <button
      onClick={() => onAdd(sectionType)}
      className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg border border-dashed border-gray-300 hover:border-blue-400 transition-colors"
    >
          <IconPlus size={14} />
      {label}
    </button>
  );
}

// =============================================
// Live Preview (bottom panel) — uses shared RaportPreview
// =============================================

function LivePreview({ sections }: { sections: LayoutSection[] }) {
  return <RaportPreview sections={sections} data={DUMMY_DATA} />;
}

// =============================================
// Main Layout Builder Component
// =============================================

export default function LayoutBuilder({
  initialSections = [],
  templateRaportId,
  sekolahId,
  layoutId,
  onSave,
  isSaving,
}: {
  initialSections?: LayoutSection[];
  templateRaportId?: string;
  sekolahId?: string;
  layoutId?: string;
  onSave?: (sections: LayoutSection[]) => void;
  isSaving?: boolean;
}) {
  const [sections, setSections] = useState<LayoutSection[]>(() => {
    if (initialSections.length > 0) return initialSections;

    // Default: build from all available section types
    return ALL_SECTION_TYPES.map((type, i) => ({
      sectionType: type,
      order: i + 1,
      wajib: ['header', 'identitas', 'footer'].includes(type),
      config: {},
      varianTampilan: (SECTION_VARIANTS[type]?.[0] ?? 'ringkas') as VarianTampilan,
      visible: true,
    }));
  });

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sectionIds = useMemo(
    () => sections.map((s) => s.sectionType),
    [sections]
  );

  const usedTypes = useMemo(
    () => new Set(sections.map((s) => s.sectionType)),
    [sections]
  );

  const availableTypes = useMemo(
    () => ALL_SECTION_TYPES.filter((t) => !usedTypes.has(t)),
    [usedTypes]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      setSections((prev) => {
        const oldIndex = prev.findIndex((s) => s.sectionType === active.id);
        const newIndex = prev.findIndex((s) => s.sectionType === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        const reordered = arrayMove(prev, oldIndex, newIndex);
        return reordered.map((s, i) => ({ ...s, order: i + 1 }));
      });
    }
  }, []);

  const handleAddSection = useCallback((sectionType: LayoutSection['sectionType']) => {
    const variants = SECTION_VARIANTS[sectionType] ?? [];
    const isWajib = ['header', 'identitas', 'footer'].includes(sectionType);
    const newSection: LayoutSection = {
      sectionType,
      order: sections.length + 1,
      wajib: isWajib,
      config: {},
      varianTampilan: (variants[0] ?? 'ringkas') as VarianTampilan,
      visible: true,
    };
    setSections((prev) => [...prev, newSection]);
  }, [sections.length]);

  const handleVariantChange = useCallback(
    (index: number, variant: VarianTampilan) => {
      setSections((prev) =>
        prev.map((s, i) => (i === index ? { ...s, varianTampilan: variant } : s))
      );
    },
    []
  );

  const handleToggleVisibility = useCallback((index: number) => {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, visible: !s.visible } : s))
    );
  }, []);

  const handleRemove = useCallback((index: number) => {
    setSections((prev) => {
      const removed = prev.filter((_, i) => i !== index);
      return removed.map((s, i) => ({ ...s, order: i + 1 }));
    });
  }, []);

  const handleSave = useCallback(() => {
    onSave?.(sections);
  }, [onSave, sections]);

  return (
    <div className="space-y-6">
      {/* Main layout: left panel (available) + right panel (sortable) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Available sections */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Section Tersedia
            </h3>
            {availableTypes.length === 0 ? (
              <p className="text-xs text-gray-400">Semua section sudah ditambahkan.</p>
            ) : (
              <div className="space-y-1.5">
                {availableTypes.map((type) => (
                  <AvailableSectionItem
                    key={type}
                    sectionType={type}
                    onAdd={handleAddSection}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Sortable section list */}
        <div className="lg:col-span-3">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Urutan Section
            </h3>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sectionIds}
                strategy={verticalListSortingStrategy}
              >
                {sections.map((section, index) => (
                  <SortableSectionItem
                    key={section.sectionType}
                    section={section}
                    index={index}
                    onVariantChange={handleVariantChange}
                    onToggleVisibility={handleToggleVisibility}
                    onRemove={handleRemove}
                  />
                ))}
              </SortableContext>
              <DragOverlay>
                {activeId ? (
                  <div className="bg-white border border-blue-400 rounded-lg p-3 shadow-lg">
                    <span className="text-sm font-medium">
                      {SECTION_LABELS[activeId] ?? activeId}
                    </span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      </div>

      {/* Save button */}
      {onSave && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Menyimpan...' : layoutId ? 'Perbarui Layout' : 'Simpan Layout'}
          </button>
        </div>
      )}

      {/* Live preview */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Pratinjau Langsung
        </h3>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <span className="text-xs text-gray-500 ml-2">Preview — Data Dummy</span>
          </div>
          <div className="p-4 bg-gray-50">
            <LivePreview sections={sections} />
          </div>
        </div>
      </div>
    </div>
  );
}
