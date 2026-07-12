import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';
import { generateChatResponse, estimateCost } from '@/lib/ai/generators';
import { getUserTokenAccess, consumeUserToken } from '@/lib/token-system';

const prisma = new PrismaClient();

/**
 * Helper to get current user from session cookie
 */
async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('gurupro_session');

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const sessionData = JSON.parse(sessionCookie.value);
    return sessionData;
  } catch {
    return null;
  }
}

/**
 * POST /api/ai/chat
 * AI Chat Administrasi - natural language interface for teacher tasks
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const body = await request.json();

    // Token check
    const tokenAccess = await getUserTokenAccess(userId);
    if (!tokenAccess.access.allowed) {
      return NextResponse.json({
        error: 'Token habis atau langganan expired',
        reason: tokenAccess.access.reason,
        remainingTokens: 0,
      }, { status: 403 });
    }

    const { message, session_id } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get user context
    const userData = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        nama_lengkap: true,
        nama_sekolah: true,
      },
    });

    // Get chat history for context
    const chatSessionId = session_id || `chat-${Date.now()}`;
    const chatHistory = await prisma.ai_chat_logs.findMany({
      where: {
        user_id: userId,
        session_id: chatSessionId,
      },
      orderBy: {
        created_at: 'asc',
      },
      take: 10,
    });

    // Get pending tasks for context
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pendingTasks = await prisma.admin_tasks.findMany({
      where: {
        user_id: userId,
        status: 'pending',
        due_date: {
          lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        task_title: true,
        task_type: true,
        due_date: true,
      },
    });

    // Generate response
    const result = await generateChatResponse({
      userMessage: message,
      context: {
        nama_guru: userData?.nama_lengkap || 'Guru',
        jenjang: 'SMA',
        hari_ini_tanggal: new Date().toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        tugas_pending: pendingTasks.map(t => `${t.task_title} (${t.task_type})`),
      },
      chatHistory: chatHistory.map(h => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content,
      })),
    });

    // Save chat to database
    await prisma.ai_chat_logs.create({
      data: {
        user_id: userId,
        session_id: chatSessionId,
        role: 'user',
        content: message,
      },
    });

    if (result.success && result.data?.response) {
      await prisma.ai_chat_logs.create({
        data: {
          user_id: userId,
          session_id: chatSessionId,
          role: 'assistant',
          content: result.data.response,
          action_type: result.data.action?.type || null,
          action_data: result.data.action?.data ? JSON.stringify(result.data.action.data) : undefined,
        },
      });
    }

    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Gagal mendapatkan respons AI',
      }, { status: 500 });
    }

    // Calculate cost
    const cost = result.usage ? estimateCost(result.usage) : { totalCost: 0 };

    // Consume token
    await consumeUserToken(userId, 1);

    return NextResponse.json({
      success: true,
      response: result.data?.response || 'Maaf, saya tidak bisa memproses permintaan Anda saat ini.',
      session_id: chatSessionId,
      action: result.data?.action || null,
      suggestions: result.data?.suggestions || [],
      cost,
    });
  } catch (error: any) {
    console.error('Error in AI chat:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/chat
 * Get chat history
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const { searchParams } = new URL(request.url);
    const session_id = searchParams.get('session_id');

    const whereClause: any = { user_id: userId };
    if (session_id) {
      whereClause.session_id = session_id;
    }

    const chats = await prisma.ai_chat_logs.findMany({
      where: whereClause,
      orderBy: { created_at: 'asc' },
    });

    // Get unique sessions
    const sessions = [...new Set(chats.map(c => c.session_id))];

    return NextResponse.json({
      success: true,
      chats,
      sessions,
    });
  } catch (error: any) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai/chat
 * Clear chat history
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const { searchParams } = new URL(request.url);
    const session_id = searchParams.get('session_id');

    if (session_id) {
      await prisma.ai_chat_logs.deleteMany({
        where: {
          user_id: userId,
          session_id,
        },
      });
    } else {
      await prisma.ai_chat_logs.deleteMany({
        where: { user_id: userId },
      });
    }

    return NextResponse.json({
      success: true,
      message: session_id ? 'Chat session deleted' : 'All chat history deleted',
    });
  } catch (error: any) {
    console.error('Error deleting chat:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}