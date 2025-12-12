// ═══════════════════════════════════════════════════════════════════════════
// نظرة - فلاتر التنبيهات
// AlertsFilter.tsx
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import type { AlertStatus, WeaponType, Camera } from '../../types';

export interface AlertFilters {
  status: AlertStatus | 'الكل';
  weaponType: WeaponType | 'الكل';
  cameraId: string | 'الكل';
  dateRange: {
    start: string;
    end: string;
  };
  sortBy: 'time' | 'priority' | 'confidence';
  sortOrder: 'asc' | 'desc';
}

interface AlertsFilterProps {
  filters: AlertFilters;
  onFiltersChange: (filters: AlertFilters) => void;
  cameras: Camera[];
  onReset?: () => void;
}

const statusOptions: (AlertStatus | 'الكل')[] = [
  'الكل',
  'جديد',
  'قيد المراجعة',
  'مؤكد',
  'إنذار كاذب',
];

const weaponOptions: (WeaponType | 'الكل')[] = ['الكل', 'مسدس', 'سكين'];

const sortOptions = [
  { value: 'time', label: 'الوقت' },
  { value: 'priority', label: 'الأولوية' },
  { value: 'confidence', label: 'نسبة الثقة' },
] as const;

export const AlertsFilter: React.FC<AlertsFilterProps> = ({
  filters,
  onFiltersChange,
  cameras,
  onReset,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = <K extends keyof AlertFilters>(
    key: K,
    value: AlertFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    }
  };

  // حساب عدد الفلاتر النشطة
  const activeFiltersCount = [
    filters.status !== 'الكل',
    filters.weaponType !== 'الكل',
    filters.cameraId !== 'الكل',
    filters.dateRange.start !== '',
    filters.dateRange.end !== '',
  ].filter(Boolean).length;

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      {/* رأس الفلاتر */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-750 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🔍</span>
          <span className="text-white font-medium">فلاتر البحث</span>
          {activeFiltersCount > 0 && (
            <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
              {activeFiltersCount} نشط
            </span>
          )}
        </div>
        <button className="text-gray-400 hover:text-white transition-colors">
          <span
            className={`inline-block transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          >
            ▼
          </span>
        </button>
      </div>

      {/* محتوى الفلاتر */}
      <div
        className={`
          transition-all duration-300 ease-in-out overflow-hidden
          ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
        `}
      >
        <div className="p-4 pt-0 space-y-4 border-t border-gray-700">
          {/* الصف الأول: الحالة ونوع السلاح */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* فلتر الحالة */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <span className="ml-1">📋</span>
                الحالة
              </label>
              <select
                value={filters.status}
                onChange={(e) =>
                  updateFilter('status', e.target.value as AlertStatus | 'الكل')
                }
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {/* فلتر نوع السلاح */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <span className="ml-1">🔫</span>
                نوع السلاح
              </label>
              <select
                value={filters.weaponType}
                onChange={(e) =>
                  updateFilter('weaponType', e.target.value as WeaponType | 'الكل')
                }
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                {weaponOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* فلتر الكاميرا */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <span className="ml-1">📹</span>
                الكاميرا
              </label>
              <select
                value={filters.cameraId}
                onChange={(e) => updateFilter('cameraId', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="الكل">جميع الكاميرات</option>
                {cameras.map((camera) => (
                  <option key={camera.id} value={camera.id}>
                    {camera.name}
                  </option>
                ))}
              </select>
            </div>

            {/* فلتر الترتيب */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <span className="ml-1">↕️</span>
                الترتيب
              </label>
              <div className="flex gap-2">
                <select
                  value={filters.sortBy}
                  onChange={(e) =>
                    updateFilter('sortBy', e.target.value as 'time' | 'priority' | 'confidence')
                  }
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')
                  }
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white hover:bg-gray-700 transition-colors"
                  title={filters.sortOrder === 'asc' ? 'تصاعدي' : 'تنازلي'}
                >
                  {filters.sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </div>

          {/* الصف الثاني: نطاق التاريخ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <span className="ml-1">📅</span>
                من تاريخ
              </label>
              <input
                type="datetime-local"
                value={filters.dateRange.start}
                onChange={(e) =>
                  updateFilter('dateRange', {
                    ...filters.dateRange,
                    start: e.target.value,
                  })
                }
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <span className="ml-1">📅</span>
                إلى تاريخ
              </label>
              <input
                type="datetime-local"
                value={filters.dateRange.end}
                onChange={(e) =>
                  updateFilter('dateRange', {
                    ...filters.dateRange,
                    end: e.target.value,
                  })
                }
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              <span>🔄</span>
              <span className="text-sm">إعادة تعيين</span>
            </button>
            <div className="text-gray-500 text-sm">
              {activeFiltersCount > 0
                ? `${activeFiltersCount} فلتر نشط`
                : 'لا توجد فلاتر نشطة'}
            </div>
          </div>
        </div>
      </div>

      {/* شريط الفلاتر السريعة (عند عدم التوسيع) */}
      {!isExpanded && activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
          {filters.status !== 'الكل' && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-700 rounded-full text-sm text-white">
              الحالة: {filters.status}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateFilter('status', 'الكل');
                }}
                className="text-gray-400 hover:text-white mr-1"
              >
                ×
              </button>
            </span>
          )}
          {filters.weaponType !== 'الكل' && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-700 rounded-full text-sm text-white">
              السلاح: {filters.weaponType}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateFilter('weaponType', 'الكل');
                }}
                className="text-gray-400 hover:text-white mr-1"
              >
                ×
              </button>
            </span>
          )}
          {filters.cameraId !== 'الكل' && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-700 rounded-full text-sm text-white">
              الكاميرا: {cameras.find((c) => c.id === filters.cameraId)?.name || filters.cameraId}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateFilter('cameraId', 'الكل');
                }}
                className="text-gray-400 hover:text-white mr-1"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default AlertsFilter;
