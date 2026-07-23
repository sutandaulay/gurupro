'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Clock,
  BookOpen,
  Calendar,
  MapPin,
  Users,
  ChevronRight,
  Play,
  CheckCircle2,
} from 'lucide-react';

export interface Subject {
  id: string;
  nama_mapel: string;
  kode_mapel?: string;
}

export interface TeachingSession {
  id: string;
  subjectId: string;
  subjectName: string;
  startTime: string;
  endTime: string;
  className?: string;
  roomName?: string;
  isSelected?: boolean;
}

export interface ScheduleSelectorProps {
  subjects: Subject[];
  todaySchedule: string[];
  institutionName: string;
  onConfirm: (sessions: TeachingSession[], checkInNow: boolean) => void;
  onSkip: () => void;
  isLoading?: boolean;
}

export const ScheduleSelector = ({
  subjects,
  todaySchedule,
  institutionName,
  onConfirm,
  onSkip,
  isLoading = false,
}: ScheduleSelectorProps) => {
  const [selectedSessions, setSelectedSessions] = useState<TeachingSession[]>([]);
  const [checkInNow, setCheckInNow] = useState(true);
  const [showCustomDialog, setShowCustomDialog] = useState(false);

  // Parse time slots from schedule (format: "08:00-10:00" or "08:00")
  const parseTimeSlots = (schedule: string[]): { start: string; end: string }[] => {
    return schedule.map((slot) => {
      if (slot.includes('-')) {
        const [start, end] = slot.split('-');
        return { start: start.trim(), end: end.trim() };
      }
      // If no end time specified, default to 2 hours
      return { start: slot.trim(), end: `${parseInt(slot.split(':')[0]) + 2}:${slot.split(':')[1]}` };
    });
  };

  const timeSlots = parseTimeSlots(todaySchedule);

  // Auto-generate sessions based on schedule and subjects
  const generateDefaultSessions = (): TeachingSession[] => {
    const sessions: TeachingSession[] = [];

    // If no subjects, create generic sessions
    if (subjects.length === 0) {
      timeSlots.forEach((slot, index) => {
        sessions.push({
          id: `session_${index}`,
          subjectId: 'general',
          subjectName: `Sesi Mengajar ${index + 1}`,
          startTime: slot.start,
          endTime: slot.end,
        });
      });
      return sessions;
    }

    // Distribute subjects across time slots
    timeSlots.forEach((slot, slotIndex) => {
      // For each time slot, assign subjects
      const subjectsPerSlot = Math.ceil(subjects.length / timeSlots.length);
      const startIdx = slotIndex * subjectsPerSlot;
      const endIdx = Math.min(startIdx + subjectsPerSlot, subjects.length);

      for (let i = startIdx; i < endIdx; i++) {
        sessions.push({
          id: `session_${slotIndex}_${i}`,
          subjectId: subjects[i].id,
          subjectName: subjects[i].nama_mapel,
          startTime: slot.start,
          endTime: slot.end,
        });
      }
    });

    return sessions;
  };

  const defaultSessions = generateDefaultSessions();

  // Toggle session selection
  const toggleSession = (session: TeachingSession) => {
    setSelectedSessions((prev) => {
      const exists = prev.find((s) => s.id === session.id);
      if (exists) {
        return prev.filter((s) => s.id !== session.id);
      }
      return [...prev, { ...session, isSelected: true }];
    });
  };

  // Handle confirm
  const handleConfirm = () => {
    if (checkInNow) {
      onConfirm(selectedSessions.length > 0 ? selectedSessions : defaultSessions, true);
    } else {
      onSkip();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-violet-600" />
          Jadwal Mengajar Hari Ini
        </CardTitle>
        <CardDescription>
          {institutionName} • {new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Working Hours Summary */}
        <div className="bg-violet-50 rounded-lg p-4 border border-violet-100">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-violet-600" />
            <span className="font-semibold text-violet-900">Jam Kerja</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-violet-700">
            {timeSlots.length > 0 ? (
              timeSlots.map((slot, idx) => (
                <Badge key={idx} variant="secondary" className="px-3 py-1">
                  {slot.start} - {slot.end}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">Tidak ada jadwal hari ini</span>
            )}
          </div>
        </div>

        {/* Subjects Info */}
        {subjects.length > 0 && (
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Mata Pelajaran ({subjects.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {subjects.map((subject) => (
                <Badge key={subject.id} variant="outline" className="px-2 py-1">
                  {subject.nama_mapel}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Teaching Sessions Preview */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Sesi Mengajar Hari Ini ({defaultSessions.length})
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {defaultSessions.map((session, idx) => (
              <div
                key={session.id || idx}
                className="flex items-center gap-3 p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => toggleSession(session)}
              >
                <Checkbox
                  checked={selectedSessions.some((s) => s.id === session.id)}
                  onCheckedChange={() => toggleSession(session)}
                />
                <div className="flex-1">
                  <div className="font-medium">{session.subjectName}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    {session.startTime} - {session.endTime}
                    {session.className && (
                      <>
                        <span>•</span>
                        <span>{session.className}</span>
                      </>
                    )}
                    {session.roomName && (
                      <>
                        <span>•</span>
                        <span>{session.roomName}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-green-50 border-green-200">
            <Checkbox
              id="checkin_now"
              checked={checkInNow}
              onCheckedChange={(checked) => setCheckInNow(checked as boolean)}
            />
            <Label htmlFor="checkin_now" className="flex-1 cursor-pointer">
              <div className="font-medium text-green-900">Check-in Sekarang</div>
              <div className="text-sm text-green-700">
                Langsung presensi masuk dan mulai sesi mengajar
              </div>
            </Label>
          </div>

          {!checkInNow && (
            <div className="p-3 rounded-lg border bg-amber-50 border-amber-200">
              <p className="text-sm text-amber-800">
                Jika Anda memilih untuk tidak check-in sekarang, Anda dapat melakukan
                check-in nanti atau melaporkan ketidakhadiran melalui menu "Pengajuan Izin".
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handleConfirm}
            disabled={isLoading || (checkInNow && timeSlots.length === 0)}
            className="flex-1"
            variant={checkInNow ? 'default' : 'outline'}
          >
            {isLoading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Memproses...
              </>
            ) : checkInNow ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {selectedSessions.length > 0
                  ? `Mulai ${selectedSessions.length} Sesi`
                  : 'Check-in Sekarang'}
              </>
            ) : (
              <>
                <ChevronRight className="h-4 w-4 mr-2" />
                Lewati
              </>
            )}
          </Button>

          <Button variant="ghost" onClick={onSkip} disabled={isLoading}>
            Batal
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
