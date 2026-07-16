'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Building, Calendar, Clock } from 'lucide-react';

interface Institution {
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

interface Assignment {
  id: string;
  institutionId: string;
  subjectIds: string[];
  weeklySchedule: any;
  status: 'aktif' | 'nonaktif';
}

interface InstitutionSelectorProps {
  institutions: Institution[];
  assignments: Assignment[];
  onSelect: (institution: Institution) => void;
}

export const InstitutionSelector = ({ 
  institutions, 
  assignments,
  onSelect 
}: InstitutionSelectorProps) => {
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string | undefined>(undefined);

  const handleSelect = () => {
    if (!selectedInstitutionId) return;
    
    const institution = institutions.find(inst => inst.id === selectedInstitutionId);
    if (institution) {
      onSelect(institution);
    }
  };

  // Fungsi untuk mendapatkan informasi jadwal dari assignment
  const getScheduleInfo = (institutionId: string) => {
    const assignment = assignments.find(a => a.institutionId === institutionId);
    if (!assignment || !assignment.weeklySchedule) return null;
    
    // Contoh parsing jadwal - ini akan disesuaikan dengan struktur sebenarnya
    const today = new Date().getDay(); // 0 = Minggu, 1 = Senin, dst
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const currentDay = dayNames[today];
    
    // Dalam implementasi nyata, ini akan mengakses struktur weeklySchedule yang sebenarnya
    return {
      day: currentDay,
      scheduleCount: 0 // Placeholder - akan diisi dengan jumlah jadwal hari ini
    };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Pilih Institusi
        </CardTitle>
        <CardDescription>
          Anda mengajar di lebih dari satu institusi. Pilih institusi tempat Anda akan presensi hari ini.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <RadioGroup 
          value={selectedInstitutionId} 
          onValueChange={setSelectedInstitutionId}
          className="space-y-4"
        >
          {institutions.map((institution) => {
            const scheduleInfo = getScheduleInfo(institution.id);
            const assignment = assignments.find(a => a.institutionId === institution.id);
            
            return (
              <div 
                key={institution.id} 
                className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer"
                onClick={() => setSelectedInstitutionId(institution.id)}
              >
                <RadioGroupItem 
                  value={institution.id} 
                  id={institution.id} 
                  className="mt-0.5"
                />
                <div className="space-y-2 flex-1">
                  <Label htmlFor={institution.id} className="text-base font-semibold">
                    {institution.name}
                  </Label>
                  
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {scheduleInfo 
                          ? `${scheduleInfo.scheduleCount} jadwal hari ini` 
                          : 'Tidak ada jadwal hari ini'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>Radius: {institution.attendanceSettings.attendanceRadiusMeters}m</span>
                    </div>
                    
                    {institution.attendanceSettings.qrCodeEnabled && (
                      <Badge variant="secondary">QR Code Aktif</Badge>
                    )}
                    
                    {assignment?.status !== 'aktif' && (
                      <Badge variant="outline">Tidak Aktif</Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </RadioGroup>
        
        <div className="mt-6 flex justify-end">
          <Button 
            onClick={handleSelect} 
            disabled={!selectedInstitutionId}
            className="flex items-center gap-2"
          >
            <Building className="h-4 w-4" />
            Pilih Institusi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};