'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Clock, MapPin, BookOpen, Calendar, AlertCircle } from 'lucide-react';

export interface Institution {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
  attendanceSettings: {
    attendanceRadiusMeters: number;
    qrCodeEnabled: boolean;
  };
}

export interface Assignment {
  id: string;
  institutionId: string;
  subjects: Array<{
    id: string;
    nama_mapel: string;
    kode_mapel?: string;
  }>;
  todaySchedule: string[];
  workingHours?: {
    start: string;
    end: string;
  };
  status: 'aktif' | 'nonaktif';
  todayAttendance?: {
    status: 'belum_absen' | 'hadir' | 'check_in_only' | 'completed';
    checkIn?: {
      timestamp: string;
      distance: number;
      status: string;
    };
    checkOut?: {
      timestamp: string;
      distance: number;
      status: string;
    };
    teachingSessions?: any[];
  };
}

export interface EnhancedInstitutionSelectorProps {
  institutions: Institution[];
  assignments: Assignment[];
  onSelect: (institution: Institution, assignment: Assignment) => void;
  onViewDetails?: (institution: Institution, assignment: Assignment) => void;
  currentInstitutionId?: string;
}

export const EnhancedInstitutionSelector = ({
  institutions,
  assignments,
  onSelect,
  onViewDetails,
  currentInstitutionId,
}: EnhancedInstitutionSelectorProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(
    currentInstitutionId || null
  );

  const enrichedInstitutions = institutions.map((institution) => {
    const assignment = assignments.find((a) => a.institutionId === institution.id);
    return { institution, assignment };
  }).filter((item) => item.assignment);

  const getStatusBadge = (attendanceStatus?: string) => {
    switch (attendanceStatus) {
      case 'completed':
        return <Badge className="bg-green-500 text-xs py-0">Selesai</Badge>;
      case 'check_in_only':
        return <Badge className="bg-amber-500 text-xs py-0">Check-in</Badge>;
      case 'hadir':
        return <Badge className="bg-blue-500 text-xs py-0">Hadir</Badge>;
      default:
        return <Badge variant="outline" className="text-xs py-0">Belum</Badge>;
    }
  };

  const formatTimeSlots = (slots: string[]) => {
    if (!slots || slots.length === 0) return 'Tidak ada jadwal';
    return slots.slice(0, 3).join(', ') + (slots.length > 3 ? ` +${slots.length - 3}` : '');
  };

  return (
    <div className="space-y-3">
      <RadioGroup
        value={selectedId || ''}
        onValueChange={setSelectedId}
        className="space-y-3"
      >
        {enrichedInstitutions.map(({ institution, assignment }) => {
          const isSelected = selectedId === institution.id;
          const attendance = assignment?.todayAttendance;
          const subjects = assignment?.subjects || [];
          const schedule = assignment?.todaySchedule || [];

          return (
            <div
              key={institution.id}
              className={`relative border-2 rounded-lg p-3 transition-all cursor-pointer ${
                isSelected
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-gray-200 hover:border-violet-300'
              }`}
              onClick={() => setSelectedId(institution.id)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 pr-8">
                  <div className="flex items-center gap-2 mb-1">
                    <Label
                      htmlFor={institution.id}
                      className="text-sm font-semibold cursor-pointer"
                    >
                      {institution.name}
                    </Label>
                    {getStatusBadge(attendance?.status)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{institution.attendanceSettings.attendanceRadiusMeters}m</span>
                    {institution.attendanceSettings.qrCodeEnabled && (
                      <Badge variant="secondary" className="text-xs py-0">QR</Badge>
                    )}
                  </div>
                </div>
                <div className="absolute top-3 right-3">
                  <RadioGroupItem value={institution.id} id={institution.id} />
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{schedule.length > 0 ? formatTimeSlots(schedule) : 'Tidak ada jadwal'}</span>
              </div>

              {subjects.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {subjects.slice(0, 4).map((subject) => (
                    <Badge key={subject.id} variant="outline" className="text-xs py-0 px-1">
                      {subject.nama_mapel}
                    </Badge>
                  ))}
                  {subjects.length > 4 && (
                    <Badge variant="outline" className="text-xs py-0 px-1">
                      +{subjects.length - 4}
                    </Badge>
                  )}
                </div>
              )}

              {attendance?.status && attendance.status !== 'belum_absen' && (
                <div className="mt-2 flex gap-3 text-xs">
                  {attendance.checkIn && (
                    <span className="text-muted-foreground">
                      Masuk: {new Date(attendance.checkIn.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {attendance.checkOut && (
                    <span className="text-muted-foreground">
                      Pulang: {new Date(attendance.checkOut.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-2">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(institution, assignment!);
                  }}
                  disabled={!isSelected}
                  className="w-full"
                >
                  Pilih & Presensi
                </Button>
              </div>
            </div>
          );
        })}
      </RadioGroup>

      {enrichedInstitutions.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Tidak ada institusi</p>
        </div>
      )}
    </div>
  );
};
