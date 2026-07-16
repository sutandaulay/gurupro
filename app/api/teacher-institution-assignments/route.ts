import { NextRequest } from 'next/server';
import { getPayload as getPayloadClient } from 'payload';
import config from '@payload-config';

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayloadClient({ config });
    
    // Ambil token dari header Authorization
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split(' ')[1]; // Bearer TOKEN
    
    // Verifikasi session
    const user = await payload.auth({ token });
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ambil assignment berdasarkan teacherId (user yang sedang login)
    const { docs: assignments } = await payload.find({
      collection: 'teacher-institution-assignments',
      where: {
        teacherId: {
          equals: user.id
        }
      },
      limit: 50,
      depth: 0
    });

    // Format data untuk frontend
    const formattedAssignments = assignments.map((assign: any) => ({
      id: assign.id,
      institutionId: assign.institutionId,
      subjectIds: assign.subjectIds || [],
      weeklySchedule: assign.weeklySchedule,
      status: assign.status
    }));

    return Response.json(formattedAssignments);
  } catch (error: any) {
    console.error('Error fetching teacher institution assignments:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}