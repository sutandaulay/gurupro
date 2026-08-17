'use client';
import { apiFetch } from "@/lib/api-client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

interface LeaveRequest {
  id?: string;
  type: 'sakit' | 'izin' | 'cuti';
  startDate: Date;
  endDate: Date;
  reason: string;
  attachmentUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
}

export default function LeaveRequestPage() {
  const { data: session } = useSession();
  const [formData, setFormData] = useState<Omit<LeaveRequest, 'id' | 'status' | 'approvedBy' | 'approvedAt'>>({
    type: 'izin',
    startDate: new Date(),
    endDate: new Date(),
    reason: '',
    attachmentUrl: undefined,
  });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validasi form
      if (!formData.reason || formData.reason.trim().length < 10) {
        throw new Error('Alasan harus diisi minimal 10 karakter');
      }

      if (formData.startDate > formData.endDate) {
        throw new Error('Tanggal mulai tidak boleh setelah tanggal selesai');
      }

      // Siapkan data untuk dikirim
      const submitData = {
        ...formData,
        startDate: formData.startDate.toISOString(),
        endDate: formData.endDate.toISOString(),
      };

      // Dalam implementasi nyata, ini akan mengunggah file lampiran terlebih dahulu
      if (file) {
        // Di sini Anda akan mengunggah file dan mendapatkan URL
        // Untuk simulasi, kita abaikan bagian unggah file
        console.log('File akan diunggah:', file.name);
      }

      // Kirim permintaan ke API
      const response = await apiFetch('/api/leave-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Gagal mengirim permintaan izin');
      }

      toast.success('Permintaan izin berhasil diajukan');
      setSubmitted(true);
      // Reset form setelah submit sukses
      setFormData({
        type: 'izin',
        startDate: new Date(),
        endDate: new Date(),
        reason: '',
        attachmentUrl: undefined,
      });
      setFile(null);
    } catch (err: any) {
      console.error('Error submitting leave request:', err);
      setError(err.message);
      toast.error(err.message || 'Gagal mengirim permintaan izin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-6 w-6" />
            Ajukan Izin/Cuti
          </CardTitle>
          <CardDescription>
            Ajukan izin sakit, izin pribadi, atau cuti sesuai kebutuhan
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {submitted ? (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Permintaan Terkirim!</h3>
              <p className="text-muted-foreground">
                Permintaan izin Anda telah diajukan dan sedang menunggu persetujuan.
              </p>
              <Button 
                className="mt-6"
                onClick={() => setSubmitted(false)}
              >
                Ajukan Lagi
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="type">Jenis Permintaan *</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value: 'sakit' | 'izin' | 'cuti') => handleInputChange('type', value)}
                >
                  <SelectTrigger className="bg-neutral-50 border-slate-200 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sakit">Sakit</SelectItem>
                    <SelectItem value="izin">Izin Pribadi</SelectItem>
                    <SelectItem value="cuti">Cuti</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tanggal Mulai *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal bg-neutral-50 border-slate-200 shadow-sm"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.startDate ? format(formData.startDate, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        weekStartsOn={0}
                        selected={formData.startDate}
                        onSelect={(date) => date && handleInputChange('startDate', date)}
                        locale={id}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Tanggal Selesai *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal bg-neutral-50 border-slate-200 shadow-sm"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.endDate ? format(formData.endDate, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        weekStartsOn={0}
                        selected={formData.endDate}
                        onSelect={(date) => date && handleInputChange('endDate', date)}
                        locale={id}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Alasan *</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => handleInputChange('reason', e.target.value)}
                  placeholder="Jelaskan alasan Anda mengajukan izin..."
                  rows={4}
                  className="bg-neutral-50 border-slate-200 shadow-sm"
                />
                <p className="text-sm text-muted-foreground">
                  Minimal 10 karakter
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="attachment">Lampiran (Opsional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="attachment"
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="bg-neutral-50 border-slate-200 shadow-sm"
                  />
                  <Button type="button" variant="outline" size="icon">
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload surat dokter (izin sakit) atau dokumen pendukung lainnya
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => {
                    setFormData({
                      type: 'izin',
                      startDate: new Date(),
                      endDate: new Date(),
                      reason: '',
                      attachmentUrl: undefined,
                    });
                    setFile(null);
                  }}
                >
                  Batal
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading}
                >
                  {loading ? 'Mengirim...' : 'Ajukan Izin'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}