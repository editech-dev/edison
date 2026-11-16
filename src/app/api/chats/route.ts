
import { NextResponse } from 'next/server';
import { listChats } from '@/app/utils/redis';
import { isAdminRequest } from '@/app/utils/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const chats = await listChats();
    return NextResponse.json({ chats });
  } catch (error) {
    console.error('Error fetching chat list:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
