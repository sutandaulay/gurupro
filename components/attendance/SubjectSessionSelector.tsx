'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BookOpen, Clock, Users, Plus, X, Play, Edit3 } from 'lucide-react';

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
  classId?: string;
  roomName?: string;
}

export interface ClassInfo {
  id: string;
  name: string;
  grade?: string;
}

export interface SubjectSessionSelectorProps {
  subjects: Subject[];
  sessions: TeachingSession[];
  institutionId: string;
  onSessionUpdate: (session: TeachingSession) => void;
  onStartTeaching: (session: TeachingSession) => void;
  onStartAllSessions: () => void;
  activeSessions: TeachingSession[];
  isLoading?: boolean;
}

export const SubjectSessionSelector = ({
  subjects,
  sessions,
  institutionId,
  onSessionUpdate,
  onStartTeaching,
  onStartAllSessions,
  activeSessions,
  isLoading = false,
}: SubjectSessionSelectorProps) => {
  const [editingSession, setEditingSession] = useState<TeachingSession | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [customSession, setCustomSession] = useState({
    subjectId: '',
    startTime: '',
    endTime: '',
    className: '',
  });

  // Check if session is active
  const isSessionActive = (sessionId: string) => {
    return activeSessions.some((s) => s.id === sessionId);
  };

  // Handle edit session
  const handleEditSession = (session: TeachingSession) => {
    setEditingSession({ ...session });
  };

  // Save edited session
  const handleSaveEdit = () => {
    if (editingSession) {
      const subject = subjects.find((s) => s.id === editingSession.subjectId);
      onSessionUpdate({
        ...editingSession,
        subjectName: subject?.nama_mapel || editingSession.subjectName,
      });
      setEditingSession(null);
    }
  };

  // Handle add custom session
  const handleAddSession = () => {
    if (customSession.subjectId && customSession.startTime && customSession.endTime) {
      const subject = subjects.find((s) => s.id === customSession.subjectId);
      const newSession: TeachingSession = {
        id: `custom_${Date.now()}`,
        subjectId: customSession.subjectId,
        subjectName: subject?.nama_mapel || 'Unknown',
        startTime: customSession.startTime,
        endTime: customSession.endTime,
        className: customSession.className || undefined,
      };
      onSessionUpdate(newSession);
      setCustomSession({ subjectId: '', startTime: '', endTime: '', className: '' });
      setShowAddDialog(false);
    }
  };

  // Group sessions by time period
  const groupedSessions = sessions.reduce((acc, session) => {
    const key = `${session.startTime}-${session.endTime}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(session);
    return acc;
  }, {} as { [key: string]: TeachingSession[] });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-violet-600" />
          Sesi Mengajar
        </CardTitle>
        <CardDescription>
          Pilih dan kelola sesi mengajar Anda hari ini
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sessions by Time Period */}
        {Object.entries(groupedSessions).map(([timeKey, timeSessions]) => (
          <div key={timeKey} className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-600" />
                <span className="font-medium text-gray-700">{timeKey}</span>
              </div>
              <Badge variant="secondary">
                {timeSessions.length} sesi
              </Badge>
            </div>
            <div className="divide-y">
              {timeSessions.map((session) => {
                const isActive = isSessionActive(session.id);
                return (
                  <div
                    key={session.id}
                    className={`p-4 flex items-center gap-4 ${
                      isActive ? 'bg-green-50' : ''
                    }`}
                  >
                    {/* Subject Info */}
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-violet-500" />
                        {session.subjectName}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        {session.className && (
                          <>
                            <Users className="h-3 w-3" />
                            {session.className}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <Badge className="bg-green-500">Sedang Mengajar</Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => onStartTeaching(session)}
                          disabled={isLoading}
                          className="flex items-center gap-1"
                        >
                          <Play className="h-3 w-3" />
                          Mulai
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditSession(session)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Empty State */}
        {sessions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Tidak ada sesi mengajar terjadwal</p>
          </div>
        )}

        {/* Add Custom Session */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Tambah Sesi Manual
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Sesi Mengajar</DialogTitle>
              <DialogDescription>
                Tambahkan sesi mengajar di luar jadwal reguler
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Mata Pelajaran</Label>
                <Select
                  value={customSession.subjectId}
                  onValueChange={(value) =>
                    setCustomSession((prev) => ({ ...prev, subjectId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih mata pelajaran" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.nama_mapel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Jam Mulai</Label>
                  <Input
                    type="time"
                    value={customSession.startTime}
                    onChange={(e) =>
                      setCustomSession((prev) => ({
                        ...prev,
                        startTime: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Jam Selesai</Label>
                  <Input
                    type="time"
                    value={customSession.endTime}
                    onChange={(e) =>
                      setCustomSession((prev) => ({
                        ...prev,
                        endTime: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Kelas (Opsional)</Label>
                <Input
                  placeholder="Contoh: X IPA 1"
                  value={customSession.className}
                  onChange={(e) =>
                    setCustomSession((prev) => ({
                      ...prev,
                      className: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleAddSession} className="flex-1">
                  Tambah
                </Button>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Batal
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Actions */}
        {sessions.length > 1 && (
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={onStartAllSessions}
              disabled={isLoading || activeSessions.length === sessions.length}
              className="flex-1"
              variant="default"
            >
              <Play className="h-4 w-4 mr-2" />
              Mulai Semua Sesi
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
