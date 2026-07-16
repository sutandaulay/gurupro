'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, MapPinOff, Navigation, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Institution {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
  attendanceSettings: {
    attendanceRadiusMeters: number;
  };
}

interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface GeoValidationBadgeProps {
  location: Location | null;
  institution: Institution;
  onLocationUpdate: () => void;
}

export const GeoValidationBadge = ({ 
  location, 
  institution, 
  onLocationUpdate 
}: GeoValidationBadgeProps) => {
  const [isUpdating, setIsUpdating] = useState(false);

  // Fungsi untuk menghitung jarak antara dua titik
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // meter
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // meter
  };

  // Mendapatkan status validasi lokasi
  const getLocationStatus = () => {
    if (!location) {
      return {
        status: 'unknown',
        message: 'Lokasi belum diperoleh',
        icon: <MapPinOff className="h-4 w-4" />,
        variant: 'outline' as const
      };
    }

    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      institution.location.latitude,
      institution.location.longitude
    );

    if (distance <= institution.attendanceSettings.attendanceRadiusMeters) {
      return {
        status: 'valid',
        message: `Dalam radius (±${Math.round(distance)}m)`,
        icon: <MapPin className="h-4 w-4 text-green-500" />,
        variant: 'default' as const
      };
    } else {
      return {
        status: 'invalid',
        message: `Diluar radius (${Math.round(distance)}m dari institusi)`,
        icon: <MapPin className="h-4 w-4 text-red-500" />,
        variant: 'destructive' as const
      };
    }
  };

  const status = getLocationStatus();
  const lowAccuracyWarning = !!location && location.accuracy > 50;

  const handleLocationUpdate = async () => {
    setIsUpdating(true);
    try {
      await onLocationUpdate();
    } catch (error) {
      console.error('Error updating location:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Validasi Lokasi
        </CardTitle>
        <CardDescription>
          Presensi hanya valid dalam radius {institution.attendanceSettings.attendanceRadiusMeters}m dari institusi
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Badge 
              variant={status.variant}
              className="flex items-center gap-2 px-3 py-2"
            >
              {status.icon}
              {status.message}
            </Badge>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleLocationUpdate}
              disabled={isUpdating}
              className="flex items-center gap-2"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Memperbarui...
                </>
              ) : (
                <>
                  <Navigation className="h-4 w-4" />
                  Perbarui Lokasi
                </>
              )}
            </Button>
          </div>
          
          {location && (
            <div className="text-sm space-y-1">
              <p><strong>Lokasi Anda:</strong> {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
              <p><strong>Akurasi:</strong> ±{location.accuracy.toFixed(2)} meter</p>
              <p><strong>Lokasi Institusi:</strong> {institution.location.latitude.toFixed(6)}, {institution.location.longitude.toFixed(6)}</p>
              <p><strong>Radius Presensi:</strong> {institution.attendanceSettings.attendanceRadiusMeters} meter</p>
            </div>
          )}
          
          {lowAccuracyWarning && (
            <Alert>
              <AlertDescription>
                <p className="font-semibold">Peringatan Akurasi Lokasi Rendah</p>
                <p className="text-sm mt-1">
                  Akurasi GPS Anda saat ini ({location?.accuracy.toFixed(2)}m) lebih besar dari 50m, 
                  mungkin karena berada di dalam gedung atau kondisi sinyal buruk. 
                  Presensi tetap dapat diproses namun mungkin akan ditandai untuk review lebih lanjut.
                </p>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};