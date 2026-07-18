
import { NextResponse } from 'next/server';
import { getChat } from '@/app/utils/redis';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminToken = process.env.ADMIN_API_TOKEN;
    const authHeader = req.headers.get('authorization');
    
    if (adminToken && authHeader !== `Bearer ${adminToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const chat = await getChat(id);
    if (!chat) {
        return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    return NextResponse.json(chat);
  } catch (error) {
    console.error('Error fetching chat:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
